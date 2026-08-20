import assert from 'node:assert/strict'
import { test } from 'node:test'
import { beats, classify, enumerateMoves, isLegalPlay, type Combo } from '../src/client/combos.ts'
import { cards } from './helpers.ts'

function kindOf(text: string): string | undefined {
  return classify(cards(text))?.kind
}

test('recognizes the fixed-size shapes', () => {
  assert.equal(kindOf('5'), 'single')
  assert.equal(kindOf('5 5'), 'pair')
  assert.equal(kindOf('5 5 5'), 'triple')
  assert.equal(kindOf('5 5 5 9'), 'triple-single')
  assert.equal(kindOf('5 5 5 9 9'), 'triple-pair')
  assert.equal(kindOf('5 5 5 5'), 'bomb')
  assert.equal(kindOf('w W'), 'rocket')
})

test('rejects sets that form no combination', () => {
  assert.equal(kindOf('3 5'), undefined)
  assert.equal(kindOf('3 3 5'), undefined)
  assert.equal(kindOf('3 4 5 6'), undefined)
  assert.equal(kindOf('w 3'), undefined)
})

test('straights need five consecutive ranks below the deuce', () => {
  assert.equal(kindOf('3 4 5 6 7'), 'straight')
  assert.equal(kindOf('10 J Q K A'), 'straight')
  assert.equal(kindOf('J Q K A 2'), undefined)
  assert.equal(kindOf('3 4 5 6 8'), undefined)
  const straight = classify(cards('3 4 5 6 7')) as Combo
  assert.equal(straight.rank, 7)
  assert.equal(straight.length, 5)
})

test('pair straights need three consecutive pairs', () => {
  assert.equal(kindOf('3 3 4 4 5 5'), 'pair-straight')
  assert.equal(kindOf('3 3 4 4'), undefined)
  assert.equal(kindOf('K K A A 2 2'), undefined)
})

test('planes carry no wings, single wings, or paired wings', () => {
  assert.equal(kindOf('7 7 7 8 8 8'), 'plane')
  assert.equal(kindOf('7 7 7 8 8 8 3 4'), 'plane-single')
  assert.equal(kindOf('7 7 7 8 8 8 3 3 4 4'), 'plane-pair')
  assert.equal(kindOf('7 7 7 9 9 9'), undefined)
  assert.equal(kindOf('A A A 2 2 2'), undefined)
})

test('four with two singles and four with two pairs', () => {
  assert.equal(kindOf('9 9 9 9 3 5'), 'four-two')
  assert.equal(kindOf('9 9 9 9 3 3 5 5'), 'four-two-pairs')
})

test('bombs and the rocket outrank ordinary shapes', () => {
  const straight = classify(cards('3 4 5 6 7')) as Combo
  const bomb = classify(cards('5 5 5 5')) as Combo
  const bigger = classify(cards('9 9 9 9')) as Combo
  const rocket = classify(cards('w W')) as Combo
  assert.equal(beats(bomb, straight), true)
  assert.equal(beats(straight, bomb), false)
  assert.equal(beats(bigger, bomb), true)
  assert.equal(beats(bomb, bigger), false)
  assert.equal(beats(rocket, bigger), true)
  assert.equal(beats(bigger, rocket), false)
})

test('shapes only compare against the same kind, length, and size', () => {
  const short = classify(cards('3 4 5 6 7')) as Combo
  const long = classify(cards('4 5 6 7 8 9')) as Combo
  assert.equal(beats(long, short), false)
  const pair = classify(cards('9 9')) as Combo
  assert.equal(beats(pair, short), false)
})

test('enumerating a lead offers every shape the hand can form', () => {
  const moves = enumerateMoves(cards('3 4 5 6 7 9 9 9 9 w W'))
  const kinds = new Set(moves.map(move => move.combo.kind))
  assert.equal(kinds.has('single'), true)
  assert.equal(kinds.has('straight'), true)
  assert.equal(kinds.has('bomb'), true)
  assert.equal(kinds.has('rocket'), true)
})

test('enumerating a follow offers only legal answers', () => {
  const required = classify(cards('5 5')) as Combo
  const moves = enumerateMoves(cards('3 3 6 6 9 9 9 9 w W'), required)
  for (const move of moves) assert.equal(beats(move.combo, required), true)
  assert.equal(moves.some(move => move.combo.kind === 'pair' && move.combo.rank === 3), false)
  assert.equal(moves.some(move => move.combo.kind === 'pair' && move.combo.rank === 6), true)
  assert.equal(moves.some(move => move.combo.kind === 'bomb'), true)
})

test('nothing answers the rocket', () => {
  const rocket = classify(cards('w W')) as Combo
  assert.deepEqual(enumerateMoves(cards('9 9 9 9 3 3'), rocket), [])
})

test('every enumerated move is itself a legal play', () => {
  const hand = cards('3 3 3 4 4 4 5 6 7 8 9 9 9 9 K K A 2 w W')
  for (const move of enumerateMoves(hand)) {
    assert.equal(isLegalPlay(move.cards), true, `illegal: ${move.combo.kind}`)
    assert.deepEqual(classify(move.cards), move.combo)
  }
})
