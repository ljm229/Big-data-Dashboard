import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  COST_FIELDS,
  EXPENSE_KEYS,
  REBATE_EFFECTIVE_DATE,
  selectCostFacts,
  summarizeCosts,
  costComparison,
  costMoney,
  rebateEffectiveInRange,
  rebateComparable,
} from '../src/utils/costAnalysis.ts'

const real = JSON.parse(readFileSync(new URL('../src/data/costData.json', import.meta.url), 'utf8'))
const range = { from: '2026-09-13', to: '2026-09-13' }
const fact = overrides => ({ ...Object.fromEntries(Object.keys(COST_FIELDS).map(k => [k, 0])),
  date: range.to, store: '便利店(甲店)', channel: '淘宝闪购', row: 2,
  turnover: 1000, marketing: 100, goodsOriginal: 950, packaging: 30, deliveryIncome: 20,
  goodsCost: 500, platformDelivery: 80, commission: 50, selfDelivery: 20, promotion: 30,
  onlineIncome: 770, onlineExpense: 230, sourceProfit: 250, rebate: 40, sourceProfitWithRebate: 290, ...overrides })
const summary = (overrides = {}) => summarizeCosts([fact(overrides)])
const select = (f = {}) => selectCostFacts(real, { ...range, ...f })

test('income deducts marketing once, expenses include promotion, rebate stays separate', () => {
  const r = summary()
  assert.equal(r.income, 900); assert.equal(r.expense, 680); assert.equal(r.balance, 220); assert.equal(r.withRebate, 260)
  assert.equal(r.differences.length, 0)
  assert.ok(!EXPENSE_KEYS.includes('marketing'))
  assert.ok(Math.abs(r.expenses.reduce((s, x) => s + x.share, 0) - 1) < 1e-9)
})

test('reference screenshot validates the calculation structure, never replaces production rows', () => {
  // User-provided 09/12 summary is only a rule fixture, not a store/channel fact.
  const r = summary({ turnover: 290922.11 + 9730 + 4317.10,
    goodsOriginal: 290922.11, packaging: 9730, deliveryIncome: 4317.10, marketing: 76563.77,
    goodsCost: 139801.60, platformDelivery: 39347.15, commission: 12923.82 + 9078.84,
    selfDelivery: 11581.34, promotion: 4890.32, maintenance: 0 })
  assert.equal(r.income, 228405.44)
  assert.equal(r.expense, 217623.07)
  assert.equal(r.balance, 10782.37)
})

test('accepted Excel-first mode retains all channels promotion instead of forcing screenshot totals', () => {
  const rows = select({ from: '2026-09-12', to: '2026-09-12' })
  const r = summarizeCosts(rows)
  assert.equal(r.income, 228519.63); assert.equal(r.expense, 218741.09)
  assert.equal(r.balance, 9778.54)
  assert.equal(summarizeCosts(rows.filter(r => r.channel === '美团')).amounts.promotion.value, 1050)
})
test('platform subsidy is reference-only, not duplicated in income', () => {
  assert.equal(summary({ subsidy: 9999 }).income, 900)
})
test('missing expense never becomes zero or a complete total', () => {
  const r = summarizeCosts([fact(), fact({ row: 3, promotion: null })])
  assert.equal(r.amounts.promotion.value, 30); assert.equal(r.amounts.promotion.complete, false)
  assert.equal(r.expense, null); assert.equal(r.balance, null); assert.equal(r.chartReady, false)
})
test('blank original-price components do not erase the explicitly reported turnover', () => {
  const r = summary({ goodsOriginal: null, deliveryIncome: null })
  assert.equal(r.income, 900); assert.equal(r.amounts.goodsOriginal.value, null)
})
test('empty, true zero, negative adjustments and loss are distinct', () => {
  assert.equal(summarizeCosts([]).income, null)
  const zero = summary(Object.fromEntries(Object.keys(COST_FIELDS).map(k => [k, 0])))
  assert.equal(zero.balance, 0); assert.equal(zero.chartReady, false); assert.equal(zero.expenseRate, null)
  assert.equal(summary({ commission: -10 }).chartReady, false)
  assert.equal(summary({ goodsCost: 1000 }).balance, -280)
  assert.equal(costMoney(null), '—'); assert.equal(costMoney(0), '0.00')
})
test('date, city, normalized store and channel intersect, county maps to prefecture', () => {
  const d = { stores: [{ name: '便利店（甲店）', city: '苏州昆山' }], facts: [fact(), fact({ channel: '美团' })] }
  assert.equal(selectCostFacts(d, { ...range, city: '苏州市', store: '便利店（甲店）', channel: '淘宝闪购' }).length, 1)
  assert.equal(selectCostFacts(d, { ...range, city: '杭州' }).length, 0)
  assert.equal(select({ from: '2026-09-17', to: '2026-09-18' }).length, 0)
})
test('source1 daily totals reconcile against audited workbook columns', () => {
  const r = summarizeCosts(select())
  assert.equal(r.income, 243086.08); assert.equal(r.expense, 232719.03)
  assert.equal(r.balance, 10367.05); assert.equal(r.withRebate, 32555.15)
  assert.equal(r.amounts.sourceProfitWithRebate.value, 38033.82)
  assert.equal(r.differences.length, 0); assert.equal(r.storeCount, 18)
})
test('all facts unique and cost columns complete; source adjustments not silently corrected', () => {
  assert.equal(real.facts.length, 1142)
  assert.equal(new Set(real.facts.map(r => `${r.date}|${r.store}|${r.channel}`)).size, 1142)
  const r = summarizeCosts(real.facts)
  assert.ok(EXPENSE_KEYS.every(k => r.amounts[k].complete))
  assert.deepEqual(r.differences.map(x => [x.row, x.difference]), [[639, 23.56]])
})
test('period sums are additive and retain every record provenance', () => {
  const week = select({ from: '2026-09-04', to: '2026-09-10' })
  const r = summarizeCosts(week)
  const daySum = r.days.reduce((sum, d) => sum + summarizeCosts(week.filter(x => x.date === d)).expense, 0)
  assert.ok(Math.abs(r.expense - daySum) < 1e-6)
  assert.ok(r.rows.every(r => Number.isInteger(r.row) && r.row >= 2))
})
test('comparison uses same-filter totals when both periods have rows', () => {
  const prevRange = { from: '2026-09-12', to: '2026-09-12' }
  const prev = summary({ date: prevRange.to, turnover: 500 })
  const compare = costComparison(summary(), prev, range, prevRange)
  assert.equal(compare.ready, true); assert.equal(compare.growth(200, 100), 1)
  assert.equal(compare.growth(10, 0), null); assert.equal(compare.growth(10, -10), null)
  assert.equal(compare.growth(null, 10), null)
  assert.equal(costComparison(summary(), summary({ date: prevRange.to, store: '新店' }), range, prevRange).ready, true)
  assert.equal(costComparison(summary(), prev, range, null).ready, false)
  assert.equal(costComparison(summary(), summarizeCosts([]), range, prevRange).ready, false)
  // 残月天数不一致也可比
  assert.equal(
    costComparison(
      summarizeCosts(select({ from: '2026-09-01', to: '2026-09-13' })),
      summarizeCosts(select({ from: '2026-08-15', to: '2026-08-31' })),
      { from: '2026-09-01', to: '2026-09-13' },
      { from: '2026-08-15', to: '2026-08-31' },
    ).ready,
    true,
  )
})
test('daily and weekly comparison follow filters; empty baseline stays blank', () => {
  const r = summarizeCosts(select()), prevRange = { from: '2026-09-12', to: '2026-09-12' }
  const prev = summarizeCosts(select(prevRange))
  assert.equal(costComparison(r, prev, range, prevRange).ready, true)
  assert.equal(costComparison(r, summarizeCosts([]), range, null).growth(r.income, null), null)
  const week = { from: '2026-09-04', to: '2026-09-10' }
  const prevWeek = { from: '2026-08-28', to: '2026-09-03' }
  assert.equal(
    costComparison(summarizeCosts(select(week)), summarizeCosts(select(prevWeek)), week, prevWeek).ready,
    true,
  )
})

test('rebate inactive before 2026-07-07 leaves rebate null and skips cross-boundary compare', () => {
  assert.equal(REBATE_EFFECTIVE_DATE, '2026-07-07')
  assert.equal(rebateEffectiveInRange('2026-07-01', '2026-07-06'), false)
  assert.equal(rebateEffectiveInRange('2026-07-07', '2026-07-07'), true)
  assert.equal(rebateComparable('2026-07-08', '2026-07-08', '2026-07-01', '2026-07-01'), false)
  const inactive = summarizeCosts([fact({ rebate: 40, sourceProfitWithRebate: 290 })], { rebateActive: false })
  assert.equal(inactive.rebateActive, false)
  assert.equal(inactive.amounts.rebate.value, null)
  assert.equal(inactive.withRebate, null)
  assert.equal(inactive.marginRateWithRebate, null)
})

test('raw identity verifies income - expense = balance without display rounding', () => {
  const r = summary()
  assert.equal(r.identityOk, true)
  assert.ok(Math.abs(r.rawIncome - r.rawExpense - r.rawBalance) < 1e-9)
  assert.equal(r.netRate != null, true)
  assert.ok(Math.abs(r.netRate - r.balance / r.income) < 1e-9)
})
