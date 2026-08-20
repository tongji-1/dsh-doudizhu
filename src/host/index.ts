/**
 * Host half of dsh-doudizhu: a single loopback route that turns one bot turn
 * into one model call. The browser owns the rules and only ever posts moves it
 * has already proven legal; this side owns the prompt, the model route, and
 * the answer bounds, so the endpoint cannot be used as a free-form model proxy.
 */

import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Context } from '@deepseek-ai/cordis'
// Type-only: these merge `ctx.llm` and `ctx.webServer` into the Context above.
import type { GenerateOptions, Message, StreamChunk } from '@deepseek-ai/dsh-llm'
import type {} from '@deepseek-ai/dsh-host-webserver'
import { AI_ROUTE, parseChoice, renderPrompt, type AiRequest, type AiResponse } from '../shared/protocol.ts'

export const name = 'dsh-doudizhu'
export const inject = ['webServer', 'llm']

/** Host configuration, all optional; every field has a working default. */
export interface Config {
  /** Registered provider route; defaults to the first DeepSeek route present. */
  provider?: string
  /** Exact model id; defaults to the provider's first advertised model. */
  model?: string
  /** Output cap for one decision — the answer is a single small JSON object. */
  maxTokens?: number
  temperature?: number
  /**
   * Reasoning level for a bot turn. `off` is the default on purpose: a card
   * decision is a small structured answer, and leaving thinking on spends the
   * whole output budget on reasoning tokens before the JSON is ever emitted.
   */
  reasoningEffort?: 'off' | 'high' | 'max'
  /** Wall clock a decision may take before the browser falls back locally. */
  timeoutMs?: number
}

interface ResolvedConfig {
  readonly provider: string | undefined
  readonly model: string | undefined
  readonly maxTokens: number
  readonly temperature: number
  readonly reasoningEffort: 'off' | 'high' | 'max'
  readonly timeoutMs: number
}

const MAX_BODY_BYTES = 32_768
const MAX_CANDIDATES = 48
const MAX_HISTORY = 10

function resolveConfig(config: Config | undefined): ResolvedConfig {
  const maxTokens = Number(config?.maxTokens)
  const temperature = Number(config?.temperature)
  const timeoutMs = Number(config?.timeoutMs)
  return {
    provider: typeof config?.provider === 'string' && config.provider !== '' ? config.provider : undefined,
    model: typeof config?.model === 'string' && config.model !== '' ? config.model : undefined,
    maxTokens: Number.isFinite(maxTokens) && maxTokens > 0 ? Math.floor(maxTokens) : 160,
    temperature: Number.isFinite(temperature) && temperature >= 0 ? temperature : 0.7,
    reasoningEffort: config?.reasoningEffort === 'high' || config?.reasoningEffort === 'max'
      ? config.reasoningEffort
      : 'off',
    timeoutMs: Number.isFinite(timeoutMs) && timeoutMs > 0 ? Math.floor(timeoutMs) : 12_000,
  }
}

/** Loopback-only fence, mirroring the trust rules the /api bridge applies. */
function isLocalRequest(req: IncomingMessage): boolean {
  const host = req.headers.host
  if (typeof host !== 'string') return false
  let hostname: string
  try {
    hostname = new URL(`http://${host}`).hostname
  } catch {
    return false
  }
  const loopback = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]'
    || hostname === '::1' || hostname.endsWith('.localhost') || /^127\./.test(hostname)
  if (!loopback) return false
  if (req.headers['sec-fetch-site'] === 'cross-site') return false
  const origin = req.headers.origin
  if (typeof origin !== 'string') return true
  try {
    return new URL(origin).host === new URL(`http://${host}`).host
  } catch {
    return false
  }
}

async function readBody(req: IncomingMessage): Promise<string | undefined> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of req) {
    const buffer = chunk as Buffer
    size += buffer.length
    if (size > MAX_BODY_BYTES) return undefined
    chunks.push(buffer)
  }
  return Buffer.concat(chunks).toString('utf8')
}

function text(value: unknown, limit: number): string {
  return typeof value === 'string' ? value.slice(0, limit) : ''
}

/** Accept only the shape the prompt renderer reads, clamped to safe bounds. */
function sanitize(raw: unknown): AiRequest | undefined {
  if (typeof raw !== 'object' || raw === null) return undefined
  const input = raw as Record<string, unknown>
  const phase = input.phase === 'robbing' || input.phase === 'playing' ? input.phase : undefined
  if (phase === undefined) return undefined
  if (!Array.isArray(input.candidates) || input.candidates.length === 0) return undefined
  const candidates = input.candidates.slice(0, MAX_CANDIDATES).map((entry) => {
    const candidate = (typeof entry === 'object' && entry !== null ? entry : {}) as Record<string, unknown>
    return { label: text(candidate.label, 40), detail: text(candidate.detail, 60) }
  })
  const opponents = Array.isArray(input.opponents)
    ? input.opponents.slice(0, 2).map((entry) => {
      const opponent = (typeof entry === 'object' && entry !== null ? entry : {}) as Record<string, unknown>
      return {
        name: text(opponent.name, 16),
        role: text(opponent.role, 16),
        cards: Number.isFinite(Number(opponent.cards)) ? Math.max(0, Math.floor(Number(opponent.cards))) : 0,
        tokens: Number.isFinite(Number(opponent.tokens)) ? Math.max(0, Math.floor(Number(opponent.tokens))) : 0,
        teammate: opponent.teammate === true,
      }
    })
    : []
  const history = Array.isArray(input.history)
    ? input.history.slice(-MAX_HISTORY).map(entry => text(entry, 60))
    : []
  const dialogue = Array.isArray(input.dialogue)
    ? input.dialogue.slice(-6).map((entry) => {
      const line = (typeof entry === 'object' && entry !== null ? entry : {}) as Record<string, unknown>
      return { seatName: text(line.seatName, 16), text: text(line.text, 40) }
    }).filter(line => line.text !== '')
    : []
  const bottom = typeof input.bottom === 'string' ? text(input.bottom, 24) : undefined
  const required = typeof input.required === 'string' ? text(input.required, 40) : undefined
  const requiredFrom = typeof input.requiredFrom === 'string' ? text(input.requiredFrom, 16) : undefined
  return {
    phase,
    seatName: text(input.seatName, 16) || '玩家',
    persona: text(input.persona, 60),
    role: text(input.role, 16),
    hand: text(input.hand, 120),
    handCount: Number.isFinite(Number(input.handCount)) ? Math.max(0, Math.floor(Number(input.handCount))) : 0,
    tokens: Number.isFinite(Number(input.tokens)) ? Math.max(0, Math.floor(Number(input.tokens))) : 0,
    startingTokens: Number.isFinite(Number(input.startingTokens)) ? Math.max(1, Math.floor(Number(input.startingTokens))) : 100,
    stackPosture: input.stackPosture === 'catch-up' || input.stackPosture === 'protect' ? input.stackPosture : 'balanced',
    potentialLoss: Number.isFinite(Number(input.potentialLoss)) ? Math.max(0, Math.floor(Number(input.potentialLoss))) : 0,
    ...typeof input.candidateLandlord === 'string' ? { candidateLandlord: text(input.candidateLandlord, 16) } : {},
    priorityPlayer: text(input.priorityPlayer, 16),
    ...typeof input.firstClaimant === 'string' ? { firstClaimant: text(input.firstClaimant, 16) } : {},
    robCount: Number.isFinite(Number(input.robCount)) ? Math.max(0, Math.min(3, Math.floor(Number(input.robCount)))) : 0,
    counterRob: input.counterRob === true,
    ...bottom === undefined ? {} : { bottom },
    opponents,
    ...required === undefined ? {} : { required },
    ...requiredFrom === undefined ? {} : { requiredFrom },
    requiredIsTeammate: input.requiredIsTeammate === true,
    baseScore: Number.isFinite(Number(input.baseScore)) ? Number(input.baseScore) : 1,
    multiplier: Number.isFinite(Number(input.multiplier)) ? Number(input.multiplier) : 1,
    history,
    dialogue,
    candidates,
    canPass: input.canPass === true,
  }
}

function send(res: ServerResponse, status: number, body: AiResponse): void {
  const payload = JSON.stringify(body)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(payload),
    'cache-control': 'no-store',
  })
  res.end(payload)
}

/** Collect one model answer as plain text, or throw with the adapter's failure. */
async function collectText(stream: AsyncIterable<StreamChunk>): Promise<string> {
  let answer = ''
  for await (const chunk of stream) {
    if (chunk.type === 'text-delta') answer += chunk.text
    if (chunk.type === 'finish' && (chunk.reason.kind === 'error' || chunk.reason.kind === 'aborted')) {
      throw new Error(chunk.reason.failure.message)
    }
  }
  return answer
}

/**
 * Mount the decision route.
 * @param ctx - the plugin fiber, with the web server and model runtime injected.
 * @param config - optional provider, model, and budget overrides.
 */
export function apply(ctx: Context, config?: Config): void {
  const settings = resolveConfig(config)
  let route: { provider: string; model: string } | undefined

  const resolveRoute = async (): Promise<{ provider: string; model: string }> => {
    if (route !== undefined) return route
    const providers = ctx.llm.listProviders()
    if (providers.length === 0) throw new Error('no model provider is registered')
    const provider = settings.provider
      ?? (providers.find(entry => entry.id.includes('deepseek')) ?? providers[0] as { id: string }).id
    let model = settings.model
    if (model === undefined) {
      const models = await ctx.llm.listModels(provider)
      if (models.length === 0) throw new Error(`provider "${provider}" advertises no model`)
      model = (models.find(entry => entry.id.includes('flash')) ?? models[0] as { id: string }).id
    }
    route = { provider, model }
    return route
  }

  const decide = async (request: AiRequest): Promise<AiResponse> => {
    const { provider, model } = await resolveRoute()
    const { system, user } = renderPrompt(request)
    const controller = new AbortController()
    const timer = setTimeout(() => { controller.abort() }, settings.timeoutMs)
    try {
      const messages = [{
        id: crypto.randomUUID(),
        role: 'user',
        content: [{ type: 'text', text: user }],
        source: { kind: 'user' },
      }] as unknown as Message[]
      const options: GenerateOptions = {
        provider,
        model,
        system,
        messages,
        reasoningEffort: settings.reasoningEffort as NonNullable<GenerateOptions['reasoningEffort']>,
        temperature: settings.temperature,
        maxTokens: settings.maxTokens,
        signal: controller.signal,
      }
      const answer = await collectText(ctx.llm.stream(options))
      const parsed = parseChoice(answer, request)
      if (parsed === undefined) return { ok: false, choice: -1, error: 'unparsable answer', model }
      return { ok: true, choice: parsed.choice, ...parsed.say === undefined ? {} : { say: parsed.say }, model }
    } finally {
      clearTimeout(timer)
    }
  }

  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: AI_ROUTE,
    handler: async (req, res) => {
      if (req.method !== 'POST') return send(res, 405, { ok: false, choice: -1, error: 'method not allowed' })
      if (!isLocalRequest(req)) return send(res, 403, { ok: false, choice: -1, error: 'forbidden' })
      const body = await readBody(req)
      if (body === undefined) return send(res, 413, { ok: false, choice: -1, error: 'body too large' })
      let request: AiRequest | undefined
      try {
        request = sanitize(JSON.parse(body))
      } catch {
        request = undefined
      }
      if (request === undefined) return send(res, 400, { ok: false, choice: -1, error: 'invalid request' })
      try {
        send(res, 200, await decide(request))
      } catch (error) {
        // A model failure is ordinary here: the table falls back to its local
        // bot, so the route answers 200 with `ok: false` rather than erroring.
        route = undefined
        send(res, 200, { ok: false, choice: -1, error: error instanceof Error ? error.message : 'model call failed' })
      }
    },
  }), 'dsh-doudizhu: decision route')
}
