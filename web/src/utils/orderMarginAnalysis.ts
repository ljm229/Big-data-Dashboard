/** 订单毛利聚合：全量订单作分母；负毛利结构 / ＞3 元占比 / 漏损；变化桥驱动。 */
export type ReasonKey = '商品毛利为负' | '营销折扣过高' | '配送成本过高' | '平台费用占比高' | '其他'

export type OrderMarginFact = {
  date: string
  store: string
  storeCode: string
  channel: string
  /** 全量订单数 */
  orders: number
  /** 预计毛利 < 0 */
  negOrders: number
  /** 预计毛利 ≤ -3 */
  negGt3: number
  /** 负毛利订单预计毛利合计（负值） */
  loss: number
  /** 应收合计（变化桥） */
  revenue?: number
  /** 全量订单预计毛利合计 */
  profitSum?: number
  /** 营销优惠合计（源表多为负） */
  marketing?: number
  /** 配送相关合计：应收配送费+自配送+平台配送服务费 */
  delivery?: number
  /** 平台费：佣金+其他平台费 */
  platform?: number
  /** 有退款单号的订单数 */
  refundOrders?: number
  /** 有退款单号订单的预计毛利合计 */
  refundProfit?: number
  reasons: Record<ReasonKey, { count: number; amount: number }>
}

export type OrderMarginData = {
  generatedAt: string
  source: { path: string; sheet: string; sha256: string; note: string }
  reasonKeys: ReasonKey[]
  stats: Record<string, unknown>
  facts: OrderMarginFact[]
}

export type CycleFact = {
  date: string
  store: string
  channel: string
  orders: number | null
  negativeOrders: number | null
  profit: number | null
}

export type StoreMeta = { name: string; city: string }

export type OrderMarginFilter = {
  from: string
  to: string
  city?: string | string[]
  store?: string | string[]
  channel?: string
}

const norm = (s: string) => s.replace(/（/g, '(').replace(/）/g, ')').replace(/\s+/g, '')
const cityOf = (s: string) => (s.includes('昆山') ? '苏州' : s.includes('姜堰') ? '泰州' : s.replace(/市/g, '').trim())
const channelOf = (s: string) => {
  const t = String(s || '').trim()
  return t === 'POS' ? 'POS渠道' : t
}

function locList(v?: string | string[]) {
  if (v == null || v === '') return []
  if (Array.isArray(v)) return v.map(String).map((x) => x.trim()).filter(Boolean)
  return String(v).split(/[|、,，]/).map((x) => x.trim()).filter(Boolean)
}

function matchLoc(filter: OrderMarginFilter, store: string, cities: Map<string, string>) {
  const storeList = locList(filter.store)
  const cityList = locList(filter.city)
  const storeAll = !storeList.length || storeList.some((s) => s === '全部')
  const cityAll = !cityList.length || cityList.some((c) => c === '全国' || c === '全部')
  const st = norm(store)
  if (!(storeAll || storeList.some((s) => norm(s) === st))) return false
  if (cityAll) return true
  const city = cities.get(st) || ''
  return cityList.some((c) => city === cityOf(c))
}

export function selectOrderMarginFacts(data: OrderMarginData, filter: OrderMarginFilter, stores: StoreMeta[]) {
  const cities = new Map(stores.map((s) => [norm(s.name), cityOf(s.city)]))
  return data.facts.filter(
    (r) =>
      r.date >= filter.from &&
      r.date <= filter.to &&
      (!filter.channel || filter.channel === '全部' || r.channel === filter.channel) &&
      matchLoc(filter, r.store, cities),
  )
}

export function selectCycleFacts(facts: CycleFact[], filter: OrderMarginFilter, stores: StoreMeta[]) {
  const cities = new Map(stores.map((s) => [norm(s.name), cityOf(s.city)]))
  return facts.filter(
    (r) =>
      r.date >= filter.from &&
      r.date <= filter.to &&
      (!filter.channel || filter.channel === '全部' || channelOf(r.channel) === filter.channel || r.channel === filter.channel) &&
      matchLoc(filter, r.store, cities),
  )
}

function sum(nums: number[]) {
  return nums.reduce((a, b) => a + b, 0)
}

function negOrdersOf(r: OrderMarginFact) {
  return r.negOrders != null ? r.negOrders : r.orders
}

export function summarizeOrderMargin(
  rows: OrderMarginFact[],
  cycleRows: CycleFact[],
  reasonKeys: ReasonKey[],
) {
  const exportOrders = sum(rows.map((r) => r.orders))
  const exportNeg = sum(rows.map((r) => negOrdersOf(r)))
  const negGt3 = sum(rows.map((r) => r.negGt3))
  const loss = Math.round(sum(rows.map((r) => r.loss)) * 100) / 100

  const cycleOrders = sum(cycleRows.map((r) => (r.orders != null && r.orders > 0 ? r.orders : 0)))
  const cycleNeg = sum(cycleRows.map((r) => (r.negativeOrders != null && r.negativeOrders > 0 ? r.negativeOrders : 0)))

  /** 相对周期有效订单的覆盖；全量导出后通常接近 1 */
  const coverage = cycleOrders > 0 ? exportOrders / cycleOrders : exportOrders > 0 ? 1 : null
  const negRate = exportOrders > 0 ? exportNeg / exportOrders : cycleOrders > 0 ? cycleNeg / cycleOrders : null
  const gt3Rate = exportOrders > 0 ? negGt3 / exportOrders : null
  const gt3AmongNeg = exportNeg > 0 ? negGt3 / exportNeg : null

  const reasonMap = Object.fromEntries(reasonKeys.map((k) => [k, { count: 0, amount: 0 }])) as Record<
    ReasonKey,
    { count: number; amount: number }
  >
  for (const row of rows) {
    for (const k of reasonKeys) {
      reasonMap[k].count += row.reasons[k]?.count || 0
      reasonMap[k].amount += row.reasons[k]?.amount || 0
    }
  }
  const reasonTotal = sum(reasonKeys.map((k) => reasonMap[k].count)) || 1
  const reasons = reasonKeys
    .map((key) => ({
      key,
      count: reasonMap[key].count,
      amount: Math.round(reasonMap[key].amount * 100) / 100,
      share: reasonMap[key].count / reasonTotal,
    }))
    .filter((r) => r.count > 0)
    .sort((a, b) => b.count - a.count)

  const byChannelMap = new Map<string, { count: number; amount: number }>()
  for (const row of rows) {
    const neg = negOrdersOf(row)
    if (!neg) continue
    const cur = byChannelMap.get(row.channel) || { count: 0, amount: 0 }
    cur.count += neg
    cur.amount += row.loss
    byChannelMap.set(row.channel, cur)
  }
  const channelTotal = sum([...byChannelMap.values()].map((v) => v.count)) || 1
  const channels = [...byChannelMap.entries()]
    .map(([key, v]) => ({
      key,
      count: v.count,
      amount: Math.round(v.amount * 100) / 100,
      share: v.count / channelTotal,
    }))
    .sort((a, b) => b.count - a.count)

  const leakage = reasons.map((r) => ({
    name: r.key,
    amount: Math.abs(r.amount),
    share: r.share,
    count: r.count,
  }))

  return {
    exportOrders,
    exportNeg,
    negGt3,
    loss,
    cycleOrders: cycleOrders || null,
    cycleNeg: cycleNeg || null,
    coverage,
    negRate,
    gt3Rate,
    gt3AmongNeg,
    reasons,
    channels,
    leakage,
    coverageOk: coverage != null && coverage >= 0.85,
  }
}

export type OrderMarginSummary = ReturnType<typeof summarizeOrderMargin>

/** 门店周报行：周期订单/毛利 + 订单毛利明细 */
export function storeProfitWeekRows(
  cycleRows: CycleFact[],
  marginRows: OrderMarginFact[],
  days: number,
) {
  const dayCount = Math.max(1, days)
  type Agg = {
    store: string
    orders: number
    profit: number
    negOrders: number
    exportOrders: number
    exportNeg: number
    negGt3: number
    loss: number
  }
  const map = new Map<string, Agg>()
  for (const r of cycleRows) {
    const key = norm(r.store)
    const cur = map.get(key) || {
      store: r.store,
      orders: 0,
      profit: 0,
      negOrders: 0,
      exportOrders: 0,
      exportNeg: 0,
      negGt3: 0,
      loss: 0,
    }
    if (r.orders != null) cur.orders += r.orders
    if (r.profit != null) cur.profit += r.profit
    if (r.negativeOrders != null) cur.negOrders += r.negativeOrders
    map.set(key, cur)
  }
  for (const r of marginRows) {
    const key = norm(r.store)
    const cur = map.get(key) || {
      store: r.store,
      orders: 0,
      profit: 0,
      negOrders: 0,
      exportOrders: 0,
      exportNeg: 0,
      negGt3: 0,
      loss: 0,
    }
    cur.exportOrders += r.orders
    cur.exportNeg += negOrdersOf(r)
    cur.negGt3 += r.negGt3
    cur.loss += r.loss || 0
    if (!cur.orders) cur.orders = r.orders
    if (!cur.negOrders) cur.negOrders = negOrdersOf(r)
    map.set(key, cur)
  }
  return [...map.values()]
    .map((r) => {
      const baseOrders = r.exportOrders > 0 ? r.exportOrders : r.orders
      const baseNeg = r.exportNeg > 0 ? r.exportNeg : r.negOrders
      const negRate = baseOrders > 0 ? baseNeg / baseOrders : null
      const gt3Rate = baseOrders > 0 ? r.negGt3 / baseOrders : null
      return {
        store: r.store,
        shortName: r.store.replace(/^淘宝便利店/, '').replace(/[()（）]/g, ''),
        negRate,
        gt3Rate,
        dailyOrders: (r.orders || r.exportOrders) / dayCount,
        dailyProfit: r.profit / dayCount,
        loss: Math.round(r.loss * 100) / 100,
        orders: r.orders || r.exportOrders,
        profit: r.profit,
        coverage: r.orders > 0 && r.exportOrders > 0 ? r.exportOrders / r.orders : null,
      }
    })
    .filter((r) => r.orders > 0)
    .sort((a, b) => (b.negRate ?? -1) - (a.negRate ?? -1))
}

export function wowDelta(cur: number | null, prev: number | null, kind: 'ratio' | 'pts' = 'ratio') {
  if (cur == null || prev == null) return null
  if (kind === 'pts') return cur - prev
  if (prev === 0) return null
  return (cur - prev) / Math.abs(prev)
}

export function periodDays(from: string, to: string) {
  const a = Date.parse(from)
  const b = Date.parse(to)
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return 1
  return Math.round((b - a) / 86400000) + 1
}

function money(v: number) {
  return Math.round(v * 100) / 100
}

export type MarginBridgeTotals = {
  orders: number
  revenue: number | null
  profit: number | null
  marketing: number | null
  delivery: number | null
  platform: number | null
  refundOrders: number
  refundProfit: number | null
}

/** 筛选后的订单毛利期间合计；缺字段则该桶为 null（不把缺数当 0） */
export function aggregateMarginBridgeTotals(rows: OrderMarginFact[]): MarginBridgeTotals {
  if (!rows.length) {
    return {
      orders: 0,
      revenue: null,
      profit: null,
      marketing: null,
      delivery: null,
      platform: null,
      refundOrders: 0,
      refundProfit: null,
    }
  }
  let orders = 0
  let revenue = 0
  let profit = 0
  let marketing = 0
  let delivery = 0
  let platform = 0
  let refundOrders = 0
  let refundProfit = 0
  let hasRevenue = false
  let hasProfit = false
  let hasMarketing = false
  let hasDelivery = false
  let hasPlatform = false
  let hasRefundProfit = false
  for (const r of rows) {
    orders += r.orders
    if (typeof r.revenue === 'number') {
      revenue += r.revenue
      hasRevenue = true
    }
    if (typeof r.profitSum === 'number') {
      profit += r.profitSum
      hasProfit = true
    }
    if (typeof r.marketing === 'number') {
      marketing += r.marketing
      hasMarketing = true
    }
    if (typeof r.delivery === 'number') {
      delivery += r.delivery
      hasDelivery = true
    }
    if (typeof r.platform === 'number') {
      platform += r.platform
      hasPlatform = true
    }
    if (typeof r.refundOrders === 'number') refundOrders += r.refundOrders
    if (typeof r.refundProfit === 'number') {
      refundProfit += r.refundProfit
      hasRefundProfit = true
    }
  }
  return {
    orders,
    revenue: hasRevenue ? money(revenue) : null,
    profit: hasProfit ? money(profit) : null,
    marketing: hasMarketing ? money(marketing) : null,
    delivery: hasDelivery ? money(delivery) : null,
    platform: hasPlatform ? money(platform) : null,
    refundOrders,
    refundProfit: hasRefundProfit ? money(refundProfit) : null,
  }
}

export type ProfitBridgeStep = {
  key: string
  name: string
  value: number
  kind: 'base' | 'delta' | 'end'
}

/**
 * 利润变化桥：
 * - 两端锚点只用 source1 利润（缺则整桥不画）
 * - 中间驱动以订单毛利两期差额为主；缺字段的驱动直接省略
 * - 售后仅在两侧至少一侧有退款单毛利时展示
 * - 「其他结构变化」「口径对齐」为可计算残差，不是估数
 */
export function buildProfitBridge(input: {
  anchorPrev: number | null
  anchorCur: number | null
  omPrev: MarginBridgeTotals
  omCur: MarginBridgeTotals
}): { steps: ProfitBridgeStep[]; compareLabel: string } | null {
  const { anchorPrev, anchorCur, omPrev, omCur } = input
  if (anchorPrev == null || anchorCur == null) return null

  const steps: ProfitBridgeStep[] = [
    { key: 'prev', name: '上期贡献利润', value: money(anchorPrev), kind: 'base' },
  ]

  const drivers: ProfitBridgeStep[] = []
  let explained = 0

  const canVol =
    omPrev.orders > 0 &&
    omCur.orders > 0 &&
    omPrev.profit != null &&
    omCur.profit != null &&
    omPrev.revenue != null &&
    omCur.revenue != null &&
    omPrev.revenue !== 0

  if (canVol) {
    const u0 = omPrev.profit! / omPrev.orders
    const a0 = omPrev.revenue! / omPrev.orders
    const a1 = omCur.revenue! / omCur.orders
    const r0 = omPrev.profit! / omPrev.revenue!
    const scale = money(u0 * (omCur.orders - omPrev.orders))
    const aov = money(r0 * omCur.orders * (a1 - a0))
    drivers.push({ key: 'scale', name: '订单规模影响', value: scale, kind: 'delta' })
    drivers.push({ key: 'aov', name: '客单价影响', value: aov, kind: 'delta' })
    explained += scale + aov
  }

  const pushFee = (key: string, name: string, cur: number | null, prev: number | null) => {
    if (cur == null || prev == null) return
    const v = money(cur - prev)
    drivers.push({ key, name, value: v, kind: 'delta' })
    explained += v
  }

  pushFee('platform', '平台费用变化', omCur.platform, omPrev.platform)
  pushFee('delivery', '配送履约变化', omCur.delivery, omPrev.delivery)
  pushFee('marketing', '营销优惠变化', omCur.marketing, omPrev.marketing)

  const hasRefund =
    (omCur.refundProfit != null || omPrev.refundProfit != null) &&
    ((omCur.refundOrders || 0) > 0 || (omPrev.refundOrders || 0) > 0)
  if (hasRefund && omCur.refundProfit != null && omPrev.refundProfit != null) {
    const v = money(omCur.refundProfit - omPrev.refundProfit)
    drivers.push({ key: 'aftersales', name: '售后损失变化', value: v, kind: 'delta' })
    explained += v
  }

  if (omCur.profit != null && omPrev.profit != null) {
    const omDelta = money(omCur.profit - omPrev.profit)
    const other = money(omDelta - explained)
    if (Math.abs(other) >= 0.01) {
      drivers.push({ key: 'omOther', name: '其他结构变化', value: other, kind: 'delta' })
      explained += other
    }
    const align = money(anchorCur - anchorPrev - omDelta)
    if (Math.abs(align) >= 0.01) {
      drivers.push({ key: 'align', name: '口径对齐差额', value: align, kind: 'delta' })
    }
  } else if (drivers.length) {
    const align = money(anchorCur - anchorPrev - explained)
    if (Math.abs(align) >= 0.01) {
      drivers.push({ key: 'align', name: '口径对齐差额', value: align, kind: 'delta' })
    }
  }

  // 无任何可算驱动时，不硬凑中间柱，只保留两端对比由页面降级处理
  if (!drivers.length) return null

  steps.push(...drivers)
  steps.push({ key: 'cur', name: '本期贡献利润', value: money(anchorCur), kind: 'end' })
  return { steps, compareLabel: '' }
}
