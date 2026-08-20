/** Dou Dizhu card model: a 54-card deck ranked 3 < … < A < 2 < 小王 < 大王. */

export const SUITS = ['clubs', 'diamonds', 'hearts', 'spades'] as const

export type Suit = typeof SUITS[number] | 'joker'

/** Lowest rank in a straight-capable run. */
export const RANK_THREE = 3
/** Highest rank a straight, pair-straight, or plane may reach (Ace). */
export const RANK_ACE = 14
/** Rank of the deuce: outranks the Ace but never joins a run. */
export const RANK_TWO = 15
/** Rank of the black joker (小王). */
export const RANK_JOKER_LOW = 16
/** Rank of the red joker (大王). */
export const RANK_JOKER_HIGH = 17

export interface Card {
  /** Stable identity within one deck, used as a React key and for set algebra. */
  readonly id: number
  readonly rank: number
  readonly suit: Suit
}

const RANK_LABELS: Readonly<Record<number, string>> = {
  11: 'J', 12: 'Q', 13: 'K', 14: 'A', 15: '2', 16: 'w', 17: 'W',
}

/** Short label for one rank, as printed on the card and used in model prompts. */
export function rankText(rank: number): string {
  return RANK_LABELS[rank] ?? String(rank)
}

/** Unicode pip for one suit; jokers render a star instead. */
export function suitText(suit: Suit): string {
  if (suit === 'spades') return '♠'
  if (suit === 'hearts') return '♥'
  if (suit === 'diamonds') return '♦'
  if (suit === 'clubs') return '♣'
  return '★'
}

/** Whether the card paints red (hearts, diamonds, and the red joker). */
export function isRed(card: Card): boolean {
  return card.suit === 'hearts' || card.suit === 'diamonds' || card.rank === RANK_JOKER_HIGH
}

/** Whether the rank is one of the two jokers. */
export function isJoker(rank: number): boolean {
  return rank >= RANK_JOKER_LOW
}

/** Human-readable card text, e.g. `A♠`, `10♦`, `大王`. */
export function cardText(card: Card): string {
  if (card.rank === RANK_JOKER_HIGH) return '大王'
  if (card.rank === RANK_JOKER_LOW) return '小王'
  return `${rankText(card.rank)}${suitText(card.suit)}`
}

/** Rank-only text for a whole set, the compact form sent to the model. */
export function handText(cards: readonly Card[]): string {
  return sortForDisplay(cards).map(card => rankText(card.rank)).join(' ')
}

/** A fresh 54-card deck in canonical order. */
export function createDeck(): Card[] {
  const cards: Card[] = []
  let id = 0
  for (let rank = RANK_THREE; rank <= RANK_TWO; rank += 1) {
    for (const suit of SUITS) {
      cards.push({ id, rank, suit })
      id += 1
    }
  }
  cards.push({ id: id, rank: RANK_JOKER_LOW, suit: 'joker' })
  cards.push({ id: id + 1, rank: RANK_JOKER_HIGH, suit: 'joker' })
  return cards
}

/** Fisher-Yates over a copy; the caller owns the randomness source. */
export function shuffle<T>(items: readonly T[], random: () => number = Math.random): T[] {
  const result = [...items]
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1))
    const value = result[i] as T
    result[i] = result[j] as T
    result[j] = value
  }
  return result
}

/** Descending by rank, then by suit, so a hand always renders in a stable order. */
export function sortForDisplay(cards: readonly Card[]): Card[] {
  return [...cards].sort((left, right) => right.rank - left.rank || right.id - left.id)
}

/** Count of each rank present, keyed by rank. */
export function rankCounts(cards: readonly Card[]): Map<number, number> {
  const counts = new Map<number, number>()
  for (const card of cards) counts.set(card.rank, (counts.get(card.rank) ?? 0) + 1)
  return counts
}

/** Cards grouped by rank, each group ordered by id. */
export function groupByRank(cards: readonly Card[]): Map<number, Card[]> {
  const groups = new Map<number, Card[]>()
  for (const card of sortForDisplay(cards)) {
    const group = groups.get(card.rank)
    if (group === undefined) groups.set(card.rank, [card])
    else group.push(card)
  }
  return groups
}

/** The subset of `cards` whose ids appear in `ids`, preserving hand order. */
export function pickByIds(cards: readonly Card[], ids: readonly number[]): Card[] {
  const wanted = new Set(ids)
  return cards.filter(card => wanted.has(card.id))
}

/** `cards` minus every id in `removed`. */
export function withoutIds(cards: readonly Card[], removed: readonly number[]): Card[] {
  const gone = new Set(removed)
  return cards.filter(card => !gone.has(card.id))
}
