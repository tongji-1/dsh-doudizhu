import assert from 'node:assert/strict'
import test from 'node:test'
import { deriveWorkNotice } from '../src/client/work-status.ts'

test('work reminders prioritize required user input over running state', () => {
  const summary = { displayTitle: '实现新功能', running: true, pendingInteraction: 'approval' as const }
  assert.deepEqual(deriveWorkNotice(summary, false), { kind: 'approval', title: '实现新功能' })
})

test('work reminders retain an observed completion edge for the game overlay', () => {
  const summary = { displayTitle: '实现新功能', running: false }
  assert.deepEqual(deriveWorkNotice(summary, true), { kind: 'completed', title: '实现新功能' })
  assert.equal(deriveWorkNotice(summary, false), undefined)
})

test('ordinary running work produces a compact progress reminder', () => {
  assert.deepEqual(deriveWorkNotice({ displayTitle: '检查构建', running: true }, false), {
    kind: 'running', title: '检查构建',
  })
})
