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

/** 与门店清单/排行对齐的门店短名 */
function normStoreName(name) {
  return String(name || '')
    .replace(/淘宝便利店[（(]/g, '')
    .replace(/优沃森超市[（(]/g, '')
    .replace(/[）)]/g, '')
    .replace(/\s+/g, '')
    .trim()
}

function normCity(city) {
  const c = String(city || '').trim()
  return c.endsWith('市') ? c : `${c}市`
}

function dedupeRankRows(rows) {
  const seen = new Set()
  const out = []
  for (const r of rows) {
    const key = normStoreName(r['门店名称'])
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push(r)
  }
  return out
}

function filterRankByAllowlist(rows, allowNames) {
  if (!allowNames.size) return rows
  return rows.filter((r) => allowNames.has(normStoreName(r['门店名称'])))
}

const sourceRoot = path.join(root, '数据源')
const dates = fs
  .readdirSync(sourceRoot)
  .filter((name) => fs.statSync(path.join(sourceRoot, name)).isDirectory())
  .sort()
const result = { cities: {}, stores: {}, storeTrend: {}, storeRank: {}, storeList: {} }

for (const d of dates) {
  const dir = path.join(root, '数据源', d)
  const files = fs.readdirSync(dir)
  const find = (kw) => files.find((f) => f.includes(kw) && f.endsWith('.xlsx'))
  const cityFile = find('经营分析-城市')
  const storeFile = files.find((f) => f.includes('经营分析-门店') && !f.includes('周期'))
  const trendFile = find('周期趋势')
  const rankFile = find('门店排行')
  const listFile = files.find((f) => f.includes('门店清单'))
  result.cities[d] = readSheet(path.join(dir, cityFile), 'data').filter(
    (r) => r['城市'] && Number(r['总营业额'] || r['预计线上收入'] || 0) > 0,
  )
  result.stores[d] = readSheet(path.join(dir, storeFile), 'data').filter(
    (r) => r['门店'] && Number(r['预计线上收入'] || 0) > 0,
  )
  result.storeTrend[d] = readSheet(path.join(dir, trendFile), 'data')

  const allowNames = new Set()
  if (listFile) {
    const listRows = readSheet(path.join(dir, listFile))
    result.storeList[d] = listRows
      .filter((r) => r['门店名称'] || r['门店'])
      .map((r) => ({
        city: normCity(r['城市'] || r['城市名称'] || ''),
        name: String(r['门店名称'] || r['门店'] || ''),
        shortName: normStoreName(r['门店名称'] || r['门店']),
      }))
    result.storeList[d].forEach((r) => {
      if (r.shortName) allowNames.add(r.shortName)
    })
  } else {
    result.stores[d].forEach((r) => {
      const n = normStoreName(r['门店'])
      if (n) allowNames.add(n)
    })
    result.storeList[d] = result.stores[d].map((r) => ({
      city: normCity(r['城市'] || r['城市名称'] || ''),
      name: String(r['门店'] || ''),
      shortName: normStoreName(r['门店']),
    }))
  }

  let rankRows = readSheet(path.join(dir, rankFile), '门店排行')
  rankRows = filterRankByAllowlist(dedupeRankRows(rankRows), allowNames)
  result.storeRank[d] = rankRows
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
  武汉市: [114.31, 30.52],
  南通市: [120.86, 32.01],
  淮安市: [119.02, 33.61],
  济南市: [117.0, 36.65],
}

function buildGeo(rankRows, listRows = []) {
  const coverByCity = {}
  listRows.forEach((r) => {
    const city = normCity(r.city || r['城市'] || r['城市名称'] || '')
    if (!city) return
    coverByCity[city] = (coverByCity[city] || 0) + 1
  })

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

  if (listRows.length) {
    Object.keys(coverByCity).forEach((city) => {
      if (!map[city]) {
        map[city] = {
          city,
          city_code: '',
          paid_amount: 0,
          est_profit: 0,
          paid_orders: 0,
          store_cnt: coverByCity[city],
        }
      } else {
        map[city].store_cnt = coverByCity[city]
      }
    })
  }

  return Object.values(map).map((c) => ({
    ...c,
    profit_rate: c.paid_amount ? c.est_profit / c.paid_amount : 0,
    lng: (cityCoords[c.city] || [116.4, 39.9])[0],
    lat: (cityCoords[c.city] || [116.4, 39.9])[1],
  }))
}

const geo = {}
for (const d of dates) geo[d] = buildGeo(result.storeRank[d], result.storeList[d] || [])

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

const payload = {
  primaryDate: dates[dates.length - 1] || '',
  compareDate: dates.length > 1 ? dates[dates.length - 2] || '' : '',
  overview,
  cities: result.cities,
  stores: result.stores,
  storeRank: result.storeRank,
  storeList: result.storeList,
  geo,
  costs,
  reverse: reverseData,
  updated_at: new Date().toISOString().slice(0, 19).replace('T', ' '),
}

const out = path.join(root, 'web', 'src', 'data', 'dashboard.json')
fs.writeFileSync(out, JSON.stringify(payload))
console.log('synced ->', out)
