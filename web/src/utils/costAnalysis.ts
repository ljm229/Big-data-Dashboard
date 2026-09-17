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

/** 平台确认：含后返相关字段自该日起生效；此前不填 0、不跨口径环比 */
export const REBATE_EFFECTIVE_DATE = '2026-07-07'

/** 盈亏明细表行：与卡片总收入/总支出同口径；无独立字段不列假行、不填 0 */
export type CostDetailRow = { id: string; label: string; key: CostKey | null; note?: string; deduction?: boolean }
export const INCOME_DETAIL_ROWS: CostDetailRow[] = [
  { id: 'turnover', label: '总营业额', key: 'turnover' },
  { id: 'goodsOriginal', label: '商品原价', key: 'goodsOriginal', note: '收入组成' },
  { id: 'packaging', label: '包装费原价', key: 'packaging', note: '收入组成' },
  { id: 'deliveryIncome', label: '应收配送费及地址变更费', key: 'deliveryIncome', note: '源表合并列' },
  { id: 'marketing', label: '营销活动费用', key: 'marketing', deduction: true, note: '收入端扣减，不计入支出' },
]
export const EXPENSE_DETAIL_ROWS: CostDetailRow[] = [
  { id: 'goodsCost', label: '商品成本', key: 'goodsCost' },
  { id: 'platformDelivery', label: '平台配送服务费', key: 'platformDelivery' },
  { id: 'commission', label: '佣金及其他平台费用', key: 'commission', note: '源表合并列' },
  { id: 'selfDelivery', label: '自配送费用', key: 'selfDelivery' },
  { id: 'promotion', label: '推广费用', key: 'promotion' },
  { id: 'maintenance', label: '订单线下维护费用', key: 'maintenance' },
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
/** 展示用四舍五入；验算请用 raw* 未舍入字段 */
const calculate = (values: (number | null)[], fn: (v: number[]) => number): number | null =>
  values.every(finite) ? round(fn(values as number[])) : null
const calculateRaw = (values: (number | null)[], fn: (v: number[]) => number): number | null =>
  values.every(finite) ? fn(values as number[]) : null

function locList(v?: string | string[]) {
  if (v == null || v === '') return []
  if (Array.isArray(v)) return v.map(String).map((x) => x.trim()).filter(Boolean)
  return String(v).split(/[|、,，]/).map((x) => x.trim()).filter(Boolean)
}

/** 区间是否完全落在后返生效日及之后 */
export function rebateEffectiveInRange(from: string, to: string) {
  if (!from || !to) return false
  return from >= REBATE_EFFECTIVE_DATE && to >= REBATE_EFFECTIVE_DATE
}

/** 两期是否可对后返做环比（均已生效且有数据） */
export function rebateComparable(currentFrom: string, currentTo: string, prevFrom: string, prevTo: string) {
  return rebateEffectiveInRange(currentFrom, currentTo) && rebateEffectiveInRange(prevFrom, prevTo)
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

export function summarizeCosts(rows: CostFact[], opts?: { rebateActive?: boolean }) {
  const rebateActive = opts?.rebateActive !== false
  const amounts = Object.fromEntries(Object.keys(COST_FIELDS).map(k => {
    const values = rows.map(r => r[k as CostKey]).filter(finite)
    return [k, { value: values.length ? round(values.reduce((s, v) => s + v, 0)) : null,
      valid: values.length, total: rows.length, complete: rows.length > 0 && values.length === rows.length }]
  })) as Record<CostKey, Amount>

  // 后返未生效：后返相关金额置空，不填 0
  if (!rebateActive) {
    amounts.rebate = { value: null, valid: 0, total: rows.length, complete: false }
    amounts.sourceProfitWithRebate = { value: null, valid: 0, total: rows.length, complete: false }
  }

  const value = (key: CostKey) => amounts[key].complete ? amounts[key].value : null
  const rawValue = (key: CostKey) => {
    const values = rows.map(r => r[key]).filter(finite)
    if (!values.length) return null
    if (values.length !== rows.length) return null
    return values.reduce((s, v) => s + v, 0)
  }

  const income = calculate([value('turnover'), value('marketing')], v => v[0]! - v[1]!)
  const expense = calculate(EXPENSE_KEYS.map(value), v => v.reduce((s, n) => s + n, 0))
  const balance = calculate([income, expense], v => v[0]! - v[1]!)
  const withRebate = rebateActive
    ? calculate([balance, value('rebate')], v => v[0]! + v[1]!)
    : null

  const rawIncome = calculateRaw([rawValue('turnover'), rawValue('marketing')], v => v[0]! - v[1]!)
  const rawExpense = calculateRaw(EXPENSE_KEYS.map(rawValue), v => v.reduce((s, n) => s + n, 0))
  const rawBalance = calculateRaw([rawIncome, rawExpense], v => v[0]! - v[1]!)
  const rawWithRebate = rebateActive
    ? calculateRaw([rawBalance, rawValue('rebate')], v => v[0]! + v[1]!)
    : null

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

  /** 净利率 = 收支结余 / 经营收入（合计口径，非门店比例简单平均） */
  const netRate = balance !== null && income !== null && income !== 0 ? balance / income : null
  /** 毛利率（含后返）仅在后返生效且字段齐全时用源表合计 / 线上收入 */
  const marginRateWithRebate = (() => {
    if (!rebateActive) return null
    const profit = value('sourceProfitWithRebate')
    const base = value('onlineIncome')
    if (profit == null || base == null || base <= 0) return null
    return profit / base
  })()

  return {
    rows, amounts, income, expense, balance, withRebate, expenses, differences, chartReady,
    rawIncome, rawExpense, rawBalance, rawWithRebate,
    rebateActive,
    netRate,
    marginRateWithRebate,
    expenseRate: expense !== null && income !== null && income > 0 ? expense / income : null,
    storeCount: new Set(rows.map(r => norm(r.store))).size,
    days: [...new Set(rows.map(r => r.date))].sort(),
    /** 未舍入验算：收入 − 支出 − 结余 ≈ 0 */
    identityOk: rawIncome != null && rawExpense != null && rawBalance != null
      && Math.abs(rawIncome - rawExpense - rawBalance) < 1e-6,
  }
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

/** 明细行取值：无字段 → null（展示 —）；有字段但无有效行 → null；有部分有效行则出合计 */
export function detailAmount(summary: CostSummary, row: CostDetailRow): number | null {
  if (!row.key) return null
  const amt = summary.amounts[row.key]
  if (!amt.valid) return null
  return amt.value
}

/**
 * 明细占比：
 * - 收入侧相对总营业额（组成与营销扣减同一基期，便于对照）
 * - 支出侧相对总支出（六项合计应约 100%）
 * 缺数或基期无效 → null（展示 —）
 */
export function detailShare(
  summary: CostSummary,
  row: CostDetailRow,
  side: 'income' | 'expense',
): number | null {
  const value = detailAmount(summary, row)
  if (value == null || !Number.isFinite(value)) return null
  const base =
    side === 'income' ? summary.amounts.turnover.value : summary.expense
  if (base == null || base === 0) return null
  return Math.abs(value) / Math.abs(base)
}
