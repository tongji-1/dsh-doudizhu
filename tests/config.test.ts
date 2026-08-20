import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('bundled profile uses the stronger DeepSeek opponent configuration', async () => {
  const patch = await readFile(new URL('../cordis.patch.yml', import.meta.url), 'utf8')

  assert.match(patch, /provider:\s+deepseek-official/)
  assert.match(patch, /model:\s+deepseek-v4-pro/)
  assert.match(patch, /reasoningEffort:\s+high/)
  assert.match(patch, /maxTokens:\s+512/)
  assert.match(patch, /timeoutMs:\s+15000/)
})
