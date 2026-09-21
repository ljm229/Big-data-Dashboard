import assert from 'node:assert/strict'
import test from 'node:test'

function toPercentDisplay(v) {
  if (v == null || v === '') return null
  const n = typeof v === 'number' ? v : Number(String(v).replace(/,/g, ''))
  if (!Number.isFinite(n)) return null
  if (Math.abs(n) <= 1.5) return Number((n * 100).toFixed(4))
  return Number(n.toFixed(4))
}

function top1Gap(current, top1) {
  return Number((top1 - current).toFixed(2))
}

function searchGapPp(shop, rival) {
  if (shop == null || rival == null) return null
  return Number((shop - rival).toFixed(2))
}

test('top1 daily gap matches sample 文峰', () => {
  assert.equal(top1Gap(5189, 5577), 388)
})

test('search gap pp from decimal penetration', () => {
  const shop = toPercentDisplay(0.156)
  const rival = toPercentDisplay(0.237)
  assert.equal(shop, 15.6)
  assert.equal(rival, 23.7)
  assert.equal(searchGapPp(shop, rival), -8.1)
})
