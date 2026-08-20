/** Work-state facts projected by Harness into the standard session-list feed. */
export interface WorkSessionSummary {
  readonly displayTitle?: string
  readonly running: boolean
  readonly pendingInteraction?: 'approval' | 'plan-review' | 'question'
  readonly completed?: boolean
}

export type WorkNoticeKind = 'running' | 'approval' | 'plan-review' | 'question' | 'completed'

export interface WorkNotice {
  readonly kind: WorkNoticeKind
  readonly title: string
}

/**
 * Select the most urgent work notice for the game overlay.
 * @param summary - current Harness task summary, when a task is selected.
 * @param completedEdge - true after this overlay observed running become idle.
 * @returns one notice, with user input ahead of completion and ordinary progress.
 */
export function deriveWorkNotice(summary: WorkSessionSummary | undefined, completedEdge: boolean): WorkNotice | undefined {
  if (summary === undefined) return undefined
  if (summary.pendingInteraction !== undefined) {
    return { kind: summary.pendingInteraction, title: summary.displayTitle ?? '' }
  }
  if (completedEdge || summary.completed === true) return { kind: 'completed', title: summary.displayTitle ?? '' }
  if (summary.running) return { kind: 'running', title: summary.displayTitle ?? '' }
  return undefined
}
