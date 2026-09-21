import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = name => readFileSync(new URL(`../src/components/${name}`, import.meta.url), 'utf8')
const shell = read('StoreBoard.vue')
const city = read('classic-pages/CityStorePage.vue')
const profit = read('classic-pages/ProfitCostPage.vue')
const channel = read('classic-pages/ChannelOrderPage.vue')
const category = read('classic-pages/CategoryPage.vue')

test('management navigation includes quality, defaults to city and keeps the URL shareable', () => {
  assert.match(shell, /QualityPage/)
  assert.match(shell, /id: 'quality'/)
  assert.match(shell, /: 'city'/)
  assert.match(shell, /searchParams\.set\('tab', id\)/)
  assert.match(shell, /history\.replaceState/)
  for (const label of ['城市门店', '利润成本', '渠道订单', '商品品类', '流量转化', '门店运营质量', '预警中心']) assert.match(shell, new RegExp(label))
})

test('city page does not promote provisional risk thresholds', () => {
  assert.doesNotMatch(city, /source1RiskStores|0\.85|退款率偏高|风险线/)
  assert.match(city, /风险规则未接入/)
  assert.match(city, /问题行动台账/)
})

test('channel page never infers refund money from a rate', () => {
  assert.doesNotMatch(channel, /paid\s*\*\s*rate|refundLoss|source1RiskStores/)
  assert.match(channel, /退款率/)
  assert.match(channel, /需要配送异常订单明细/)
})

test('profit and category pages contain no arbitrary severity amount thresholds', () => {
  assert.doesNotMatch(profit, />\s*50000|高风险/)
  assert.doesNotMatch(category, />\s*5000|>\s*1000|风险线\s*&lt;\s*85%/)
  assert.match(category, /有缺货记录/)
})

test('unsupported modules explicitly render an empty state', () => {
  for (const [file, phrases] of [[profit, ['负毛利订单结构', '利润漏损 TOP5']], [channel, ['暂无小时订单', '暂无生命周期漏斗']], [category, ['暂无库存趋势']]]) {
    for (const phrase of phrases) assert.match(file, new RegExp(phrase))
  }
})

test('profit page wires risk and efficiency store boards', () => {
  assert.doesNotMatch(profit, /目标缺口|本期利润对比|亏损对象排行|亏损门店|门店利润质量|涨跌说明与整改/)
  assert.match(profit, /orderMarginSummary/)
  assert.match(profit, /orderMarginWeekBoard/)
  assert.match(profit, /风险异常表/)
  assert.match(profit, /效能排行表/)
  assert.match(profit, /负毛利订单占比/)
  assert.match(profit, /成本覆盖率/)
  assert.match(profit, /预计毛利/)
  assert.doesNotMatch(profit, /贡献利润|负贡献订单|name=\"KPI\"|>KPI</)
})
