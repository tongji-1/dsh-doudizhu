/**
 * Dou Dizhu combination rules: classification, comparison, and legal-move
 * enumeration. Pure functions over {@link Card} sets — no game state, no
 * randomness, so both the local bot and the model prompt read the same truth.
 */

import {
  groupByRank, isJoker, rankCounts, rankText, RANK_ACE, RANK_JOKER_HIGH, RANK_JOKER_LOW, RANK_THREE,
  sortForDisplay, type Card,
} from './cards.ts'

export type ComboKind =
  | 'single' | 'pair' | 'triple' | 'triple-single' | 'triple-pair'
  | 'straight' | 'pair-straight'
  | 'plane' | 'plane-single' | 'plane-pair'
  | 'four-two' | 'four-two-pairs'
  | 'bomb' | 'rocket'

export interface Combo {
  readonly kind: ComboKind
  /** Lead rank: the body's highest rank for runs, the set rank otherwise. */
  readonly rank: number
  /** Consecutive group count for run shapes; 1 for every fixed-size shape. */
  readonly length: number
  /** Card count, so two shapes of one kind never compare across sizes. */
  readonly size: number
}

/** A concrete legal play: the combination plus the exact cards forming it. */
export interface Move {
  readonly combo: Combo
  readonly cards: readonly Card[]
}

const COMBO_LABELS: Readonly<Record<ComboKind, string>> = {
  single: '单张', pair: '对子', triple: '三张', 'triple-single': '三带一', 'triple-pair': '三带二',
  straight: '顺子', 'pair-straight': '连对', plane: '飞机', 'plane-single': '飞机带单',
  'plane-pair': '飞机带对', 'four-two': '四带二', 'four-two-pairs': '四带两对',
  bomb: '炸弹', rocket: '王炸',
}

/** Chinese name of a combination kind, used in the log and the model prompt. */
export function comboLabel(kind: ComboKind): string {
  return COMBO_LABELS[kind]
}

/** One-line description of a play, e.g. `顺子 3-7`. */
export function comboText(combo: Combo): string {
  const label = comboLabel(combo.kind)
  if (combo.kind === 'rocket') return label
  if (combo.length > 1) {
    const low = combo.rank - combo.length + 1
    return `${label} ${rankText(low)}-${rankText(combo.rank)}`
  }
  return `${label} ${rankText(combo.rank)}`
}

function consecutive(ranks: readonly number[]): boolean {
  for (let i = 1; i < ranks.length; i += 1) {
    if ((ranks[i] as number) !== (ranks[i - 1] as number) + 1) return false
  }
  return true
}

/** Ranks sorted ascending that appear at least `minimum` times and can join a run. */
function runnableRanks(counts: ReadonlyMap<number, number>, minimum: number): number[] {
  return [...counts.entries()]
    .filter(([rank, count]) => count >= minimum && rank <= RANK_ACE)
    .map(([rank]) => rank)
    .sort((left, right) => left - right)
}

/** Every consecutive window of exactly `length` ranks drawn from `ranks`. */
function windows(ranks: readonly number[], length: number): number[][] {
  const result: number[][] = []
  for (let start = 0; start + length <= ranks.length; start += 1) {
    const slice = ranks.slice(start, start + length)
    if (consecutive(slice)) result.push(slice)
  }
  return result
}

/** Rank tally left over once three cards of each body rank are removed. */
function wingCounts(counts: ReadonlyMap<number, number>, body: readonly number[]): Map<number, number> {
  const rest = new Map(counts)
  for (const rank of body) {
    const remaining = (rest.get(rank) as number) - 3
    if (remaining > 0) rest.set(rank, remaining)
    else rest.delete(rank)
  }
  return rest
}

function planeShape(cards: readonly Card[], counts: ReadonlyMap<number, number>): Combo | undefined {
  const bodyRanks = runnableRanks(counts, 3)
  for (let length = Math.floor(cards.length / 3); length >= 2; length -= 1) {
    for (const run of windows(bodyRanks, length)) {
      const lead = run[run.length - 1] as number
      const wings = wingCounts(counts, run)
      const wingSize = cards.length - length * 3
      if (wingSize === 0) {
        if (wings.size === 0) return { kind: 'plane', rank: lead, length, size: cards.length }
        continue
      }
      if (wingSize === length) return { kind: 'plane-single', rank: lead, length, size: cards.length }
      if (wingSize === length * 2 && [...wings.values()].every(count => count === 2)) {
        return { kind: 'plane-pair', rank: lead, length, size: cards.length }
      }
    }
  }
  return undefined
}

/**
 * Identify the combination a card set forms.
 * @param cards - the exact cards played, in any order.
 * @returns the combination, or undefined when the set is not a legal play.
 */
export function classify(cards: readonly Card[]): Combo | undefined {
  const size = cards.length
  if (size === 0) return undefined
  const counts = rankCounts(cards)
  const ranks = [...counts.keys()].sort((left, right) => left - right)
  const highest = ranks[ranks.length - 1] as number
  const tally = [...counts.values()].sort((left, right) => right - left)

  if (size === 2 && counts.get(RANK_JOKER_LOW) === 1 && counts.get(RANK_JOKER_HIGH) === 1) {
    return { kind: 'rocket', rank: RANK_JOKER_HIGH, length: 1, size }
  }
  if (size === 4 && tally[0] === 4) return { kind: 'bomb', rank: highest, length: 1, size }
  if (size === 1) return { kind: 'single', rank: highest, length: 1, size }
  if (size === 2 && tally[0] === 2) return { kind: 'pair', rank: highest, length: 1, size }
  if (size === 3 && tally[0] === 3) return { kind: 'triple', rank: highest, length: 1, size }
  if (size === 4 && tally[0] === 3) {
    const body = ranks.find(rank => counts.get(rank) === 3) as number
    return { kind: 'triple-single', rank: body, length: 1, size }
  }
  if (size === 5 && tally[0] === 3 && tally[1] === 2) {
    const body = ranks.find(rank => counts.get(rank) === 3) as number
    return { kind: 'triple-pair', rank: body, length: 1, size }
  }
  if (size === 6 && tally[0] === 4) {
    const body = ranks.find(rank => counts.get(rank) === 4) as number
    return { kind: 'four-two', rank: body, length: 1, size }
  }
  if (size === 8 && tally[0] === 4 && tally[1] === 2 && tally[2] === 2 && ranks.length === 3) {
    const body = ranks.find(rank => counts.get(rank) === 4) as number
    return { kind: 'four-two-pairs', rank: body, length: 1, size }
  }
  if (size >= 5 && tally[0] === 1 && highest <= RANK_ACE && consecutive(ranks)) {
    return { kind: 'straight', rank: highest, length: size, size }
  }
  if (size >= 6 && size % 2 === 0 && tally[0] === 2 && tally[tally.length - 1] === 2
    && highest <= RANK_ACE && consecutive(ranks)) {
    return { kind: 'pair-straight', rank: highest, length: size / 2, size }
  }
  if (size >= 6) return planeShape(cards, counts)
  return undefined
}

/**
 * Whether `candidate` legally answers `required` on the same trick.
 * @param candidate - the combination a player wants to put down.
 * @param required - the combination currently holding the trick.
 * @returns true when the candidate outranks the required play.
 */
export function beats(candidate: Combo, required: Combo): boolean {
  if (candidate.kind === 'rocket') return required.kind !== 'rocket'
  if (required.kind === 'rocket') return false
  if (candidate.kind === 'bomb') {
    return required.kind === 'bomb' ? candidate.rank > required.rank : true
  }
  if (required.kind === 'bomb') return false
  if (candidate.kind !== required.kind) return false
  if (candidate.length !== required.length || candidate.size !== required.size) return false
  return candidate.rank > required.rank
}

/** Cards of `hand` outside `body`, lowest first — the wing-selection pool. */
function kickerPool(hand: readonly Card[], body: ReadonlySet<number>): Card[] {
  return sortForDisplay(hand.filter(card => !body.has(card.rank))).reverse()
}

/**
 * Choose `count` wing cards that damage the hand least: never split a joker
 * pair or a bomb while an ordinary spare exists, and prefer the lowest ranks.
 */
function chooseKickers(pool: readonly Card[], count: number, perGroup: 1 | 2): Card[][] {
  const groups = [...groupByRank(pool).entries()]
    .filter(([, cards]) => cards.length >= perGroup)
    .sort((left, right) => left[0] - right[0])
  const cheap = groups.filter(([rank, cards]) => !isJoker(rank) && cards.length <= perGroup)
  const rest = groups.filter(([rank, cards]) => isJoker(rank) || cards.length > perGroup)
  const ordered = [...cheap, ...rest]
  if (ordered.length < count) return []
  return ordered.slice(0, count).map(([, cards]) => cards.slice(0, perGroup))
}

function fixedMoves(hand: readonly Card[], kind: ComboKind, minimumRank: number): Move[] {
  const groups = groupByRank(hand)
  const moves: Move[] = []
  const size = kind === 'triple-single' ? 4 : kind === 'triple-pair' ? 5 : 0
  for (const [rank, cards] of groups) {
    if (rank <= minimumRank) continue
    if (kind === 'single' && cards.length >= 1) {
      moves.push({ combo: { kind, rank, length: 1, size: 1 }, cards: [cards[cards.length - 1] as Card] })
    }
    if (kind === 'pair' && cards.length >= 2) {
      moves.push({ combo: { kind, rank, length: 1, size: 2 }, cards: cards.slice(-2) })
    }
    if (kind === 'triple' && cards.length >= 3) {
      moves.push({ combo: { kind, rank, length: 1, size: 3 }, cards: cards.slice(-3) })
    }
    if ((kind === 'triple-single' || kind === 'triple-pair') && cards.length >= 3) {
      const body = cards.slice(-3)
      const wings = chooseKickers(kickerPool(hand, new Set([rank])), 1, kind === 'triple-single' ? 1 : 2)
      if (wings.length === 1) {
        moves.push({ combo: { kind, rank, length: 1, size }, cards: [...body, ...(wings[0] as Card[])] })
      }
    }
    if ((kind === 'four-two' || kind === 'four-two-pairs') && cards.length === 4) {
      const perGroup = kind === 'four-two' ? 1 : 2
      const wings = chooseKickers(kickerPool(hand, new Set([rank])), 2, perGroup)
      if (wings.length === 2) {
        moves.push({
          combo: { kind, rank, length: 1, size: 4 + 2 * perGroup },
          cards: [...cards, ...wings.flat()],
        })
      }
    }
    if (kind === 'bomb' && cards.length === 4) {
      moves.push({ combo: { kind, rank, length: 1, size: 4 }, cards })
    }
  }
  return moves
}

function runMoves(hand: readonly Card[], kind: 'straight' | 'pair-straight', length: number, minimumRank: number): Move[] {
  const groups = groupByRank(hand)
  const perRank = kind === 'straight' ? 1 : 2
  const counts = rankCounts(hand)
  const moves: Move[] = []
  for (const run of windows(runnableRanks(counts, perRank), length)) {
    const lead = run[run.length - 1] as number
    if (lead <= minimumRank) continue
    const cards = run.flatMap(rank => (groups.get(rank) as Card[]).slice(-perRank))
    moves.push({ combo: { kind, rank: lead, length, size: cards.length }, cards })
  }
  return moves
}

function planeMoves(
  hand: readonly Card[],
  kind: 'plane' | 'plane-single' | 'plane-pair',
  length: number,
  minimumRank: number,
): Move[] {
  const groups = groupByRank(hand)
  const counts = rankCounts(hand)
  const moves: Move[] = []
  for (const run of windows(runnableRanks(counts, 3), length)) {
    const lead = run[run.length - 1] as number
    if (lead <= minimumRank) continue
    const body = run.flatMap(rank => (groups.get(rank) as Card[]).slice(-3))
    if (kind === 'plane') {
      moves.push({ combo: { kind, rank: lead, length, size: body.length }, cards: body })
      continue
    }
    const perGroup = kind === 'plane-single' ? 1 : 2
    const wings = chooseKickers(kickerPool(hand, new Set(run)), length, perGroup)
    if (wings.length !== length) continue
    const cards = [...body, ...wings.flat()]
    moves.push({ combo: { kind, rank: lead, length, size: cards.length }, cards })
  }
  return moves
}

function rocketMove(hand: readonly Card[]): Move[] {
  const low = hand.find(card => card.rank === RANK_JOKER_LOW)
  const high = hand.find(card => card.rank === RANK_JOKER_HIGH)
  if (low === undefined || high === undefined) return []
  return [{ combo: { kind: 'rocket', rank: RANK_JOKER_HIGH, length: 1, size: 2 }, cards: [low, high] }]
}

/** Every bomb and the rocket, the plays that answer any trick. */
function nuclearMoves(hand: readonly Card[], required?: Combo): Move[] {
  const bombs = fixedMoves(hand, 'bomb', required?.kind === 'bomb' ? required.rank : 0)
  return [...bombs, ...rocketMove(hand)]
}

const MAX_RUN_LENGTH = RANK_ACE - RANK_THREE + 1

/**
 * Every legal play available to a hand, given the trick it must answer.
 * @param hand - the player's remaining cards.
 * @param required - the combination to beat, or undefined when leading a trick.
 * @returns legal moves, ordered by ascending card count then rank.
 */
export function enumerateMoves(hand: readonly Card[], required?: Combo): Move[] {
  if (hand.length === 0) return []
  const moves: Move[] = []
  if (required === undefined) {
    for (const kind of ['single', 'pair', 'triple', 'triple-single', 'triple-pair', 'four-two', 'four-two-pairs'] as const) {
      moves.push(...fixedMoves(hand, kind, 0))
    }
    for (let length = 5; length <= MAX_RUN_LENGTH; length += 1) moves.push(...runMoves(hand, 'straight', length, 0))
    for (let length = 3; length <= MAX_RUN_LENGTH; length += 1) moves.push(...runMoves(hand, 'pair-straight', length, 0))
    for (let length = 2; length <= 6; length += 1) {
      moves.push(...planeMoves(hand, 'plane', length, 0))
      moves.push(...planeMoves(hand, 'plane-single', length, 0))
      moves.push(...planeMoves(hand, 'plane-pair', length, 0))
    }
    moves.push(...nuclearMoves(hand))
  } else if (required.kind === 'rocket') {
    return []
  } else {
    switch (required.kind) {
      case 'straight':
      case 'pair-straight':
        moves.push(...runMoves(hand, required.kind, required.length, required.rank))
        break
      case 'plane':
      case 'plane-single':
      case 'plane-pair':
        moves.push(...planeMoves(hand, required.kind, required.length, required.rank))
        break
      case 'bomb':
        break
      default:
        moves.push(...fixedMoves(hand, required.kind, required.rank))
        break
    }
    moves.push(...nuclearMoves(hand, required))
  }
  return moves.sort((left, right) =>
    left.combo.size - right.combo.size || left.combo.rank - right.combo.rank)
}

/** Whether `cards` is a legal play against `required`. */
export function isLegalPlay(cards: readonly Card[], required?: Combo): boolean {
  const combo = classify(cards)
  if (combo === undefined) return false
  return required === undefined || beats(combo, required)
}
