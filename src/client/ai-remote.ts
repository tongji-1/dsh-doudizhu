/**
 * Model-backed bot turns. The browser enumerates the legal moves, posts a
 * redacted view of the table to the host route, and maps the chosen index back
 * to real cards. Anything unexpected — no route, timeout, junk answer — falls
 * back to {@link localDecision}, so a turn never stalls the table.
 */

import { handText, type Card } from './cards.ts'
import { comboText, type Move } from './combos.ts'
import { canPass, canRob, isCounterRob, isLandlord, isLandlordChoice, legalMoves, type GameState } from './game.ts'
import { localDecision, stackPosture, type Decision } from './ai-local.ts'
import { STARTING_TOKENS } from './game.ts'
import { AI_ROUTE, type AiCandidate, type AiDialogueLine, type AiRequest, type AiResponse } from '../shared/protocol.ts'

/** Where a bot's turn came from, surfaced in the table's status line. */
export type DecisionSource = 'model' | 'local' | 'disabled'

export interface DecisionOutcome {
  readonly decision: Decision
  readonly source: DecisionSource
  readonly model?: string
  readonly error?: string
}

/** Table personality for each bot seat, sent to the model as a style hint. */
export const PERSONAS: Readonly<Record<number, string>> = {
  1: '沉稳克制，喜欢留大牌收官，不轻易动炸弹',
  2: '进攻性强，愿意早打快打，抓住机会就压',
}

const MAX_CANDIDATES = 40
const MAX_HISTORY = 8

/** Consecutive route failures after which the table stops calling the model. */
const FAILURE_BUDGET = 3
let failures = 0

/** Re-enable model calls after a settings change or a manual retry. */
export function resetRemoteFailures(): void {
  failures = 0
}

/** Whether the model path is still considered available this session. */
export function remoteAvailable(): boolean {
  return failures < FAILURE_BUDGET
}

function explosive(move: Move): boolean {
  return move.combo.kind === 'bomb' || move.combo.kind === 'rocket'
}

/**
 * Trim a long move list to something a model can read, without hiding the
 * decisions that matter: every bomb stays, and the rest is sampled evenly.
 */
export function selectCandidates(moves: readonly Move[], max = MAX_CANDIDATES): Move[] {
  if (moves.length <= max) return [...moves]
  const nuclear = moves.filter(explosive)
  const ordinary = moves.filter(move => !explosive(move))
  const room = Math.max(1, max - nuclear.length)
  const step = ordinary.length / room
  const sampled: Move[] = []
  for (let index = 0; index < room; index += 1) {
    const pick = ordinary[Math.min(ordinary.length - 1, Math.floor(index * step))]
    if (pick !== undefined && !sampled.includes(pick)) sampled.push(pick)
  }
  return [...sampled, ...nuclear]
}

function roleText(state: GameState, index: number): string {
  if (state.phase === 'robbing') {
    if (state.candidateLandlordSeat === null) return state.initialLandlordSeat === index ? '优先选择地主' : '等待选择地主'
    return state.candidateLandlordSeat === index ? '暂定地主' : '争夺地主'
  }
  if (state.landlordSeat === null) return '待定'
  return isLandlord(state, index) ? '地主' : '农民'
}

function teammate(state: GameState, left: number, right: number): boolean {
  return state.landlordSeat !== null && !isLandlord(state, left) && !isLandlord(state, right)
}

function buildRequest(state: GameState, index: number, candidates: readonly AiCandidate[], dialogue: readonly AiDialogueLine[]): AiRequest {
  const seat = state.seats[index] as { name: string; hand: readonly Card[] }
  const leader = state.leader
  const required = state.required
  return {
    phase: state.phase === 'robbing' ? 'robbing' : 'playing',
    seatName: seat.name,
    persona: PERSONAS[index] ?? '',
    role: roleText(state, index),
    hand: handText(seat.hand),
    handCount: seat.hand.length,
    tokens: state.seats[index]?.tokens ?? 0,
    startingTokens: STARTING_TOKENS,
    stackPosture: stackPosture(state, index),
    potentialLoss: state.phase === 'robbing'
      ? state.baseScore * state.multiplier * (isLandlordChoice(state) ? 1 : 2) * 2
      : state.baseScore * state.multiplier * (isLandlord(state, index) ? 2 : 1),
    ...state.candidateLandlordSeat === null ? {} : { candidateLandlord: state.seats[state.candidateLandlordSeat]?.name ?? '' },
    priorityPlayer: state.seats[state.initialLandlordSeat]?.name ?? '',
    ...state.firstClaimantSeat === null ? {} : { firstClaimant: state.seats[state.firstClaimantSeat]?.name ?? '' },
    robCount: state.robCount,
    counterRob: isCounterRob(state),
    ...state.bottomRevealed ? { bottom: handText(state.bottom) } : {},
    opponents: state.seats.flatMap((other, otherIndex) => otherIndex === index ? [] : [{
      name: other.name,
      role: roleText(state, otherIndex),
      cards: other.hand.length,
      tokens: other.tokens,
      teammate: teammate(state, index, otherIndex),
    }]),
    ...required === null ? {} : { required: comboText(required) },
    ...leader === null || leader === index ? {} : { requiredFrom: state.seats[leader]?.name ?? '' },
    requiredIsTeammate: leader !== null && leader !== index && teammate(state, index, leader),
    baseScore: state.baseScore,
    multiplier: state.multiplier,
    history: state.logs.slice(-MAX_HISTORY),
    dialogue: dialogue.slice(-6),
    candidates,
    canPass: state.phase === 'playing' && canPass(state),
  }
}

async function ask(request: AiRequest, signal: AbortSignal): Promise<AiResponse> {
  const response = await fetch(AI_ROUTE, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(request),
    signal,
  })
  if (!response.ok) throw new Error(`route answered ${response.status}`)
  return await response.json() as AiResponse
}

/**
 * Resolve one bot turn, preferring the model and falling back locally.
 * @param state - the live hand; the seat on turn must be a bot.
 * @param index - the seat to decide for.
 * @param useModel - false to skip the route entirely (offline opponents).
 * @param signal - aborts the in-flight call when the hand moves on.
 * @returns the decision plus where it came from.
 */
export async function decideTurn(
  state: GameState,
  index: number,
  useModel: boolean,
  signal: AbortSignal,
  dialogue: readonly AiDialogueLine[] = [],
): Promise<DecisionOutcome> {
  const fallback = localDecision(state, index)
  if (!useModel) return { decision: fallback, source: 'disabled' }
  if (!remoteAvailable()) return { decision: fallback, source: 'local', error: 'model path disabled after repeated failures' }

  const robbing = state.phase === 'robbing'
  const moves = robbing ? [] : selectCandidates(legalMoves(state, index))
  const candidates: AiCandidate[] = robbing
    ? isLandlordChoice(state)
      ? [{ label: '不当地主', detail: '' }, { label: '当地主', detail: '' }]
      : [
          { label: isCounterRob(state) ? '放弃抢回' : '不抢', detail: '' },
          { label: isCounterRob(state) ? '抢回地主' : '抢地主', detail: '' },
        ]
    : moves.map(move => ({ label: comboText(move.combo), detail: handText(move.cards) }))
  if (candidates.length === 0) return { decision: fallback, source: 'local' }

  try {
    const answer = await ask(buildRequest(state, index, candidates, dialogue), signal)
    if (!answer.ok) {
      failures += 1
      return { decision: fallback, source: 'local', ...answer.error === undefined ? {} : { error: answer.error } }
    }
    failures = 0
    const say = answer.say
    if (answer.choice === -1) {
      return canPass(state)
        ? { decision: { kind: 'pass', ...say === undefined ? {} : { say } }, source: 'model', ...answer.model === undefined ? {} : { model: answer.model } }
        : { decision: fallback, source: 'local', error: 'model passed when passing was illegal' }
    }
    if (robbing) {
      if (!canRob(state, index) || (answer.choice !== 0 && answer.choice !== 1)) {
        return { decision: fallback, source: 'local', error: 'rob index out of range' }
      }
      return { decision: { kind: 'rob', take: answer.choice === 1, ...say === undefined ? {} : { say } }, source: 'model', ...answer.model === undefined ? {} : { model: answer.model } }
    }
    const move = moves[answer.choice]
    if (move === undefined) return { decision: fallback, source: 'local', error: 'move index out of range' }
    return {
      decision: { kind: 'play', cardIds: move.cards.map(card => card.id), ...say === undefined ? {} : { say } },
      source: 'model',
      ...answer.model === undefined ? {} : { model: answer.model },
    }
  } catch (error) {
    if (signal.aborted) return { decision: fallback, source: 'local', error: 'aborted' }
    failures += 1
    return { decision: fallback, source: 'local', error: error instanceof Error ? error.message : 'route unreachable' }
  }
}
