/** Client-side contracts: the harness faces this plugin reads, and the slot face it publishes. */

import type { TableSnapshot, TableStore, WindowBox } from './store.ts'

export interface SessionSummary {
  readonly id?: string
  readonly displayTitle?: string
  readonly running: boolean
  readonly pendingInteraction?: 'approval' | 'plan-review' | 'question'
  readonly completed?: boolean
}

export interface SessionListState {
  readonly current?: string
  readonly byId: Readonly<Record<string, SessionSummary | undefined>>
}

export type SelectorHook<T> = <Selected>(selector: (state: T) => Selected) => Selected

/** Framework-standard props every slot registrant receives. */
export interface StandardProps {
  readonly useSessions: SelectorHook<SessionListState>
}

/** The store surface both slot components consume. */
export interface TableFace {
  readonly useTable: SelectorHook<TableSnapshot>
  readonly openTable: () => void
  readonly closeTable: () => void
  readonly setMinimized: (minimized: boolean) => void
  readonly setBox: (box: WindowBox) => void
  readonly setUseModel: (useModel: boolean) => void
  readonly toggleCard: (id: number) => void
  readonly setCardSelected: (id: number, selected: boolean) => void
  readonly clearSelection: () => void
  readonly playSelection: () => void
  readonly passTurn: () => void
  readonly decideRob: (take: boolean) => void
  readonly hint: (direction?: -1 | 0 | 1) => void
  readonly sendQuickTalk: (text: string) => void
  readonly nextHand: () => void
  readonly resetTable: () => void
}

/** The shape `ctx.slots` exposes to a registrant. */
export interface SlotsFace {
  inject(name: string, register: () => (() => void) | void): void
  register(options: Record<string, unknown>, component: unknown): () => void
}

export interface LocaleFace {
  register(namespace: string, dictionaries: Record<string, Record<string, string>>): () => void
  bind(namespace: string): (key: string) => string
}

export interface ClientCtx {
  readonly slots: SlotsFace
  readonly locale: LocaleFace
  effect(effect: () => (() => void) | void, label?: string): void
}

/** Build the slot face from a live store. */
export function createFace(store: TableStore): Omit<TableFace, 'useTable'> & { hooks: { table: TableStore } } {
  return {
    hooks: { table: store },
    openTable: store.open,
    closeTable: store.close,
    setMinimized: store.setMinimized,
    setBox: store.setBox,
    setUseModel: store.setUseModel,
    toggleCard: store.toggleCard,
    setCardSelected: store.setCardSelected,
    clearSelection: store.clearSelection,
    playSelection: store.playSelection,
    passTurn: store.passTurn,
    decideRob: store.decideRob,
    hint: store.hint,
    sendQuickTalk: store.sendQuickTalk,
    nextHand: store.nextHand,
    resetTable: store.reset,
  }
}
