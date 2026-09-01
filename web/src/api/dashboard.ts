/**
 * 只从 Excel 转换后的 JSON 取值，不做分时/订单流等推演。
 * 源文件：数据源/8.21、8.28 下「门店排行」「经营分析-城市/门店」「门店清单」
 */
import raw from '../data/dashboard.json'
import { isAbnormalStore } from '../utils/health'

const CITY_COORDS: Record<string, [number, number]> = {
  杭州市: [120.15, 30.28],
  苏州市: [120.62, 31.32],
  上海市: [121.47, 31.23],
  金华市: [119.65, 29.08],
  无锡市: [120.31, 31.59],
  武汉市: [114.31, 30.52],
  南通市: [120.86, 32.01],
  淮安市: [119.02, 33.61],
  济南市: [117.0, 36.65],
  郑州市: [113.65, 34.76],
}

type StoreListRow = { city: string; name: string; shortName: string }

function storeListRows(dateKey: string): StoreListRow[] {
  return ((raw as { storeList?: Record<string, StoreListRow[]> }).storeList?.[dateKey] ||
    []) as StoreListRow[]
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
  return ((raw.storeRank as Record<string, StoreRow[]>)[dateKey] || []) as StoreRow[]
}

function cityRows(dateKey: string): CityRow[] {
  return ((raw.cities as Record<string, CityRow[]>)[dateKey] || []).filter((r) => r['城市']) as CityRow[]
}

function filterStores(dateKey: string, cityName: string) {
  return storeRows(dateKey).filter((r) => matchCity(String(r['城市名称'] || ''), cityName))
}

function filterCities(dateKey: string, cityName: string) {
  const all = cityRows(dateKey)
  if (!cityName || cityName === '全国') return all
  return all.filter((r) => matchCity(String(r['城市'] || ''), cityName))
}

function wait<T>(data: T): Promise<T> {
  return Promise.resolve(structuredClone(data))
}

export function availableDates() {
  return Object.keys(raw.storeRank || {}).map((k) => {
    const [m, d] = k.split('.')
    return `2026-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
  })
}

export async function fetchOverview(dateKey: string, cityName = '全国') {
  if (!dateKey) return null
  const ranks = filterStores(dateKey, cityName)
  if (!ranks.length) return null
  const cityAgg = filterCities(dateKey, cityName)
  const sum = (k: string) => ranks.reduce((a, r) => a + toNum(r[k]), 0)
  const citySum = (k: string) => cityAgg.reduce((a, r) => a + toNum(r[k]), 0)
  const total_gmv = sum('总营业额')
  const discount_amount = sum('总优惠金额')
  const paid_amount = sum('用户实付营业额')
  const paid_orders = sum('用户实付订单量')
  const effective_orders = citySum('有效订单量') || paid_orders
  const buyer_cnt = sum('交易用户数')
  const est_profit = sum('预计毛利')
  const online_income = sum('预计线上收入') || citySum('预计线上收入')
  const profit_rate =
    ranks.length === 1
      ? toNum(ranks[0]['毛利率'])
      : cityAgg.length === 1
        ? toNum(cityAgg[0]['毛利率'])
        : paid_amount
          ? est_profit / paid_amount
          : 0
  return {
    total_gmv,
    discount_amount,
    discount_rate: total_gmv ? discount_amount / total_gmv : 0,
    paid_amount,
    paid_orders,
    effective_orders,
    buyer_cnt,
    arpu: buyer_cnt ? paid_amount / buyer_cnt : 0,
    avg_item_price: sum('商品销量') ? paid_amount / sum('商品销量') : 0,
    orders_per_store_day: ranks.length ? effective_orders / ranks.length : 0,
    est_profit,
    profit_rate,
    online_income,
    est_expense: sum('预计线上支出'),
    purchase_cost: sum('采购成本'),
    self_delivery_cost: sum('商家自配送费用'),
    active_sku_cnt: sum('动销商品数'),
    sku_sales: sum('商品销量'),
    return_qty: sum('商品退货数量'),
    return_rate: sum('商品销量') ? sum('商品退货数量') / sum('商品销量') : 0,
    store_cnt: fetchCoverageStoreCnt(dateKey, cityName) || ranks.length,
    active_store_cnt: ranks.filter((r) => toNum(r['用户实付订单量']) > 0).length,
    refund_orders: sum('退款订单量'),
    refund_amount: sum('退款金额'),
    refund_rate: effective_orders ? sum('退款订单量') / effective_orders : 0,
    updated_at: String((raw as { updated_at?: string }).updated_at || ''),
  }
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
    map[city].est_profit += toNum(r['预计毛利'])
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
    Object.values(map).map((c) => ({
      ...c,
      profit_rate: c.paid_amount ? c.est_profit / c.paid_amount : 0,
      lng: (CITY_COORDS[c.city] || [120.15, 30.28])[0],
      lat: (CITY_COORDS[c.city] || [120.15, 30.28])[1],
    })),
  )
}

export async function fetchCityOptions(dateKey: string) {
  const geo = await fetchGeo(dateKey)
  return [{ id: 'all', name: '全国' }, ...geo.map((c) => ({ id: String(c.city_code), name: c.city }))]
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
export async function fetchCost(dateKey: string, cityName = '全国') {
  const rows = filterCities(dateKey, cityName)
  const sum = (k: string) => rows.reduce((a, r) => a + toNum(r[k]), 0)
  const gmv = sum('总营业额')
  const discount = Math.max(0, gmv - sum('有效订单金额（实付）'))
  const items = [
    { item: '采购成本', amount: sum('商品成本'), key: 'purchase' as const },
    { item: '总优惠金额', amount: discount, key: 'discount' as const },
    { item: '营销活动费用', amount: sum('营销活动费用') + sum('推广费用'), key: 'marketing' as const },
    { item: '平台配送服务费', amount: sum('平台配送服务费'), key: 'platform_delivery' as const },
    { item: '佣金及其他平台费', amount: sum('佣金&其他平台费用'), key: 'commission' as const },
    { item: '商家自配送费用', amount: sum('自配送费用'), key: 'self_delivery' as const },
  ]
    .filter((x) => x.amount > 0)
    .sort((a, b) => b.amount - a.amount)
  return wait({
    est_expense: sum('预计线上支出'),
    gmv,
    items: items.map((i) => ({
      ...i,
      rate: gmv ? i.amount / gmv : 0,
      color: COST_COLORS[i.item] || '#8899AA',
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
  return ((raw as { stores?: Record<string, Record<string, unknown>[]> }).stores?.[dateKey] ||
    []) as Record<string, unknown>[]
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
      const store = storeName(String(r['门店'] || ''))
      return {
        name: '门店营销合计',
        cost: toNum(r['营销活动费用']) + toNum(r['推广费用']),
        store,
        paid: toNum(r['预计线上收入']),
        city: cityMap[store] || cityMap[String(r['门店'] || '')] || '',
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

export async function fetchStoreRank(dateKey: string, cityName = '全国') {
  return wait(
    filterStores(dateKey, cityName)
      .map((r) => ({
        name: storeName(r['门店名称']),
        fullName: String(r['门店名称'] || ''),
        city: String(r['城市名称'] || ''),
        code: String(r['门店code'] || ''),
        paid_amount: toNum(r['用户实付营业额']),
        profit_rate: toNum(r['毛利率']),
        paid_orders: toNum(r['用户实付订单量']),
        refund_orders: toNum(r['退款订单量']),
        avg_item_price: toNum(r['单均价']),
        active_sku_cnt: toNum(r['动销商品数']),
        refund_amount: toNum(r['退款金额']),
        self_delivery_cost: toNum(r['商家自配送费用']),
        sku_sales: toNum(r['商品销量']),
        return_qty: toNum(r['商品退货数量']),
      }))
      .sort((a, b) => b.paid_amount - a.paid_amount),
  )
}

export async function fetchStoreSheet(dateKey: string, cityName = '全国') {
  return fetchStoreRank(dateKey, cityName)
}
