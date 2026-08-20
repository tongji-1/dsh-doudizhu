import assert from 'node:assert/strict'
import test from 'node:test'
import { createTableStore } from '../src/client/store.ts'

function memoryStorage(seed: Readonly<Record<string, string>> = {}): Storage {
  const values = new Map(Object.entries(seed))
  return {
    get length() { return values.size },
    clear: () => { values.clear() },
    getItem: key => values.get(key) ?? null,
    key: index => [...values.keys()][index] ?? null,
    removeItem: key => { values.delete(key) },
    setItem: (key, value) => { values.set(key, value) },
  }
}

test('legacy scores reset to 100-token seats while UI settings survive, then v4 restores dialogue and bot replies', async () => {
  const storage = memoryStorage({
    'dsh-doudizhu/doudizhu-v1': JSON.stringify({
      game: { seats: [{ score: -900 }, { score: 450 }, { score: 450 }] },
      box: { x: 21, y: 22, width: 700, height: 500 },
      useModel: false,
      minimized: true,
    }),
  })
  const fakeWindow = { localStorage: storage, innerWidth: 1200, innerHeight: 900 }
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'window')
  const originalRandom = Math.random
  Object.defineProperty(globalThis, 'window', { configurable: true, value: fakeWindow })
  Math.random = () => 0.01
  try {
    const first = createTableStore()
    assert.deepEqual(first.getSnapshot().game.seats.map(seat => seat.tokens), [100, 100, 100])
    assert.deepEqual(first.getSnapshot().box, { x: 21, y: 22, width: 700, height: 500 })
    assert.equal(first.getSnapshot().useModel, false)
    assert.equal(first.getSnapshot().minimized, true)

    first.sendQuickTalk('手下留情')
    first.sendQuickTalk('别得意')
    assert.equal(first.getSnapshot().dialogue.length, 1)
    assert.equal(first.getSnapshot().talks[0]?.seat, 0)
    assert.notEqual(storage.getItem('dsh-doudizhu/doudizhu-v4'), null)

    await new Promise(resolve => setTimeout(resolve, 1_050))
    assert.equal(first.getSnapshot().dialogue.some(line => line.seat === 0 && line.text === '手下留情'), true)
    assert.equal(first.getSnapshot().dialogue.some(line => line.seat === 1 && /放水/.test(line.text)), true)
    assert.equal(first.getSnapshot().dialogue.some(line => line.seat === 2 && /求饶/.test(line.text)), true)

    const restored = createTableStore()
    assert.equal(restored.getSnapshot().dialogue.some(line => line.text === '手下留情'), true)
    assert.equal(restored.getSnapshot().dialogue.some(line => line.seat === 1), true)
    assert.equal(restored.getSnapshot().dialogue.some(line => line.seat === 2), true)
    assert.equal(restored.getSnapshot().talks.length, 0)
    restored.reset()
    first.reset()
  } finally {
    Math.random = originalRandom
    if (descriptor === undefined) delete (globalThis as { window?: unknown }).window
    else Object.defineProperty(globalThis, 'window', descriptor)
  }
})

test('v3 auction state migrates into a fresh priority-choice hand while preserving bankroll', () => {
  const storage = memoryStorage({
    'dsh-doudizhu/doudizhu-v3': JSON.stringify({
      game: { seats: [{ tokens: 108 }, { tokens: 96 }, { tokens: 96 }] },
      useModel: false,
    }),
  })
  const fakeWindow = { localStorage: storage, innerWidth: 1200, innerHeight: 900 }
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'window')
  Object.defineProperty(globalThis, 'window', { configurable: true, value: fakeWindow })
  try {
    const store = createTableStore()
    const game = store.getSnapshot().game
    assert.equal(game.phase, 'robbing')
    assert.equal(game.candidateLandlordSeat, null)
    assert.equal(game.turn, game.initialLandlordSeat)
    assert.deepEqual(game.seats.map(seat => seat.tokens), [108, 96, 96])
    store.reset()
  } finally {
    if (descriptor === undefined) delete (globalThis as { window?: unknown }).window
    else Object.defineProperty(globalThis, 'window', descriptor)
  }
})

test('v2 bankroll and UI settings migrate into a fresh rob-landlord hand', () => {
  const storage = memoryStorage({
    'dsh-doudizhu/doudizhu-v2': JSON.stringify({
      game: { seats: [{ tokens: 120 }, { tokens: 90 }, { tokens: 90 }] },
      box: { x: 31, y: 32, width: 760, height: 520 },
      useModel: false,
      minimized: false,
      dialogue: [{ id: 7, seat: 2, seatName: '汐音', text: '再来一局' }],
    }),
  })
  const fakeWindow = { localStorage: storage, innerWidth: 1200, innerHeight: 900 }
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'window')
  Object.defineProperty(globalThis, 'window', { configurable: true, value: fakeWindow })
  try {
    const store = createTableStore()
    const snapshot = store.getSnapshot()
    assert.equal(snapshot.game.phase, 'robbing')
    assert.deepEqual(snapshot.game.seats.map(seat => seat.tokens), [120, 90, 90])
    assert.deepEqual(snapshot.box, { x: 31, y: 32, width: 760, height: 520 })
    assert.equal(snapshot.useModel, false)
    assert.equal(snapshot.dialogue.at(-1)?.text, '再来一局')
    store.reset()
  } finally {
    if (descriptor === undefined) delete (globalThis as { window?: unknown }).window
    else Object.defineProperty(globalThis, 'window', descriptor)
  }
})
