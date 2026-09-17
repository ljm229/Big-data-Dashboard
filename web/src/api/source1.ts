/**
 * 数据源1：渠道门店周期趋势 + 城市门店上线进度 + 淘宝闪购供给/品类。
 * KPI 只按本文件聚合；缺字段的指标返回 null（大屏显示 —）。
 */
import raw from '../data/source1.json'
import { daysInRange, shiftDay } from '../utils/bizWeek'

export type Source1Store = { name: string; city: string; status: string; address?: string }
type Fact = {
  date: string
  channel: string
  store: string
  /** 总营业额（源表字段直接加总，不重算） */
  turnover: number | null
  /** 预计线上收入（源表字段；勿当作总营业额） */
  onlineRevenue: number | null
  profit: number | null
  marginRate: number | null
  unitProfit: number | null
  paid: number | null
  orders: number | null
  refundRate: number | null
  refundOrders: number | null
}
export type SupplyFact = {
  date: string
  store: string
  onShelf: number | null
  sellable: number | null
  moving: number | null
  stockout: number | null
  refundSku: number | null
  badSku: number | null
  attendance: number | null
  absent: number | null
  absentLoss: number | null
}
export type CategoryRow = {
  name: string
  sales: number
  qty: number
  orders: number
  refundAmt: number
  stockoutLoss: number
  stockoutTimes: number
}
export type CategoryStoreRow = {
  store: string
  category: string
  sales: number
  qty: number
  orders: number
  refundAmt: number
  stockoutLoss: number
  stockoutTimes: number
}

const data = raw as unknown as {
  days: string[]
  channels: string[]
  stores: Source1Store[]
  facts: Fact[]
  supply?: SupplyFact[]
  categoryPeriod?: { from: string; to: string; channel: string; categories: CategoryRow[] } | null
  categoryByStore?: CategoryStoreRow[]
}

const facts = data.facts || []
const supplyFacts = data.supply || []
const categoryPeriod = data.categoryPeriod || null
const categoryByStore = data.categoryByStore || []

/** 统一全角/半角括号，便于翱象与淘宝闪购门店对齐 */
export function normStoreName(name: string) {
  return String(name || '')
    .replace(/（/g, '(')
    .replace(/）/g, ')')
    .replace(/\s+/g, '')
    .trim()
}

const PREFECTURE_CITIES = [
  '杭州',
  '苏州',
  '南通',
  '上海',
  '武汉',
  '无锡',
  '金华',
  '济南',
  '郑州',
  '扬州',
  '泰州',
  '淮安',
  '南京',
  '青岛',
]

/** 县级市/区并入地级市，统一输出「××市」（全国除外） */
export function canonCity(raw: string) {
  const s = String(raw || '').trim()
  if (!s || s === '全国') return s
  if (s.includes('昆山')) return '苏州市'
  if (s.includes('姜堰')) return '泰州市'
  const compact = s.replace(/市/g, '')
  const hit = PREFECTURE_CITIES.find((c) => compact === c || compact.startsWith(c))
  if (hit) return `${hit}市`
  if (!compact) return s
  return /市$/.test(s) ? s : `${compact}市`
}

const storeByName = new Map<string, Source1Store>()
for (const s of data.stores || []) {
  const row = { ...s, name: s.name, city: canonCity(s.city) }
  storeByName.set(row.name, row)
  storeByName.set(normStoreName(row.name), row)
}

export const SOURCE1_DAYS = [...(data.days || [])].sort()
export const SOURCE1_CHANNELS = ['全部', ...(data.channels || [])]
export const SOURCE1_STORES = [...new Map([...storeByName.values()].map((s) => [normStoreName(s.name), s])).values()]
export const SOURCE1_CITIES = [
  '全国',
  ...[...new Set(SOURCE1_STORES.map((s) => s.city).filter(Boolean))].sort(),
]

export type LocSel = string | string[] | undefined

function selList(v: LocSel): string[] {
  if (v == null || v === '') return []
  if (Array.isArray(v)) return v.map((x) => String(x || '').trim()).filter(Boolean)
  const raw = String(v).trim()
  if (!raw) return []
  if (raw.includes('、')) return raw.split('、').map((x) => x.trim()).filter(Boolean)
  if (raw.includes('|')) return raw.split('|').map((x) => x.trim()).filter(Boolean)
  return [raw]
}

export function isAllCity(v: LocSel) {
  const list = selList(v)
  return !list.length || list.some((x) => x === '全国' || x === '全部' || x === 'all')
}

export function isAllStore(v: LocSel) {
  const list = selList(v)
  return !list.length || list.some((x) => x === '全部')
}

function lookupStore(storeName: string) {
  return storeByName.get(storeName) || storeByName.get(normStoreName(storeName))
}

export function matchCityName(rowCity: string, selected: LocSel) {
  if (isAllCity(selected)) return true
  const row = canonCity(rowCity)
  const rowShort = String(rowCity || '').replace(/市/g, '')
  return selList(selected).some((c) => {
    if (c === '全国' || c === '全部' || c === 'all') return true
    return canonCity(c) === row || c.replace(/市/g, '') === rowShort
  })
}

function matchCity(storeName: string, city: LocSel) {
  if (isAllCity(city)) return true
  const row = lookupStore(storeName)
  return matchCityName(row?.city || '', city)
}

function matchStore(rowStore: string, store: LocSel) {
  if (isAllStore(store)) return true
  return selList(store).some(
    (s) => s !== '全部' && (rowStore === s || normStoreName(rowStore) === normStoreName(s)),
  )
}

function matchChannel(rowChannel: string, channel: string) {
  return !channel || channel === '全部' || rowChannel === channel
}

export type KpiFilter = {
  from: string
  to: string
  city?: LocSel
  channel?: string
  store?: LocSel
}

export type KpiTotals = {
  profit: number | null
  paid: number | null
  turnover: number | null
  onlineRevenue: number | null
  orders: number | null
  arpu: number | null
  profitRate: number | null
  unitProfit: number | null
  refundRate: number | null
  onlineOpen: number | null
  onlinePlan: number | null
  onlineRate: number | null
}

function emptyTotals(): KpiTotals {
  return {
    profit: null,
    paid: null,
    turnover: null,
    onlineRevenue: null,
    orders: null,
    arpu: null,
    profitRate: null,
    unitProfit: null,
    refundRate: null,
    onlineOpen: null,
    onlinePlan: null,
    onlineRate: null,
  }
}

function sumNum(rows: Fact[], field: 'profit' | 'paid' | 'orders' | 'refundOrders' | 'onlineRevenue' | 'turnover') {
  let total = 0
  let n = 0
  for (const r of rows) {
    const v = r[field]
    if (v == null || Number.isNaN(v)) continue
    total += v
    n++
  }
  return n ? total : null
}

/** 只对有值的行加权；缺权时退回简单平均。缺值不参与、不当 0。 */
function weightedAvg(
  rows: Fact[],
  valueOf: (r: Fact) => number | null,
  weightOf: (r: Fact) => number | null,
) {
  let weightedNum = 0
  let weightedDen = 0
  let plainSum = 0
  let plainN = 0
  for (const r of rows) {
    const v = valueOf(r)
    if (v == null || Number.isNaN(v)) continue
    plainSum += v
    plainN++
    const w = weightOf(r)
    if (w != null && w > 0 && !Number.isNaN(w)) {
      weightedNum += v * w
      weightedDen += w
    }
  }
  if (weightedDen) return weightedNum / weightedDen
  if (plainN) return plainSum / plainN
  return null
}

function rateWeight(r: Fact) {
  if (r.turnover != null && r.turnover !== 0) return Math.abs(r.turnover)
  if (r.onlineRevenue != null && r.onlineRevenue !== 0) return Math.abs(r.onlineRevenue)
  if (r.paid != null && r.paid !== 0) return Math.abs(r.paid)
  return null
}

function sumFacts(from: string, to: string, city: LocSel, channel: string, store: LocSel) {
  const rows = facts.filter(
    (r) =>
      r.date >= from &&
      r.date <= to &&
      matchChannel(r.channel, channel) &&
      matchStore(r.store, store) &&
      matchCity(r.store, city),
  )
  const totals = sumRows(rows)
  const hit =
    totals.profit != null ||
    totals.paid != null ||
    totals.turnover != null ||
    totals.onlineRevenue != null ||
    totals.orders != null ||
    totals.profitRate != null ||
    totals.refundRate != null ||
    totals.unitProfit != null
  return { ...totals, hit }
}

function launchTotals(city: LocSel, store: LocSel) {
  const rows = SOURCE1_STORES.filter(
    (s) => s.status && matchStore(s.name, store) && matchCity(s.name, city),
  )
  if (!rows.length) return { onlineOpen: null, onlinePlan: null, onlineRate: null }
  const onlinePlan = rows.length
  const onlineOpen = rows.filter((s) => s.status === '已营业').length
  return {
    onlineOpen,
    onlinePlan,
    onlineRate: onlinePlan ? onlineOpen / onlinePlan : null,
  }
}

export function aggregateSource1Kpi(filter: KpiFilter): KpiTotals {
  const from = filter.from
  const to = filter.to
  if (!from || !to) return emptyTotals()
  const city = filter.city || '全国'
  const channel = filter.channel || '全部'
  const store = filter.store || '全部'
  const totals = sumFacts(from, to, city, channel, store)
  const launch = launchTotals(city, store)
  if (!totals.hit) {
    return { ...emptyTotals(), ...launch }
  }
  return {
    profit: totals.profit,
    paid: totals.paid,
    turnover: totals.turnover,
    onlineRevenue: totals.onlineRevenue,
    orders: totals.orders,
    arpu: totals.arpu,
    profitRate: totals.profitRate,
    unitProfit: totals.unitProfit,
    refundRate: totals.refundRate,
    ...launch,
  }
}

export type KpiDelta = {
  profit: number | null
  paid: number | null
  turnover: number | null
  onlineRevenue: number | null
  orders: number | null
  arpu: number | null
  profitRate: number | null
  unitProfit: number | null
  refundRate: number | null
}

function rel(cur: number | null, prev: number | null) {
  if (cur == null || prev == null || !prev) return null
  return (cur - prev) / Math.abs(prev)
}

function pts(cur: number | null, prev: number | null) {
  if (cur == null || prev == null) return null
  return cur - prev
}

export function deltaOf(cur: KpiTotals, prev: KpiTotals | null): KpiDelta {
  if (!prev) {
    return {
      profit: null,
      paid: null,
      turnover: null,
      onlineRevenue: null,
      orders: null,
      arpu: null,
      profitRate: null,
      unitProfit: null,
      refundRate: null,
    }
  }
  return {
    profit: rel(cur.profit, prev.profit),
    paid: rel(cur.paid, prev.paid),
    turnover: rel(cur.turnover, prev.turnover),
    onlineRevenue: rel(cur.onlineRevenue, prev.onlineRevenue),
    orders: rel(cur.orders, prev.orders),
    arpu: rel(cur.arpu, prev.arpu),
    profitRate: pts(cur.profitRate, prev.profitRate),
    unitProfit: rel(cur.unitProfit, prev.unitProfit),
    refundRate: pts(cur.refundRate, prev.refundRate),
  }
}

export function previousDayRange(from: string, to: string) {
  const span = daysInRange(from, to).length || 1
  return { from: shiftDay(from, -span), to: shiftDay(to, -span) }
}

export function previousWeekRange(from: string, to: string) {
  return { from: shiftDay(from, -7), to: shiftDay(to, -7) }
}

/** 按口径取上期区间：日=等长前移；周=整体 -7 天；月=等长前移（残月也能出月比） */
export function previousPeriodRange(from: string, to: string, mode: 'day' | 'week' | 'month' = 'day') {
  if (!from || !to) return { from: '', to: '' }
  if (mode === 'week') return previousWeekRange(from, to)
  return previousDayRange(from, to)
}

export function periodDeltaLabel(mode: 'day' | 'week' | 'month') {
  return mode === 'week' ? '周比' : mode === 'month' ? '月比' : '日比'
}

export function hasSource1Day(iso: string) {
  return SOURCE1_DAYS.includes(iso)
}

export function source1StoreCity(name: string) {
  return lookupStore(name)?.city || ''
}

export type AggRow = {
  key: string
  profit: number | null
  paid: number | null
  turnover: number | null
  onlineRevenue: number | null
  orders: number | null
  refundOrders: number | null
  profitRate: number | null
  arpu: number | null
  unitProfit: number | null
  refundRate: number | null
}

function scopedFacts(filter: KpiFilter) {
  const city = filter.city || '全国'
  const channel = filter.channel || '全部'
  const store = filter.store || '全部'
  const from = filter.from
  const to = filter.to
  return facts.filter((r) => {
    if (from && r.date < from) return false
    if (to && r.date > to) return false
    if (!matchChannel(r.channel, channel)) return false
    if (!matchStore(r.store, store)) return false
    if (!matchCity(r.store, city)) return false
    return true
  })
}

function fold(rows: Fact[], keyOf: (r: Fact) => string) {
  const groups = new Map<string, Fact[]>()
  for (const r of rows) {
    const key = keyOf(r)
    if (!key) continue
    const group = groups.get(key) || []
    group.push(r)
    groups.set(key, group)
  }
  return [...groups.entries()].map(([key, group]) => {
    const totals = sumRows(group)
    const lastDate = group.reduce((m, r) => (r.date > m ? r.date : m), '')
    return { key, lastDate, ...totals }
  })
}

function sumRows(rows: Fact[]): Omit<AggRow, 'key'> {
  const profit = sumNum(rows, 'profit')
  const paid = sumNum(rows, 'paid')
  const turnover = sumNum(rows, 'turnover')
  const onlineRevenue = sumNum(rows, 'onlineRevenue')
  const orders = sumNum(rows, 'orders')
  const refundOrders = sumNum(rows, 'refundOrders')
  return {
    profit,
    paid,
    turnover,
    onlineRevenue,
    orders,
    refundOrders,
    // 毛利率/退款率/单均：表内指标加权聚合；客单价=实付÷订单量
    profitRate: weightedAvg(rows, (r) => r.marginRate, rateWeight),
    arpu: paid != null && orders != null && orders !== 0 ? paid / orders : null,
    unitProfit: weightedAvg(rows, (r) => r.unitProfit, (r) => r.orders),
    refundRate: weightedAvg(rows, (r) => r.refundRate, (r) => r.orders),
  }
}

/** 毛利趋势：不受当前日/周/月的起止裁切，只跟城市/平台/门店走。 */
export function source1Trend(filter: Omit<KpiFilter, 'from' | 'to'>) {
  return fold(
    facts.filter(
      (r) =>
        matchChannel(r.channel, filter.channel || '全部') &&
        matchStore(r.store, filter.store || '全部') &&
        matchCity(r.store, filter.city || '全国'),
    ),
    (r) => r.date,
  ).sort((a, b) => a.key.localeCompare(b.key))
}

const EMPTY_AGG: Omit<AggRow, 'key'> = {
  profit: null,
  paid: null,
  turnover: null,
  onlineRevenue: null,
  orders: null,
  refundOrders: null,
  profitRate: null,
  arpu: null,
  unitProfit: null,
  refundRate: null,
}

/** 指定日期序列；缺日保留空点，不当 0。 */
export function source1TrendRange(filter: KpiFilter, keys?: string[]) {
  const days =
    keys ||
    SOURCE1_DAYS.filter((d) => d >= filter.from && d <= filter.to)
  const map = new Map(source1Trend(filter).map((r) => [r.key, r]))
  return days.map((key) => map.get(key) || { key, ...EMPTY_AGG })
}

/** 数据源最近 N 日；缺日保留空点，不当 0。 */
export function source1RecentTrend(filter: Omit<KpiFilter, 'from' | 'to'>, days = 7) {
  return source1TrendRange({ ...filter, from: '', to: '' }, SOURCE1_DAYS.slice(-days))
}

export function source1ByCity(filter: KpiFilter) {
  return fold(scopedFacts(filter), (r) => canonCity(storeByName.get(r.store)?.city || '')).filter((r) => r.key)
}

export function source1ByStore(filter: KpiFilter) {
  return fold(scopedFacts(filter), (r) => r.store)
}

export function source1ByChannel(filter: KpiFilter) {
  return fold(scopedFacts(filter), (r) => r.channel)
}

export function source1LaunchByCity(city: LocSel = '全国', store: LocSel = '全部') {
  const rows = SOURCE1_STORES.filter((s) => s.status && matchStore(s.name, store) && matchCity(s.name, city))
  const map = new Map<string, { plan: number; open: number }>()
  for (const s of rows) {
    const key = canonCity(s.city) || '未标注'
    const cur = map.get(key) || { plan: 0, open: 0 }
    cur.plan += 1
    if (s.status === '已营业') cur.open += 1
    map.set(key, cur)
  }
  return [...map.entries()]
    .map(([key, v]) => ({
      city: key,
      plan: v.plan,
      open: v.open,
      pending: v.plan - v.open,
      rate: v.plan ? v.open / v.plan : 0,
    }))
    .sort((a, b) => b.rate - a.rate || b.open - a.open)
}

export function source1StoresByStatus(kind: 'open' | 'pending', city: LocSel = '全国', store: LocSel = '全部') {
  return SOURCE1_STORES.filter((s) => {
    if (!s.status) return false
    if (kind === 'open' && s.status !== '已营业') return false
    if (kind === 'pending' && s.status === '已营业') return false
    return matchStore(s.name, store) && matchCity(s.name, city)
  })
}

export type RiskStoreRow = {
  key: string
  city: string
  channel: string
  type: '毛利为负' | '退款偏高' | '缺货偏高'
  impact: number
  profit: number | null
  refundRate: number | null
  refundOrders: number | null
  /** 风险对应事实的最近日期 YYYY-MM-DD */
  asOf: string
  attendance?: number | null
  stockout?: number | null
}

/**
 * 经营风险：按「门店 × 渠道」判定（全店汇总会把单渠道亏损冲掉）。
 * - 负毛利：期内该渠道预计毛利合计 < 0
 * - 高退款：期内该渠道退款率 ≥ 5%（无订单权重时用简单平均）
 * - 缺货：供给出勤率 < 85%
 */
export function source1RiskStores(filter: KpiFilter): RiskStoreRow[] {
  const channelRows = fold(scopedFacts(filter), (r) => `${r.store}\t${r.channel}`)
  const profitAndRefund: RiskStoreRow[] = []
  for (const row of channelRows) {
    const [store, channelName] = row.key.split('\t')
    const city = lookupStore(store)?.city || ''
    const asOf = row.lastDate || filter.to || ''
    if (row.profit != null && row.profit < 0) {
      profitAndRefund.push({
        key: store,
        city,
        channel: channelName,
        type: '毛利为负',
        impact: Math.abs(row.profit),
        profit: row.profit,
        refundRate: row.refundRate,
        refundOrders: row.refundOrders,
        asOf,
      })
    }
    if (row.refundRate != null && row.refundRate >= 0.05) {
      profitAndRefund.push({
        key: store,
        city,
        channel: channelName,
        type: '退款偏高',
        impact: row.refundOrders ?? row.refundRate,
        profit: row.profit,
        refundRate: row.refundRate,
        refundOrders: row.refundOrders,
        asOf,
      })
    }
  }

  const stockRisks: RiskStoreRow[] = source1StockoutStores(filter).map((r) => ({
    key: r.store,
    city: r.city,
    channel: '',
    type: '缺货偏高' as const,
    impact: r.absentLoss || 0,
    profit: null,
    refundRate: null,
    refundOrders: null,
    asOf: r.lastDate || filter.to || '',
    attendance: r.attendance,
    stockout: r.stockout,
  }))

  return [...profitAndRefund, ...stockRisks].sort((a, b) => b.impact - a.impact)
}

const STOCKOUT_ATTENDANCE_RISK = 0.85

function scopedSupply(filter: KpiFilter) {
  const city = filter.city || '全国'
  const store = filter.store || '全部'
  const from = filter.from
  const to = filter.to
  return supplyFacts.filter((r) => {
    if (from && r.date < from) return false
    if (to && r.date > to) return false
    if (!matchStore(r.store, store)) return false
    if (!matchCity(r.store, city)) return false
    return true
  })
}

/** 门店供给汇总（筛选期内按店平均出勤、累加缺货/损失） */
export function source1StockoutStores(filter: KpiFilter) {
  const groups = new Map<string, SupplyFact[]>()
  for (const r of scopedSupply(filter)) {
    const list = groups.get(r.store) || []
    list.push(r)
    groups.set(r.store, list)
  }
  return [...groups.entries()]
    .map(([store, rows]) => {
      const attendanceVals = rows.map((r) => r.attendance).filter((v): v is number => v != null)
      const attendance = attendanceVals.length
        ? attendanceVals.reduce((a, b) => a + b, 0) / attendanceVals.length
        : null
      const stockout = rows.reduce((a, r) => a + (r.stockout || 0), 0)
      const absentLoss = rows.reduce((a, r) => a + (r.absentLoss || 0), 0)
      const lastDate = rows.reduce((m, r) => (r.date > m ? r.date : m), '')
      return {
        store,
        city: lookupStore(store)?.city || '',
        attendance,
        stockout,
        absentLoss,
        lastDate,
        risk: attendance != null && attendance < STOCKOUT_ATTENDANCE_RISK,
      }
    })
    .filter((r) => r.risk || r.absentLoss > 0)
    .sort((a, b) => b.absentLoss - a.absentLoss)
}

/** 城市摘要卡：缺货异常门店数（出勤率 < 85%） */
export function source1StockoutRiskCount(filter: KpiFilter) {
  if (!supplyFacts.length) return null
  return source1StockoutStores(filter).filter((r) => r.risk).length
}

export function source1StoreSupply(filter: KpiFilter & { store: string }) {
  const rows = scopedSupply(filter)
  if (!rows.length) return null
  const attendanceVals = rows.map((r) => r.attendance).filter((v): v is number => v != null)
  return {
    stockout: rows.reduce((a, r) => a + (r.stockout || 0), 0),
    absentLoss: rows.reduce((a, r) => a + (r.absentLoss || 0), 0),
    attendance: attendanceVals.length ? attendanceVals.reduce((a, b) => a + b, 0) / attendanceVals.length : null,
    moving: rows.reduce((a, r) => a + (r.moving || 0), 0),
  }
}

/**
 * 品类销售贡献（淘宝闪购商品明细）。
 * 无品类毛利字段；区间与筛选期无交集时才返回。
 */
export function source1ByCategory(filter: KpiFilter): CategoryRow[] {
  if (!categoryPeriod?.categories?.length) return []
  const from = filter.from
  const to = filter.to
  if (from && to && (to < categoryPeriod.from || from > categoryPeriod.to)) return []
  if (filter.channel && filter.channel !== '全部' && filter.channel !== '淘宝闪购') return []

  const city = filter.city || '全国'
  const store = filter.store || '全部'
  if (city === '全国' && store === '全部') {
    return [...categoryPeriod.categories].sort((a, b) => b.sales - a.sales)
  }

  const map = new Map<string, CategoryRow>()
  for (const row of categoryByStore) {
    if (!matchStore(row.store, store)) continue
    if (!matchCity(row.store, city)) continue
    const cur = map.get(row.category) || {
      name: row.category,
      sales: 0,
      qty: 0,
      orders: 0,
      refundAmt: 0,
      stockoutLoss: 0,
      stockoutTimes: 0,
    }
    cur.sales += row.sales
    cur.qty += row.qty
    cur.orders += row.orders
    cur.refundAmt += row.refundAmt
    cur.stockoutLoss += row.stockoutLoss
    cur.stockoutTimes += row.stockoutTimes
    map.set(row.category, cur)
  }
  return [...map.values()].sort((a, b) => b.sales - a.sales)
}

export function source1CategoryMeta() {
  return categoryPeriod
    ? { from: categoryPeriod.from, to: categoryPeriod.to, channel: categoryPeriod.channel }
    : null
}
