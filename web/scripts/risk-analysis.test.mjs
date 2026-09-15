import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import { analyzeRisks, riskValue } from '../src/utils/riskAnalysis.ts'

const real = JSON.parse(readFileSync(new URL('../src/data/riskData.json', import.meta.url), 'utf8'))
const day = '2026-09-13'
const source = { path: 'fixture.xlsx', sheet: 'data', sha256: '' }
const store = { name: '淘宝便利店(甲店)', city: '苏州', status: '已营业', row: 2 }
const fact = overrides => ({ date: day, store: store.name, channel: '美团', row: 2, profit: 10, orders: 10, paid: 100,
  refundRate: 0, refundOrders: 0, refundAmount: null, negativeOrders: null, negativeOrderRate: null, ...overrides })
const supply = overrides => ({ date: day, store: store.name, row: 2, attendance: 1, stockout: 0, onShelf: 10, absent: 0, absentLoss: null, ...overrides })
const data = overrides => ({ generatedAt: day, stores: [store], facts: [], supply: [], quality: [],
  files: { stores: source, facts: source, supply: source, quality: source }, ...overrides })
const run = (d, f = {}) => analyzeRisks(d, { from: day, to: day, ...f })

test('boundaries: profit < 0, refund >= 5%, attendance < 85%', () => {
  assert.equal(run(data({ facts: [fact({ profit: 0, refundRate: .0499 })], supply: [supply({ attendance: .85 })] })).events.length, 0)
  const events = run(data({ facts: [fact({ profit: -.01, refundRate: .05 })], supply: [supply({ attendance: .8499 })] })).events
  assert.deepEqual(events.map(e => e.category), ['profit', 'service', 'supply'])
  assert.equal(riskValue(events[0].value, 'yuan'), '-0.01 元')
})
test('only Taobao supplies stock data; all channels does not relabel supply', () => {
  const d = data({ supply: [supply({ attendance: .2 })] })
  assert.equal(run(d, { channel: '美团' }).events.length, 0)
  assert.equal(run(d, { channel: '京东' }).supplyApplicable, false)
  assert.equal(run(d, { channel: '全部' }).events[0].channel, '淘宝闪购')
})
test('pending and unknown stores stay outside operating counts', () => {
  const d = data({ stores: [{ ...store, status: '待营业' }], facts: [fact({ profit: -100 })], supply: [supply({ attendance: .2, store: '未知店' })] })
  assert.ok(run(d).events.every(e => e.scope === 'review' && e.priority === 'attention'))
  assert.equal(run(d).coverage.profit.operating, 0)
})
test('missing and invalid rates never become healthy zeros', () => {
  const r = run(data({ facts: [fact({ profit: null, refundRate: null })], supply: [supply({ attendance: null })] }))
  assert.equal(r.events.length, 0)
  assert.equal(r.coverage.profit.rows, 0)
  assert.equal(riskValue(null, 'yuan'), '—')
  assert.equal(run(data({ facts: [fact({ refundRate: 2 })], supply: [supply({ attendance: -.1 })] })).events.length, 0)
})
test('period reports keep daily losses even when the net period profit is positive', () => {
  const d = data({ facts: [fact({ date: '2026-09-12', profit: -10 }), fact({ profit: 100 })] })
  const e = run(d, { from: '2026-09-12' }).events[0]
  assert.equal(e.value, -10); assert.equal(e.hits, 1); assert.equal(e.observedDays, 2)
  assert.equal(e.asOf, '2026-09-12'); assert.equal(e.evidence.at(-1).value, '90.00 元')
})
test('stock evidence is the worst day snapshot, not a sum of daily SKUs', () => {
  const d = data({ supply: [supply({ date: '2026-09-12', attendance: .1, stockout: 9 }), supply({ attendance: .3, stockout: 7 })] })
  const e = run(d, { from: '2026-09-11' }).events[0]
  assert.equal(e.value, .1); assert.equal(e.hits, 2); assert.equal(e.expectedDays, 3); assert.equal(e.observedDays, 2)
  assert.equal(e.evidence.find(x => x.label === '当日缺货商品数').value, '9')
  assert.equal(e.evidence.at(-1).value, '—')
})
test('do not recompute source refund rate from an unverified denominator', () => {
  const e = run(data({ facts: [fact({ refundRate: .1, refundOrders: 3, orders: 5 })] })).events[0]
  assert.equal(e.value, .1); assert.equal(e.evidence[0].value, '3')
})
test('no current-date data never falls back to older exceptions', () => {
  const r = run(data({ facts: [fact({ profit: -10 })] }), { from: '2026-09-14', to: '2026-09-14' })
  assert.equal(r.events.length, 0); assert.equal(r.latestInSelection, '')
})
test('city and fullwidth store normalization apply together with channel and date', () => {
  const d = data({ facts: [fact({ profit: -10 })] })
  assert.equal(run(d, { city: '苏州市', store: '淘宝便利店（甲店）', channel: '美团' }).events.length, 1)
  assert.equal(run(d, { city: '南京' }).events.length, 0)
  assert.equal(run(d, { channel: '淘宝闪购' }).events.length, 0)
})
test('single day trend includes six context days but not their hits in the current count', () => {
  const e = run(data({ facts: [fact({ date: '2026-09-12', profit: -30 }), fact({ profit: -10 })] })).events[0]
  assert.equal(e.hits, 1); assert.equal(e.trend.length, 7); assert.equal(e.trend[0].value, null)
})
test('compound county/city labels normalize once for both filtering and display', () => {
  for (const [raw, city] of [['苏州昆山', '苏州'], ['泰州姜堰', '泰州']]) {
    const d = data({ stores: [{...store, city:raw}], supply: [supply({attendance:.2})] })
    const e = run(d, {city:`${city}市`}).events[0]
    assert.equal(e.city, city)
  }
})
test('source snapshot: Huaitong 09/13 is review only, 30 stockout, 36.17% attendance, original row 563', () => {
  const e = run(real, { city: '淮安' }).events.find(x => x.store.includes('汇通'))
  assert.equal(e.scope, 'review'); assert.equal(e.sourceRow, 563)
  assert.equal(riskValue(e.value, 'percent'), '36.17%')
  assert.equal(e.evidence[1].value, '30'); assert.equal(e.evidence[3].value, '0.00 元')
})
test('source snapshot: Binjiang Meituan negative profit agrees with source row and same-day quality', () => {
  const e = run(real).events.find(x => x.store.includes('滨江') && x.category === 'profit')
  assert.equal(e.value, -550.41); assert.equal(e.channel, '美团'); assert.equal(e.sourceRow, 7)
  assert.equal(e.quality.row, 462); assert.equal(e.quality.date, day)
})
test('source keys are unique and match the existing base snapshot fields', () => {
  const base = JSON.parse(readFileSync(new URL('../src/data/source1.json', import.meta.url), 'utf8'))
  const key = r => `${r.date}|${r.store}|${r.channel || ''}`
  for (const rows of [real.facts, real.supply, real.quality]) assert.equal(new Set(rows.map(key)).size, rows.length)
  const old = new Map(base.facts.map(r => [key(r), r]))
  for (const row of real.facts) for (const field of ['profit', 'orders', 'refundRate', 'refundOrders']) assert.equal(row[field], old.get(key(row))?.[field], `${key(row)}.${field}`)
})

const component = readFileSync(new URL('../src/components/boards/RiskTop.vue', import.meta.url), 'utf8')
const script = component.match(/<script setup lang="ts">([\s\S]*?)<\/script>/)[1]
const ast = ts.createSourceFile('RiskTop.ts', script, ts.ScriptTarget.Latest, true)
function handler(name, context) {
  const node = ast.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === name)
  const js = ts.transpileModule(`(${node.getText(ast)})`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText
  return vm.runInNewContext(js, context)
}
test('opening a detail only changes local state, not the global filters', () => {
  const calls = []; const ctx = { selected: {value:null}, modal: {value:'rules'}, showDialog: () => calls.push('dialog') }
  const row = run(real).events[0]
  handler('openDetail', ctx)(row)
  assert.equal(ctx.selected.value, row); assert.deepEqual(calls, ['dialog'])
})
test('explicit map action closes detail and then filters/focuses the specific store', () => {
  const calls = []; const row = run(real).events[0]
  handler('viewStore', {selected:{value:row},closeDialog:()=>calls.push('close'),filter:{setChannel:v=>calls.push(['channel',v]),setStore:v=>calls.push(['store',v]),focusStore:v=>calls.push(['focus',v])}})()
  assert.deepEqual(calls, ['close', ['channel',row.channel], ['store',row.store], ['focus',row.store]])
})
