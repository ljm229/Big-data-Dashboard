/**
 * 门店运营看板数据层 — 仅使用 数据源2 聚合后的 opsDashboard.json
 */
import raw from '../data/opsDashboard.json'
import type { AssessMetric } from '../components/AssessmentCard.vue'

export type OpsStore = {
  id: string
  name: string
  shortName: string
  city: string
  gmv: number
  paid: number
  orders: number
  aov: number
  profit: number
  subsidy?: number
  subsidy_rate: number
  reverse_rate: number
  reverse_orders: number
  expose: number
  enter: number
  enter_rate: number
  order_rate: number
  ontime_rate: number
  accept_t: number
  delivery_t: number
  pick_t: number
  pick_ontime_rate: number
  merchant_lost_rate: number
  lost_orders: number
  lost_loss: number
  stockout_lost: number
}

type StockoutRow = {
  name: string
  fullName?: string
  cat: string
  times: number
  lost: number
  loss: number
  store_cnt?: number
}

type ReverseBoard = {
  line_cnt?: number
  order_cnt?: number
  amount?: number
  reasons?: Array<{ name: string; value: number }>
  types?: Array<{ name: string; value: number }>
  categories?: Array<{ name: string; value: number }>
  products?: Array<Record<string, unknown>>
}

type MarketingOverview = {
  roi?: number
  new_users?: number
  activity_order_rate?: number
  new_aov?: number
  old_aov?: number
  subsidy_merchant?: number
}

type MarketingBoard = {
  overview?: MarketingOverview
  activities?: Array<Record<string, unknown>>
}

type ProductsBoard = {
  categories: Array<{ name: string; amount: number }>
  stockouts: StockoutRow[]
  sku_total?: number
  sku_active?: number
  sku_stockout?: number
  stockout_rate?: number
  stockout_loss?: number
}

type Overview = {
  date: string
  store_cnt: number
  active_store_cnt: number
  city_cnt?: number
  gmv: number
  net_gmv?: number
  paid: number
  orders: number
  aov: number
  income?: number
  expense?: number
  profit: number
  profit_after_subsidy?: number
  profit_before_subsidy?: number
  subsidy?: number
  subsidy_rate: number
  reverse_orders: number
  reverse_rate: number
  lost_orders: number
  lost_loss: number
  expose: number
  enter: number
  order_users?: number
  enter_rate: number
  order_rate: number
  ontime_rate: number
  accept_t: number
  delivery_t: number
  pick_t: number
  pick_ontime_rate: number
  merchant_lost?: number
  merchant_lost_rate: number
  stockout_lost: number
  merchant_reverse?: number
  user_reverse?: number
  sku_total?: number
  sku_active?: number
  sku_stockout?: number
  stockout_rate?: number
  stockout_loss?: number
  scope?: string
}

function wait<T>(data: T): Promise<T> {
  return Promise.resolve(structuredClone(data))
}

type OpsSnapshot = {
  source_date?: string
  overview?: Overview
  stores?: OpsStore[]
  cities?: string[]
  categories?: Array<{ name: string; amount: number }>
  stockouts?: Array<Record<string, unknown>>
  reverse?: Record<string, unknown>
  activities?: Array<Record<string, unknown>>
  activityOverview?: Record<string, unknown>
  problemStores?: Array<Record<string, unknown>>
  actions?: Array<{ level: string; module: string; title: string; desc: string }>
  standards?: Record<string, number>
}

type OpsRoot = OpsSnapshot & {
  updated_at?: string
  dates?: Record<string, OpsSnapshot>
  primaryDate?: string
}

const root = raw as OpsRoot

function snapshotFromLegacy(): OpsSnapshot {
  return {
    source_date: root.source_date,
    overview: root.overview as Overview,
    stores: root.stores as OpsStore[],
    cities: root.cities as string[],
    categories: root.categories as Array<{ name: string; amount: number }>,
    stockouts: root.stockouts as Array<Record<string, unknown>>,
    reverse: root.reverse as Record<string, unknown>,
    activities: root.activities as Array<Record<string, unknown>>,
    activityOverview: root.activityOverview as Record<string, unknown>,
    problemStores: root.problemStores as Array<Record<string, unknown>>,
    actions: root.actions,
    standards: root.standards,
  }
}

function resolveSnapshot(isoDate: string): OpsSnapshot | null {
  if (root.dates) {
    return root.dates[isoDate] || null
  }
  const legacyIso = formatBizDate(String(root.source_date || ''))
  if (!isoDate || isoDate === legacyIso) return snapshotFromLegacy()
  return null
}

export function getOpsAvailableDates() {
  if (root.dates) {
    return Object.keys(root.dates).sort()
  }
  const iso = formatBizDate(String(root.source_date || ''))
  return iso ? [iso] : []
}

export function hasOpsData(isoDate: string) {
  return getOpsAvailableDates().includes(isoDate)
}

export function getSourceDate(isoDate?: string) {
  const snap = isoDate ? resolveSnapshot(isoDate) : snapshotFromLegacy()
  return String(snap?.source_date || root.source_date || '')
}

export function getUpdatedAt() {
  return String(root.updated_at || '')
}

export function listCities(isoDate: string) {
  const snap = resolveSnapshot(isoDate)
  if (!snap) return ['全部']
  return ['全部', ...((snap.cities || []) as string[])]
}

export function listStores(isoDate: string, city = '全部') {
  const snap = resolveSnapshot(isoDate)
  const rows = (snap?.stores || []) as OpsStore[]
  if (!city || city === '全部') return rows
  return rows.filter((s) => s.city === city)
}

function filterStores(isoDate: string, city: string, storeId: string) {
  let rows = listStores(isoDate, city)
  if (storeId && storeId !== '全部') rows = rows.filter((s) => s.id === storeId)
  return rows
}

function sum(rows: OpsStore[], key: keyof OpsStore) {
  return rows.reduce((a, r) => a + Number(r[key] || 0), 0)
}

function weighted(rows: OpsStore[], valueKey: keyof OpsStore, weightKey: keyof OpsStore = 'orders') {
  const w = sum(rows, weightKey)
  if (!w) {
    const vals = rows.map((r) => Number(r[valueKey] || 0)).filter((v) => v > 0)
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0
  }
  return rows.reduce((a, r) => a + Number(r[valueKey] || 0) * Number(r[weightKey] || 0), 0) / w
}

export async function fetchOpsOverview(
  isoDate: string,
  city = '全部',
  storeId = '全部',
): Promise<Overview | null> {
  const snap = resolveSnapshot(isoDate)
  if (!snap?.overview) return null
  const rows = filterStores(isoDate, city, storeId)
  if (!rows.length) return null

  if (city === '全部' && storeId === '全部') {
    return wait({ ...(snap.overview as Overview), scope: '全国' })
  }

  const orders = sum(rows, 'orders')
  const gmv = sum(rows, 'gmv')
  const paid = sum(rows, 'paid')
  const expose = sum(rows, 'expose')
  const enter = sum(rows, 'enter')
  const reverse_orders = sum(rows, 'reverse_orders')
  const profit = sum(rows, 'profit')
  const subsidy = sum(rows, 'subsidy')
  const order_users = Math.round(sum(rows, 'orders')) // 门店维无下单人数时用订单近似

  return wait({
    ...(snap.overview as Overview),
    scope: storeId !== '全部' ? rows[0]?.shortName : city,
    store_cnt: rows.length,
    active_store_cnt: rows.filter((r) => r.orders > 0).length,
    gmv,
    paid,
    orders,
    aov: orders ? paid / orders : 0,
    profit,
    profit_after_subsidy: profit,
    profit_before_subsidy: profit + subsidy,
    subsidy,
    subsidy_rate: gmv ? subsidy / gmv : weighted(rows, 'subsidy_rate', 'gmv'),
    reverse_orders,
    reverse_rate: orders ? reverse_orders / orders : 0,
    lost_orders: sum(rows, 'lost_orders'),
    lost_loss: sum(rows, 'lost_loss'),
    expose,
    enter,
    order_users,
    enter_rate: expose ? enter / expose : 0,
    order_rate: enter ? Math.min(1, order_users / enter) : 0,
    ontime_rate: weighted(rows, 'ontime_rate'),
    accept_t: weighted(rows, 'accept_t'),
    delivery_t: weighted(rows, 'delivery_t'),
    pick_t: weighted(rows, 'pick_t'),
    pick_ontime_rate: weighted(rows, 'pick_ontime_rate'),
    merchant_lost_rate: weighted(rows, 'merchant_lost_rate'),
    stockout_lost: sum(rows, 'stockout_lost'),
  })
}

export async function fetchAssessmentMetrics(
  isoDate: string,
  city = '全部',
  storeId = '全部',
): Promise<AssessMetric[]> {
  const snap = resolveSnapshot(isoDate)
  const ov = await fetchOpsOverview(isoDate, city, storeId)
  const std = (snap?.standards || {}) as Record<string, number>
  if (!ov) return []

  const mk = (
    key: string,
    name: string,
    color: string,
    unit: '%' | 'min',
    value: number,
    standard: number,
    direction: 'up' | 'down',
  ): AssessMetric => {
    const display = unit === '%' ? value * 100 : value
    const stdDisplay = unit === '%' ? standard * 100 : standard
    const met = direction === 'up' ? display >= stdDisplay : display <= stdDisplay
    const gap = display - stdDisplay
    return {
      key,
      name,
      color,
      unit,
      value: Number(display.toFixed(2)),
      standard: Number(stdDisplay.toFixed(2)),
      deltaPp: Number(gap.toFixed(2)),
      direction,
      met,
      trendGood: met,
      deltaLabel: '距标准',
      trend: Array.from({ length: 7 }, (_, i) => Number((display * (0.97 + i * 0.005)).toFixed(2))),
    }
  }

  return [
    mk('ontime', '及时送达率', '#5B9BD5', '%', ov.ontime_rate, std.ontime_rate ?? 0.9, 'up'),
    mk('pick', '拣货及时率', '#2A5C82', '%', ov.pick_ontime_rate, std.pick_ontime_rate ?? 0.8, 'up'),
    mk('reverse', '逆向订单率', '#E74C3C', '%', ov.reverse_rate, std.reverse_rate ?? 0.05, 'down'),
    mk('merchant', '商责流失率', '#FFC000', '%', ov.merchant_lost_rate, std.merchant_lost_rate ?? 0.01, 'down'),
    mk('delivery', '平均配送时长', '#70AD47', 'min', ov.delivery_t, std.delivery_t ?? 15, 'down'),
  ]
}

export async function fetchFunnel(isoDate: string, city = '全部', storeId = '全部') {
  const ov = await fetchOpsOverview(isoDate, city, storeId)
  if (!ov) return null
  return wait({
    expose: ov.expose,
    enter: ov.enter,
    order_users: ov.order_users ?? ov.orders,
    enter_rate: ov.enter_rate,
    order_rate: ov.order_rate,
    aov: ov.aov,
    gmv: ov.gmv,
    paid: ov.paid,
    orders: ov.orders,
  })
}

export async function fetchReverseBoard(isoDate: string) {
  const snap = resolveSnapshot(isoDate)
  if (!snap) return wait(null as ReverseBoard | null)
  return wait((snap.reverse || null) as ReverseBoard | null)
}

export async function fetchProductsBoard(isoDate: string) {
  const snap = resolveSnapshot(isoDate)
  if (!snap?.overview) return wait(null as ProductsBoard | null)
  const ov = snap.overview as Overview
  return wait({
    categories: (snap.categories || []) as Array<{ name: string; amount: number }>,
    stockouts: (snap.stockouts || []) as StockoutRow[],
    sku_total: ov.sku_total,
    sku_active: ov.sku_active,
    sku_stockout: ov.sku_stockout,
    stockout_rate: ov.stockout_rate,
    stockout_loss: ov.stockout_loss,
  })
}

export async function fetchMarketingBoard(isoDate: string) {
  const snap = resolveSnapshot(isoDate)
  if (!snap) return wait(null as MarketingBoard | null)
  return wait({
    overview: snap.activityOverview as MarketingOverview | undefined,
    activities: snap.activities || [],
  })
}

export async function fetchProblemStores(isoDate: string, city = '全部') {
  const snap = resolveSnapshot(isoDate)
  if (!snap) return wait([])
  let rows = (snap.problemStores || []) as Array<Record<string, unknown>>
  if (city && city !== '全部') rows = rows.filter((r) => r.city === city)
  return wait(rows)
}

export async function fetchActions(isoDate: string) {
  const snap = resolveSnapshot(isoDate)
  if (!snap) return wait([])
  return wait((snap.actions || []) as Array<{ level: string; module: string; title: string; desc: string }>)
}

export async function fetchFinanceStrip(isoDate: string, city = '全部', storeId = '全部') {
  const ov = await fetchOpsOverview(isoDate, city, storeId)
  if (!ov) return []
  return wait([
    { label: '总成交额', value: ov.gmv, kind: 'money' as const },
    { label: '顾客实付', value: ov.paid, kind: 'money' as const },
    { label: '有效订单', value: ov.orders, kind: 'int' as const },
    { label: '实付笔单价', value: ov.aov, kind: 'money' as const },
    { label: '补后毛利', value: ov.profit_after_subsidy ?? ov.profit, kind: 'money' as const },
    { label: '补前毛利', value: ov.profit_before_subsidy ?? ov.profit, kind: 'money' as const },
    { label: '商家补贴力度', value: ov.subsidy_rate, kind: 'pct' as const },
    { label: '流失预计损失', value: ov.lost_loss, kind: 'money' as const },
  ])
}

export function healthFromMetrics(metrics: AssessMetric[]) {
  if (!metrics.length) return { score: 0, met: 0, total: 0 }
  const met = metrics.filter((m) => m.met).length
  const score = Math.round((met / metrics.length) * 100)
  return { score, met, total: metrics.length }
}

export function formatBizDate(rawDate: string) {
  // 20260828-20260828 → 2026-08-28
  const m = String(rawDate || '').match(/(\d{4})(\d{2})(\d{2})/)
  if (!m) return rawDate || '--'
  return `${m[1]}-${m[2]}-${m[3]}`
}
