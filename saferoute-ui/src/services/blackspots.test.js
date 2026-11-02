import assert from 'node:assert/strict'
import test from 'node:test'
import { parseBlackspotsResponse } from './blackspots.js'

test('parses the top-level blackspot array returned by Flask', () => {
  const records = [{ id: 1, lat: 21.1, lng: 79.1 }]
  assert.deepEqual(parseBlackspotsResponse(records), records)
})

test('accepts a wrapped blackspot response', () => {
  const records = [{ id: 1, lat: 21.1, lng: 79.1 }]
  assert.deepEqual(parseBlackspotsResponse({ blackspots: records }), records)
})

test('rejects invalid responses instead of treating them as empty data', () => {
  assert.throws(() => parseBlackspotsResponse({}), /invalid response/)
  assert.throws(() => parseBlackspotsResponse(null), /invalid response/)
})
