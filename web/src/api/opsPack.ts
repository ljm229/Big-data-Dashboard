/**
 * 运营增量包：经营推广 / 流量 / 服务 / 供给 / 商品 / 活动 / 逆向 / 配送异常
 * 无数据返回 null，UI 展示 --，不编造
 */
import pack from '../data/opsPack.json'
import dash from '../data/dashboard.json'
import { bareStoreName, formatStoreName, sameStore } from '../utils/storeName'

type WeekMeta = { id: string; label?: string; start?: string; end?: string; days?: string[] }
type MonthMeta = { id: string; days?: string[] }
const WEEKS: WeekMeta[] = (dash as { weeks?: WeekMeta[] }).weeks || []
const MONTHS: MonthMeta[] = (dash as { months?: MonthMeta[] }).months || []
const ALL_DAYS: string[] = (dash as { days?: string[] }).days || []

type Funnel = {
  expose: number
  enter: number
  orderUsers: number
  enterRate: number | null
  orderRate: number | null
  overallRate: number | null
}

export type TrafficStore = {
  name: string
  shortName: string
  city: string
  expose: number
  enter: number
  orderUsers: number
  enterRate: number | null
  orderRate: number | null
  overallRate: number | null
}

export type TrafficSource = {
  cat: string
  name: string
  expose: number
  enter: number
  orderUsers: number
  enterRate: number | null
  orderRate: number | null
  overallRate: number | null
}

export type TrafficBoard = {
  days: string[]
  label: string
  funnel: Funnel
  prevFunnel: Funnel | null
  sources: TrafficSource[]
  stores: TrafficStore[]
  anomalies: { type: string; store: string; city: string; tip: string; value: string }[]
  tips: string[]
}

export type SupplyStore = {
  name: string
  shortName: string
  id: string
  online: number | null
  sellable: number | null
  active: number | null
  stockout: number | null
  refundSku: number | null
  badSku: number | null
  attendance: number | null
  absent: number | null
  absentLoss: number | null
  bundleCnt: number | null
  bundleOrders: number | null
  bundleGmv: number | null
  bundlePaid: number | null
  bundleUsers: number | null
}

export type SupplyBoard = {
  days: string[]
  label: string
  summary: {
    storeCnt: number
    online: number
    sellable: number
    active: number
    stockout: number
    refundSku: number
    badSku: number
    attendance: number | null
    absent: number
    absentLoss: number
    bundlePaid: number
    bundleOrders: number
  }
  stores: SupplyStore[]
  tips: string[]
}

export type ProductBoard = {
  kind: 'day' | 'period'
  from: string
  to: string
  label: string
  stores: {
    shortName: string
    name: string
    refundAmt: number
    refundOrders: number
    badCnt: number
    stockoutLoss: number
    stockoutTimes: number
    sales: number
    qty: number
    orders: number
  }[]
  topLossSku: { name: string; loss: number; times: number }[]
  topRefundSku: { name: string; amount: number; orders: number }[]
  topSalesSku: { name: string; sales: number; qty: number }[]
  categories: { name: string; sales: number; qty: number; refundAmt: number; stockoutLoss: number }[]
  summary: {
    skuRows: number
    sales: number
    qty: number
    orders: number
    refundAmt: number
    refundOrders: number
    badCnt: number
    stockoutLoss: number
    stockoutTimes: number
  }
  refundReasons: { name: string; value: number }[]
  tips: string[]
}

export type PromoBoard = {
  days: string[]
  label: string
  summary: {
    promotionSpend: number
    paid: number
    orders: number
    paidPerSpend: number | null
    activityPaid: number
    activitySubsidy: number
    activityOrders: number
    newUsers: number
    activeStores: number
    coverageStores: number
    sourceRows: number
  }
  daily: {
    day: string
    paid: number
    promotionSpend: number
    activityCost: number
  }[]
  activities: {
    id: string
    name: string
    shortStore: string
    paid: number
    merchantSubsidy: number
    roi: number | null
    activityOrders: number
    newUsers: number
    oldUsers: number
  }[]
  tips: string[]
}

export type ReverseOpsBoard = {
  days: string[]
  label: string
  summary: {
    lineCnt: number
    orderCnt: number
    amount: number
    timely: number
    late: number
    missing: number
    deliveryTotal: number
  }
  reasons: { name: string; value: number }[]
  types: { name: string; value: number }[]
  categories: { name: string; value: number }[]
  products: { name: string; value: number; amount: number }[]
  stores: {
    id: string
    shortName: string
    city: string
    orderCnt: number
    amount: number
    late: number
    deliveryTotal: number
  }[]
  deliveryDaily: { day: string; timely: number; late: number; missing: number }[]
  tips: string[]
}

type Pack = {
  updated_at?: string
  notes?: string[]
  traffic: Record<string, { funnel: Funnel; sources: TrafficSource[]; stores: TrafficStore[]; storeCnt: number }> | null
  marketing: Record<string, {
    paid: number | null
    orders: number | null
    profit: number | null
    promotionSpend: number | null
    activityCost: number | null
  }> | null
  service: Record<string, unknown[]> | null
  supply: Record<string, { summary: SupplyBoard['summary']; stores: SupplyStore[] }> | null
  product: Record<
    string,
    {
      kind: 'day' | 'period'
      from: string
      to: string
      stores: ProductBoard['stores']
      topLossSku: ProductBoard['topLossSku']
      topRefundSku: ProductBoard['topRefundSku']
      topSalesSku: ProductBoard['topSalesSku']
      categories: ProductBoard['categories']
      summary: ProductBoard['summary']
      refundReasons: ProductBoard['refundReasons']
    }
  > | null
  activity: Record<string, Array<{
    id: string
    name: string
    storeId: string
    store: string
    shortStore: string
    paid: number
    merchantSubsidy: number
    roi: number | null
    activityOrders: number
    newUsers: number
    oldUsers: number
  }>> | null
  reverse: Record<string, { stores: Array<{
    id: string
    name: string
    shortName: string
    city: string
    lineCnt: number
    orderCnt: number
    amount: number
    reasons: { name: string; value: number }[]
    types: { name: string; value: number }[]
    categories: { name: string; value: number }[]
    products: { name: string; value: number; amount: number }[]
  }> }> | null
  delivery: Record<string, { stores: Array<{
    id: string
    name: string
    shortName: string
    city: string
    total: number
    timely: number
    late: number
    missing: number
    merchantBasis: number
    riderBasis: number
  }> }> | null
}

const data = pack as Pack

function rate(a: number, b: number): number | null {
  if (!b) return null
  return a / b
}

function round(n: number | null, d = 4): number | null {
  if (n == null || !Number.isFinite(n)) return null
  const p = 10 ** d
  return Math.round(n * p) / p
}

/** 将筛选键解析为自然日列表 */
export function resolvePackDays(dateKey: string): string[] {
  if (!dateKey) return []
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return [dateKey]
  if (dateKey.startsWith('W:')) {
    const id = dateKey.slice(2)
    const w = WEEKS.find((x) => x.id === id)
    if (w?.days?.length) return [...w.days]
    if (id.includes('_')) {
      const [a, b] = id.split('_')
      return expandRange(a, b)
    }
  }
  if (dateKey.startsWith('M:')) {
    const id = dateKey.slice(2)
    const m = MONTHS.find((x) => x.id === id)
    if (m?.days?.length) return [...m.days]
    return ALL_DAYS.filter((d) => d.startsWith(id))
  }
  // 考核周 id：2026-08-28_2026-09-03
  if (/^\d{4}-\d{2}-\d{2}_\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
    const w = WEEKS.find((x) => x.id === dateKey)
    if (w?.days?.length) return [...w.days]
    const [a, b] = dateKey.split('_')
    return expandRange(a, b)
  }
  return []
}

function toIsoLocal(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function expandRange(from: string, to: string): string[] {
  const out: string[] = []
  const d = new Date(`${from}T12:00:00`)
  const end = new Date(`${to}T12:00:00`)
  if (Number.isNaN(d.getTime()) || Number.isNaN(end.getTime())) return []
  while (d <= end) {
    out.push(toIsoLocal(d))
    d.setDate(d.getDate() + 1)
  }
  return out
}

function daysLabel(days: string[]): string {
  if (!days.length) return ''
  if (days.length === 1) return days[0]
  return `${days[0]}～${days[days.length - 1]}（${days.length}天）`
}

function matchStore(row: { shortName?: string; name?: string; id?: string }, storeId: string | string[], storeHint?: string | string[]) {
  const ids = Array.isArray(storeId)
    ? storeId
    : String(storeId || '')
        .split(/[|、,，]/)
        .map((x) => x.trim())
        .filter(Boolean)
  if (!ids.length || ids.some((id) => !id || id === '全部')) return true
  const hints = Array.isArray(storeHint)
    ? storeHint
    : storeHint
      ? String(storeHint)
          .split(/[|、,，]/)
          .map((x) => x.trim())
          .filter(Boolean)
      : []
  return ids.some((id, i) => {
    if (row.id && (row.id === id || sameStore(row.id, id))) return true
    const hint = hints[i] || hints[0] || id
    if (row.shortName && sameStore(row.shortName, hint)) return true
    if (row.name && sameStore(row.name, hint)) return true
    const bareHint = bareStoreName(hint)
    if (bareHint && row.shortName && (bareHint.includes(bareStoreName(row.shortName)) || bareStoreName(row.shortName).includes(bareHint))) {
      return true
    }
    return false
  })
}

function withStoreLabel<T extends { shortName?: string; name?: string }>(row: T): T {
  const shortName = formatStoreName(row.shortName || row.name) || row.shortName
  const name = formatStoreName(row.name || row.shortName) || row.name
  return { ...row, shortName, name }
}

function matchCity(city: string | string[], rowCity?: string) {
  const list = Array.isArray(city)
    ? city
    : String(city || '')
        .split(/[|、,，]/)
        .map((x) => x.trim())
        .filter(Boolean)
  if (!list.length || list.some((c) => !c || c === '全部' || c === '全国')) return true
  const c = (rowCity || '').replace(/市$/, '')
  return list.some((item) => {
    const want = item.replace(/市$/, '')
    return c === want || c.includes(want) || want.includes(c)
  })
}

function sumFunnel(list: Funnel[]): Funnel {
  const expose = list.reduce((a, x) => a + (x.expose || 0), 0)
  const enter = list.reduce((a, x) => a + (x.enter || 0), 0)
  const orderUsers = list.reduce((a, x) => a + (x.orderUsers || 0), 0)
  return {
    expose,
    enter,
    orderUsers,
    enterRate: round(rate(enter, expose)),
    orderRate: round(rate(orderUsers, enter)),
    overallRate: round(rate(orderUsers, expose)),
  }
}

function prevDaysOf(days: string[]): string[] {
  if (!days.length) return []
  if (days.length === 1) {
    const d = new Date(`${days[0]}T12:00:00`)
    d.setDate(d.getDate() - 1)
    return [`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`]
  }
  const span = days.length
  const first = new Date(`${days[0]}T12:00:00`)
  first.setDate(first.getDate() - span)
  const out: string[] = []
  for (let i = 0; i < span; i++) {
    const x = new Date(first)
    x.setDate(first.getDate() + i)
    out.push(toIsoLocal(x))
  }
  return out
}

function pctDelta(cur: number | null, prev: number | null): number | null {
  if (cur == null || prev == null || prev === 0) return null
  return (cur - prev) / Math.abs(prev)
}

export function getOpsPackMeta() {
  return {
    updatedAt: data.updated_at || '',
    notes: data.notes || [],
    hasTraffic: !!data.traffic && Object.keys(data.traffic).length > 0,
    hasMarketing: !!data.marketing && Object.keys(data.marketing).length > 0,
    hasService: !!data.service && Object.keys(data.service).length > 0,
    hasSupply: !!data.supply && Object.keys(data.supply).length > 0,
    hasProduct: !!data.product && Object.keys(data.product).length > 0,
    hasActivity: !!data.activity && Object.keys(data.activity).length > 0,
    hasReverse: !!data.reverse && Object.keys(data.reverse).length > 0,
    hasDelivery: !!data.delivery && Object.keys(data.delivery).length > 0,
  }
}

/** 增量数据包中实际可用的自然日，用于补齐质量库尚未覆盖的新日期。 */
export function getOpsPackAvailableDates(): string[] {
  const keys = [data.traffic, data.marketing, data.service, data.supply, data.activity, data.reverse, data.delivery]
    .flatMap((bucket) => bucket ? Object.keys(bucket) : [])
    .filter((day) => /^\d{4}-\d{2}-\d{2}$/.test(day))
  if (data.product) {
    for (const row of Object.values(data.product)) {
      if (row.kind === 'day' && row.from) keys.push(row.from)
    }
  }
  return [...new Set(keys)].sort()
}

export function fetchTrafficBoard(
  dateKey: string,
  city = '全部',
  storeId = '全部',
  storeHint?: string,
): TrafficBoard | null {
  if (!data.traffic) return null
  const days = resolvePackDays(dateKey).filter((d) => data.traffic![d])
  if (!days.length) return null

  const dayBuckets = days.map((d) => data.traffic![d])
  let storesMap = new Map<string, TrafficStore>()
  let sourcesMap = new Map<string, TrafficSource>()

  for (const b of dayBuckets) {
    for (const st of b.stores) {
      if (!matchCity(city, st.city)) continue
      if (!matchStore(st, storeId, storeHint)) continue
      const cur = storesMap.get(st.shortName) || {
        ...st,
        expose: 0,
        enter: 0,
        orderUsers: 0,
        enterRate: null,
        orderRate: null,
        overallRate: null,
      }
      cur.expose += st.expose
      cur.enter += st.enter
      cur.orderUsers += st.orderUsers
      if (st.city) cur.city = st.city
      storesMap.set(st.shortName, cur)
    }
    // 来源仅在全国/全店时有意义；单店筛选时按店漏斗为主，来源仍用全量日汇总（数据源无店×来源再筛时的预聚合）
    const storeAll =
      !storeId ||
      storeId === '全部' ||
      (Array.isArray(storeId) && (!storeId.length || storeId.every((s) => s === '全部')))
    if (storeAll) {
      for (const s of b.sources) {
        const k = `${s.cat}||${s.name}`
        const cur = sourcesMap.get(k) || { ...s, expose: 0, enter: 0, orderUsers: 0 }
        cur.expose += s.expose
        cur.enter += s.enter
        cur.orderUsers += s.orderUsers
        sourcesMap.set(k, cur)
      }
    }
  }

  const stores = [...storesMap.values()]
    .map((st) => ({
      ...st,
      enterRate: round(rate(st.enter, st.expose)),
      orderRate: round(rate(st.orderUsers, st.enter)),
      overallRate: round(rate(st.orderUsers, st.expose)),
    }))
    .map(withStoreLabel)
    .sort((a, b) => (a.overallRate ?? 1) - (b.overallRate ?? 1))

  if (!stores.length) return null

  const funnel = sumFunnel(stores)
  const sources = [...sourcesMap.values()]
    .map((s) => ({
      ...s,
      enterRate: round(rate(s.enter, s.expose)),
      orderRate: round(rate(s.orderUsers, s.enter)),
      overallRate: round(rate(s.orderUsers, s.expose)),
    }))
    .sort((a, b) => b.expose - a.expose)
    .slice(0, 12)

  // 环比：上一同等跨度且天数对齐才展示（避免残周对完整周）
  const prevDays = (dateKey.startsWith('W:')
    ? days.map((day) => {
        const d = new Date(`${day}T12:00:00`)
        d.setDate(d.getDate() - 7)
        return toIsoLocal(d)
      })
    : prevDaysOf(days)).filter((d) => data.traffic![d])
  let prevFunnel: Funnel | null = null
  if (prevDays.length === days.length) {
    const prevStores: Funnel[] = []
    for (const d of prevDays) {
      for (const st of data.traffic![d].stores) {
        if (!matchCity(city, st.city)) continue
        if (!matchStore(st, storeId, storeHint)) continue
        prevStores.push(st)
      }
    }
    if (prevStores.length) {
      const map = new Map<string, Funnel & { shortName: string }>()
      // 简化：直接合计
      prevFunnel = sumFunnel(prevStores)
    }
  }

  const medEnter =
    stores.length > 0
      ? [...stores].map((s) => s.enterRate ?? 0).sort((a, b) => a - b)[Math.floor(stores.length / 2)]
      : 0
  const medOrder =
    stores.length > 0
      ? [...stores].map((s) => s.orderRate ?? 0).sort((a, b) => a - b)[Math.floor(stores.length / 2)]
      : 0

  const anomalies: TrafficBoard['anomalies'] = []
  for (const st of stores.slice(0, 8)) {
    if ((st.enterRate ?? 1) < medEnter * 0.7 && st.expose >= 500) {
      anomalies.push({
        type: '进店转化弱',
        store: st.shortName,
        city: st.city,
        tip: '曝光尚可但进店率偏低，优先查装修/入口曝光位',
        value: `进店率 ${((st.enterRate ?? 0) * 100).toFixed(1)}%`,
      })
    } else if ((st.orderRate ?? 1) < medOrder * 0.7 && st.enter >= 80) {
      anomalies.push({
        type: '下单转化弱',
        store: st.shortName,
        city: st.city,
        tip: '进店后下单弱，查价格/库存/活动力度',
        value: `下单率 ${((st.orderRate ?? 0) * 100).toFixed(1)}%`,
      })
    }
  }

  const tips: string[] = []
  if (funnel.enterRate != null && funnel.orderRate != null) {
    if (funnel.enterRate < 0.08) tips.push('整体进店率偏低，断点更可能在曝光→进店（入口/装修）。')
    else if (funnel.orderRate < 0.2) tips.push('进店相对健康，断点更可能在进店→下单（供给/价格/活动）。')
    else tips.push('漏斗两环相对均衡，优先盯门店效率尾部与低效来源。')
  }
  if (prevFunnel) {
    const dEnter = pctDelta(funnel.enterRate, prevFunnel.enterRate)
    const dOrder = pctDelta(funnel.orderRate, prevFunnel.orderRate)
    if (dEnter != null && dEnter < -0.1) tips.push('进店率日比明显下滑，优先复盘流量入口变化。')
    if (dOrder != null && dOrder < -0.1) tips.push('下单率日比下滑，结合供给与活动页核对。')
  }

  return {
    days,
    label: daysLabel(days),
    funnel,
    prevFunnel,
    sources,
    stores,
    anomalies: anomalies.slice(0, 8),
    tips,
  }
}

export function fetchSupplyBoard(
  dateKey: string,
  city = '全部',
  storeId = '全部',
  storeHint?: string,
): SupplyBoard | null {
  if (!data.supply) return null
  const days = resolvePackDays(dateKey).filter((d) => data.supply![d])
  if (!days.length) return null

  /** 供给表无城市列：用同日流量店名×城市做映射 */
  const cityByShort = new Map<string, string>()
  if (data.traffic && city !== '全部') {
    for (const d of days) {
      const tb = data.traffic[d]
      if (!tb) continue
      for (const st of tb.stores) {
        if (st.city) cityByShort.set(st.shortName, st.city)
      }
    }
  }

  const map = new Map<string, SupplyStore>()
  for (const d of days) {
    for (const st of data.supply![d].stores) {
      if (!matchStore(st, storeId, storeHint)) continue
      if (city !== '全部') {
        const c = cityByShort.get(st.shortName)
        if (c && !matchCity(city, c)) continue
        if (!c) continue // 无法确认城市时不纳入城市筛选结果
      }
      const cur = map.get(st.shortName)
      if (!cur) {
        map.set(st.shortName, { ...st })
        continue
      }
      const addKeys = [
        'online',
        'sellable',
        'active',
        'stockout',
        'refundSku',
        'badSku',
        'absent',
        'absentLoss',
        'bundleCnt',
        'bundleOrders',
        'bundleGmv',
        'bundlePaid',
        'bundleUsers',
      ] as const
      for (const k of addKeys) {
        const a = cur[k]
        const b = st[k]
        if (a == null && b == null) cur[k] = null
        else cur[k] = (Number(a) || 0) + (Number(b) || 0)
      }
      if (cur.attendance != null || st.attendance != null) {
        const vals = [cur.attendance, st.attendance].filter((v) => v != null) as number[]
        cur.attendance = vals.reduce((a, b) => a + b, 0) / vals.length
      }
    }
  }

  const stores = [...map.values()].map(withStoreLabel).sort((a, b) => (b.absentLoss || 0) - (a.absentLoss || 0))
  if (!stores.length) return null

  const attVals = stores.map((s) => s.attendance).filter((v): v is number => v != null)
  const summary = {
    storeCnt: stores.length,
    online: stores.reduce((a, s) => a + (s.online || 0), 0),
    sellable: stores.reduce((a, s) => a + (s.sellable || 0), 0),
    active: stores.reduce((a, s) => a + (s.active || 0), 0),
    stockout: stores.reduce((a, s) => a + (s.stockout || 0), 0),
    refundSku: stores.reduce((a, s) => a + (s.refundSku || 0), 0),
    badSku: stores.reduce((a, s) => a + (s.badSku || 0), 0),
    attendance: attVals.length ? attVals.reduce((a, b) => a + b, 0) / attVals.length : null,
    absent: stores.reduce((a, s) => a + (s.absent || 0), 0),
    absentLoss: Math.round(stores.reduce((a, s) => a + (s.absentLoss || 0), 0) * 100) / 100,
    bundlePaid: Math.round(stores.reduce((a, s) => a + (s.bundlePaid || 0), 0) * 100) / 100,
    bundleOrders: stores.reduce((a, s) => a + (s.bundleOrders || 0), 0),
  }

  const tips: string[] = []
  if (summary.attendance != null && summary.attendance < 0.85) {
    tips.push('商品出勤率偏低，缺勤损失可能在拖累转化，优先盯缺货榜尾部门店。')
  }
  if (summary.absentLoss > 0) {
    tips.push(`本期缺勤损失合计约 ¥${summary.absentLoss.toFixed(0)}，按损失金额排店后下钻品级。`)
  }
  if (days.length > 1) {
    tips.push('多日汇总：在架/缺货等为各日加总，出勤率为店均值，解读时注意不可与单日直接比。')
  }

  return { days, label: daysLabel(days), summary, stores, tips }
}

export function fetchProductBoard(dateKey: string, storeId = '全部', storeHint?: string): ProductBoard | null {
  if (!data.product) return null
  const days = resolvePackDays(dateKey)
  const entries = Object.values(data.product)
  if (!entries.length) return null

  // 优先：日键精确命中；否则取与筛选区间有交集的 period
  let hit =
    days.length === 1 && data.product[days[0]]
      ? data.product[days[0]]
      : entries.find((e) => {
          if (e.kind !== 'period') return false
          if (!days.length) return true
          const from = e.from
          const to = e.to
          return days.some((d) => d >= from && d <= to) || (days[0] <= to && days[days.length - 1] >= from)
        })

  if (!hit && data.product.period) hit = data.product.period
  if (!hit) hit = entries[0]
  if (!hit) return null

  let stores = hit.stores
  if (storeId !== '全部') {
    stores = stores.filter((s) => matchStore(s, storeId, storeHint))
  }
  if (!stores.length && storeId !== '全部') return null

  const tips: string[] = []
  if (hit.kind === 'period') {
    tips.push(`品钻为下载区间 ${hit.from}～${hit.to} 汇总，非按日切片；与上方日/周筛选重叠时展示本区间。`)
  }
  const topLoss = hit.topLossSku[0]
  if (topLoss) tips.push(`缺货损失 Top 品：${topLoss.name.slice(0, 24)}…（¥${topLoss.loss}）`)

  return {
    kind: hit.kind,
    from: hit.from,
    to: hit.to,
    label: hit.kind === 'period' ? `${hit.from}～${hit.to} 区间` : hit.from,
    stores: stores.map(withStoreLabel),
    topLossSku: hit.topLossSku,
    topRefundSku: hit.topRefundSku,
    topSalesSku: hit.topSalesSku || [],
    categories: storeId === '全部' ? hit.categories || [] : [],
    summary: stores.reduce(
      (acc, store) => {
        acc.sales += store.sales || 0
        acc.qty += store.qty || 0
        acc.orders += store.orders || 0
        acc.refundAmt += store.refundAmt || 0
        acc.refundOrders += store.refundOrders || 0
        acc.badCnt += store.badCnt || 0
        acc.stockoutLoss += store.stockoutLoss || 0
        acc.stockoutTimes += store.stockoutTimes || 0
        return acc
      },
      {
        skuRows: storeId === '全部' ? hit.summary?.skuRows || 0 : 0,
        sales: 0,
        qty: 0,
        orders: 0,
        refundAmt: 0,
        refundOrders: 0,
        badCnt: 0,
        stockoutLoss: 0,
        stockoutTimes: 0,
      },
    ),
    refundReasons: hit.refundReasons || [],
    tips,
  }
}

function sumNamedRows(rows: { name: string; value: number }[], map: Map<string, number>) {
  for (const row of rows || []) map.set(row.name, (map.get(row.name) || 0) + (row.value || 0))
}

export function fetchPromoBoard(dateKey: string, storeId = '全部', storeHint?: string): PromoBoard | null {
  const requested = resolvePackDays(dateKey)
  const days = requested.filter((day) => data.marketing?.[day] || data.activity?.[day])
  if (!days.length) return null

  const daily = days
    .map((day) => ({
      day,
      paid: data.marketing?.[day]?.paid || 0,
      promotionSpend: data.marketing?.[day]?.promotionSpend || 0,
      activityCost: data.marketing?.[day]?.activityCost || 0,
    }))
    .sort((a, b) => a.day.localeCompare(b.day))

  const activityRows = days.flatMap((day) => data.activity?.[day] || []).filter((row) =>
    matchStore({ id: row.storeId, name: row.store, shortName: row.shortStore }, storeId, storeHint),
  )
  const byActivity = new Map<string, PromoBoard['activities'][number]>()
  for (const row of activityRows) {
    const key = `${row.id}||${row.shortStore}`
    const cur = byActivity.get(key) || {
      id: row.id,
      name: row.name,
      shortStore: formatStoreName(row.shortStore || row.store),
      paid: 0,
      merchantSubsidy: 0,
      roi: null,
      activityOrders: 0,
      newUsers: 0,
      oldUsers: 0,
    }
    cur.paid += row.paid || 0
    cur.merchantSubsidy += row.merchantSubsidy || 0
    cur.activityOrders += row.activityOrders || 0
    cur.newUsers += row.newUsers || 0
    cur.oldUsers += row.oldUsers || 0
    if (row.roi != null) cur.roi = row.roi
    byActivity.set(key, cur)
  }
  const activities = [...byActivity.values()].sort((a, b) => b.paid - a.paid).slice(0, 16)
  const promotionSpend = daily.reduce((a, row) => a + row.promotionSpend, 0)
  const paid = daily.reduce((a, row) => a + row.paid, 0)
  const summary = {
    promotionSpend,
    paid,
    orders: days.reduce((a, day) => a + (data.marketing?.[day]?.orders || 0), 0),
    paidPerSpend: rate(paid, promotionSpend),
    activityPaid: activities.reduce((a, row) => a + row.paid, 0),
    activitySubsidy: activities.reduce((a, row) => a + row.merchantSubsidy, 0),
    activityOrders: activities.reduce((a, row) => a + row.activityOrders, 0),
    newUsers: activities.reduce((a, row) => a + row.newUsers, 0),
    activeStores: new Set(activityRows.map((row) => row.shortStore || row.store)).size,
    coverageStores: new Set(Object.values(data.activity || {}).flat().map((row) => row.shortStore || row.store)).size,
    sourceRows: activityRows.length,
  }
  const tips = [`本期活动源表有 ${summary.sourceRows} 条记录，覆盖 ${summary.activeStores}/${summary.coverageStores} 家活动门店。`, '全店实付/推广费用于观察投入强度，不代表广告归因 ROAS。']
  if (storeId !== '全部') tips.push('推广费用趋势当前只有全店汇总口径；活动明细已按门店筛选。')
  return { days, label: daysLabel(days), summary, daily, activities, tips }
}

export function fetchReverseOpsBoard(
  dateKey: string,
  city = '全部',
  storeId = '全部',
  storeHint?: string,
): ReverseOpsBoard | null {
  const days = resolvePackDays(dateKey).filter((day) => data.reverse?.[day] || data.delivery?.[day])
  if (!days.length) return null

  const storeMap = new Map<string, ReverseOpsBoard['stores'][number]>()
  const reasonMap = new Map<string, number>()
  const typeMap = new Map<string, number>()
  const categoryMap = new Map<string, number>()
  const productMap = new Map<string, { name: string; value: number; amount: number }>()
  let lineCnt = 0
  let orderCnt = 0
  let amount = 0

  for (const day of days) {
    for (const row of data.reverse?.[day]?.stores || []) {
      if (!matchCity(city, row.city) || !matchStore(row, storeId, storeHint)) continue
      lineCnt += row.lineCnt || 0
      orderCnt += row.orderCnt || 0
      amount += row.amount || 0
      sumNamedRows(row.reasons, reasonMap)
      sumNamedRows(row.types, typeMap)
      sumNamedRows(row.categories, categoryMap)
      for (const product of row.products || []) {
        const cur = productMap.get(product.name) || { name: product.name, value: 0, amount: 0 }
        cur.value += product.value || 0
        cur.amount += product.amount || 0
        productMap.set(product.name, cur)
      }
      const key = row.id || row.shortName
      const cur = storeMap.get(key) || {
        id: row.id,
        shortName: formatStoreName(row.shortName || row.name),
        city: row.city,
        orderCnt: 0,
        amount: 0,
        late: 0,
        deliveryTotal: 0,
      }
      cur.orderCnt += row.orderCnt || 0
      cur.amount += row.amount || 0
      storeMap.set(key, cur)
    }
  }

  const deliveryDaily = days.map((day) => {
    let timely = 0
    let late = 0
    let missing = 0
    for (const row of data.delivery?.[day]?.stores || []) {
      if (!matchCity(city, row.city) || !matchStore(row, storeId, storeHint)) continue
      timely += row.timely || 0
      late += row.late || 0
      missing += row.missing || 0
      const key = row.id || row.shortName
      const cur = storeMap.get(key) || {
        id: row.id,
        shortName: formatStoreName(row.shortName || row.name),
        city: row.city,
        orderCnt: 0,
        amount: 0,
        late: 0,
        deliveryTotal: 0,
      }
      cur.late += row.late || 0
      cur.deliveryTotal += row.total || 0
      storeMap.set(key, cur)
    }
    return { day, timely, late, missing }
  }).sort((a, b) => a.day.localeCompare(b.day))

  const timely = deliveryDaily.reduce((a, row) => a + row.timely, 0)
  const late = deliveryDaily.reduce((a, row) => a + row.late, 0)
  const missing = deliveryDaily.reduce((a, row) => a + row.missing, 0)
  const stores = [...storeMap.values()].sort((a, b) => b.orderCnt - a.orderCnt || b.late - a.late)
  return {
    days,
    label: daysLabel(days),
    summary: { lineCnt, orderCnt, amount: Math.round(amount * 100) / 100, timely, late, missing, deliveryTotal: timely + late + missing },
    reasons: topMapValues(reasonMap, 10),
    types: topMapValues(typeMap, 8),
    categories: topMapValues(categoryMap, 10),
    products: [...productMap.values()].sort((a, b) => b.value - a.value).slice(0, 10),
    stores,
    deliveryDaily,
    tips: ['逆向订单按订单 ID 去重；原因与类目按退货商品行统计。', '配送异常包含及时、不及时和缺少节点数据三种状态。'],
  }
}

function topMapValues(map: Map<string, number>, limit: number) {
  return [...map.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, limit)
}

export function hasOpsPackFor(dateKey: string): boolean {
  const days = resolvePackDays(dateKey)
  if (!days.length) return !!(data.product && Object.keys(data.product).length)
  if (data.traffic && days.some((d) => data.traffic![d])) return true
  if (data.marketing && days.some((d) => data.marketing![d])) return true
  if (data.reverse && days.some((d) => data.reverse![d])) return true
  if (data.supply && days.some((d) => data.supply![d])) return true
  if (data.product) {
    return Object.values(data.product).some((e) => {
      if (e.kind === 'period') return days.some((d) => d >= e.from && d <= e.to)
      return days.includes(e.from)
    })
  }
  return false
}
