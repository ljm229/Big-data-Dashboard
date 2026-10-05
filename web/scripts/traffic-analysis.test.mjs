import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  selectTraffic, summarizeTraffic, groupTraffic, trafficDailySeries, trafficDelta, trafficMetricDelta,
  reportedTrafficRate, trafficNumber, trafficPercent, trafficRatio,
} from '../src/utils/trafficAnalysis.ts'

const real = JSON.parse(readFileSync(new URL('../src/data/trafficData.json', import.meta.url), 'utf8'))
const select = (filters = {}) => selectTraffic(real, { from: real.period.from, to: real.period.to, dimension: 'platform', ...filters })
const sample = (overrides) => ({
  storeId: '1', store: '甲店', city: '苏州', dimension: 'platform', source: '甲来源', row: 2, date: '2026-09-16',
  exposure: 100, entry: 30, orders: 10, reportedRates: ['30.0%', '33.3%', '10.0%'], ...overrides,
})

test('source is daily grain across extended range, stores, cities, facts', () => {
  assert.deepEqual(real.period, { from: '2026-08-15', to: '2026-09-17', grain: 'day' })
  assert.equal(real.facts.length, 5139)
  assert.equal(new Set(real.facts.map((r) => r.date)).size, 34)
  assert.equal(new Set(real.facts.map((r) => r.storeId)).size, 20)
  assert.equal(new Set(real.facts.map((r) => r.city)).size, 9)
  assert.ok(real.facts.every((r) => typeof r.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(r.date)))
})

test('full-range platform totals match workbook sum of daily rows', () => {
  const rows = select(), total = summarizeTraffic(rows)
  assert.equal(rows.length, 1713)
  assert.deepEqual([total.exposure, total.entry, total.orders], [5666962, 606853, 175719])
  assert.equal(total.rateBasis, 'record-ratio')
  assert.equal(total.p1, 606853 / 5666962)
  assert.equal(total.p2, 175719 / 606853)
  assert.equal(total.overall, 175719 / 5666962)
})

test('APP sources are independent and cannot be merged with platform', () => {
  const rows = select({ dimension: 'app' }), total = summarizeTraffic(rows)
  assert.equal(rows.length, 3426)
  assert.deepEqual([total.exposure, total.entry, total.orders], [1238619, 110862, 30813])
  assert.throws(() => summarizeTraffic(real.facts), /不能合并/)
})

test('day slice returns only that date; out-of-range stays empty', () => {
  const day = select({ from: '2026-09-16', to: '2026-09-16' })
  assert.equal(day.length, 60)
  assert.deepEqual(
    [summarizeTraffic(day).exposure, summarizeTraffic(day).entry, summarizeTraffic(day).orders],
    [174987, 18931, 5368],
  )
  assert.equal(select({ from: '2026-09-14', to: '2026-09-14' }).length, 54)
  assert.equal(select({ from: '2026-09-17', to: '2026-09-17' }).length, 60)
  assert.equal(select({ from: '2026-07-01', to: '2026-07-31' }).length, 0)
})

test('city/store/source filters intersect and normalize full-width brackets', () => {
  const rows = select({
    from: '2026-08-15', to: '2026-08-15',
    city: '苏州市', store: '淘宝便利店（通安店）', source: '淘宝闪购APP',
  })
  assert.equal(rows.length, 1)
  assert.equal(select({ city: '上海市', store: '淘宝便利店（通安店）', from: '2026-08-15', to: '2026-08-15' }).length, 0)
  assert.equal(select({ city: '扬州市' }).length, 0)
})

test('single record preserves reported rate; multi-day uses ratio of sums', () => {
  const one = select({
    from: '2026-08-15', to: '2026-08-15', store: '1306680659', source: '淘宝闪购APP',
  })
  assert.equal(one.length, 1)
  const reported = summarizeTraffic(one)
  assert.equal(reported.rateBasis, 'reported')
  assert.deepEqual([reported.p1, reported.p2, reported.overall], [
    reportedTrafficRate(one[0].reportedRates[0]),
    reportedTrafficRate(one[0].reportedRates[1]),
    reportedTrafficRate(one[0].reportedRates[2]),
  ])
  const multi = summarizeTraffic(select({ store: '1306680659', source: '淘宝闪购APP' }))
  assert.equal(multi.rateBasis, 'record-ratio')
  assert.equal(multi.p1, multi.entry / multi.exposure)
})

test('aggregation uses ratio of sums, not mean of source percentages', () => {
  const result = summarizeTraffic([
    sample(),
    sample({ row: 3, exposure: 900, entry: 90, orders: 9, reportedRates: ['10.0%', '10.0%', '1.0%'] }),
  ])
  assert.equal(result.p1, 120 / 1000)
  assert.equal(result.p2, 19 / 120)
  assert.equal(result.overall, 19 / 1000)
  assert.notEqual(result.p1, (.3 + .1) / 2)
})

test('daily series omits empty days and preserves totals', () => {
  const rows = select({ from: '2026-09-10', to: '2026-09-16' })
  const series = trafficDailySeries(rows)
  assert.ok(series.length >= 1)
  assert.ok(series.every((p) => p.date >= '2026-09-10' && p.date <= '2026-09-16'))
  assert.equal(series.reduce((n, p) => n + (p.exposure || 0), 0), summarizeTraffic(rows).exposure)
})

test('日比 / 周比 deltas: counts as ratio, rates as pts; missing prev is null', () => {
  assert.equal(trafficDelta(110, 100, 'ratio'), 0.1)
  assert.ok(Math.abs(trafficDelta(0.12, 0.1, 'pts') - 0.02) < 1e-12)
  assert.equal(trafficDelta(10, 0, 'ratio'), null)
  assert.equal(trafficDelta(10, null, 'ratio'), null)
  const cur = summarizeTraffic(select({ from: '2026-09-16', to: '2026-09-16' }))
  const prev = summarizeTraffic(select({ from: '2026-09-15', to: '2026-09-15' }))
  const week = summarizeTraffic(select({ from: '2026-09-09', to: '2026-09-09' }))
  assert.ok(trafficMetricDelta(cur, prev, 'exposure') !== null)
  assert.ok(trafficMetricDelta(cur, week, 'overall') !== null)
  assert.equal(trafficMetricDelta(cur, summarizeTraffic([]), 'exposure'), null)
})

test('missing counts remain missing; empty and true zero are distinct', () => {
  assert.equal(summarizeTraffic([]).exposure, null)
  const missing = summarizeTraffic([sample(), sample({ exposure: null })])
  assert.equal(missing.exposure, null); assert.equal(missing.p1, null); assert.equal(missing.overall, null)
  const zero = summarizeTraffic([sample({ exposure: 0, entry: 0, orders: 0 }), sample({ exposure: 0, entry: 0, orders: 0 })])
  assert.equal(zero.exposure, 0); assert.equal(zero.p1, null); assert.equal(zero.p2, null); assert.equal(zero.overall, null)
  assert.equal(trafficNumber(null), '—'); assert.equal(trafficNumber(0), '0'); assert.equal(trafficPercent(null), '—')
  assert.equal(trafficRatio(0, 10), 0); assert.equal(trafficRatio(0, 0), null)
  assert.equal(reportedTrafficRate('未知'), null)
})

test('source, city and store group sums preserve the same exact totals', () => {
  for (const dim of ['platform', 'app']) {
    const rows = select({ dimension: dim }), total = summarizeTraffic(rows)
    for (const key of ['source', 'city', 'store']) {
      const groups = groupTraffic(rows, key)
      for (const count of ['exposure', 'entry', 'orders']) assert.equal(groups.reduce((n, r) => n + r[count], 0), total[count])
      assert.equal(groups.reduce((n, r) => n + r.recordCount, 0), rows.length)
    }
  }
})
