import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

// Execute the real component's handlers with filter/navigation spies, without loading map tiles.
const source = readFileSync(new URL('../src/components/boards/CityMap.vue', import.meta.url), 'utf8')
const script = source.match(/<script setup lang="ts">([\s\S]*?)<\/script>/)[1]
const ast = ts.createSourceFile('CityMap.ts', script, ts.ScriptTarget.Latest, true)
function handler(name, context, isWatch = false) {
  let expression
  for (const node of ast.statements) {
    if (!isWatch && ts.isFunctionDeclaration(node) && node.name?.text === name) expression = node
    if (isWatch && ts.isExpressionStatement(node) && ts.isCallExpression(node.expression)) {
      const call = node.expression
      if (call.expression.getText(ast) === 'watch' && call.arguments[0]?.getText(ast) === name) expression = call.arguments[1]
    }
  }
  assert.ok(expression, `Missing actual handler: ${name}`)
  const js = ts.transpileModule(`(${expression.getText(ast)})`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText
  return vm.runInNewContext(js, context)
}
function harness() {
  const calls = []
  return {
    calls,
    mapLevel: { value: 'city' },
    cityName: { value: '扬州' },
    selectedStore: { value: '全部' },
    storeFocus: { value: '' },
    mapStyle: { value: 'region' },
    canonCity: name => name.replace(/市$/, ''),
    source1StoreCity: () => '扬州',
    showCitySummary: name => calls.push(['summary', name]),
    enterCityLayer: (name, options) => calls.push(['stores', name, options?.store]),
    filter: {
      setStore: name => calls.push(['filter-store', name]),
      setCity: (id, name) => calls.push(['filter-city', id, name]),
    },
  }
}

test('city dropdown always opens summary, even when previously viewing store locations', () => {
  for (const city of ['扬州', '苏州', '全国']) {
    const ctx = harness()
    handler('onHeaderCity', ctx)(city)
    assert.deepEqual(ctx.calls, [['summary', city]])
  }
})
test('city shortcuts clear store filter and show the city summary', () => {
  const ctx = harness()
  handler('pickCity', ctx)('扬州')
  assert.deepEqual(ctx.calls, [['filter-store', '全部'], ['filter-city', '扬州', '扬州'], ['summary', '扬州']])
})
test('city watcher never drills down with all stores, but preserves explicit store selection', () => {
  const ctx = harness()
  handler('cityName', ctx, true)('扬州')
  assert.deepEqual(ctx.calls, [['summary', '扬州']])
  ctx.calls.length = 0
  ctx.selectedStore.value = '邗江店'
  handler('cityName', ctx, true)('扬州')
  assert.deepEqual(ctx.calls, [['stores', '扬州', '邗江店']])
})
test('all stores returns to summary; a concrete store still enters the street map', () => {
  const ctx = harness()
  handler('selectedStore', ctx, true)('全部')
  assert.deepEqual(ctx.calls, [['summary', '扬州']])
  ctx.calls.length = 0
  handler('selectedStore', ctx, true)('邗江店')
  assert.deepEqual(ctx.calls, [['stores', '扬州', '邗江店']])
  assert.equal(ctx.mapStyle.value, 'street')
})
test('explicit store-details button still drills down without selecting one store', () => {
  const ctx = { ...harness(), picked: { value: { key: '扬州' } } }
  handler('enterCityMap', ctx)()
  assert.deepEqual(ctx.calls, [['stores', '扬州', undefined]])
})
