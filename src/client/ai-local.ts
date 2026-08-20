/**
 * Offline bot policy. It is the fallback whenever the model call is disabled,
 * slow, or unparseable, so it must always return a legal decision — never
 * throw, never stall. Deliberately simple: structure-first leads, cheapest
 * legal answer when following, and no bombing a teammate.
 */

import { isJoker, RANK_ACE, RANK_TWO, type Card } from './cards.ts'
import type { Move } from './combos.ts'
import { BASE_STAKE, canPass, canRob, isCounterRob, isLandlord, isLandlordChoice, legalMoves, type GameState } from './game.ts'
import type { StackPosture } from '../shared/protocol.ts'

/** One bot turn resolved to a concrete action. */
export type Decision =
  | { readonly kind: 'rob'; readonly take: boolean; readonly say?: string }
  | { readonly kind: 'play'; readonly cardIds: readonly number[]; readonly say?: string }
  | { readonly kind: 'pass'; readonly say?: string }

/** Rough 0..1 strength of a starting hand, used to decide whether to rob the landlord. */
export function handStrength(hand: readonly Card[]): number {
  let points = 0
  const counts = new Map<number, number>()
  for (const card of hand) {
    counts.set(card.rank, (counts.get(card.rank) ?? 0) + 1)
    if (card.rank === RANK_TWO) points += 1.5
    else if (card.rank === RANK_ACE) points += 0.8
    else if (isJoker(card.rank)) points += 3
  }
  for (const count of counts.values()) if (count === 4) points += 4
  if ((counts.get(16) ?? 0) + (counts.get(17) ?? 0) === 2) points += 3
  return Math.max(0, Math.min(1, points / 16))
}

function explosive(move: Move): boolean {
  return move.combo.kind === 'bomb' || move.combo.kind === 'rocket'
}

/** Bankroll posture shared by the local policy and the model prompt. */
export function stackPosture(state: GameState, index: number): StackPosture {
  const own = state.seats[index]?.tokens ?? 0
  const richestOpponent = Math.max(...state.seats.flatMap((seat, seatIndex) => seatIndex === index ? [] : [seat.tokens]))
  if (own <= richestOpponent * 0.75) return 'catch-up'
  if (own >= richestOpponent * 1.25) return 'protect'
  return 'balanced'
}

/** Decide whether to accept an unclaimed landlord or rob the current claimant. */
export function localRob(state: GameState, index: number): Decision {
  const seat = state.seats[index]
  if (seat === undefined || !canRob(state, index)) return { kind: 'rob', take: false }
  const strength = handStrength(seat.hand)
  const posture = stackPosture(state, index)
  const firstChoice = isLandlordChoice(state)
  const bankrollShift = posture === 'catch-up' ? -0.06 : posture === 'protect' ? 0.06 : 0
  const personaShift = index === 1 ? 0.025 : index === 2 ? -0.025 : 0
  const nextExposure = BASE_STAKE * state.multiplier * (firstChoice ? 1 : 2) * 2
  const exposureShift = Math.min(0.16, nextExposure / Math.max(1, seat.tokens) * 0.12)
  const repeatedRobShift = firstChoice ? -state.passedRobSeats.length * 0.035 : state.robCount * 0.08
  const counterShift = isCounterRob(state) ? -0.025 : 0
  const threshold = (firstChoice ? 0.4 : 0.44) + bankrollShift + personaShift + exposureShift + repeatedRobShift + counterShift
  return { kind: 'rob', take: strength >= threshold }
}

/** True when both seats sit on the farmers' side of this hand. */
function teammates(state: GameState, left: number, right: number): boolean {
  return state.landlordSeat !== null && !isLandlord(state, left) && !isLandlord(state, right)
}

/** Fewest cards held by anyone this seat is playing against. */
function pressure(state: GameState, index: number): number {
  const opponents = state.seats.flatMap((seat, seatIndex) =>
    seatIndex !== index && !teammates(state, index, seatIndex) ? [seat.hand.length] : [])
  return opponents.length === 0 ? 99 : Math.min(...opponents)
}

function leadMove(state: GameState, index: number, moves: readonly Move[]): Decision {
  const seat = state.seats[index] as { hand: readonly Card[] }
  const finisher = moves.find(move => move.cards.length === seat.hand.length)
  if (finisher !== undefined) return { kind: 'play', cardIds: finisher.cards.map(card => card.id) }
  if (stackPosture(state, index) === 'catch-up' && pressure(state, index) <= 4) {
    const closingBomb = moves.find(move => explosive(move) && seat.hand.length - move.cards.length <= 2)
    if (closingBomb !== undefined) return { kind: 'play', cardIds: closingBomb.cards.map(card => card.id) }
  }
  const ordinary = moves.filter(move => !explosive(move))
  const pool = ordinary.length > 0 ? ordinary : moves
  // Shed structure first, cheapest rank first: long runs leave the hand tidier.
  const best = [...pool].sort((left, right) =>
    right.combo.size - left.combo.size || left.combo.rank - right.combo.rank)[0] as Move
  return { kind: 'play', cardIds: best.cards.map(card => card.id) }
}

function followMove(state: GameState, index: number, moves: readonly Move[]): Decision {
  const seat = state.seats[index] as { hand: readonly Card[] }
  const finisher = moves.find(move => move.cards.length === seat.hand.length)
  if (finisher !== undefined) return { kind: 'play', cardIds: finisher.cards.map(card => card.id) }
  if (state.leader !== null && state.leader !== index && teammates(state, index, state.leader)) {
    return { kind: 'pass' }
  }
  const posture = stackPosture(state, index)
  const danger = pressure(state, index)
  const urgent = danger <= (posture === 'catch-up' ? 4 : 2)
  const ordinary = moves.filter(move => !explosive(move))
  const cheapest = [...ordinary].sort((left, right) =>
    left.combo.rank - right.combo.rank || left.combo.size - right.combo.size)[0]
  if (cheapest !== undefined && (urgent || cheapest.combo.rank <= RANK_ACE)) {
    return { kind: 'play', cardIds: cheapest.cards.map(card => card.id) }
  }
  if (posture === 'catch-up') {
    const closingBomb = moves.find(move => explosive(move) && (danger <= 4 || seat.hand.length - move.cards.length <= 2))
    if (closingBomb !== undefined) return { kind: 'play', cardIds: closingBomb.cards.map(card => card.id) }
  }
  if (urgent && moves.length > 0) {
    const strongest = moves[moves.length - 1] as Move
    return { kind: 'play', cardIds: strongest.cards.map(card => card.id) }
  }
  if (cheapest !== undefined && !canPass(state)) {
    return { kind: 'play', cardIds: cheapest.cards.map(card => card.id) }
  }
  return canPass(state) ? { kind: 'pass' } : { kind: 'play', cardIds: (moves[0] as Move).cards.map(card => card.id) }
}

/**
 * Decide one turn for a bot seat without consulting a model.
 * @param state - the live hand.
 * @param index - the seat on turn.
 * @returns a legal decision; a pass only when passing is legal.
 */
export function localDecision(state: GameState, index: number): Decision {
  if (state.phase === 'robbing') return localRob(state, index)
  const moves = legalMoves(state, index)
  if (moves.length === 0) return { kind: 'pass' }
  return state.required === null ? leadMove(state, index, moves) : followMove(state, index, moves)
}
