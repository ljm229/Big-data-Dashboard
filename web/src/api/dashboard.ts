/**
 * 只从 Excel 转换后的 JSON 取值，不做分时/订单流等推演。
 * 源：数据源周包 → dashboard.json（按日 / 按周键，毛利含后返）
 */
import raw from '../data/dashboard.json'
import { isAbnormalStore } from '../utils/health'
import { cityCoord, storeCoord, resolveProvince, normCityName } from '../data/geoMeta'

type StoreListRow = { city: string; name: string; shortName: string }

export type CategoryRow = {
  name: string
  total_gmv: number
  sales: number
  income: number
  orders: number
  qty: number
  aov: number
  profit: number
  profit_rate: number
  active_rate: number
  refund_amount: number
  refund_orders: number
  sku_online?: number
  sku_active?: number
  wow_rate?: number
  share?: number
}

type DashRaw = {
  overview?: Record<string, Record<string, number | string>>
  storeRank?: Record<string, StoreRow[]>
  cities?: Record<string, CityRow[]>
  storeList?: Record<string, StoreListRow[]>
  channelStores?: Record<string, StoreRow[]>
  costs?: Record<string, unknown>
  reverse?: Record<string, unknown>
  assessment?: Record<
    string,
    Array<{
      name: string
      shortName: string
      code?: string
      sellout_rate: number
      pick_error_rate: number
      warehouse_t: number
      im_reply_rate: number
      merchant_issue_rate: number
      shop_score?: number
    }>
  >
  weeks?: Array<{ id: string; days: string[]; start?: string; end?: string }>
  days?: string[]
  category?: {
    period?: { start?: string; end?: string; label?: string }
    overall?: CategoryRow[]
    byStore?: Array<CategoryRow & { store?: string; shortName?: string }>
  }
  updated_at?: string
  schemaVersion?: number
}

const data = raw as DashRaw

function storeListRows(dateKey: string): StoreListRow[] {
  return (data.storeList?.[dateKey] || []) as StoreListRow[]
}

function coverageByCity(dateKey: string) {
  const cover: Record<string, number> = {}
  storeListRows(dateKey).forEach((r) => {
    if (!r.city) return
    cover[r.city] = (cover[r.city] || 0) + 1
  })
  return cover
}

export function hasStoreList(dateKey: string) {
  return storeListRows(dateKey).length > 0
}

export function fetchCoverageStoreCnt(dateKey: string, cityName = '全国') {
  const list = storeListRows(dateKey)
  if (!list.length) {
    const ranks = storeRows(dateKey)
    if (!cityName || cityName === '全国') return ranks.length
    return filterStores(dateKey, cityName).length
  }
  if (!cityName || cityName === '全国') return list.length
  return list.filter((r) => matchCity(r.city, cityName)).length
}

export function toNum(v: unknown): number {
  if (v == null || v === '') return 0
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0
  const s = String(v).trim().replace(/,/g, '')
  if (!s) return 0
  if (s.endsWith('%')) return parseFloat(s) / 100 || 0
  const n = Number(s)
  return Number.isFinite(n) ? n : 0
}

function storeName(v: unknown) {
  return String(v || '')
    .replace('淘宝便利店（', '')
    .replace('）', '')
}

function matchCity(rowCity: string, selected: string) {
  if (!selected || selected === '全国') return true
  const a = rowCity.replace(/市$/, '')
  const b = selected.replace(/市$/, '')
  return a === b || rowCity === selected
}

type StoreRow = Record<string, unknown>
type CityRow = Record<string, unknown>

function storeRows(dateKey: string): StoreRow[] {
  return (data.storeRank?.[dateKey] || []) as StoreRow[]
}

function cityRows(dateKey: string): CityRow[] {
  return ((data.cities?.[dateKey] || []) as CityRow[]).filter((r) => r['城市'])
}

function channelRows(dateKey: string): StoreRow[] {
  return (data.channelStores?.[dateKey] || []) as StoreRow[]
}

function filterStores(dateKey: string, cityName: string) {
  return storeRows(dateKey).filter((r) => matchCity(String(r['城市名称'] || ''), cityName))
}

function filterCities(dateKey: string, cityName: string) {
  const all = cityRows(dateKey)
  if (!cityName || cityName === '全国') return all
  return all.filter((r) => matchCity(String(r['城市'] || ''), cityName))
}

function filterChannelStores(dateKey: string, cityName: string, channel: string) {
  return channelRows(dateKey).filter((r) => {
    if (channel && channel !== '全部' && String(r['渠道'] || '') !== channel) return false
    return matchCity(String(r['城市名称'] || ''), cityName)
  })
}

function wait<T>(data: T): Promise<T> {
  return Promise.resolve(structuredClone(data))
}

function overviewFromRanks(ranks: StoreRow[]) {
  if (!ranks.length) return null
  const sum = (k: string) => ranks.reduce((a, r) => a + toNum(r[k]), 0)
  const total_gmv = sum('总营业额')
  const paid_amount = sum('用户实付营业额')
  const paid_orders = sum('用户实付订单量')
  const buyer_cnt = sum('交易用户数')
  const est_profit = sum('预计毛利')
  return {
    total_gmv,
    discount_amount: sum('总优惠金额') || Math.max(0, total_gmv - paid_amount),
    discount_rate: total_gmv ? Math.max(0, total_gmv - paid_amount) / total_gmv : 0,
    paid_amount,
    paid_orders,
    effective_orders: paid_orders,
    buyer_cnt,
    arpu: buyer_cnt ? paid_amount / buyer_cnt : paid_orders ? paid_amount / paid_orders : 0,
    est_profit,
    profit_rate: total_gmv ? est_profit / total_gmv : 0,
    online_income: sum('预计线上收入'),
    est_expense: sum('预计线上支出'),
    purchase_cost: sum('采购成本') || sum('商品成本'),
    self_delivery_cost: sum('商家自配送费用') || sum('自配送费用'),
    refund_orders: sum('退款订单量'),
    refund_amount: sum('退款金额'),
    refund_rate: paid_orders ? sum('退款订单量') / paid_orders : 0,
    store_cnt: ranks.length,
    active_store_cnt: ranks.filter((r) => toNum(r['用户实付订单量']) > 0).length,
    rebate: sum('平台后返'),
    marketing_cost: sum('营销活动费用'),
  }
}

export function availableDates() {
  const days = (raw as { days?: string[] }).days
  if (days?.length) return days
  return Object.keys(data.storeRank || {})
    .filter((k) => !k.startsWith('W:'))
    .sort()
}

export async function fetchOverview(dateKey: string, cityName = '全国', channel = '全部') {
  if (!dateKey) return null

  if (channel && channel !== '全部') {
    const ranks = filterChannelStores(dateKey, cityName, channel)
    const ov = overviewFromRanks(ranks)
    return ov ? { ...ov, updated_at: data.updated_at || '' } : null
  }

  if (cityName && cityName !== '全国') {
    const cityAgg = filterCities(dateKey, cityName)
    const ranks = filterStores(dateKey, cityName)
    if (cityAgg.length) {
      const sum = (k: string) => cityAgg.reduce((a, r) => a + toNum(r[k]), 0)
      const total_gmv = sum('总营业额')
      const paid_amount = sum('有效订单金额（实付）') || ranks.reduce((a, r) => a + toNum(r['用户实付营业额']), 0)
      const effective_orders = sum('有效订单量')
      const est_profit = sum('预计毛利(含平台后返)') || sum('预计毛利')
      const buyer_cnt = sum('有效买家数')
      return {
        total_gmv,
        paid_amount,
        paid_orders: effective_orders,
        effective_orders,
        buyer_cnt,
        arpu: buyer_cnt ? paid_amount / buyer_cnt : effective_orders ? paid_amount / effective_orders : 0,
        est_profit,
        profit_rate: total_gmv ? est_profit / total_gmv : toNum(cityAgg[0]['毛利率(含平台后返)']) || toNum(cityAgg[0]['毛利率']),
        online_income: sum('预计线上收入'),
        est_expense: sum('预计线上支出'),
        refund_orders: sum('退款订单量'),
        refund_amount: sum('退款金额'),
        refund_rate: effective_orders ? sum('退款订单量') / effective_orders : sum('退款率') / cityAgg.length,
        store_cnt: fetchCoverageStoreCnt(dateKey, cityName) || ranks.length,
        active_store_cnt: ranks.filter((r) => toNum(r['用户实付订单量']) > 0).length,
        rebate: sum('平台后返'),
        marketing_cost: sum('营销活动费用'),
        updated_at: data.updated_at || '',
      }
    }
    const ov = overviewFromRanks(ranks)
    return ov ? { ...ov, updated_at: data.updated_at || '' } : null
  }

  const cached = data.overview?.[dateKey]
  if (cached) {
    return {
      ...cached,
      updated_at: data.updated_at || '',
    }
  }

  const ranks = filterStores(dateKey, cityName)
  if (!ranks.length) return null
  const ov = overviewFromRanks(ranks)
  return ov ? { ...ov, updated_at: data.updated_at || '' } : null
}

export async function fetchGeo(dateKey: string) {
  const ranks = storeRows(dateKey)
  const cover = coverageByCity(dateKey)
  const map: Record<
    string,
    {
      city: string
      city_code: string
      paid_amount: number
      est_profit: number
      paid_orders: number
      store_cnt: number
    }
  > = {}
  ranks.forEach((r) => {
    const city = String(r['城市名称'] || '')
    if (!city) return
    if (!map[city]) {
      map[city] = {
        city,
        city_code: String(r['城市code'] || ''),
        paid_amount: 0,
        est_profit: 0,
        paid_orders: 0,
        store_cnt: 0,
      }
    }
    map[city].paid_amount += toNum(r['用户实付营业额'])
    map[city].est_profit += toNum(r['预计毛利(含平台后返)']) || toNum(r['预计毛利'])
    map[city].paid_orders += toNum(r['用户实付订单量'])
    map[city].store_cnt += 1
  })

  if (Object.keys(cover).length) {
    Object.entries(cover).forEach(([city, cnt]) => {
      if (!map[city]) {
        map[city] = {
          city,
          city_code: '',
          paid_amount: 0,
          est_profit: 0,
          paid_orders: 0,
          store_cnt: cnt,
        }
      } else {
        map[city].store_cnt = cnt
      }
    })
  }

  return wait(
    Object.values(map).map((c) => {
      const [lng, lat] = cityCoord(c.city)
      const province = resolveProvince(c.city)
      return {
        ...c,
        profit_rate: c.paid_amount ? c.est_profit / c.paid_amount : 0,
        lng,
        lat,
        province: province?.name || '',
        provinceKey: province?.key || '',
      }
    }),
  )
}

export type MapStorePoint = {
  name: string
  shortName: string
  city: string
  lng: number
  lat: number
  paid_amount: number
  profit_rate: number
  paid_orders: number
  est_profit: number
  active: boolean
}

/** 门店地图打点：有排行数据的优先，其余用门店清单补点 */
export async function fetchMapStores(dateKey: string, cityName = '全国', channel = '全部') {
  const ranks =
    channel && channel !== '全部'
      ? filterChannelStores(dateKey, cityName, channel)
      : filterStores(dateKey, cityName)
  const byName = new Map<string, MapStorePoint>()
  ranks.forEach((r, i) => {
    const city = String(r['城市名称'] || '')
    const full = String(r['门店名称'] || '')
    const short = storeName(full)
    const [lng, lat] = storeCoord(full, city, i)
    byName.set(short || full, {
      name: full,
      shortName: short || full,
      city,
      lng,
      lat,
      paid_amount: toNum(r['用户实付营业额']),
      est_profit: toNum(r['预计毛利(含平台后返)']) || toNum(r['预计毛利']),
      paid_orders: toNum(r['用户实付订单量']),
      profit_rate: toNum(r['毛利率(含平台后返)']) || toNum(r['毛利率']),
      active: true,
    })
  })

  if (!channel || channel === '全部') {
    storeListRows(dateKey)
      .filter((r) => matchCity(r.city, cityName))
      .forEach((r, i) => {
        const short = r.shortName || storeName(r.name)
        if (byName.has(short) || byName.has(r.name)) return
        const [lng, lat] = storeCoord(r.name || short, r.city, i + ranks.length)
        byName.set(short || r.name, {
          name: r.name,
          shortName: short,
          city: normCityName(r.city),
          lng,
          lat,
          paid_amount: 0,
          est_profit: 0,
          paid_orders: 0,
          profit_rate: 0,
          active: false,
        })
      })
  }

  return wait([...byName.values()])
}

export async function fetchCityOptions(dateKey: string) {
  const geo = await fetchGeo(dateKey)
  // 用城市名做 id，避免 city_code 为空导致选项冲突
  return [{ id: 'all', name: '全国' }, ...geo.map((c) => ({ id: c.city, name: c.city }))]
}

function cityMetricSnapshot(dateKey: string, cityName: string) {
  const cities = filterCities(dateKey, cityName)
  const ranks = filterStores(dateKey, cityName)
  const sumC = (k: string) => cities.reduce((a, r) => a + toNum(r[k]), 0)
  const sumR = (k: string) => ranks.reduce((a, r) => a + toNum(r[k]), 0)
  const paidAmount = sumR('用户实付营业额') || sumC('有效订单金额（实付）')
  const paidOrders = sumR('用户实付订单量') || sumC('有效订单量')
  const estProfit = sumR('预计毛利')
  const aovFromCity =
    cities.length === 1
      ? toNum(cities[0]['有效客单价（实付）'])
      : cities.length
        ? sumC('有效客单价（实付）') / cities.length
        : 0
  const aov = aovFromCity || (paidOrders ? paidAmount / paidOrders : 0)
  const profitRate =
    cities.length === 1 ? toNum(cities[0]['毛利率']) : paidAmount ? estProfit / paidAmount : 0
  const refundRate =
    cities.length === 1
      ? toNum(cities[0]['退款率'])
      : paidOrders
        ? sumR('退款订单量') / paidOrders
        : 0
  return {
    paid_amount: paidAmount,
    paid_orders: paidOrders,
    aov,
    profit_rate: profitRate,
    refund_rate: refundRate,
    store_cnt: fetchCoverageStoreCnt(dateKey, cityName) || ranks.length,
    est_profit: estProfit,
  }
}

function pctChange(cur: number, prev: number) {
  if (!prev) return 0
  return (cur - prev) / prev
}

/** 城市地图弹窗：指标 + 环比 + 诊断文案 */
export async function fetchCityPopup(dateKey: string, compareKey: string | null, cityName: string) {
  const cur = cityMetricSnapshot(dateKey, cityName)
  const prev = compareKey ? cityMetricSnapshot(compareKey, cityName) : null
  const national = cityMetricSnapshot(dateKey, '全国')

  const tips: string[] = []
  if (cur.profit_rate >= 0.15) tips.push('盈利良好')
  else if (cur.profit_rate >= 0.08) tips.push('盈利一般')
  else if (cur.profit_rate >= 0) tips.push('盈利偏弱')
  else tips.push('出现负毛利')

  if (national.aov && cur.aov >= national.aov * 1.08) tips.push('客单价偏高')
  else if (national.aov && cur.aov <= national.aov * 0.92) tips.push('客单价偏低')

  if (cur.refund_rate > 0.05) tips.push('退款偏高')
  else if (cur.refund_rate <= 0.03) tips.push('逆向健康')

  return wait({
    name: cityName,
    store_cnt: cur.store_cnt,
    paid_amount: cur.paid_amount,
    paid_amount_diff: prev ? pctChange(cur.paid_amount, prev.paid_amount) : 0,
    paid_orders: cur.paid_orders,
    paid_orders_diff: prev ? pctChange(cur.paid_orders, prev.paid_orders) : 0,
    aov: cur.aov,
    aov_diff: prev ? pctChange(cur.aov, prev.aov) : 0,
    profit_rate: cur.profit_rate,
    profit_rate_diff: prev ? (cur.profit_rate - prev.profit_rate) * 100 : 0,
    refund_rate: cur.refund_rate,
    refund_rate_diff: prev ? (cur.refund_rate - prev.refund_rate) * 100 : 0,
    est_profit: cur.est_profit,
    diagnosis: tips.join('，') || '经营平稳',
  })
}

/** 各城市（或门店）实付/订单，对照另一天 Excel */
export async function fetchCityCompare(dateKey: string, compareKey: string | null, cityName = '全国') {
  if (cityName && cityName !== '全国') {
    const cur = filterStores(dateKey, cityName)
    const prev = compareKey ? filterStores(compareKey, cityName) : []
    const prevMap = Object.fromEntries(prev.map((r) => [String(r['门店code']), r]))
    return wait(
      cur
        .map((r) => {
          const p = prevMap[String(r['门店code'])]
          return {
            label: storeName(r['门店名称']),
            paid_orders: toNum(r['用户实付订单量']),
            paid_amount: toNum(r['用户实付营业额']),
            compare_orders: p ? toNum(p['用户实付订单量']) : 0,
            compare_amount: p ? toNum(p['用户实付营业额']) : 0,
          }
        })
        .sort((a, b) => b.paid_amount - a.paid_amount),
    )
  }
  const geo = await fetchGeo(dateKey)
  const geo2 = compareKey ? await fetchGeo(compareKey) : []
  const prevMap = Object.fromEntries(geo2.map((c) => [c.city, c]))
  return wait(
    geo
      .map((c) => ({
        label: c.city,
        paid_orders: c.paid_orders,
        paid_amount: c.paid_amount,
        compare_orders: prevMap[c.city]?.paid_orders || 0,
        compare_amount: prevMap[c.city]?.paid_amount || 0,
      }))
      .sort((a, b) => b.paid_amount - a.paid_amount),
  )
}

export async function fetchProfitByCity(dateKey: string, cityName = '全国') {
  const rows = filterCities(dateKey, cityName)
  const series = rows.map((r) => {
    const gmv = toNum(r['总营业额'])
    const paid = toNum(r['有效订单金额（实付）'])
    return {
      label: String(r['城市']),
      profit_rate: toNum(r['毛利率']),
      discount_rate: gmv ? Math.max(0, gmv - paid) / gmv : 0,
      neg_profit_order_rate: toNum(r['负毛利订单占比']),
    }
  })
  const n = rows.length || 1
  return wait({
    series,
    profit_per_order: rows.reduce((a, r) => a + toNum(r['单均毛利']), 0) / n,
    per_store: rows.reduce((a, r) => a + toNum(r['店日均毛利']), 0) / n,
    neg_profit_order_rate: rows.reduce((a, r) => a + toNum(r['负毛利订单占比']), 0) / n,
  })
}

const COST_COLORS: Record<string, string> = {
  采购成本: '#00E396',
  总优惠金额: '#FEB019',
  营销活动费用: '#FF7C00',
  平台配送服务费: '#008FFB',
  佣金及其他平台费: '#8899AA',
  商家自配送费用: '#8899AA',
}

/** 费用占营业额比；按金额降序 */
export async function fetchCost(dateKey: string, cityName = '全国', channel = '全部') {
  const COST_EXTRA: Record<string, string> = {
    ...COST_COLORS,
    商品成本: '#00E396',
    平台后返: '#9B8CFF',
    平台补贴: '#5AD8A6',
    推广费用: '#F6BD16',
  }

  if (channel && channel !== '全部') {
    const rows = filterChannelStores(dateKey, cityName, channel)
    const sum = (k: string) => rows.reduce((a, r) => a + toNum(r[k]), 0)
    const gmv = sum('总营业额')
    const paid = sum('用户实付营业额')
    const items = [
      { item: '商品成本', amount: sum('商品成本'), key: 'purchase' as const },
      { item: '总优惠金额', amount: Math.max(0, gmv - paid), key: 'discount' as const },
      { item: '营销活动费用', amount: sum('营销活动费用'), key: 'marketing' as const },
      { item: '推广费用', amount: sum('推广费用'), key: 'promo' as const },
      { item: '平台配送服务费', amount: sum('平台配送服务费'), key: 'platform_delivery' as const },
      { item: '佣金及其他平台费', amount: sum('佣金&其他平台费用'), key: 'commission' as const },
      { item: '商家自配送费用', amount: sum('自配送费用'), key: 'self_delivery' as const },
      { item: '平台补贴', amount: sum('平台补贴'), key: 'platform_subsidy' as const },
      { item: '平台后返', amount: sum('平台后返'), key: 'rebate' as const },
    ]
      .filter((x) => x.amount > 0)
      .sort((a, b) => b.amount - a.amount)
    return wait({
      est_expense: 0,
      gmv,
      items: items.map((i) => ({
        ...i,
        rate: gmv ? i.amount / gmv : 0,
        color: COST_EXTRA[i.item] || '#8899AA',
      })),
    })
  }

  if ((!cityName || cityName === '全国') && data.costs?.[dateKey]) {
    const cached = data.costs[dateKey] as {
      est_expense?: number
      items?: { item: string; amount: number; rate: number; key?: string }[]
    }
    const gmv = toNum(data.overview?.[dateKey]?.total_gmv)
    return wait({
      est_expense: cached.est_expense || 0,
      gmv,
      items: (cached.items || []).map((i) => ({
        ...i,
        color: COST_EXTRA[i.item] || '#8899AA',
      })),
    })
  }

  const rows = filterCities(dateKey, cityName)
  const sum = (k: string) => rows.reduce((a, r) => a + toNum(r[k]), 0)
  const gmv = sum('总营业额')
  const discount = Math.max(0, gmv - sum('有效订单金额（实付）'))
  const items = [
    { item: '商品成本', amount: sum('商品成本'), key: 'purchase' as const },
    { item: '总优惠金额', amount: discount, key: 'discount' as const },
    { item: '营销活动费用', amount: sum('营销活动费用'), key: 'marketing' as const },
    { item: '推广费用', amount: sum('推广费用'), key: 'promo' as const },
    { item: '平台配送服务费', amount: sum('平台配送服务费'), key: 'platform_delivery' as const },
    { item: '佣金及其他平台费', amount: sum('佣金&其他平台费用'), key: 'commission' as const },
    { item: '商家自配送费用', amount: sum('自配送费用'), key: 'self_delivery' as const },
    { item: '平台补贴', amount: sum('平台补贴'), key: 'platform_subsidy' as const },
    { item: '平台后返', amount: sum('平台后返'), key: 'rebate' as const },
  ]
    .filter((x) => x.amount > 0)
    .sort((a, b) => b.amount - a.amount)
  return wait({
    est_expense: sum('预计线上支出'),
    gmv,
    items: items.map((i) => ({
      ...i,
      rate: gmv ? i.amount / gmv : 0,
      color: COST_EXTRA[i.item] || '#8899AA',
    })),
  })
}

function reverseSnapshot(dateKey: string, cityName: string) {
  const rows = filterCities(dateKey, cityName)
  const ranks = filterStores(dateKey, cityName)
  const sumC = (k: string) => rows.reduce((a, r) => a + toNum(r[k]), 0)
  const paidOrders = ranks.reduce((a, r) => a + toNum(r['用户实付订单量']), 0)
  const refundOrders = ranks.reduce((a, r) => a + toNum(r['退款订单量']), 0)
  const ratios = rows.map((r) => toNum(r['售中售后退款比'])).filter((n) => n > 0)
  return {
    refund_rate: paidOrders ? refundOrders / paidOrders : 0,
    refund_amount: ranks.reduce((a, r) => a + toNum(r['退款金额']), 0),
    refund_orders: refundOrders,
    inafter_refund_ratio: ratios.length ? ratios.reduce((a, b) => a + b, 0) / ratios.length : 0,
    partial_refund_orders: sumC('部分退款订单量'),
    full_refund_orders: sumC('整单退款订单量'),
  }
}

export async function fetchReverse(dateKey: string, cityName = '全国', compareKey: string | null = null) {
  const cur = reverseSnapshot(dateKey, cityName)
  const prev = compareKey ? reverseSnapshot(compareKey, cityName) : null
  return wait({
    ...cur,
    refund_amount_diff: prev ? cur.refund_amount - prev.refund_amount : 0,
    refund_amount_diff_rate: prev && prev.refund_amount ? (cur.refund_amount - prev.refund_amount) / prev.refund_amount : 0,
    refund_rate_diff: prev ? (cur.refund_rate - prev.refund_rate) * 100 : 0,
    refund_orders_diff: prev ? cur.refund_orders - prev.refund_orders : 0,
    inafter_refund_ratio_diff: prev ? cur.inafter_refund_ratio - prev.inafter_refund_ratio : 0,
  })
}

function storeSheetRows(dateKey: string): Record<string, unknown>[] {
  return storeRows(dateKey) as Record<string, unknown>[]
}

function storeCityByName(dateKey: string) {
  const map: Record<string, string> = {}
  storeRows(dateKey).forEach((r) => {
    const city = String(r['城市名称'] || '')
    const full = String(r['门店名称'] || '')
    map[full] = city
    map[storeName(full)] = city
  })
  return map
}

/** 营销费用明细（数据源 · 经营分析-城市/门店），供成本板块浮窗 */
export async function fetchMarketingActivities(dateKey: string, cityName = '全国', limit = 12) {
  if (!dateKey) return wait([])

  if (!cityName || cityName === '全国') {
    const list = filterCities(dateKey, '全国')
      .map((r) => ({
        name: '城市营销合计',
        cost: toNum(r['营销活动费用']) + toNum(r['推广费用']),
        store: String(r['城市'] || ''),
        paid: toNum(r['有效订单金额（实付）']),
      }))
      .filter((a) => a.cost > 0)
      .sort((a, b) => b.cost - a.cost)
      .slice(0, limit)
    return wait(list)
  }

  const cityMap = storeCityByName(dateKey)
  const list = storeSheetRows(dateKey)
    .map((r) => {
      const store = storeName(String(r['门店名称'] || r['门店'] || ''))
      return {
        name: '门店营销合计',
        cost: toNum(r['营销活动费用']) + toNum(r['推广费用']),
        store,
        paid: toNum(r['用户实付营业额'] || r['预计线上收入']),
        city: cityMap[store] || cityMap[String(r['门店名称'] || '')] || String(r['城市名称'] || ''),
      }
    })
    .filter((a) => a.cost > 0 && matchCity(a.city, cityName))
    .sort((a, b) => b.cost - a.cost)
    .slice(0, limit)
    .map(({ city: _city, ...rest }) => rest)

  return wait(list)
}

export async function fetchHealth(dateKey: string, compareKey: string | null, cityName = '全国') {
  const ranks = filterStores(dateKey, cityName)
  const cities = filterCities(dateKey, cityName)
  const prevRanks = compareKey ? filterStores(compareKey, cityName) : []
  const prevCities = compareKey ? filterCities(compareKey, cityName) : []
  const sumR = (k: string) => ranks.reduce((a, r) => a + toNum(r[k]), 0)
  const sumC = (k: string) => cities.reduce((a, r) => a + toNum(r[k]), 0)
  const totalGmv = sumR('总营业额')
  const paidAmount = sumR('用户实付营业额')
  const paidOrders = sumR('用户实付订单量')
  const buyerCnt = sumR('交易用户数')
  const prevBuyerCnt = prevRanks.reduce((a, r) => a + toNum(r['交易用户数']), 0)
  const estProfit = sumR('预计毛利')
  const grossRate = paidAmount ? estProfit / paidAmount : 0
  const marketingCost = sumC('营销活动费用') + sumC('推广费用')
  const marketingRate = totalGmv ? marketingCost / totalGmv : 0
  const negRate = cities.length ? cities.reduce((a, r) => a + toNum(r['负毛利订单占比']), 0) / cities.length : 0
  const prevNegRate = prevCities.length
    ? prevCities.reduce((a, r) => a + toNum(r['负毛利订单占比']), 0) / prevCities.length
    : 0
  const abnormalStores = ranks
    .map((r) => ({
      name: storeName(r['门店名称']),
      profit_rate: toNum(r['毛利率']),
      paid_orders: toNum(r['用户实付订单量']),
      refund_orders: toNum(r['退款订单量']),
    }))
    .filter(isAbnormalStore)
  return wait({
    neg_rate: negRate,
    neg_rate_prev: prevNegRate,
    neg_rate_diff: negRate - prevNegRate,
    buyer_cnt: buyerCnt,
    buyer_cnt_prev: prevBuyerCnt,
    buyer_growth: prevBuyerCnt ? (buyerCnt - prevBuyerCnt) / prevBuyerCnt : 0,
    orders_per_buyer: buyerCnt ? paidOrders / buyerCnt : 0,
    marketing_rate: marketingRate,
    gross_rate: grossRate,
    net_rate: grossRate - marketingRate,
    abnormal_store_cnt: abnormalStores.length,
    abnormal_store_names: abnormalStores.map((s) => s.name),
    store_cnt: fetchCoverageStoreCnt(dateKey, cityName) || ranks.length,
  })
}

/** 超长门店名缩为约 6 字短名 */
function shortStoreLabel(name: string) {
  const n = storeName(name)
  if (n.length <= 6) return n
  return n.slice(0, 6)
}

export async function fetchProducts(dateKey: string, cityName = '全国') {
  const ranks = filterStores(dateKey, cityName)
  const rates = ranks.map((r) => toNum(r['商品动销率'])).filter((n) => n > 0)
  const sku_sales = ranks.reduce((a, r) => a + toNum(r['商品销量']), 0)
  const return_qty = ranks.reduce((a, r) => a + toNum(r['商品退货数量']), 0)
  const rows = [...ranks]
    .sort((a, b) => toNum(b['商品销量']) - toNum(a['商品销量']))
    .slice(0, 7)
    .map((r) => {
      const full = String(r['门店名称'] || '')
      const short = shortStoreLabel(full)
      const paidOrders = toNum(r['用户实付订单量'])
      const refundOrders = toNum(r['退款订单量'])
      return {
        name: short,
        fullName: full,
        city: String(r['城市名称'] || ''),
        code: String(r['门店code'] || ''),
        sku_sales: toNum(r['商品销量']),
        return_qty: toNum(r['商品退货数量']),
        return_rate: toNum(r['退货率']),
        paid_orders: paidOrders,
        refund_orders: refundOrders,
        profit_rate: toNum(r['毛利率']),
        abnormal: isAbnormalStore({
          profit_rate: toNum(r['毛利率']),
          paid_orders: paidOrders,
          refund_orders: refundOrders,
        }),
      }
    })
  return wait({
    sku_active_rate: rates.length ? rates.reduce((a, b) => a + b, 0) / rates.length : 0,
    sku_sales,
    return_qty,
    return_rate: sku_sales ? return_qty / sku_sales : 0,
    rows,
  })
}

export async function fetchCityRank(dateKey: string, metric = 'paid_amount') {
  const list = (await fetchGeo(dateKey)).map((c) => ({
    name: c.city,
    paid_amount: c.paid_amount,
    profit: c.est_profit,
    orders: c.paid_orders,
    orders_per_store_day: c.store_cnt ? c.paid_orders / c.store_cnt : 0,
    profit_rate: c.profit_rate,
    store_cnt: c.store_cnt,
  }))
  const key = metric as keyof (typeof list)[0]
  return wait([...list].sort((a, b) => Number(b[key]) - Number(a[key])))
}

export async function fetchStoreRank(dateKey: string, cityName = '全国', channel = '全部') {
  const rows =
    channel && channel !== '全部'
      ? filterChannelStores(dateKey, cityName, channel)
      : filterStores(dateKey, cityName)
  return wait(
    rows
      .map((r) => {
        const paid_amount = toNum(r['用户实付营业额'])
        const paid_orders = toNum(r['用户实付订单量'])
        const refund_orders = toNum(r['退款订单量'])
        const est_profit = toNum(r['预计毛利'])
        const total_gmv = toNum(r['总营业额'])
        return {
          name: storeName(r['门店名称']),
          fullName: String(r['门店名称'] || ''),
          city: String(r['城市名称'] || ''),
          code: String(r['门店code'] || ''),
          channel: String(r['渠道'] || r['渠道名称'] || channel || ''),
          paid_amount,
          total_gmv,
          profit_rate: toNum(r['毛利率']),
          paid_orders,
          buyer_cnt: toNum(r['交易用户数']),
          refund_orders,
          refund_amount: toNum(r['退款金额']),
          refund_rate: paid_orders ? refund_orders / paid_orders : 0,
          neg_profit_order_rate: toNum(r['负毛利订单占比']),
          avg_item_price: toNum(r['单均价']) || (paid_orders ? paid_amount / paid_orders : 0),
          active_sku_cnt: toNum(r['动销商品数']),
          self_delivery_cost: toNum(r['商家自配送费用']),
          sku_sales: toNum(r['商品销量']),
          return_qty: toNum(r['商品退货数量']),
          est_profit,
        }
      })
      .sort((a, b) => b.paid_amount - a.paid_amount),
  )
}

export async function fetchStoreSheet(dateKey: string, cityName = '全国', channel = '全部') {
  return fetchStoreRank(dateKey, cityName, channel)
}

/** 渠道结构：实付/毛利/订单按渠道汇总 */
export async function fetchChannelMix(dateKey: string, cityName = '全国') {
  const rows = filterChannelStores(dateKey, cityName, '全部')
  const map: Record<
    string,
    { channel: string; paid_amount: number; est_profit: number; paid_orders: number; total_gmv: number }
  > = {}
  rows.forEach((r) => {
    const channel = String(r['渠道'] || '未知')
    if (!map[channel]) {
      map[channel] = { channel, paid_amount: 0, est_profit: 0, paid_orders: 0, total_gmv: 0 }
    }
    map[channel].paid_amount += toNum(r['用户实付营业额'])
    map[channel].est_profit += toNum(r['预计毛利'])
    map[channel].paid_orders += toNum(r['用户实付订单量'])
    map[channel].total_gmv += toNum(r['总营业额'])
  })
  const list = Object.values(map)
    .map((x) => ({
      ...x,
      profit_rate: x.total_gmv ? x.est_profit / x.total_gmv : 0,
    }))
    .sort((a, b) => b.paid_amount - a.paid_amount)
  const paidTotal = list.reduce((a, b) => a + b.paid_amount, 0) || 1
  return wait(
    list.map((x) => ({
      ...x,
      paid_share: x.paid_amount / paidTotal,
    })),
  )
}

/** 利润质量：含后返 vs 不含后返 + 负毛利占比 */
export async function fetchProfitQuality(dateKey: string, cityName = '全国', channel = '全部') {
  const ov = await fetchOverview(dateKey, cityName, channel)
  if (!ov) return null
  const o = ov as unknown as Record<string, number>
  const profit = toNum(o.est_profit)
  const profitRaw = toNum(o.est_profit_raw)
  const rebate = toNum(o.rebate) || Math.max(0, profit - profitRaw)
  const gmv = toNum(o.total_gmv)
  return wait({
    est_profit: profit,
    est_profit_raw: profitRaw || profit - rebate,
    rebate,
    rebate_share: profit ? rebate / profit : 0,
    profit_rate: toNum(o.profit_rate),
    profit_rate_raw: toNum(o.profit_rate_raw) || (gmv ? (profitRaw || profit - rebate) / gmv : 0),
    neg_profit_order_rate: toNum(o.neg_profit_order_rate),
    marketing_rate: gmv ? toNum(o.marketing_cost) / gmv : 0,
    refund_rate: toNum(o.refund_rate),
  })
}

/** 日趋势：当前周内每日实付/毛利 */
export async function fetchDayTrend(dateKey: string, cityName = '全国', channel = '全部') {
  const meta = raw as unknown as {
    days?: string[]
    weeks?: { id: string; days: string[] }[]
    overview?: Record<string, Record<string, number>>
  }
  const weeks = meta.weeks || []
  let dayList: string[] = []
  if (dateKey.startsWith('W:')) {
    const id = dateKey.slice(2)
    dayList = weeks.find((w) => w.id === id)?.days || []
  } else {
    dayList = weeks.find((w) => w.days.includes(dateKey))?.days || (meta.days || []).slice(-7)
  }
  dayList = [...dayList].sort()

  const points = []
  for (const d of dayList) {
    const ov = await fetchOverview(d, cityName, channel)
    if (!ov) continue
    const o = ov as unknown as Record<string, number>
    points.push({
      date: d,
      label: d.slice(5).replace('-', '/'),
      paid_amount: toNum(o.paid_amount),
      est_profit: toNum(o.est_profit),
      paid_orders: toNum(o.effective_orders || o.paid_orders),
      profit_rate: toNum(o.profit_rate),
    })
  }
  return wait(points)
}

/** 门店经营画像（地图/榜单击） */
export async function fetchStoreProfile(dateKey: string, storeNameOrShort: string) {
  const short = storeName(storeNameOrShort)
  const row =
    storeRows(dateKey).find(
      (r) => storeName(r['门店名称']) === short || String(r['门店名称']) === storeNameOrShort,
    ) || null
  const chRows = channelRows(dateKey).filter(
    (r) => storeName(r['门店名称']) === short || String(r['门店名称']) === storeNameOrShort,
  )
  const channels = chRows
    .map((r) => ({
      channel: String(r['渠道'] || ''),
      paid_amount: toNum(r['用户实付营业额']),
      est_profit: toNum(r['预计毛利']),
      paid_orders: toNum(r['用户实付订单量']),
      profit_rate: toNum(r['毛利率']),
      refund_amount: toNum(r['退款金额']),
    }))
    .sort((a, b) => b.paid_amount - a.paid_amount)

  if (!row && !channels.length) return null

  const paid = row ? toNum(row['用户实付营业额']) : channels.reduce((a, c) => a + c.paid_amount, 0)
  const orders = row ? toNum(row['用户实付订单量']) : channels.reduce((a, c) => a + c.paid_orders, 0)
  const profit = row ? toNum(row['预计毛利']) : channels.reduce((a, c) => a + c.est_profit, 0)
  const gmv = row ? toNum(row['总营业额']) : 0
  const rebate = row ? toNum(row['平台后返']) : 0
  const profitRaw = row ? toNum(row['预计毛利_不含后返']) : Math.max(0, profit - rebate)

  return wait({
    name: storeName(row?.['门店名称'] || storeNameOrShort),
    fullName: String(row?.['门店名称'] || storeNameOrShort),
    city: String(row?.['城市名称'] || chRows[0]?.['城市名称'] || ''),
    paid_amount: paid,
    total_gmv: gmv,
    paid_orders: orders,
    buyer_cnt: row ? toNum(row['交易用户数']) : 0,
    arpu: orders ? paid / orders : 0,
    est_profit: profit,
    est_profit_raw: profitRaw,
    rebate,
    rebate_share: profit ? rebate / Math.abs(profit) : 0,
    profit_rate: row ? toNum(row['毛利率']) : gmv ? profit / gmv : 0,
    neg_profit_order_rate: row ? toNum(row['负毛利订单占比']) : 0,
    marketing_cost: row ? toNum(row['营销活动费用']) : 0,
    refund_orders: row ? toNum(row['退款订单量']) : 0,
    refund_amount: row ? toNum(row['退款金额']) : 0,
    refund_rate: orders ? toNum(row?.['退款订单量']) / orders : 0,
    self_delivery_cost: row ? toNum(row['商家自配送费用']) : 0,
    channels,
  })
}

export type AssessmentRow = {
  name: string
  shortName: string
  code?: string
  city: string
  sellout_rate: number
  pick_error_rate: number
  warehouse_t: number
  im_reply_rate: number
  merchant_issue_rate: number
  shop_score?: number
}

/** 日 → 所在周 id；周键 W:xxx → 直接取周 */
export function resolveAssessmentWeekId(dateKey: string): string | null {
  if (!dateKey) return null
  if (dateKey.startsWith('W:')) {
    const id = dateKey.slice(2)
    return data.assessment?.[id] ? id : null
  }
  if (data.assessment?.[dateKey]) return dateKey
  const weeks = data.weeks || []
  const hit = weeks.find((w) => w.id === dateKey || w.days?.includes(dateKey))
  if (hit && data.assessment?.[hit.id]) return hit.id
  return null
}

function cityByStoreShort(dateKey: string): Record<string, string> {
  const map: Record<string, string> = {}
  // 优先当日门店信息；无则扫全部日
  const days = data.days?.length ? data.days : Object.keys(data.storeList || {})
  const prefer = storeListRows(dateKey)
  const rows = prefer.length ? prefer : days.flatMap((d) => storeListRows(d))
  rows.forEach((r) => {
    if (r.shortName) map[r.shortName] = r.city
    if (r.name) map[r.name] = r.city
  })
  return map
}

export function hasAssessment(dateKey: string) {
  return !!resolveAssessmentWeekId(dateKey)
}

export async function fetchAssessmentStores(
  dateKey: string,
  cityName = '全国',
  storeShort = '全部',
): Promise<AssessmentRow[]> {
  const weekId = resolveAssessmentWeekId(dateKey)
  if (!weekId) return wait([])
  const cityMap = cityByStoreShort(dateKey.startsWith('W:') ? dateKey.slice(2).split('_')[1] || '' : dateKey)
  let rows: AssessmentRow[] = (data.assessment?.[weekId] || []).map((r) => ({
    ...r,
    city: cityMap[r.shortName] || cityMap[r.name] || '',
  }))
  if (cityName && cityName !== '全国' && cityName !== '全部') {
    rows = rows.filter((r) => matchCity(r.city, cityName))
  }
  if (storeShort && storeShort !== '全部') {
    rows = rows.filter((r) => r.shortName === storeShort || r.name === storeShort || r.code === storeShort)
  }
  return wait(rows)
}

export async function fetchAssessmentCityOptions(dateKey: string) {
  const rows = await fetchAssessmentStores(dateKey)
  const cities = [...new Set(rows.map((r) => r.city).filter(Boolean))].sort()
  return ['全部', ...cities]
}

export async function fetchAssessmentStoreOptions(dateKey: string, cityName = '全部') {
  const rows = await fetchAssessmentStores(dateKey, cityName === '全部' ? '全国' : cityName)
  return rows
    .map((r) => ({ id: r.shortName || r.name, shortName: r.shortName || r.name, name: r.name, city: r.city }))
    .sort((a, b) => a.shortName.localeCompare(b.shortName, 'zh'))
}

function aggregateCategoryRows(rows: CategoryRow[]): CategoryRow[] {
  const map = new Map<string, CategoryRow>()
  rows.forEach((r) => {
    const cur = map.get(r.name)
    if (!cur) {
      map.set(r.name, { ...r })
      return
    }
    cur.total_gmv += r.total_gmv
    cur.sales += r.sales
    cur.income += r.income
    cur.orders += r.orders
    cur.qty += r.qty
    cur.profit += r.profit
    cur.refund_amount += r.refund_amount
    cur.refund_orders += r.refund_orders
    cur.sku_online = (cur.sku_online || 0) + (r.sku_online || 0)
    cur.sku_active = (cur.sku_active || 0) + (r.sku_active || 0)
  })
  return [...map.values()]
    .map((r) => ({
      ...r,
      aov: r.orders ? r.sales / r.orders : 0,
      profit_rate: r.sales ? r.profit / r.sales : 0,
      active_rate: r.sku_online ? (r.sku_active || 0) / r.sku_online : r.active_rate,
    }))
    .sort((a, b) => b.total_gmv - a.total_gmv)
}

export async function fetchCategoryMix(dateKey: string, cityName = '全国', storeShort = '全部') {
  const block = data.category
  if (!block) return wait({ period: null as null | { label?: string; start?: string; end?: string }, rows: [] as CategoryRow[] })

  const cityMap = cityByStoreShort(
    dateKey.startsWith('W:') ? dateKey.slice(2).split('_')[1] || '' : dateKey,
  )
  let rows: CategoryRow[] = []

  const needFilter =
    (storeShort && storeShort !== '全部') || (cityName && cityName !== '全国' && cityName !== '全部')

  if (needFilter && block.byStore?.length) {
    let storeRows = block.byStore
    if (storeShort && storeShort !== '全部') {
      storeRows = storeRows.filter(
        (r) => r.shortName === storeShort || storeName(r.store) === storeShort || r.store === storeShort,
      )
    } else if (cityName && cityName !== '全国' && cityName !== '全部') {
      storeRows = storeRows.filter((r) => {
        const city = cityMap[r.shortName || ''] || cityMap[storeName(r.store || '')] || ''
        return matchCity(city, cityName)
      })
    }
    rows = aggregateCategoryRows(storeRows)
  } else {
    rows = [...(block.overall || [])]
  }

  const total = rows.reduce((a, r) => a + r.total_gmv, 0) || 1
  rows = rows.map((r) => ({ ...r, share: r.total_gmv / total }))

  return wait({
    period: block.period || null,
    rows,
  })
}
