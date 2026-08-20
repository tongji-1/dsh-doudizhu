import assert from 'node:assert/strict'
import test from 'node:test'
import { createHand, legalMoves, robLandlord, type GameState } from '../src/client/game.ts'
import { analyzeSelection, navigateHint, setCardsSelected } from '../src/client/selection.ts'
import { seeded } from './helpers.ts'

function playing(): GameState {
  let state = createHand(seeded([0.13, 0.71, 0.42, 0.9, 0.05]))
  state = robLandlord(state, true)
  while (state.phase === 'robbing') state = robLandlord(state, false)
  return state
}

test('selection analysis distinguishes legal, malformed, and too-low plays', () => {
  const state = playing()
  const moves = legalMoves(state, state.userSeat)
  const legal = moves[0]
  assert.notEqual(legal, undefined)
  assert.equal(analyzeSelection(state, state.userSeat, legal?.cards.map(card => card.id) ?? []).kind, 'valid')

  const first = state.seats[state.userSeat]?.hand.find(card => card.rank < 16)
  const different = state.seats[state.userSeat]?.hand.find(card => card.rank < 16 && card.rank !== first?.rank)
  assert.equal(analyzeSelection(state, state.userSeat, [first?.id ?? -1, different?.id ?? -2]).kind, 'invalid')

  const singles = moves.filter(move => move.combo.kind === 'single')
  const low = singles[0]
  const high = singles.at(-1)
  assert.notEqual(low, undefined)
  assert.notEqual(high, undefined)
  const following: GameState = { ...state, required: high?.combo ?? null }
  assert.equal(analyzeSelection(following, state.userSeat, low?.cards.map(card => card.id) ?? []).kind, 'too-low')
})

test('hint navigation starts at either edge and wraps in both directions', () => {
  const state = playing()
  const total = legalMoves(state, state.userSeat).length
  const first = navigateHint(state, state.userSeat, [], 1)
  const last = navigateHint(state, state.userSeat, [], -1)
  assert.equal(first?.index, 0)
  assert.equal(last?.index, total - 1)
  assert.equal(navigateHint(state, state.userSeat, last?.ids ?? [], 1)?.index, 0)
  assert.equal(navigateHint(state, state.userSeat, first?.ids ?? [], -1)?.index, total - 1)
})

test('drag selection updates are idempotent for crossed cards', () => {
  assert.deepEqual(setCardsSelected([1], [1, 2, 2], true), [1, 2])
  assert.deepEqual(setCardsSelected([1, 2, 3], [2, 3], false), [1])
})
