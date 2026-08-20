import assert from 'node:assert/strict'
import test from 'node:test'
import { localRob, stackPosture } from '../src/client/ai-local.ts'
import { createHand, type GameState } from '../src/client/game.ts'
import { parseChoice, renderPrompt, type AiRequest } from '../src/shared/protocol.ts'
import { cards, seeded } from './helpers.ts'

function withTokens(tokens: readonly number[]): GameState {
  const state = createHand(seeded([0.2, 0.7, 0.4]))
  return {
    ...state,
    phase: 'robbing',
    turn: 1,
    initialLandlordSeat: 1,
    candidateLandlordSeat: 2,
    firstClaimantSeat: 1,
    pendingRobbers: [1],
    robbedSeats: [2],
    passedRobSeats: [0],
    robCount: 1,
    multiplier: 2,
    seats: state.seats.map((seat, index) => ({
      ...seat,
      tokens: tokens[index] ?? seat.tokens,
      hand: index === 1 ? cards('W w K Q J 10 9 8 7 6 5 4 3 3 4 5 6') : seat.hand,
    })),
  }
}

test('bankroll posture uses the agreed 75 and 125 percent boundaries', () => {
  assert.equal(stackPosture(withTokens([125, 50, 125]), 1), 'catch-up')
  assert.equal(stackPosture(withTokens([50, 200, 50]), 1), 'protect')
  assert.equal(stackPosture(withTokens([95, 105, 100]), 1), 'balanced')
})

test('a trailing local bot robs more freely than the same leading bot', () => {
  const trailing = localRob(withTokens([125, 50, 125]), 1)
  const leading = localRob(withTokens([50, 200, 50]), 1)
  assert.equal(trailing.kind, 'rob')
  assert.equal(leading.kind, 'rob')
  assert.equal(trailing.kind === 'rob' && trailing.take, true)
  assert.equal(leading.kind === 'rob' && leading.take, false)
})

test('the model prompt receives bankroll exposure and recent table dialogue', () => {
  const request: AiRequest = {
    phase: 'robbing',
    seatName: '沧澜',
    persona: '沉稳克制',
    role: '暂定地主',
    hand: 'A K Q',
    handCount: 3,
    tokens: 42,
    startingTokens: 100,
    stackPosture: 'catch-up',
    potentialLoss: 12,
    candidateLandlord: '汐音',
    priorityPlayer: '沧澜',
    firstClaimant: '沧澜',
    robCount: 1,
    counterRob: true,
    opponents: [
      { name: '易珈仰', role: '地主', cards: 2, tokens: 160, teammate: false },
      { name: '汐音', role: '农民', cards: 4, tokens: 98, teammate: true },
    ],
    baseScore: 2,
    multiplier: 4,
    history: ['易珈仰 出 对子'],
    dialogue: [{ seatName: '易珈仰', text: '别得意' }],
    candidates: [
      { label: '放弃抢回', detail: '' },
      { label: '抢回地主', detail: '' },
    ],
    canPass: false,
  }
  const prompt = renderPrompt(request)
  assert.match(prompt.user, /筹码 42\/100/)
  assert.match(prompt.user, /落后追赶/)
  assert.match(prompt.user, /易珈仰：别得意/)
  assert.match(prompt.user, /筹码 160/)
  assert.match(prompt.user, /抢回地主/)

  const parsed = parseChoice('{"i":0,"say":"这一句会被安全地限制在二十四个汉字以内而不会破坏决定"}', request)
  assert.equal(parsed?.choice, 0)
  assert.equal((parsed?.say?.length ?? 0) <= 24, true)
})
