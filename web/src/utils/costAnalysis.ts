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
export type Amount = { value: number | null; valid: number; total: number; complete: boolean }
const norm = (s: string) => s.replace(/（/g, '(').replace(/）/g, ')').replace(/\s+/g, '')
const city = (s: string) => s.includes('昆山') ? '苏州' : s.includes('姜堰') ? '泰州' : s.replace(/市/g, '').trim()
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

/** Compare only equal-length periods with identical store/channel/day-offset coverage. */
export function costComparison(current: CostSummary, previous: CostSummary, currentRange: CostFilter, previousRange: CostFilter | null) {
  if (!previousRange) return { ready: false, reason: '暂无完整上期', growth: (_a: number | null, _b: number | null) => null }
  const days = (f: CostFilter) => (Date.parse(f.to) - Date.parse(f.from)) / 86400000 + 1
  const keys = (rows: CostFact[], from: string) => rows.map(r => `${norm(r.store)}|${r.channel}|${(Date.parse(r.date) - Date.parse(from)) / 86400000}`).sort().join('\n')
  const ready = current.rows.length > 0 && days(currentRange) === days(previousRange)
    && keys(current.rows, currentRange.from) === keys(previous.rows, previousRange.from)
  return { ready, reason: ready ? '同范围日比' : '两期覆盖不同，暂不比较',
    growth: (a: number | null, b: number | null) => ready && a !== null && b !== null && b > 0 ? (a - b) / b : null }
}

export function costMoney(n: number | null, unit: 'yuan' | 'wan' = 'yuan') {
  if (n === null || !Number.isFinite(n)) return '—'
  return (unit === 'wan' ? n / 10000 : n).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
