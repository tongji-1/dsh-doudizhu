/**
 * The table's live state, owned outside React so a hand keeps running while
 * the window is minimized or closed. Bot turns are asynchronous — a model call
 * may take seconds — so every scheduled turn carries a generation stamp and a
 * stale answer is discarded rather than applied to a hand that has moved on.
 */

import { canPass, createHand, createTable, legalMoves, NAMES, play, pass, robLandlord, type GameState } from './game.ts'
import { comboText } from './combos.ts'
import { decideTurn, resetRemoteFailures, type DecisionSource } from './ai-remote.ts'
import { navigateHint, setCardsSelected } from './selection.ts'
import type { Decision } from './ai-local.ts'

const STORAGE_KEY = 'dsh-doudizhu/doudizhu-v4'
const AUCTION_STORAGE_KEY = 'dsh-doudizhu/doudizhu-v3'
const TOKEN_STORAGE_KEY = 'dsh-doudizhu/doudizhu-v2'
const LEGACY_STORAGE_KEY = 'dsh-doudizhu/doudizhu-v1'

export const QUICK_TALKS = ['手下留情', '这把我拿下', '好牌！', '打得漂亮', '别得意', '快点出牌'] as const

const QUICK_TALK_REPLIES: Readonly<Record<string, readonly [string, string]>> = {
  手下留情: ['牌桌上我可不会放水', '嘴上求饶可没用哦'],
  这把我拿下: ['先稳稳打完再说', '口气不小，我等着！'],
  '好牌！': ['好牌也要看怎么出', '被你看出来啦？'],
  打得漂亮: ['承让，节奏刚刚好', '那当然，继续看我的'],
  别得意: ['胜负还没有定', '我就得意这一小会儿'],
  快点出牌: ['好，轮到我会快些', '催我可是会露出破绽的'],
}

/** Personality-matched immediate replies to one supported player quick-talk line. */
export function quickTalkReplies(text: string): readonly [string, string] | undefined {
  return QUICK_TALK_REPLIES[text]
}

/** Where the floating table sits, in viewport pixels. */
export interface WindowBox {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

export interface TurnStatus {
  readonly source: DecisionSource
  readonly model?: string
  readonly error?: string
}

export interface TableTalk {
  readonly id: number
  readonly seat: number
  readonly text: string
  readonly priority: number
}

export interface DialogueLine {
  readonly id: number
  readonly seat: number
  readonly seatName: string
  readonly text: string
}

export interface TableSnapshot {
  /** Whether the window is on screen at all. */
  readonly open: boolean
  /** Collapsed to the corner pill; the hand keeps playing either way. */
  readonly minimized: boolean
  readonly box: WindowBox
  /** False plays the bots entirely offline, with no model calls. */
  readonly useModel: boolean
  readonly game: GameState
  readonly thinkingSeat: number | null
  readonly thinkingSince: number
  readonly status?: TurnStatus | undefined
  readonly talks: readonly TableTalk[]
  readonly dialogue: readonly DialogueLine[]
  readonly quickTalkReadyAt: number
  /** Card ids the human has picked but not yet played. */
  readonly selection: readonly number[]
}

export interface TableStore {
  getSnapshot(): TableSnapshot
  subscribe(listener: () => void): () => void
  open(): void
  close(): void
  toggle(): void
  setMinimized(minimized: boolean): void
  setBox(box: WindowBox): void
  setUseModel(useModel: boolean): void
  toggleCard(id: number): void
  setCardSelected(id: number, selected: boolean): void
  clearSelection(): void
  playSelection(): void
  passTurn(): void
  decideRob(take: boolean): void
  hint(direction?: -1 | 0 | 1): void
  sendQuickTalk(text: string): void
  nextHand(): void
  reset(): void
}

export const DEFAULT_BOX: WindowBox = { x: 0, y: 0, width: 880, height: 600 }
const MIN_WIDTH = 560
const MIN_HEIGHT = 420
const MIN_THINK_MS = 700
const TALK_MS = 4_500
const QUICK_TALK_COOLDOWN_MS = 3_000
const MAX_DIALOGUE = 12

function defaultBox(): WindowBox {
  if (typeof window === 'undefined') return DEFAULT_BOX
  const width = Math.min(DEFAULT_BOX.width, Math.max(MIN_WIDTH, window.innerWidth - 80))
  const height = Math.min(DEFAULT_BOX.height, Math.max(MIN_HEIGHT, window.innerHeight - 120))
  return {
    width,
    height,
    x: Math.max(16, window.innerWidth - width - 32),
    y: Math.max(16, window.innerHeight - height - 32),
  }
}

/** Keep a box inside the viewport and above the minimum usable size. */
export function clampBox(box: WindowBox, viewportWidth: number, viewportHeight: number): WindowBox {
  const width = Math.max(MIN_WIDTH, Math.min(box.width, viewportWidth))
  const height = Math.max(MIN_HEIGHT, Math.min(box.height, viewportHeight))
  return {
    width,
    height,
    x: Math.max(0, Math.min(box.x, Math.max(0, viewportWidth - width))),
    y: Math.max(0, Math.min(box.y, Math.max(0, viewportHeight - height))),
  }
}

function idle(game: GameState, previous?: Partial<TableSnapshot>): TableSnapshot {
  return {
    open: previous?.open ?? false,
    minimized: previous?.minimized ?? false,
    box: previous?.box ?? defaultBox(),
    useModel: previous?.useModel ?? true,
    game,
    thinkingSeat: null,
    thinkingSince: 0,
    talks: [],
    dialogue: previous?.dialogue ?? [],
    quickTalkReadyAt: 0,
    selection: [],
  }
}

function isBox(value: unknown): value is WindowBox {
  if (typeof value !== 'object' || value === null) return false
  const box = value as Record<string, unknown>
  return ['x', 'y', 'width', 'height'].every(key => Number.isFinite(box[key]))
}

function load(): TableSnapshot {
  if (typeof window === 'undefined') return idle(createTable())
  try {
    const current = window.localStorage.getItem(STORAGE_KEY)
    const auctionVersion = window.localStorage.getItem(AUCTION_STORAGE_KEY)
    const tokenVersion = window.localStorage.getItem(TOKEN_STORAGE_KEY)
    const raw = current ?? auctionVersion ?? tokenVersion ?? window.localStorage.getItem(LEGACY_STORAGE_KEY)
    if (raw === null) return idle(createTable())
    const parsed = JSON.parse(raw) as Partial<TableSnapshot>
    const common = {
      box: isBox(parsed.box) ? parsed.box : defaultBox(),
      useModel: parsed.useModel !== false,
      minimized: parsed.minimized === true,
    }
    // v1 scores could be negative and are discarded. v2 token balances are
    // preserved, but its in-progress numeric auction state cannot enter the
    // new rob-landlord state machine, so migration deals a fresh hand.
    if (current === null && auctionVersion === null && tokenVersion === null) return idle(createTable(), common)
    const savedGame = parsed.game
    if (savedGame === undefined || !Array.isArray(savedGame.seats) || savedGame.seats.length !== 3
      || savedGame.seats.some(seat => !Number.isFinite(seat.tokens))) {
      throw new Error('invalid saved table')
    }
    const dialogue = Array.isArray(parsed.dialogue)
      ? parsed.dialogue.slice(-MAX_DIALOGUE).filter((entry): entry is DialogueLine =>
        typeof entry === 'object' && entry !== null
        && Number.isInteger(entry.seat) && typeof entry.seatName === 'string' && typeof entry.text === 'string')
      : []
    if (current === null) {
      const balances = savedGame.seats.map(seat => Math.max(0, Math.floor(seat.tokens)))
      const validBankroll = balances.reduce((sum, value) => sum + value, 0) === 300 && balances.every(value => value > 0)
      const fresh = createTable()
      const game: GameState = validBankroll
        ? { ...fresh, seats: fresh.seats.map((seat, index) => ({ ...seat, tokens: balances[index] ?? seat.tokens })) }
        : fresh
      return idle(game, { ...common, dialogue })
    }
    if (savedGame.phase !== 'robbing' && savedGame.phase !== 'playing' && savedGame.phase !== 'over') {
      throw new Error('invalid saved table phase')
    }
    if (!Number.isInteger(savedGame.initialLandlordSeat)
      || savedGame.candidateLandlordSeat !== null && !Number.isInteger(savedGame.candidateLandlordSeat)
      || savedGame.firstClaimantSeat !== null && !Number.isInteger(savedGame.firstClaimantSeat)
      || !Array.isArray(savedGame.pendingRobbers) || !Array.isArray(savedGame.robbedSeats)
      || !Array.isArray(savedGame.passedRobSeats) || !Number.isInteger(savedGame.robCount)
      || !Number.isInteger(savedGame.finisherSeat) && savedGame.finisherSeat !== null) {
      throw new Error('invalid saved landlord auction')
    }
    // Seat labels are presentation identity rather than historical game data.
    // Refresh them on load so an existing persisted hand adopts current names.
    const game: GameState = {
      ...savedGame,
      seats: savedGame.seats.map((seat, index) => ({
        ...seat,
        name: NAMES[index] ?? seat.name,
      })),
    }
    return idle(game, {
      // Stored verbatim: the box is what the user chose, and the view clamps it
      // to the live viewport at render time so a narrow window never shrinks it.
      ...common,
      dialogue,
    })
  } catch {
    return idle(createTable())
  }
}

/**
 * Create the table store and start its turn loop.
 * @returns the store; the caller owns nothing else, the loop is self-driving.
 */
export function createTableStore(): TableStore {
  let snapshot = load()
  let generation = 0
  let turnTimer: ReturnType<typeof setTimeout> | undefined
  const talkTimers = new Map<number, ReturnType<typeof setTimeout>>()
  const replyTimers = new Set<ReturnType<typeof setTimeout>>()
  let controller: AbortController | undefined
  let talkId = 0
  const listeners = new Set<() => void>()

  const publish = (next: TableSnapshot, persist = true): void => {
    snapshot = next
    if (persist && typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
          game: snapshot.game,
          box: snapshot.box,
          useModel: snapshot.useModel,
          minimized: snapshot.minimized,
          dialogue: snapshot.dialogue,
        }))
      } catch {
        // Storage can be full or disabled; the hand continues in memory.
      }
    }
    for (const listener of listeners) listener()
  }

  const showTalk = (seat: number, text: string | undefined, priority = 1, record = true): void => {
    const trimmed = text?.trim().slice(0, 24)
    if (trimmed === undefined || trimmed === '') return
    const current = snapshot.talks.find(talk => talk.seat === seat)
    if (current !== undefined && current.priority > priority) return
    if (snapshot.dialogue.slice(-4).some(line => line.seat === seat && line.text === trimmed)) return
    talkId += 1
    const talk: TableTalk = { id: talkId, seat, text: trimmed, priority }
    const baseDialogue = current !== undefined && current.priority < priority
      ? snapshot.dialogue.filter(line => line.id !== current.id)
      : snapshot.dialogue
    const dialogue = record
      ? [...baseDialogue, { id: talk.id, seat, seatName: snapshot.game.seats[seat]?.name ?? NAMES[seat] ?? '玩家', text: trimmed }].slice(-MAX_DIALOGUE)
      : snapshot.dialogue
    publish({ ...snapshot, talks: [...snapshot.talks.filter(entry => entry.seat !== seat), talk], dialogue }, record)
    const previousTimer = talkTimers.get(seat)
    if (previousTimer !== undefined) clearTimeout(previousTimer)
    const timer = setTimeout(() => {
      if (snapshot.talks.some(entry => entry.id === talk.id)) {
        publish({ ...snapshot, talks: snapshot.talks.filter(entry => entry.id !== talk.id) }, false)
      }
      talkTimers.delete(seat)
    }, TALK_MS)
    talkTimers.set(seat, timer)
  }

  const fallbackTalk = (seat: number, decision: Decision): string => {
    const bold = seat === 2
    if (decision.kind === 'rob') {
      if (!decision.take) return bold ? '这次先不抢' : '先让你们决定'
      return bold ? '这个地主我要了' : '牌不错，我来坐庄'
    }
    if (decision.kind === 'pass') return bold ? '这手先让你' : '不急，先过'
    return bold ? '看我的' : '稳稳出牌'
  }

  const reactToTransition = (previous: GameState, next: GameState): void => {
    if (previous.phase === 'robbing' && previous.candidateLandlordSeat === null && next.candidateLandlordSeat !== null) {
      const actor = previous.turn
      if (actor === 1 || actor === 2) {
        showTalk(actor, actor === 1 ? '这一局我先来坐庄' : '地主位我先拿下！', 3)
      }
      for (const seat of [1, 2]) {
        if (seat !== actor && seat === next.turn) showTalk(seat, seat === 1 ? '我再看看要不要抢' : '想坐庄还得问问我', 2)
      }
    }
    if (previous.phase === 'robbing' && next.phase === 'robbing' && next.robCount > previous.robCount) {
      const actor = previous.turn
      if (actor !== null) {
        if (actor === 1 || actor === 2) {
          showTalk(actor, actor === 1 ? '既然有机会，我来坐庄' : '这地主我抢了！', 3)
        }
        for (const seat of [1, 2]) {
          if (seat !== actor && seat === next.turn) showTalk(seat, seat === 1 ? '让我看看值不值得跟' : '想坐庄？先问问我', 2)
        }
      }
    }
    if (previous.phase === 'robbing' && next.phase === 'playing' && next.landlordSeat !== null) {
      for (const seat of [1, 2]) {
        showTalk(seat, seat === next.landlordSeat
          ? (seat === 1 ? '地主位，我接了' : '这地主归我了')
          : (seat === 1 ? '农民要好好配合' : '那就一起拦地主'), 2)
      }
    }
    const actor = previous.turn
    if (actor !== null && previous.phase === 'playing') {
      const combo = next.seats[actor]?.lastCombo
      if (combo?.kind === 'bomb' || combo?.kind === 'rocket') {
        for (const seat of [1, 2]) {
          if (seat !== actor) showTalk(seat, seat === 1 ? '炸弹也要沉住气' : '这才有意思！', 3)
        }
      }
      const remaining = next.seats[actor]?.hand.length
      if ((remaining === 1 || remaining === 2) && next.phase !== 'over') {
        for (const seat of [1, 2]) {
          if (seat !== actor) showTalk(seat, `${next.seats[actor]?.name ?? '对手'}报${remaining === 1 ? '单' : '双'}了`, 3)
        }
      }
    }
    if (previous.phase !== 'over' && next.phase === 'over') {
      for (const seat of [1, 2]) {
        const text = next.bankruptSeats.includes(seat)
          ? '筹码见底了…'
          : next.winners.includes(seat)
            ? (seat === 1 ? '配合得不错' : '这局漂亮！')
            : (seat === 1 ? '记住节奏，下局再来' : '下一局我会赢回来')
        showTalk(seat, text, next.matchOver ? 4 : 3)
      }
    }
  }

  const stop = (): void => {
    generation += 1
    if (turnTimer !== undefined) clearTimeout(turnTimer)
    turnTimer = undefined
    controller?.abort()
    controller = undefined
    if (snapshot.thinkingSeat !== null) publish({ ...snapshot, thinkingSeat: null, thinkingSince: 0 }, false)
  }

  const schedule = (): void => {
    if (turnTimer !== undefined) clearTimeout(turnTimer)
    turnTimer = undefined
    const { game } = snapshot
    const seat = game.turn === null ? undefined : game.seats[game.turn]
    if (game.phase === 'over' || game.matchOver || seat === undefined || !seat.bot) {
      if (snapshot.thinkingSeat !== null) publish({ ...snapshot, thinkingSeat: null, thinkingSince: 0 }, false)
      return
    }
    const index = game.turn as number
    generation += 1
    const stamp = generation
    controller?.abort()
    controller = new AbortController()
    const signal = controller.signal
    publish({ ...snapshot, thinkingSeat: index, thinkingSince: Date.now() }, false)

    const started = Date.now()
    const dialogue = snapshot.dialogue.map(line => ({ seatName: line.seatName, text: line.text }))
    void decideTurn(game, index, snapshot.useModel, signal, dialogue).then((outcome) => {
      if (stamp !== generation) return
      const wait = Math.max(0, MIN_THINK_MS - (Date.now() - started))
      turnTimer = setTimeout(() => {
        turnTimer = undefined
        if (stamp !== generation) return
        const { decision } = outcome
        const applied = decision.kind === 'rob'
          ? robLandlord(snapshot.game, decision.take)
          : decision.kind === 'pass'
            ? pass(snapshot.game)
            : play(snapshot.game, decision.cardIds)
        // A rejected decision would freeze the table; force a legal move instead.
        const settled = applied === snapshot.game ? forceLegal(snapshot.game, index) : applied
        const status: TurnStatus = {
          source: outcome.source,
          ...outcome.model === undefined ? {} : { model: outcome.model },
          ...outcome.error === undefined ? {} : { error: outcome.error },
        }
        const previous = snapshot.game
        publish({ ...snapshot, game: settled, thinkingSeat: null, thinkingSince: 0, status, selection: [] })
        showTalk(index, decision.say ?? fallbackTalk(index, decision))
        reactToTransition(previous, settled)
        // A turn that produced no state change would spin the loop forever.
        if (settled !== game) schedule()
      }, wait)
    })
  }

  const apply = (next: GameState): void => {
    if (next === snapshot.game) return
    const previous = snapshot.game
    const changedHand = next.handNumber !== previous.handNumber
    stop()
    if (changedHand) {
      for (const timer of talkTimers.values()) clearTimeout(timer)
      talkTimers.clear()
    }
    publish({ ...snapshot, game: next, selection: [], status: undefined, talks: changedHand ? [] : snapshot.talks })
    reactToTransition(previous, next)
    schedule()
  }

  const restart = (): void => {
    stop()
    for (const timer of talkTimers.values()) clearTimeout(timer)
    talkTimers.clear()
    for (const timer of replyTimers) clearTimeout(timer)
    replyTimers.clear()
    publish({
      ...snapshot,
      game: createTable(),
      selection: [],
      talks: [],
      dialogue: [],
      quickTalkReadyAt: 0,
      status: undefined,
    })
    schedule()
  }

  const store: TableStore = {
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
    open: () => { publish({ ...snapshot, open: true, minimized: false }) },
    close: () => { publish({ ...snapshot, open: false }) },
    toggle: () => {
      publish(snapshot.open && !snapshot.minimized
        ? { ...snapshot, open: false }
        : { ...snapshot, open: true, minimized: false })
    },
    setMinimized: (minimized) => { publish({ ...snapshot, minimized }) },
    setBox: (box) => { publish({ ...snapshot, box }) },
    setUseModel: (useModel) => {
      resetRemoteFailures()
      publish({ ...snapshot, useModel })
    },
    toggleCard: (id) => {
      if (snapshot.game.phase !== 'playing' || snapshot.game.turn !== snapshot.game.userSeat) return
      const selection = snapshot.selection.includes(id)
        ? snapshot.selection.filter(card => card !== id)
        : [...snapshot.selection, id]
      publish({ ...snapshot, selection }, false)
    },
    setCardSelected: (id, selected) => {
      if (snapshot.game.phase !== 'playing' || snapshot.game.turn !== snapshot.game.userSeat) return
      const held = snapshot.game.seats[snapshot.game.userSeat]?.hand.some(card => card.id === id) === true
      if (!held) return
      publish({ ...snapshot, selection: setCardsSelected(snapshot.selection, [id], selected) }, false)
    },
    clearSelection: () => { publish({ ...snapshot, selection: [] }, false) },
    playSelection: () => { apply(play(snapshot.game, snapshot.selection)) },
    passTurn: () => { if (canPass(snapshot.game)) apply(pass(snapshot.game)) },
    decideRob: (take) => { apply(robLandlord(snapshot.game, take)) },
    hint: (direction = 0) => {
      const { game } = snapshot
      if (game.phase !== 'playing' || game.turn !== game.userSeat) return
      const next = navigateHint(game, game.userSeat, direction === 0 ? [] : snapshot.selection, direction === -1 ? -1 : 1)
      if (next !== undefined) publish({ ...snapshot, selection: next.ids }, false)
    },
    sendQuickTalk: (text) => {
      if (!(QUICK_TALKS as readonly string[]).includes(text) || Date.now() < snapshot.quickTalkReadyAt) return
      publish({ ...snapshot, quickTalkReadyAt: Date.now() + QUICK_TALK_COOLDOWN_MS }, false)
      showTalk(snapshot.game.userSeat, text, 2)
      const replies = quickTalkReplies(text)
      if (replies !== undefined) {
        for (const [offset, seat] of [1, 2].entries()) {
          const timer = setTimeout(() => {
            replyTimers.delete(timer)
            showTalk(seat, replies[seat - 1], 2)
          }, 380 + offset * 520)
          replyTimers.add(timer)
        }
      }
    },
    nextHand: () => {
      if (snapshot.game.matchOver) restart()
      else apply(createHand(Math.random, snapshot.game))
    },
    reset: () => {
      resetRemoteFailures()
      restart()
    },
  }

  schedule()
  return store
}

/** Last-resort legal move, used when a decision was rejected by the rules. */
function forceLegal(game: GameState, index: number): GameState {
  if (game.phase === 'robbing') return robLandlord(game, false)
  const moves = legalMoves(game, index)
  if (canPass(game)) return pass(game)
  const first = moves[0]
  return first === undefined ? game : play(game, first.cards.map(card => card.id))
}
