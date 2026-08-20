import { beats, classify, type Combo, type Move } from './combos.ts'
import { legalMoves, type GameState } from './game.ts'

export type SelectionState =
  | { readonly kind: 'empty' }
  | { readonly kind: 'invalid' }
  | { readonly kind: 'too-low'; readonly combo: Combo; readonly required: Combo }
  | { readonly kind: 'valid'; readonly combo: Combo }

export interface HintSelection {
  readonly ids: readonly number[]
  readonly index: number
  readonly total: number
  readonly move: Move
}

/** Explain whether the human's exact selected cards can be played now. */
export function analyzeSelection(game: GameState, index: number, ids: readonly number[]): SelectionState {
  if (ids.length === 0) return { kind: 'empty' }
  const wanted = new Set(ids)
  const hand = game.seats[index]?.hand ?? []
  const cards = hand.filter(card => wanted.has(card.id))
  if (cards.length !== wanted.size) return { kind: 'invalid' }
  const combo = classify(cards)
  if (combo === undefined) return { kind: 'invalid' }
  if (game.required !== null && !beats(combo, game.required)) {
    return { kind: 'too-low', combo, required: game.required }
  }
  const legal = legalMoves(game, index).some(move =>
    move.cards.length === wanted.size && move.cards.every(card => wanted.has(card.id)))
  return legal ? { kind: 'valid', combo } : { kind: 'invalid' }
}

/** Move backward or forward through every legal play, wrapping at both ends. */
export function navigateHint(
  game: GameState,
  index: number,
  currentIds: readonly number[],
  direction: -1 | 1,
): HintSelection | undefined {
  const moves = legalMoves(game, index)
  if (moves.length === 0) return undefined
  const current = new Set(currentIds)
  const shown = moves.findIndex(move =>
    move.cards.length === current.size && move.cards.every(card => current.has(card.id)))
  const nextIndex = shown < 0
    ? direction > 0 ? 0 : moves.length - 1
    : (shown + direction + moves.length) % moves.length
  const move = moves[nextIndex]
  if (move === undefined) return undefined
  return { ids: move.cards.map(card => card.id), index: nextIndex, total: moves.length, move }
}

/** Idempotently select or deselect a group, used by pointer-drag selection. */
export function setCardsSelected(current: readonly number[], ids: readonly number[], selected: boolean): number[] {
  const next = new Set(current)
  for (const id of ids) selected ? next.add(id) : next.delete(id)
  return [...next]
}
