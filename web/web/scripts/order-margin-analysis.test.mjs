import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  selectOrderMarginFacts,
  summarizeOrderMargin,
  storeProfitWeekRows,
  wowDelta,
} from '../src/utils/orderMarginAnalysis.ts'

const real = JSON.parse(readFileSync(new URL('../src/data/orderMarginData.json', import.meta.url), 'utf8'))
const stores = [{ name: '淘宝便利店（黄桥店）', city: '泰州' }]

function ratioValue(delta) {
  if (delta == null || Number.isNaN(delta)) return '—'
  const sign = delta >= 0 ? '+' : ''
  return `${sign}${(delta * 100).toFixed(1)}%`
}

test('order margin snapshot keeps full orders and negative breakdown', () => {
  assert.ok(real.facts.length > 800)
  assert.ok((real.stats.orderRows || 0) > 100000)
  assert.ok((real.stats.negOrderRows || 0) > 30000)
  assert.ok(real.reasonKeys.includes('营销折扣过高'))
  assert.ok(real.facts.every((f) => typeof f.negOrders === 'number'))
  assert.match(JSON.stringify(real.stats.channels), /淘宝闪购/)
})

test('full export yields neg and gt3 rates with coverage', () => {
  const rows = selectOrderMarginFacts(real, { from: '2026-09-13', to: '2026-09-13', channel: '美团' }, stores)
  assert.ok(rows.length > 0)
  const cycle = rows.map((r) => ({
    date: r.date,
    store: r.store,
    channel: r.channel,
    orders: r.orders,
    negativeOrders: r.negOrders,
    profit: 100,
  }))
  const s = summarizeOrderMargin(rows, cycle, real.reasonKeys)
  assert.ok(s.exportOrders > 0)
  assert.ok(s.negRate != null && s.negRate > 0 && s.negRate < 1)
  assert.ok(s.gt3Rate != null)
  assert.ok(s.reasons.length >= 1)
  assert.equal(s.coverageOk, true)
})

test('display helpers use percent sign not pct', () => {
  assert.equal(ratioValue(0.033), '+3.3%')
  assert.equal(ratioValue(-0.007), '-0.7%')
  assert.doesNotMatch(ratioValue(-0.007), /pct/)
})

test('store week rows and wow helpers', () => {
  const cycle = [
    { date: '2026-09-13', store: '淘宝便利店(甲店)', channel: '美团', orders: 70, negativeOrders: 7, profit: 140 },
  ]
  const margin = [
    {
      date: '2026-09-13',
      store: '淘宝便利店(甲店)',
      storeCode: 'A',
      channel: '美团',
      orders: 70,
      negOrders: 7,
      negGt3: 2,
      loss: -20,
      reasons: Object.fromEntries(real.reasonKeys.map((k) => [k, { count: 0, amount: 0 }])),
    },
  ]
  const rows = storeProfitWeekRows(cycle, margin, 7)
  assert.equal(rows.length, 1)
  assert.ok(Math.abs(rows[0].dailyOrders - 10) < 1e-9)
  assert.ok(Math.abs((rows[0].negRate || 0) - 0.1) < 1e-9)
  assert.equal(wowDelta(0.2, 0.1, 'pts'), 0.1)
  assert.equal(wowDelta(null, 1, 'ratio'), null)
})
