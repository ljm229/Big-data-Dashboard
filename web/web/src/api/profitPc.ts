import raw from '../data/profitPcData.json'
import costRaw from '../data/costData.json'
import { ref } from 'vue'

export type ProfitDimension = 'profit' | 'balance'
/** 利润成本标题一排的视角切换（盈亏概览 / 毛利概览），与流量转化切换同布局 */
export const profitDimension = ref<ProfitDimension>('profit')

export type ProfitPcFact = {
  date: string
  store: string
  orders: number | null
  turnover: number | null
  paid: number | null
  subsidyRateSrc: number | null
  profit: number | null
  profitRateSrc: number | null
  incomeTotal: number | null
  incomes: Record<string, number | null>
  expenseTotal: number | null
  expenses: Record<string, number | null>
}

export type ProfitPcFilter = { from: string; to: string; city?: string | string[]; store?: string | string[] }

const facts = (raw as { facts: ProfitPcFact[] }).facts || []

export const PROFIT_PC_DATES = [...new Set(facts.map((r) => r.date))].sort()
export const PROFIT_PC_RANGE = {
  from: PROFIT_PC_DATES[0] || '',
  to: PROFIT_PC_DATES[PROFIT_PC_DATES.length - 1] || '',
}

/** 返回不晚于给定日期的最近一个有数据的日期，用于当前日期无 PC 事实时兜底展示 */
export function latestProfitPcDateOnOrBefore(date: string): string {
  let hit = ''
  for (const d of PROFIT_PC_DATES) {
    if (d <= date) hit = d
    else break
  }
  return hit
}

const norm = (s: string) =>
  String(s || '').replace(/（/g, '(').replace(/）/g, ')').replace(/\s+/g, '').trim()

const canonCity = (s: string) => {
  const t = String(s || '').trim()
  if (!t || t === '全国' || t === '全部') return t
  if (t.includes('昆山')) return '苏州'
  if (t.includes('姜堰')) return '泰州'
  return t.replace(/市/g, '').trim()
}

const cityMap = new Map<string, string>(
  ((costRaw as { stores: { name: string; city: string }[] }).stores || []).map((s) => [
    norm(s.name),
    canonCity(s.city),
  ]),
)

function locList(v?: string | string[]) {
  if (v == null || v === '') return []
  if (Array.isArray(v)) return v.map(String).map((x) => x.trim()).filter(Boolean)
  return String(v).split(/[|、,，]/).map((x) => x.trim()).filter(Boolean)
}

export function shortPcStore(name: string) {
  const t = String(name || '')
    .replace(/淘宝便利店/g, '')
    .replace(/[()（）]/g, '')
    .trim()
  return t || name
}

export function selectProfitPcFacts(f: ProfitPcFilter): ProfitPcFact[] {
  const storeList = locList(f.store)
  const cityList = locList(f.city).map(canonCity)
  const storeAll = !storeList.length || storeList.some((s) => s === '全部')
  const cityAll = !cityList.length || cityList.some((c) => c === '全国' || c === '全部')
  return facts.filter((r) => {
    if (!f.from || !f.to) return false
    if (r.date < f.from || r.date > f.to) return false
    if (r.store === '门店/门店') return false
    if (String(r.store).includes('模板')) return false
    if (!storeAll && !storeList.some((s) => norm(r.store) === norm(s))) return false
    if (!cityAll) {
      const c = cityMap.get(norm(r.store)) || ''
      if (!cityList.some((cc) => c === cc)) return false
    }
    return true
  })
}

const num = (v: number | null | undefined) => (typeof v === 'number' && Number.isFinite(v) ? v : 0)
const hasNum = (v: number | null | undefined) => typeof v === 'number' && Number.isFinite(v)

export const INCOME_PC_LABELS = [
  { key: 'goodsOriginal', label: '商品原价' },
  { key: 'delivery', label: '应收配送费' },
  { key: 'packaging', label: '包装费原价' },
  { key: 'marketing', label: '营销活动费用' },
  { key: 'addrChange', label: '地址变更费' },
  { key: 'other', label: '其他收入' },
  { key: 'salesOrder', label: '销售开单收入' },
] as const

export const EXPENSE_PC_LABELS = [
  { key: 'goodsCost', label: '商品成本' },
  { key: 'platformDelivery', label: '平台配送' },
  { key: 'selfDelivery', label: '自配送' },
  { key: 'commission', label: '佣金' },
  { key: 'promotion', label: '推广费用' },
  { key: 'labor', label: '人力成本' },
  { key: 'rent', label: '房租物业' },
  { key: 'utilities', label: '水电杂项' },
  { key: 'other', label: '其他支出' },
] as const

function mergeExpenses(e: Record<string, number | null>) {
  return {
    goodsCost: num(e.goodsCost),
    platformDelivery: num(e.platformDelivery),
    selfDelivery: num(e.selfDelivery),
    commission: num(e.commission),
    promotion: num(e.promotion),
    labor: num(e.labor),
    rent: num(e.rent),
    utilities: num(e.utilities),
    other: num(e.other) + num(e.donation) + num(e.offlineGoods),
  }
}

export type ProfitPcStore = {
  store: string
  shortName: string
  orders: number
  turnover: number
  paid: number
  incomeTotal: number
  expenseTotal: number
  profit: number
  profitRate: number | null
  subsidyRate: number | null
  subsidyRateSrc: number | null
  marketing: number
  incomes: Record<string, number>
  expenses: Record<string, number>
}

export function summarizeProfitPc(rows: ProfitPcFact[]) {
  const use = rows.filter((r) => r.store !== '门店/门店' && !String(r.store).includes('模板'))
  const turnover = use.reduce((s, r) => s + num(r.turnover), 0)
  const paid = use.reduce((s, r) => s + num(r.paid), 0)
  const orders = use.reduce((s, r) => s + num(r.orders), 0)
  const profit = use.reduce((s, r) => s + num(r.profit), 0)
  const incomeTotal = use.reduce((s, r) => s + num(r.incomeTotal), 0)
  const expenseTotal = use.reduce((s, r) => s + num(r.expenseTotal), 0)
  const marketing = use.reduce((s, r) => s + num(r.incomes?.marketing), 0)
  const goodsOriginal = use.reduce((s, r) => s + num(r.incomes?.goodsOriginal), 0)
  const deliveryPack = use.reduce(
    (s, r) => s + num(r.incomes?.delivery) + num(r.incomes?.packaging) + num(r.incomes?.addrChange) + num(r.incomes?.other) + num(r.incomes?.salesOrder),
    0,
  )
  const expenseItems = mergeExpenses({
    goodsCost: use.reduce((s, r) => s + num(r.expenses?.goodsCost), 0),
    offlineGoods: use.reduce((s, r) => s + num(r.expenses?.offlineGoods), 0),
    selfDelivery: use.reduce((s, r) => s + num(r.expenses?.selfDelivery), 0),
    platformDelivery: use.reduce((s, r) => s + num(r.expenses?.platformDelivery), 0),
    commission: use.reduce((s, r) => s + num(r.expenses?.commission), 0),
    donation: use.reduce((s, r) => s + num(r.expenses?.donation), 0),
    labor: use.reduce((s, r) => s + num(r.expenses?.labor), 0),
    utilities: use.reduce((s, r) => s + num(r.expenses?.utilities), 0),
    rent: use.reduce((s, r) => s + num(r.expenses?.rent), 0),
    other: use.reduce((s, r) => s + num(r.expenses?.other), 0),
    promotion: use.reduce((s, r) => s + num(r.expenses?.promotion), 0),
  })
  const coreExpense = expenseItems.goodsCost
  const deliveryExpense = expenseItems.platformDelivery + expenseItems.selfDelivery + expenseItems.commission + expenseItems.promotion
  const residualExpense = expenseTotal - coreExpense - deliveryExpense
  const subsidyRate = turnover > 0 ? marketing / turnover : null
  const profitRate = incomeTotal !== 0 ? profit / incomeTotal : null
  return {
    rows: use, turnover, paid, orders, profit, incomeTotal, expenseTotal, marketing, subsidyRate, profitRate,
    waterfall: { goodsOriginal, deliveryPack, marketing, incomeTotal, coreExpense, deliveryExpense, residualExpense, expenseTotal, profit },
  }
}

export function profitPcByStore(rows: ProfitPcFact[]): ProfitPcStore[] {
  const map = new Map<string, ProfitPcFact[]>()
  for (const r of rows) {
    if (r.store === '门店/门店') continue
    const list = map.get(r.store) || []
    list.push(r)
    map.set(r.store, list)
  }
  const out: ProfitPcStore[] = []
  for (const [store, list] of map) {
    const turnover = list.reduce((s, r) => s + num(r.turnover), 0)
    const paid = list.reduce((s, r) => s + num(r.paid), 0)
    const orders = list.reduce((s, r) => s + num(r.orders), 0)
    const incomeTotal = list.reduce((s, r) => s + num(r.incomeTotal), 0)
    const expenseTotal = list.reduce((s, r) => s + num(r.expenseTotal), 0)
    const profit = list.reduce((s, r) => s + num(r.profit), 0)
    const marketing = list.reduce((s, r) => s + num(r.incomes?.marketing), 0)
    const incomes: Record<string, number> = {}
    for (const c of INCOME_PC_LABELS) incomes[c.key] = list.reduce((s, r) => s + num(r.incomes?.[c.key]), 0)
    const merged = mergeExpenses(
      Object.fromEntries(
        ['goodsCost', 'offlineGoods', 'selfDelivery', 'platformDelivery', 'commission', 'donation', 'labor', 'utilities', 'rent', 'other', 'promotion'].map(
          (k) => [k, list.reduce((s, r) => s + num(r.expenses?.[k]), 0)],
        ),
      ),
    )
    const validSrc = list.map((r) => r.subsidyRateSrc).filter(hasNum) as number[]
    out.push({
      store,
      shortName: shortPcStore(store),
      orders,
      turnover: Math.round(turnover * 100) / 100,
      paid: Math.round(paid * 100) / 100,
      incomeTotal: Math.round(incomeTotal * 100) / 100,
      expenseTotal: Math.round(expenseTotal * 100) / 100,
      profit: Math.round(profit * 100) / 100,
      profitRate: incomeTotal !== 0 ? profit / incomeTotal : null,
      subsidyRate: turnover > 0 ? marketing / turnover : null,
      subsidyRateSrc: validSrc.length ? validSrc.reduce((a, b) => a + b, 0) / validSrc.length : null,
      marketing: Math.round(marketing * 100) / 100,
      incomes,
      expenses: merged,
    })
  }
  return out
}

export function profitPcDaily(rows: ProfitPcFact[]) {
  const map = new Map<string, ProfitPcFact[]>()
  for (const r of rows) {
    if (r.store === '门店/门店') continue
    const list = map.get(r.date) || []
    list.push(r)
    map.set(r.date, list)
  }
  const days = [...map.keys()].sort()
  const totalStores = new Set(rows.map((r) => r.store)).size || 1
  return days.map((d) => {
    const list = map.get(d) || []
    const s = summarizeProfitPc(list)
    const active = new Set(list.filter((r) => num(r.turnover) > 0).map((r) => r.store)).size
    return {
      date: d,
      label: d.slice(5),
      turnover: s.turnover,
      profit: s.profit,
      profitRate: s.profitRate,
      subsidyRate: s.subsidyRate,
      activeRate: active / totalStores,
      active,
      storeCount: new Set(list.map((r) => r.store)).size,
    }
  })
}

export function profitPcIncomeAgg(rows: ProfitPcFact[]) {
  const agg: Record<string, number> = {}
  for (const c of INCOME_PC_LABELS) agg[c.key] = 0
  for (const r of rows) {
    if (r.store === '门店/门店') continue
    for (const c of INCOME_PC_LABELS) agg[c.key]! += num(r.incomes?.[c.key])
  }
  return agg
}

export function profitPcExpenseAgg(rows: ProfitPcFact[]) {
  const agg: Record<string, number> = {}
  for (const c of EXPENSE_PC_LABELS) agg[c.key] = 0
  for (const r of rows) {
    if (r.store === '门店/门店') continue
    const m = mergeExpenses(r.expenses || {})
    for (const c of EXPENSE_PC_LABELS) agg[c.key]! += m[c.key as keyof typeof m] || 0
  }
  return agg
}
