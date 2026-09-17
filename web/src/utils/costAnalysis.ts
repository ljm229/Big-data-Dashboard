export const COST_FIELDS = {
  turnover: '总营业额', goodsOriginal: '商品原价', packaging: '包装费原价', deliveryIncome: '应收配送费及地址变更费',
  maintenance: '订单线下维护费用', marketing: '营销活动费用', commission: '佣金及其他平台费用', goodsCost: '商品成本',
  platformDelivery: '平台配送服务费', selfDelivery: '自配送费用', subsidy: '平台补贴', promotion: '推广费用',
  rebate: '平台后返', onlineIncome: '预计线上收入', onlineExpense: '预计线上支出', sourceProfit: '预计毛利',
  sourceProfitWithRebate: '预计毛利（含平台后返）',
} as const
export type CostKey = keyof typeof COST_FIELDS
export type CostFact = { date: string; store: string; channel: string; row: number } & Record<CostKey, number | null>
export type CostData = { facts: CostFact[]; stores: { name: string; city: string }[] }
export type CostFilter = { from: string; to: string; city?: string | string[]; store?: string | string[]; channel?: string }
export const EXPENSE_KEYS: CostKey[] = ['goodsCost', 'platformDelivery', 'commission', 'selfDelivery', 'promotion', 'maintenance']
export const INCOME_KEYS: CostKey[] = ['goodsOriginal', 'packaging', 'deliveryIncome', 'marketing']

/** 盈亏明细表行：对齐平台「收入明细 / 支出明细」指标清单；无独立字段时 key 为 null，显示 — 不填 0 */
export type CostDetailRow = { id: string; label: string; key: CostKey | null; note?: string; deduction?: boolean }
export const INCOME_DETAIL_ROWS: CostDetailRow[] = [
  { id: 'goodsOriginal', label: '商品原价', key: 'goodsOriginal' },
  { id: 'deliveryFee', label: '应收配送费', key: 'deliveryIncome', note: '源表含地址变更费' },
  { id: 'packaging', label: '包装费原价', key: 'packaging' },
  { id: 'marketing', label: '营销活动费用', key: 'marketing', deduction: true, note: '收入端扣减' },
  { id: 'addressChange', label: '地址变更费', key: null, note: '源表已并入应收配送费' },
  { id: 'billingIncome', label: '销售开单收入', key: null, note: '源表未提供' },
  { id: 'otherIncome', label: '其他收入', key: null, note: '源表未提供' },
]
export const EXPENSE_DETAIL_ROWS: CostDetailRow[] = [
  { id: 'goodsCost', label: '商品成本', key: 'goodsCost' },
  { id: 'offlineGoodsCost', label: '线下销售商品成本支出', key: null, note: '源表未提供' },
  { id: 'selfDelivery', label: '自配送费用', key: 'selfDelivery' },
  { id: 'platformDelivery', label: '平台配送服务费', key: 'platformDelivery' },
  { id: 'commission', label: '佣金', key: 'commission', note: '源表含其他平台费用' },
  { id: 'otherPlatform', label: '其他平台费用', key: null, note: '源表已并入佣金' },
  { id: 'donation', label: '公益捐款', key: null, note: '源表未提供' },
  { id: 'offlineLedger', label: '线下账本支出', key: null, note: '源表未提供' },
  { id: 'promotion', label: '推广费用', key: 'promotion' },
]
export type Amount = { value: number | null; valid: number; total: number; complete: boolean }
const norm = (s: string) => s.replace(/（/g, '(').replace(/）/g, ')').replace(/\s+/g, '')
const city = (s: string) => {
  const t = String(s || '').trim()
  if (!t || t === '全国' || t === '全部') return t
  if (t.includes('昆山')) return '苏州'
  if (t.includes('姜堰')) return '泰州'
  return t.replace(/市/g, '').trim()
}
const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n)
const round = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100
const calculate = (values: (number | null)[], fn: (v: number[]) => number): number | null =>
  values.every(finite) ? round(fn(values as number[])) : null

function locList(v?: string | string[]) {
  if (v == null || v === '') return []
  if (Array.isArray(v)) return v.map(String).map((x) => x.trim()).filter(Boolean)
  return String(v).split(/[|、,，]/).map((x) => x.trim()).filter(Boolean)
}

export function selectCostFacts(data: CostData, f: CostFilter) {
  const cities = new Map(data.stores.map(s => [norm(s.name), city(s.city)]))
  const storeList = locList(f.store)
  const cityList = locList(f.city)
  const storeAll = !storeList.length || storeList.some((s) => s === '全部')
  const cityAll = !cityList.length || cityList.some((c) => c === '全国' || c === '全部')
  return data.facts.filter(r => f.from && f.to && r.date >= f.from && r.date <= f.to
    && (!f.channel || f.channel === '全部' || r.channel === f.channel)
    && (storeAll || storeList.some((s) => norm(r.store) === norm(s)))
    && (cityAll || cityList.some((c) => cities.get(norm(r.store)) === city(c))))
}

export function summarizeCosts(rows: CostFact[]) {
  const amounts = Object.fromEntries(Object.keys(COST_FIELDS).map(k => {
    const values = rows.map(r => r[k as CostKey]).filter(finite)
    return [k, { value: values.length ? round(values.reduce((s, v) => s + v, 0)) : null,
      valid: values.length, total: rows.length, complete: rows.length > 0 && values.length === rows.length }]
  })) as Record<CostKey, Amount>
  const value = (key: CostKey) => amounts[key].complete ? amounts[key].value : null
  const income = calculate([value('turnover'), value('marketing')], v => v[0]! - v[1]!)
  const expense = calculate(EXPENSE_KEYS.map(value), v => v.reduce((s, n) => s + n, 0))
  const balance = calculate([income, expense], v => v[0]! - v[1]!)
  const withRebate = calculate([balance, value('rebate')], v => v[0]! + v[1]!)
  const differences = rows.flatMap(r => {
    // Platform profit excludes promotion in this export. Keep source adjustments visible.
    const expected = calculate([r.turnover, r.marketing, ...EXPENSE_KEYS.filter(k => k !== 'promotion').map(k => r[k])],
      v => v[0]! - v.slice(1).reduce((s, n) => s + n, 0))
    return expected !== null && finite(r.sourceProfit) && Math.abs(r.sourceProfit - expected) > .03
      ? [{ row: r.row, date: r.date, store: r.store, channel: r.channel, difference: round(r.sourceProfit - expected) }] : []
  })
  const chartReady = expense !== null && expense > 0 && EXPENSE_KEYS.every(k => value(k)! >= 0)
  const expenses = EXPENSE_KEYS.map(key => ({ key, label: COST_FIELDS[key], ...amounts[key],
    share: chartReady ? value(key)! / expense! : null }))
  return { rows, amounts, income, expense, balance, withRebate, expenses, differences, chartReady,
    expenseRate: expense !== null && income !== null && income > 0 ? expense / income : null,
    storeCount: new Set(rows.map(r => norm(r.store))).size,
    days: [...new Set(rows.map(r => r.date))].sort() }
}
export type CostSummary = ReturnType<typeof summarizeCosts>

/** 同筛选口径比较：两期均有数据即可出比（周/月残段天数可不一致，按合计比）。 */
export function costComparison(current: CostSummary, previous: CostSummary, currentRange: CostFilter, previousRange: CostFilter | null) {
  if (!previousRange?.from || !previousRange?.to) {
    return { ready: false, reason: '暂无完整上期', growth: (_a: number | null, _b: number | null) => null }
  }
  if (!currentRange.from || !currentRange.to) {
    return { ready: false, reason: '本期日期无效', growth: (_a: number | null, _b: number | null) => null }
  }
  if (!current.rows.length || !previous.rows.length) {
    return { ready: false, reason: '本期或上期无数据', growth: (_a: number | null, _b: number | null) => null }
  }
  return {
    ready: true,
    reason: '同筛选口径对比（时间 / 城市 / 门店 / 渠道）',
    growth: (a: number | null, b: number | null) => (a !== null && b !== null && b > 0 ? (a - b) / b : null),
  }
}

export function costMoney(n: number | null, unit: 'yuan' | 'wan' = 'yuan') {
  if (n === null || !Number.isFinite(n)) return '—'
  return (unit === 'wan' ? n / 10000 : n).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
