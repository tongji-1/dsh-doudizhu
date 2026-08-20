import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  BASE_STAKE, BOTTOM_SIZE, HAND_SIZE, STARTING_TOKENS, canPass, createHand, createTable,
  isCounterRob, legalMoves, pass, play, robLandlord, type GameState,
} from '../src/client/game.ts'
import { localDecision } from '../src/client/ai-local.ts'
import { seeded } from './helpers.ts'

const fixed = (): (() => number) => seeded([0.13, 0.71, 0.42, 0.9, 0.05, 0.58, 0.27, 0.83])

/** Drive the whole hand with the offline policy; returns the settled state. */
function playOut(state: GameState, limit = 400): GameState {
  let current = state
  for (let step = 0; step < limit && current.phase !== 'over'; step += 1) {
    const seat = current.turn
    if (seat === null) break
    const decision = localDecision(current, seat)
    const next = decision.kind === 'rob'
      ? robLandlord(current, decision.take)
      : decision.kind === 'pass' ? pass(current) : play(current, decision.cardIds)
    assert.notEqual(next, current, `turn ${seat} produced no progress (${decision.kind})`)
    current = next
  }
  return current
}

function finishAuction(state: GameState): GameState {
  let current = state
  if (current.phase === 'robbing' && current.candidateLandlordSeat === null) current = robLandlord(current, true)
  while (current.phase === 'robbing') current = robLandlord(current, false)
  return current
}

function finishWithTokens(state: GameState, winner: number, tokens: readonly number[]): GameState {
  const card = state.seats[winner]?.hand[0]
  assert.notEqual(card, undefined)
  const ready: GameState = {
    ...state,
    phase: 'playing',
    turn: winner,
    leader: winner,
    required: null,
    landlordPlays: 2,
    farmerPlays: 1,
    seats: state.seats.map((seat, index) => ({
      ...seat,
      tokens: tokens[index] ?? seat.tokens,
      hand: index === winner && card !== undefined ? [card] : seat.hand,
    })),
  }
  return play(ready, [card?.id ?? -1])
}

test('a fresh hand deals seventeen cards each plus a kitty', () => {
  const state = createHand(fixed())
  assert.equal(state.seats.length, 3)
  assert.deepEqual(state.seats.map(seat => seat.name), ['易珈仰', '沧澜', '汐音'])
  for (const seat of state.seats) assert.equal(seat.hand.length, HAND_SIZE)
  assert.deepEqual(state.seats.map(seat => seat.tokens), [STARTING_TOKENS, STARTING_TOKENS, STARTING_TOKENS])
  assert.equal(state.bottom.length, BOTTOM_SIZE)
  const ids = new Set([...state.seats.flatMap(seat => seat.hand.map(card => card.id)), ...state.bottom.map(card => card.id)])
  assert.equal(ids.size, 54)
  assert.equal(state.phase, 'robbing')
  assert.equal(state.baseScore, BASE_STAKE)
  assert.equal(state.candidateLandlordSeat, null)
  assert.equal(state.firstClaimantSeat, null)
  assert.deepEqual(state.pendingRobbers, [
    state.initialLandlordSeat,
    (state.initialLandlordSeat + 1) % 3,
    (state.initialLandlordSeat + 2) % 3,
  ])
  assert.equal(state.turn, state.initialLandlordSeat)
})

test('the previous finisher chooses first, then two declines leave that claimant as landlord', () => {
  const opening = createHand(fixed())
  const claimed = robLandlord(opening, true)
  assert.equal(claimed.candidateLandlordSeat, opening.initialLandlordSeat)
  assert.equal(claimed.multiplier, 1)
  const state = robLandlord(robLandlord(claimed, false), false)
  assert.equal(state.phase, 'playing')
  assert.equal(state.landlordSeat, opening.initialLandlordSeat)
  assert.equal(state.baseScore, BASE_STAKE)
  assert.equal(state.multiplier, 1)
  assert.equal(state.bottomRevealed, true)
  const landlord = state.seats[state.landlordSeat as number]
  assert.equal(landlord?.hand.length, HAND_SIZE + BOTTOM_SIZE)
  assert.equal(state.turn, state.landlordSeat)
})

test('each successful rob doubles the multiplier and the original holder may take it back', () => {
  const opening = createHand(fixed())
  const claimant = opening.turn as number
  const claimed = robLandlord(opening, true)
  assert.equal(claimed.multiplier, 1)
  const firstRobber = claimed.turn as number
  const afterFirst = robLandlord(claimed, true)
  assert.equal(afterFirst.candidateLandlordSeat, firstRobber)
  assert.equal(afterFirst.multiplier, 2)
  const secondRobber = afterFirst.turn as number
  const afterSecond = robLandlord(afterFirst, true)
  assert.equal(afterSecond.candidateLandlordSeat, secondRobber)
  assert.equal(afterSecond.multiplier, 4)
  assert.equal(isCounterRob(afterSecond), true)
  assert.equal(afterSecond.turn, claimant)
  const started = robLandlord(afterSecond, true)
  assert.equal(started.phase, 'playing')
  assert.equal(started.landlordSeat, claimant)
  assert.equal(started.robCount, 3)
  assert.equal(started.multiplier, 8)
  assert.deepEqual(started.robbedSeats, [firstRobber, secondRobber, claimant])
})

test('the original holder may decline a counter-rob and leave the last robber as landlord', () => {
  const opening = createHand(fixed())
  const claimed = robLandlord(opening, true)
  const firstRobber = claimed.turn as number
  const afterRob = robLandlord(claimed, true)
  const afterOtherDeclines = robLandlord(afterRob, false)
  assert.equal(isCounterRob(afterOtherDeclines), true)
  const started = robLandlord(afterOtherDeclines, false)
  assert.equal(started.landlordSeat, firstRobber)
  assert.equal(started.multiplier, 2)
})

test('three landlord declines redeal and rotate the priority chooser', () => {
  const opening = createHand(fixed())
  const first = robLandlord(opening, false)
  const second = robLandlord(first, false)
  const redealt = robLandlord(second, false, fixed())
  assert.equal(redealt.phase, 'robbing')
  assert.equal(redealt.handNumber, opening.handNumber)
  assert.equal(redealt.initialLandlordSeat, (opening.initialLandlordSeat + 1) % 3)
  assert.equal(redealt.turn, redealt.initialLandlordSeat)
  assert.equal(redealt.candidateLandlordSeat, null)
  assert.deepEqual(redealt.seats.map(seat => seat.tokens), opening.seats.map(seat => seat.tokens))
})

test('two passes return the lead to the trick owner and clear the table', () => {
  const start = finishAuction(createHand(fixed()))
  const landlord = start.landlordSeat as number
  const first = legalMoves(start, landlord)[0]
  assert.notEqual(first, undefined)
  const led = play(start, (first?.cards ?? []).map(card => card.id))
  assert.equal(led.leader, landlord)
  assert.notEqual(led.required, null)
  const settled = pass(pass(led))
  assert.equal(settled.turn, landlord)
  assert.equal(settled.required, null)
  for (const seat of settled.seats) assert.equal(seat.lastPlay.length, 0)
})

test('the trick owner may not pass', () => {
  const start = finishAuction(createHand(fixed()))
  assert.equal(canPass(start), false)
  assert.equal(pass(start), start)
})

test('an illegal set leaves the state untouched', () => {
  const start = finishAuction(createHand(fixed()))
  const landlord = start.landlordSeat as number
  const hand = start.seats[landlord]?.hand ?? []
  assert.equal(play(start, []), start)
  assert.equal(play(start, [-1]), start)
  const junk = hand.filter((card, index) => index < 2 && card.rank !== (hand[0]?.rank ?? 0))
  if (junk.length === 2) assert.equal(play(start, junk.map(card => card.id)), start)
})

test('a full hand settles with a zero-sum token transfer', () => {
  const finished = playOut(createHand(fixed()))
  assert.equal(finished.phase, 'over')
  assert.notEqual(finished.result, undefined)
  assert.equal(finished.winners.length, finished.landlordSeat !== null && finished.winners.includes(finished.landlordSeat) ? 1 : 2)
  const total = finished.seats.reduce((sum, seat) => sum + seat.tokens, 0)
  assert.equal(total, STARTING_TOKENS * 3)
  assert.equal(finished.seats.every(seat => seat.tokens >= 0), true)
  const emptied = finished.seats.filter(seat => seat.hand.length === 0)
  assert.equal(emptied.length, 1)
})

test('tokens carry across hands and the actual finisher receives first landlord choice', () => {
  const first = playOut(createHand(fixed()))
  const second = createHand(fixed(), first)
  assert.equal(second.handNumber, first.handNumber + 1)
  assert.equal(second.initialLandlordSeat, first.finisherSeat)
  assert.equal(second.turn, first.finisherSeat)
  assert.equal(second.candidateLandlordSeat, null)
  assert.deepEqual(second.seats.map(seat => seat.tokens), first.seats.map(seat => seat.tokens))
})

test('a landlord win collects at most each farmer all-in balance', () => {
  const started = finishAuction(createHand(fixed()))
  const landlord = started.landlordSeat as number
  const farmers = [0, 1, 2].filter(index => index !== landlord)
  const tokens = [0, 0, 0]
  tokens[landlord] = 297
  tokens[farmers[0] as number] = 2
  tokens[farmers[1] as number] = 1
  const finished = finishWithTokens(started, landlord, tokens)

  assert.deepEqual(finished.seats.map(seat => seat.tokens), [300, 0, 0])
  assert.equal(finished.settlement?.paid, 3)
  assert.equal(finished.matchOver, true)
  assert.deepEqual(finished.bankruptSeats, farmers)
})

test('an underfunded landlord splits an odd all-in payment toward the finishing farmer', () => {
  const started = finishAuction(createHand(fixed()))
  const landlord = started.landlordSeat as number
  const winner = (landlord + 1) % 3
  const otherFarmer = (landlord + 2) % 3
  const tokens = [0, 0, 0]
  tokens[landlord] = 1
  tokens[winner] = 150
  tokens[otherFarmer] = 149
  const finished = finishWithTokens(started, winner, tokens)

  assert.equal(finished.seats[landlord]?.tokens, 0)
  assert.equal(finished.seats[winner]?.tokens, 151)
  assert.equal(finished.seats[otherFarmer]?.tokens, 149)
  assert.equal(finished.settlement?.paid, 1)
  assert.equal(finished.seats.reduce((sum, seat) => sum + seat.tokens, 0), 300)
})

test('a fully funded landlord pays one stake to each farmer', () => {
  const started = finishAuction(createHand(fixed()))
  const landlord = started.landlordSeat as number
  const winner = (landlord + 1) % 3
  const finished = finishWithTokens(started, winner, [100, 100, 100])

  assert.equal(finished.settlement?.stake, BASE_STAKE)
  assert.equal(finished.settlement?.paid, BASE_STAKE * 2)
  assert.equal(finished.seats[landlord]?.tokens, 100 - BASE_STAKE * 2)
  for (let index = 0; index < 3; index += 1) {
    if (index !== landlord) assert.equal(finished.seats[index]?.tokens, 100 + BASE_STAKE)
  }
})

test('bankruptcy blocks another deal until a fresh table is created', () => {
  const started = finishAuction(createHand(fixed()))
  const finished = finishWithTokens(started, started.landlordSeat as number, [297, 2, 1])
  assert.equal(finished.matchOver, true)
  assert.equal(createHand(fixed(), finished), finished)
  assert.deepEqual(createTable(fixed()).seats.map(seat => seat.tokens), [100, 100, 100])
})

test('the offline policy always answers with a legal turn', () => {
  for (let round = 0; round < 12; round += 1) {
    let state = createHand(seeded([round / 12, 0.4, 0.77, 0.19, 0.62]))
    for (let step = 0; step < 400 && state.phase !== 'over'; step += 1) {
      const seat = state.turn as number
      const decision = localDecision(state, seat)
      if (decision.kind === 'pass') assert.equal(canPass(state), true)
      if (decision.kind === 'play') {
        const ids = new Set(decision.cardIds)
        assert.equal(legalMoves(state, seat).some(move =>
          move.cards.length === ids.size && move.cards.every(card => ids.has(card.id))), true)
      }
      state = decision.kind === 'rob'
        ? robLandlord(state, decision.take)
        : decision.kind === 'pass' ? pass(state) : play(state, decision.cardIds)
    }
    assert.equal(state.phase, 'over')
  }
})
