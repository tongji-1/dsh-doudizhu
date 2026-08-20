/** Shared fixtures: build exact card sets from short rank text. */

import { SUITS, type Card } from '../src/client/cards.ts'

const RANK_BY_TEXT: Readonly<Record<string, number>> = {
  3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8, 9: 9, 10: 10,
  J: 11, Q: 12, K: 13, A: 14, 2: 15, w: 16, W: 17,
}

/**
 * Build cards from rank labels, e.g. `cards('3 3 4 5 6 7 8')`.
 * Repeated ranks receive distinct suits, so a set of four is a real bomb.
 */
export function cards(text: string): Card[] {
  const seen = new Map<number, number>()
  let id = 0
  return text.trim().split(/\s+/).map((token) => {
    const rank = RANK_BY_TEXT[token]
    if (rank === undefined) throw new Error(`unknown rank ${token}`)
    const copy = seen.get(rank) ?? 0
    seen.set(rank, copy + 1)
    id += 1
    return { id, rank, suit: rank >= 16 ? 'joker' : SUITS[copy % SUITS.length] as Card['suit'] }
  })
}

/** A deterministic random source cycling through a fixed sequence. */
export function seeded(values: readonly number[]): () => number {
  let index = 0
  return () => {
    const value = values[index % values.length] as number
    index += 1
    return value
  }
}
