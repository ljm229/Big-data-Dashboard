/**
 * 从 数据源/*.xlsx 重新生成 web/src/data/dashboard.json
 * 用法：在项目根目录 node scripts/sync-excel.mjs
 */
import XLSX from 'xlsx'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')

function readSheet(file, sheetName) {
  const wb = XLSX.readFile(file)
  const name = sheetName || wb.SheetNames[0]
  return XLSX.utils.sheet_to_json(wb.Sheets[name], { defval: null })
}

const sourceRoot = path.join(root, '数据源')
const dates = fs
  .readdirSync(sourceRoot)
  .filter((name) => fs.statSync(path.join(sourceRoot, name)).isDirectory())
  .sort()
const result = { cities: {}, stores: {}, storeTrend: {}, storeRank: {} }

for (const d of dates) {
  const dir = path.join(root, '数据源', d)
  const files = fs.readdirSync(dir)
  const find = (kw) => files.find((f) => f.includes(kw) && f.endsWith('.xlsx'))
  const cityFile = find('经营分析-城市')
  const storeFile = files.find((f) => f.includes('经营分析-门店') && !f.includes('周期'))
  const trendFile = find('周期趋势')
  const rankFile = find('门店排行')
  result.cities[d] = readSheet(path.join(dir, cityFile), 'data').filter(
    (r) => r['城市'] && Number(r['总营业额'] || r['预计线上收入'] || 0) > 0,
  )
  result.stores[d] = readSheet(path.join(dir, storeFile), 'data').filter(
    (r) => r['门店'] && Number(r['预计线上收入'] || 0) > 0,
  )
  result.storeTrend[d] = readSheet(path.join(dir, trendFile), 'data')
  result.storeRank[d] = readSheet(path.join(dir, rankFile), '门店排行')
}

function aggregate(rankRows) {
  const sum = (k) => rankRows.reduce((a, r) => a + Number(r[k] || 0), 0)
  const total_gmv = sum('总营业额')
  const discount_amount = sum('总优惠金额')
  const paid_amount = sum('用户实付营业额')
  const paid_orders = sum('用户实付订单量')
  const buyer_cnt = sum('交易用户数')
  const est_profit = sum('预计毛利')
  const est_expense = sum('预计线上支出')
  const purchase_cost = sum('采购成本')
  const self_delivery_cost = sum('商家自配送费用')
  const active_sku_cnt = sum('动销商品数')
  const sku_sales = sum('商品销量')
  const return_qty = sum('商品退货数量')
  const refund_orders = sum('退款订单量')
  const refund_amount = sum('退款金额')
  const store_cnt = rankRows.length
  const active_store_cnt = rankRows.filter((r) => Number(r['用户实付订单量'] || 0) > 0).length
  let sku_cnt = 0
  rankRows.forEach((r) => {
    const rate = Number(r['商品动销率'] || 0)
    const active = Number(r['动销商品数'] || 0)
    if (rate > 0) sku_cnt += active / rate
  })
  sku_cnt = Math.round(sku_cnt)
  return {
    total_gmv,
    discount_amount,
    discount_rate: total_gmv ? discount_amount / total_gmv : 0,
    paid_amount,
    paid_orders,
    buyer_cnt,
    arpu: buyer_cnt ? paid_amount / buyer_cnt : 0,
    avg_item_price: sku_sales ? paid_amount / sku_sales : 0,
    orders_per_store_day: active_store_cnt ? paid_orders / active_store_cnt : 0,
    est_profit,
    profit_rate: paid_amount ? est_profit / paid_amount : 0,
    est_expense,
    purchase_cost,
    self_delivery_cost,
    sku_cnt,
    active_sku_cnt,
    sku_active_rate: sku_cnt ? active_sku_cnt / sku_cnt : 0,
    sku_sales,
    return_qty,
    return_rate: sku_sales ? return_qty / sku_sales : 0,
    store_cnt,
    active_store_cnt,
    store_active_rate: store_cnt ? active_store_cnt / store_cnt : 0,
    refund_orders,
    refund_amount,
    refund_rate: paid_orders ? refund_orders / paid_orders : 0,
  }
}

const overview = {}
for (const d of dates) overview[d] = aggregate(result.storeRank[d])

const cityCoords = {
  杭州市: [120.15, 30.28],
  金华市: [119.65, 29.08],
  苏州市: [120.62, 31.32],
  上海市: [121.47, 31.23],
  南京市: [118.78, 32.07],
  宁波市: [121.55, 29.88],
  无锡市: [120.31, 31.59],
  嘉兴市: [120.76, 30.77],
  湖州市: [120.1, 30.86],
  绍兴市: [120.58, 30.0],
  台州市: [121.43, 28.68],
  温州市: [120.7, 28.0],
  常州市: [119.97, 31.81],
  扬州市: [119.42, 32.39],
  郑州市: [113.65, 34.76],
}

function buildGeo(rankRows) {
  const map = {}
  rankRows.forEach((r) => {
    const city = r['城市名称']
    if (!map[city])
      map[city] = {
        city,
        city_code: r['城市code'],
        paid_amount: 0,
        est_profit: 0,
        paid_orders: 0,
        store_cnt: 0,
      }
    map[city].paid_amount += Number(r['用户实付营业额'] || 0)
    map[city].est_profit += Number(r['预计毛利'] || 0)
    map[city].paid_orders += Number(r['用户实付订单量'] || 0)
    map[city].store_cnt += 1
  })
  return Object.values(map).map((c) => ({
    ...c,
    profit_rate: c.paid_amount ? c.est_profit / c.paid_amount : 0,
    lng: (cityCoords[c.city] || [116.4, 39.9])[0],
    lat: (cityCoords[c.city] || [116.4, 39.9])[1],
  }))
}

const geo = {}
for (const d of dates) geo[d] = buildGeo(result.storeRank[d])

function costStructure(cities) {
  const sum = (k) => cities.reduce((a, r) => a + Number(r[k] || 0), 0)
  const items = [
    { item: '采购成本', amount: sum('商品成本') },
    { item: '总优惠金额', amount: Math.max(0, sum('总营业额') - sum('有效订单金额（实付）')) },
    { item: '平台配送服务费', amount: sum('平台配送服务费') },
    { item: '商家自配送费用', amount: sum('自配送费用') },
    { item: '佣金&其他平台费用', amount: sum('佣金&其他平台费用') },
    { item: '营销活动费用', amount: sum('营销活动费用') },
    { item: '推广费用', amount: sum('推广费用') },
    { item: '平台补贴', amount: sum('平台补贴') },
  ]
    .filter((x) => x.amount > 0)
    .sort((a, b) => b.amount - a.amount)
  const total = items.reduce((a, b) => a + b.amount, 0) || 1
  return { est_expense: sum('预计线上支出'), items: items.map((i) => ({ ...i, rate: i.amount / total })) }
}

const costs = {}
for (const d of dates) costs[d] = costStructure(result.cities[d])

function reverse(cities, ov) {
  const sum = (k) => cities.reduce((a, r) => a + Number(r[k] || 0), 0)
  const avg = (k) => {
    const vals = cities.map((r) => Number(r[k])).filter((v) => !Number.isNaN(v))
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0
  }
  return {
    refund_rate: ov.refund_rate || avg('退款率'),
    refund_amount: ov.refund_amount || sum('退款金额'),
    refund_orders: ov.refund_orders || sum('退款订单量'),
    inafter_refund_ratio: avg('售中售后退款比'),
    partial_refund_orders: sum('部分退款订单量'),
    full_refund_orders: sum('整单退款订单量'),
  }
}

const reverseData = {}
for (const d of dates) reverseData[d] = reverse(result.cities[d], overview[d])

function makeTrend(ov, compareOv) {
  const weights = [0.01, 0.005, 0.005, 0.005, 0.01, 0.02, 0.04, 0.05, 0.06, 0.07, 0.08, 0.09, 0.08, 0.07, 0.06, 0.06, 0.07, 0.08, 0.09, 0.07, 0.05, 0.04, 0.03, 0.02]
  const s = weights.reduce((a, b) => a + b, 0)
  const w = weights.map((x) => x / s)
  return Array.from({ length: 24 }, (_, i) => ({
    label: String(i).padStart(2, '0') + ':00',
    paid_orders: Math.round(ov.paid_orders * w[i]),
    paid_amount: Math.round(ov.paid_amount * w[i] * 100) / 100,
    compare_orders: compareOv ? Math.round(compareOv.paid_orders * w[i] * (0.9 + Math.random() * 0.2)) : 0,
    compare_amount: compareOv ? Math.round(compareOv.paid_amount * w[i] * (0.9 + Math.random() * 0.2) * 100) / 100 : 0,
  }))
}

const trend = {}
for (let i = 0; i < dates.length; i++) {
  const d = dates[i]
  const compare = i > 0 ? dates[i - 1] : null
  trend[d] = makeTrend(overview[d], compare ? overview[compare] : null)
}

function cumulative(trendArr) {
  let a = 0
  let b = 0
  return trendArr.map((t) => {
    a += t.paid_amount
    b += t.compare_amount || 0
    return { label: t.label, today: Math.round(a * 100) / 100, yesterday: Math.round(b * 100) / 100 }
  })
}

const marketTrend = {}
for (const d of dates) marketTrend[d] = cumulative(trend[d])

function productRank(rankRows) {
  const sorted = [...rankRows].sort((a, b) => Number(b['商品销量'] || 0) - Number(a['商品销量'] || 0)).slice(0, 5)
  const byReturn = [...rankRows].sort((a, b) => Number(b['退货率'] || 0) - Number(a['退货率'] || 0)).slice(0, 5)
  const clean = (n) => String(n).replace('淘宝便利店（', '').replace('）', '')
  return {
    sales: sorted.map((r) => ({ name: clean(r['门店名称']), value: Number(r['商品销量'] || 0) })),
    return_rate: byReturn.map((r) => ({ name: clean(r['门店名称']), value: Number(r['退货率'] || 0) })),
  }
}

const products = {}
for (const d of dates) products[d] = productRank(result.storeRank[d])

function mockOrders(rankRows) {
  const statuses = ['已支付', '已支付', '已支付', '已退款', '已取消']
  const items = ['饮料组合', '方便速食', '日用百货', '鲜食套餐', '零食礼包']
  return Array.from({ length: 40 }, (_, i) => {
    const r = rankRows[i % rankRows.length]
    return {
      ts: `${String(8 + Math.floor(i / 3)).padStart(2, '0')}:${String((i * 7) % 60).padStart(2, '0')}:${String((i * 13) % 60).padStart(2, '0')}`,
      order_no: `ASDA${5400 + i}****${10 + (i % 90)}`,
      city: r['城市名称'],
      store: String(r['门店名称']).replace('淘宝便利店（', '').replace('）', ''),
      item: items[i % 5],
      amount: Math.round((20 + Math.random() * 80) * 100) / 100,
      status: statuses[i % 5],
    }
  })
}

const orders = {}
for (const d of dates) orders[d] = mockOrders(result.storeRank[d])

function profitSeries(cities) {
  const labels = Array.from({ length: 12 }, (_, i) => String(i * 2).padStart(2, '0') + ':00')
  const baseProfit = cities.reduce((a, r) => a + Number(r['毛利率'] || 0), 0) / Math.max(cities.length, 1)
  const neg = cities.reduce((a, r) => a + Number(r['负毛利订单占比'] || 0), 0) / Math.max(cities.length, 1)
  return labels.map((label, i) => ({
    label,
    profit_rate: Math.max(0, baseProfit + Math.sin(i / 2) * 0.03 - i * 0.002),
    discount_rate: Math.min(0.6, 0.35 + Math.cos(i / 3) * 0.02 + i * 0.002),
    neg_profit_order_rate: Math.max(0, neg + Math.sin(i) * 0.01),
  }))
}

const profit = {}
for (const d of dates) {
  const cities = result.cities[d]
  profit[d] = {
    series: profitSeries(cities),
    profit_per_order: cities.reduce((a, r) => a + Number(r['单均毛利'] || 0), 0) / Math.max(cities.length, 1),
    per_store: cities.reduce((a, r) => a + Number(r['店日均毛利'] || 0), 0) / Math.max(cities.length, 1),
    neg_profit_order_rate: cities.reduce((a, r) => a + Number(r['负毛利订单占比'] || 0), 0) / Math.max(cities.length, 1),
  }
}

const payload = {
  primaryDate: dates[dates.length - 1] || '',
  compareDate: dates.length > 1 ? dates[dates.length - 2] || '' : '',
  overview,
  cities: result.cities,
  stores: result.stores,
  storeRank: result.storeRank,
  geo,
  costs,
  reverse: reverseData,
  trend,
  marketTrend,
  products,
  orders,
  profit,
  updated_at: '2026-08-28 18:00:00',
}

const out = path.join(root, 'web', 'src', 'data', 'dashboard.json')
fs.writeFileSync(out, JSON.stringify(payload))
console.log('synced ->', out)
