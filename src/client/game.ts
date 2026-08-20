/**
 * Dou Dizhu game state: a three-seat hand from the landlord auction through the last card,
 * plus a continuous token bankroll. Every transition is a pure function of the previous state, so
 * the store can persist a snapshot and the bots can reason about it offline.
 */

import { createDeck, shuffle, sortForDisplay, withoutIds, type Card } from './cards.ts'
import { beats, classify, comboText, enumerateMoves, type Combo, type Move } from './combos.ts'

export type Phase = 'robbing' | 'playing' | 'over'

export const SEAT_COUNT = 3
export const HAND_SIZE = 17
export const BOTTOM_SIZE = 3
export const STARTING_TOKENS = 100
/** Fixed token stake before robbing, bombs, and spring multipliers. */
export const BASE_STAKE = 2
/** Seat names in turn order; seat 0 is always the human. */
export const NAMES = ['易珈仰', '沧澜', '汐音'] as const

export interface TokenTransfer {
  readonly from: number
  readonly to: number
  readonly amount: number
}

export interface HandSettlement {
  /** Fixed base stake multiplied by robbing, bombs, rocket, and spring. */
  readonly stake: number
  /** What was actually moved after all-in caps were applied. */
  readonly paid: number
  readonly transfers: readonly TokenTransfer[]
}

export interface Seat {
  readonly id: string
  readonly name: string
  readonly bot: boolean
  readonly hand: readonly Card[]
  /** Match bankroll, persisted between hands and never below zero. */
  readonly tokens: number
  readonly landlord: boolean
  /** True once the seat has passed on the current trick. */
  readonly passed: boolean
  /** Cards currently face-up in front of the seat. */
  readonly lastPlay: readonly Card[]
  readonly lastCombo: Combo | null
}

export interface GameState {
  readonly handNumber: number
  readonly phase: Phase
  /** Previous finisher, or the random opening chooser, who decides first whether to be landlord. */
  readonly initialLandlordSeat: number
  /** Seat that currently holds the landlord claim; null until somebody accepts. */
  readonly candidateLandlordSeat: number | null
  /** First seat to accept the landlord; it may counter-rob after another seat takes the claim. */
  readonly firstClaimantSeat: number | null
  /** Remaining seats that must choose to rob or decline, in action order. */
  readonly pendingRobbers: readonly number[]
  /** Successful rob actions in chronological order. */
  readonly robbedSeats: readonly number[]
  /** Seats that declined their one rob opportunity. */
  readonly passedRobSeats: readonly number[]
  readonly robCount: number
  readonly seats: readonly Seat[]
  readonly bottom: readonly Card[]
  readonly bottomRevealed: boolean
  readonly landlordSeat: number | null
  /** Fixed table stake before multipliers. */
  readonly baseScore: number
  readonly multiplier: number
  readonly turn: number | null
  /** Seat holding the current trick; it leads once both opponents pass. */
  readonly leader: number | null
  readonly required: Combo | null
  readonly userSeat: number
  readonly logs: readonly string[]
  readonly winners: readonly number[]
  /** The exact seat that emptied its hand; it receives first landlord choice next hand. */
  readonly finisherSeat: number | null
  /** A match ends after a settled hand leaves any seat with no tokens. */
  readonly matchOver: boolean
  readonly bankruptSeats: readonly number[]
  readonly spring: 'none' | 'spring' | 'anti-spring'
  readonly landlordPlays: number
  readonly farmerPlays: number
  /** Settled outcome line, present only once the hand is over. */
  readonly result?: string
  readonly settlement?: HandSettlement
}

function addLog(state: GameState, message: string): GameState {
  return { ...state, logs: [...state.logs.slice(-11), message] }
}

function replaceSeat(state: GameState, index: number, change: (seat: Seat) => Seat): GameState {
  const seats = [...state.seats]
  seats[index] = change(seats[index] as Seat)
  return { ...state, seats }
}

/** The seat that acts after `index`, in fixed counter-clockwise order. */
export function nextSeat(index: number): number {
  return (index + 1) % SEAT_COUNT
}

/** Whether the seat is on the landlord's side of this hand. */
export function isLandlord(state: GameState, index: number): boolean {
  return state.landlordSeat === index
}

/** Whether the current auction action is the original holder's final chance to take the landlord back. */
export function isCounterRob(state: GameState): boolean {
  return state.phase === 'robbing'
    && state.robCount > 0
    && state.firstClaimantSeat !== null
    && state.turn === state.firstClaimantSeat
    && state.pendingRobbers.length === 1
}

/** Whether the current auction action is an unclaimed landlord choice rather than a rob. */
export function isLandlordChoice(state: GameState): boolean {
  return state.phase === 'robbing' && state.candidateLandlordSeat === null
}

/** Whether a seat may answer the current landlord auction. */
export function canRob(state: GameState, index: number): boolean {
  return state.phase === 'robbing' && state.turn === index && state.pendingRobbers[0] === index
}

/** Every play the seat may legally make right now, ordered cheapest first. */
export function legalMoves(state: GameState, index: number): Move[] {
  if (state.phase !== 'playing' || state.turn !== index) return []
  const seat = state.seats[index]
  if (seat === undefined) return []
  return enumerateMoves(seat.hand, state.required ?? undefined)
}

/** Whether the seat on turn may pass (it may not when it owns the trick). */
export function canPass(state: GameState): boolean {
  return state.phase === 'playing' && state.required !== null
}

function settle(state: GameState, winner: number): GameState {
  const landlordSeat = state.landlordSeat as number
  const landlordWon = winner === landlordSeat
  const spring: GameState['spring'] = landlordWon && state.farmerPlays === 0
    ? 'spring'
    : !landlordWon && state.landlordPlays <= 1 ? 'anti-spring' : 'none'
  const multiplier = state.multiplier * (spring === 'none' ? 1 : 2)
  const stake = state.baseScore * multiplier
  const balances = state.seats.map(seat => seat.tokens)
  const transfers: TokenTransfer[] = []
  const transfer = (from: number, to: number, wanted: number): void => {
    const amount = Math.max(0, Math.min(wanted, balances[from] ?? 0))
    if (amount === 0) return
    balances[from] = (balances[from] ?? 0) - amount
    balances[to] = (balances[to] ?? 0) + amount
    transfers.push({ from, to, amount })
  }
  if (landlordWon) {
    for (let index = 0; index < state.seats.length; index += 1) {
      if (index !== landlordSeat) transfer(index, landlordSeat, stake)
    }
  } else {
    const available = Math.min(stake * 2, balances[landlordSeat] ?? 0)
    const farmers = state.seats.flatMap((_, index) => index === landlordSeat ? [] : [index])
    const baseShare = Math.floor(available / farmers.length)
    let remainder = available - baseShare * farmers.length
    // When an odd all-in cannot split evenly, reward the farmer who went out.
    const ordered = [winner, ...farmers.filter(index => index !== winner)]
    for (const index of ordered) {
      const bonus = remainder > 0 ? 1 : 0
      remainder -= bonus
      transfer(landlordSeat, index, baseShare + bonus)
    }
  }
  const paid = transfers.reduce((sum, entry) => sum + entry.amount, 0)
  const seats = state.seats.map((seat, index) => ({ ...seat, tokens: balances[index] ?? seat.tokens }))
  const bankruptSeats = seats.flatMap((seat, index) => seat.tokens === 0 ? [index] : [])
  const matchOver = bankruptSeats.length > 0
  const side = landlordWon ? '地主' : '农民'
  const springText = spring === 'spring' ? ' · 春天' : spring === 'anti-spring' ? ' · 反春' : ''
  const winners = state.seats.flatMap((_, index) =>
    (index === landlordSeat) === landlordWon ? [index] : [])
  return addLog({
    ...state,
    seats,
    phase: 'over',
    turn: null,
    required: null,
    multiplier,
    spring,
    winners,
    finisherSeat: winner,
    matchOver,
    bankruptSeats,
    settlement: { stake, paid, transfers },
    result: `${side}胜 · 底注 ${state.baseScore} ×${multiplier}${springText} · 转移 ${paid} 筹码`,
  }, `${(state.seats[winner] as Seat).name} 打光手牌，${side}获胜${springText}`)
}

function startPlaying(state: GameState, landlordSeat: number): GameState {
  const seats = state.seats.map((seat, index) => index === landlordSeat
    ? { ...seat, landlord: true, hand: sortForDisplay([...seat.hand, ...state.bottom]) }
    : seat)
  return addLog({
    ...state,
    seats,
    phase: 'playing',
    landlordSeat,
    bottomRevealed: true,
    candidateLandlordSeat: landlordSeat,
    pendingRobbers: [],
    turn: landlordSeat,
    leader: landlordSeat,
    required: null,
  }, `${(seats[landlordSeat] as Seat).name} 成为地主，底注 ${state.baseScore}，抢地主倍率 ×${state.multiplier}`)
}

/**
 * Resolve one rob-landlord decision.
 * @param state - the current hand, in the robbing phase.
 * @param take - true to accept an unclaimed landlord, or rob an existing claim and double the multiplier.
 * @returns the next state; the same state when the auction action is not legal now.
 */
export function robLandlord(state: GameState, take: boolean, random: () => number = Math.random): GameState {
  if (state.phase !== 'robbing' || state.turn === null || !canRob(state, state.turn)) return state
  const index = state.turn
  const seat = state.seats[index] as Seat
  const counter = isCounterRob(state)
  const firstChoice = isLandlordChoice(state)
  const pendingRobbers = state.pendingRobbers.slice(1)
  const candidateLandlordSeat = take ? index : state.candidateLandlordSeat
  const firstClaimantSeat = state.firstClaimantSeat ?? (take ? index : null)
  const countsAsRob = take && !firstChoice
  const robCount = state.robCount + (countsAsRob ? 1 : 0)
  const multiplier = countsAsRob ? state.multiplier * 2 : state.multiplier
  let next = addLog({
    ...state,
    candidateLandlordSeat,
    firstClaimantSeat,
    pendingRobbers,
    robbedSeats: countsAsRob ? [...state.robbedSeats, index] : state.robbedSeats,
    passedRobSeats: take ? state.passedRobSeats : [...state.passedRobSeats, index],
    robCount,
    multiplier,
  }, take
    ? firstChoice
      ? `${seat.name} 选择当地主，其他人可以抢`
      : `${seat.name}${counter ? ' 抢回地主' : ' 抢地主'}，倍率 ×${multiplier}`
    : `${seat.name}${counter ? ' 放弃抢回' : firstChoice ? ' 不当地主' : ' 不抢'}`)

  if (pendingRobbers.length > 0) return { ...next, turn: pendingRobbers[0] as number }
  if (candidateLandlordSeat === null) return redealAfterNoClaim(next, random)
  if (!counter && robCount > 0 && firstClaimantSeat !== null) {
    next = addLog({ ...next, pendingRobbers: [firstClaimantSeat], turn: firstClaimantSeat },
      `${state.seats[firstClaimantSeat]?.name ?? '最先选择者'} 可以抢回地主`)
    return next
  }
  return startPlaying(next, candidateLandlordSeat)
}

function deal(
  random: () => number,
  handNumber: number,
  tokens: readonly number[],
  initialLandlordSeat: number,
  prefix?: string,
): GameState {
  const deck = shuffle(createDeck(), random)
  const seats = NAMES.map((name, index): Seat => ({
    id: `seat-${index}`,
    name,
    bot: index !== 0,
    hand: sortForDisplay(deck.slice(index * HAND_SIZE, (index + 1) * HAND_SIZE)),
    tokens: tokens[index] ?? STARTING_TOKENS,
    landlord: false,
    passed: false,
    lastPlay: [],
    lastCombo: null,
  }))
  return {
    handNumber,
    phase: 'robbing',
    initialLandlordSeat,
    candidateLandlordSeat: null,
    firstClaimantSeat: null,
    pendingRobbers: [initialLandlordSeat, nextSeat(initialLandlordSeat), nextSeat(nextSeat(initialLandlordSeat))],
    robbedSeats: [],
    passedRobSeats: [],
    robCount: 0,
    seats,
    bottom: sortForDisplay(deck.slice(SEAT_COUNT * HAND_SIZE, SEAT_COUNT * HAND_SIZE + BOTTOM_SIZE)),
    bottomRevealed: false,
    landlordSeat: null,
    baseScore: BASE_STAKE,
    multiplier: 1,
    turn: initialLandlordSeat,
    leader: null,
    required: null,
    userSeat: 0,
    logs: [`${prefix ?? `第 ${handNumber} 局`} · ${NAMES[initialLandlordSeat]} 优先选择是否当地主`],
    winners: [],
    finisherSeat: null,
    matchOver: false,
    bankruptSeats: [],
    spring: 'none',
    landlordPlays: 0,
    farmerPlays: 0,
  }
}

function redealAfterNoClaim(state: GameState, random: () => number): GameState {
  const chooser = nextSeat(state.initialLandlordSeat)
  return deal(random, state.handNumber, state.seats.map(seat => seat.tokens), chooser, '三家都不当地主，重新发牌')
}

/**
 * Play a set of cards for the seat on turn.
 * @param state - the current hand, in the playing phase.
 * @param cardIds - ids of the exact cards to put down.
 * @returns the next state; the same state when the play is not legal now.
 */
export function play(state: GameState, cardIds: readonly number[]): GameState {
  if (state.phase !== 'playing' || state.turn === null) return state
  const index = state.turn
  const seat = state.seats[index] as Seat
  const held = new Set(seat.hand.map(card => card.id))
  if (cardIds.length === 0 || !cardIds.every(id => held.has(id))) return state
  const cards = seat.hand.filter(card => cardIds.includes(card.id))
  const combo = classify(cards)
  if (combo === undefined) return state
  if (state.required !== null && !beats(combo, state.required)) return state

  const hand = withoutIds(seat.hand, cardIds)
  const explosive = combo.kind === 'bomb' || combo.kind === 'rocket'
  let next: GameState = {
    ...state,
    seats: state.seats.map((candidate, candidateIndex) => candidateIndex === index
      ? { ...candidate, hand, passed: false, lastPlay: cards, lastCombo: combo }
      : candidate),
    required: combo,
    leader: index,
    multiplier: explosive ? state.multiplier * 2 : state.multiplier,
    landlordPlays: index === state.landlordSeat ? state.landlordPlays + 1 : state.landlordPlays,
    farmerPlays: index === state.landlordSeat ? state.farmerPlays : state.farmerPlays + 1,
  }
  next = addLog(next, `${seat.name} 出 ${comboText(combo)}${explosive ? ' 💥 倍数 ×2' : ''}`)
  if (hand.length === 0) return settle(next, index)
  return { ...next, turn: nextSeat(index) }
}

/**
 * Pass for the seat on turn.
 * @param state - the current hand, in the playing phase.
 * @returns the next state; the same state when passing is not legal now.
 */
export function pass(state: GameState): GameState {
  if (!canPass(state) || state.turn === null) return state
  const index = state.turn
  const seat = state.seats[index] as Seat
  let next = replaceSeat(state, index, current => ({ ...current, passed: true, lastPlay: [], lastCombo: null }))
  next = addLog(next, `${seat.name} 不要`)
  const upcoming = nextSeat(index)
  if (upcoming === next.leader) {
    // The trick returns to its owner: the table clears and a new lead begins.
    return {
      ...next,
      seats: next.seats.map(candidate => ({ ...candidate, passed: false, lastPlay: [], lastCombo: null })),
      required: null,
      turn: next.leader,
    }
  }
  return { ...next, turn: upcoming }
}

/**
 * Deal a fresh hand, carrying tokens and giving the previous finisher first landlord choice.
 * @param random - randomness source for the shuffle.
 * @param previous - the hand just finished, or undefined for a new table.
 * @returns a hand in the robbing phase.
 */
export function createHand(random: () => number = Math.random, previous?: GameState): GameState {
  if (previous?.matchOver === true) return previous
  const initialLandlordSeat = previous?.finisherSeat ?? Math.min(SEAT_COUNT - 1, Math.floor(random() * SEAT_COUNT))
  return deal(
    random,
    (previous?.handNumber ?? 0) + 1,
    previous?.seats.map(seat => seat.tokens) ?? [],
    initialLandlordSeat,
  )
}

/** A table with fresh token balances. */
export function createTable(random: () => number = Math.random): GameState {
  return createHand(random)
}
