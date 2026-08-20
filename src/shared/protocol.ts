/**
 * The wire contract between the browser table and the host's model route, plus
 * the prompt rendering and answer parsing both halves agree on. The client
 * sends only facts a seat may legally know; the host owns the prompt so the
 * route can never be driven as a general-purpose model proxy.
 */

/** Route the client posts to; registered by the host half on the web server. */
export const AI_ROUTE = '/dsh-doudizhu/api/decide'

/** One option the model may choose, already validated as legal by the client. */
export interface AiCandidate {
  /** Short action name, e.g. `顺子 3-7`, `抢地主`, or `不抢`. */
  readonly label: string
  /** Card ranks making up the play, empty for an auction action. */
  readonly detail: string
}

/** What one opponent looks like from the deciding seat's side of the table. */
export interface AiOpponent {
  readonly name: string
  readonly role: string
  readonly cards: number
  readonly tokens: number
  readonly teammate: boolean
}

export type StackPosture = 'catch-up' | 'balanced' | 'protect'

export interface AiDialogueLine {
  readonly seatName: string
  readonly text: string
}

/** A single bot turn handed to the model. */
export interface AiRequest {
  readonly phase: 'robbing' | 'playing'
  readonly seatName: string
  readonly persona: string
  readonly role: string
  /** The seat's own cards, as ranks in descending order. */
  readonly hand: string
  readonly handCount: number
  readonly tokens: number
  readonly startingTokens: number
  readonly stackPosture: StackPosture
  readonly potentialLoss: number
  readonly candidateLandlord?: string
  readonly priorityPlayer: string
  readonly firstClaimant?: string
  readonly robCount: number
  readonly counterRob: boolean
  /** Revealed bottom cards once a landlord exists. */
  readonly bottom?: string
  readonly opponents: readonly AiOpponent[]
  /** The play that must be beaten, absent when leading a trick. */
  readonly required?: string
  readonly requiredFrom?: string
  readonly requiredIsTeammate?: boolean
  readonly baseScore: number
  readonly multiplier: number
  readonly history: readonly string[]
  readonly dialogue: readonly AiDialogueLine[]
  readonly candidates: readonly AiCandidate[]
  readonly canPass: boolean
}

/** The host's answer: an index into `candidates`, or -1 for a pass. */
export interface AiResponse {
  readonly ok: boolean
  readonly choice: number
  readonly say?: string
  /** Present when the host could not reach or parse the model. */
  readonly error?: string
  readonly model?: string
}

const SYSTEM_RULES = [
  '你是斗地主牌桌上的一名玩家。',
  '牌力顺序：3 < 4 < 5 < 6 < 7 < 8 < 9 < 10 < J < Q < K < A < 2 < 小王(w) < 大王(W)。',
  '炸弹（四张同点）与王炸（双王）可以压住任何非炸弹牌型；王炸最大。',
  '农民两人是队友，目标是让任意一名农民先出完牌；地主单独一人。',
  '不要打压队友刚出的牌，除非你能一次出完手上所有牌。',
  '手牌少的对手威胁最大，必要时用大牌或炸弹压制。',
  '筹码落后时可适度提高方差争取追赶；筹码领先时避免无必要地抢地主和使用炸弹。',
  '结合最近牌桌对话自然回应，但不要重复同一句话，也不要影响合法出牌。',
].join('\n')

const OUTPUT_RULES = [
  '只能从候选列表里挑一个编号。允许不出时可以回答 -1 表示过牌。',
  '只输出一行 JSON，不要解释、不要代码块：',
  '{"i": 编号, "say": "不超过24个汉字的桌面发言，可省略"}',
].join('\n')

/**
 * Render the system and user prompts for one bot turn.
 * @param request - the deciding seat's legal view of the table.
 * @returns the two prompt halves, ready for the model call.
 */
export function renderPrompt(request: AiRequest): { system: string; user: string } {
  const lines: string[] = []
  lines.push(`你是「${request.seatName}」，身份：${request.role}。性格：${request.persona}。`)
  lines.push(`你的手牌（${request.handCount} 张）：${request.hand}`)
  const posture = request.stackPosture === 'catch-up' ? '落后追赶' : request.stackPosture === 'protect' ? '领先保守' : '均势平衡'
  lines.push(`你的筹码 ${request.tokens}/${request.startingTokens}，策略：${posture}；当前最多可能损失约 ${request.potentialLoss} 筹码。`)
  if (request.bottom !== undefined) lines.push(`底牌：${request.bottom}`)
  for (const opponent of request.opponents) {
    const side = opponent.teammate ? '队友' : '对手'
    lines.push(`${side}「${opponent.name}」（${opponent.role}）剩 ${opponent.cards} 张，筹码 ${opponent.tokens}。`)
  }
  lines.push(`底注 ${request.baseScore}，当前倍数 ${request.multiplier}。`)
  if (request.history.length > 0) lines.push(`最近出牌：\n${request.history.map(line => `- ${line}`).join('\n')}`)
  if (request.dialogue.length > 0) {
    lines.push(`最近对话：\n${request.dialogue.map(line => `- ${line.seatName}：${line.text}`).join('\n')}`)
  }
  if (request.phase === 'robbing') {
    if (request.candidateLandlord === undefined) {
      lines.push(`「${request.priorityPlayer}」拥有本轮优先选择权，目前还没有地主。`)
      lines.push('现在轮到你决定是否当地主。选择当地主时保持当前倍数，后面的玩家仍可抢地主。')
    } else {
      lines.push(`暂定地主是「${request.candidateLandlord}」，最先选择当地主的是「${request.firstClaimant ?? request.candidateLandlord}」，已经抢过 ${request.robCount} 次。`)
      lines.push(request.counterRob
        ? '现在轮到你决定是否抢回地主。抢回后当前倍数再翻一倍，你将独自承担地主的两份输赢。'
        : '现在轮到你决定是否抢地主。抢地主后当前倍数翻一倍，你将独自承担地主的两份输赢。')
    }
  } else if (request.required === undefined) {
    lines.push('现在轮到你出牌，你是本轮的先手，可以自由选择牌型。')
  } else {
    const owner = request.requiredIsTeammate === true ? '队友' : '对手'
    lines.push(`${owner}「${request.requiredFrom ?? '上家'}」出了 ${request.required}，你必须压过它或者过牌。`)
  }
  lines.push('候选：')
  for (const [index, candidate] of request.candidates.entries()) {
    const detail = candidate.detail === '' ? '' : `（${candidate.detail}）`
    lines.push(`${index}. ${candidate.label}${detail}`)
  }
  if (request.canPass) lines.push('-1. 不出')
  lines.push(OUTPUT_RULES)
  return { system: SYSTEM_RULES, user: lines.join('\n') }
}

/** Longest run of digits with an optional sign, scanned from a model answer. */
function firstInteger(text: string): number | undefined {
  const match = /-?\d+/.exec(text)
  if (match === null) return undefined
  const value = Number(match[0])
  return Number.isInteger(value) ? value : undefined
}

/**
 * Read the model's answer into a validated choice.
 * @param text - raw model output, possibly wrapped in prose or a code fence.
 * @param request - the turn the answer belongs to, for bounds checking.
 * @returns the chosen index and table talk, or undefined when unusable.
 */
export function parseChoice(text: string, request: AiRequest): { choice: number; say?: string } | undefined {
  const object = /\{[^{}]*\}/.exec(text)
  let choice: number | undefined
  let say: string | undefined
  if (object !== null) {
    try {
      const parsed = JSON.parse(object[0]) as { i?: unknown; say?: unknown }
      if (typeof parsed.i === 'number' && Number.isInteger(parsed.i)) choice = parsed.i
      if (typeof parsed.say === 'string' && parsed.say.trim() !== '') say = parsed.say.trim().slice(0, 24)
    } catch {
      // Fall through to the loose scan below.
    }
  }
  if (choice === undefined) choice = firstInteger(text)
  if (choice === undefined) return undefined
  if (choice === -1) return request.canPass ? { choice: -1, ...(say === undefined ? {} : { say }) } : undefined
  if (choice < 0 || choice >= request.candidates.length) return undefined
  return { choice, ...(say === undefined ? {} : { say }) }
}
