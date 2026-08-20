import assert from 'node:assert/strict'
import test from 'node:test'

import { STYLES } from '../src/client/styles.ts'

test('the table owns an opaque foreground surface', () => {
  assert.match(
    STYLES,
    /--ddz-solid-surface:\s*var\(--dsw-alias-bg-overlay,\s*#fff\)/,
  )
  assert.match(STYLES, /\.ddz-window\s*\{[^}]*background:\s*var\(--ddz-solid-surface\)/s)
  assert.doesNotMatch(STYLES, /\.ddz-window\s*\{[^}]*background:\s*var\(--dsw-alias-bg-base\)/s)
})

test('the maid skin receives a dedicated navy, porcelain and gold treatment', () => {
  assert.match(STYLES, /body\[data-dsh-maid-atelier\]\s+\.ddz-window\s*\{/)
  assert.match(STYLES, /--ddz-navy:\s*#0b173b/)
  assert.match(STYLES, /--ddz-porcelain:\s*#f8f6f0/)
  assert.match(STYLES, /--ddz-gold:\s*#c5a468/)
  assert.match(STYLES, /body\[data-dsh-maid-atelier\]\s+\[data-ddz-nav-entry\]/)
  assert.match(STYLES, /\.ddz-bot-character\s*\{/)
  assert.match(STYLES, /data-skin-chrome="character-stage"/)
})

test('the result view owns a scroll-safe settlement card', () => {
  assert.match(STYLES, /\.ddz-center\[data-result="true"\][^{]*\{[^}]*overflow:\s*auto/s)
  assert.match(STYLES, /\.ddz-settlement\s*\{[^}]*max-height:\s*100%[^}]*overflow:\s*auto/s)
  assert.match(STYLES, /\.ddz-settlement-payment\s*\{/)
})

test('work reminders expose running, attention, and completion treatments', () => {
  assert.match(STYLES, /\.ddz-work-reminder\s*\{/)
  assert.match(STYLES, /data-kind="running"/)
  assert.match(STYLES, /data-kind="approval"/)
  assert.match(STYLES, /data-kind="completed"/)
})
