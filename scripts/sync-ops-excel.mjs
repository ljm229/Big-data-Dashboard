/**
 * 从 数据源2/*.xlsx 聚合生成 web/src/data/opsDashboard.json
 * 用法：node scripts/sync-ops-excel.mjs
 *
 * 文件对应关系（按文件名关键字 + 字段特征识别）：
 * - 聚合下载 + 总成交额 → 经营财务
 * - 聚合下载 + 总曝光人数 → 流量转化
 * - 聚合下载 + 及时送达率 → 履约服务
 * - 活动分析 → 营销活动
 * - 商品分析 → 商品/缺货（仅落聚合，不落明细）
 * - 订单分析-逆向单 → 逆向原因/品类
 */
import XLSX from 'xlsx'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const sourceRoot = path.join(root, '数据源2')

function toNum(v) {
  if (v == null || v === '') return 0
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0
  const s = String(v).trim().replace(/,/g, '')
  if (!s) return 0
  if (s.endsWith('%')) return parseFloat(s) / 100 || 0
  const n = Number(s)
  return Number.isFinite(n) ? n : 0
}

function shortName(name) {
  return String(name || '')
    .replace(/^优沃森超市\(/, '')
    .replace(/\)$/, '')
    .replace(/^淘宝便利店（/, '')
    .replace(/）$/, '')
}

function readData(file) {
  const wb = XLSX.readFile(file)
  return XLSX.utils.sheet_to_json(wb.Sheets.data || wb.Sheets[wb.SheetNames[0]], { defval: null })
}

function readMetaDate(file) {
  try {
    const wb = XLSX.readFile(file, { sheetRows: 10 })
    const meta = XLSX.utils.sheet_to_json(wb.Sheets.meta, { defval: null })
    const row = meta.find((r) => r['文件名'] === '日期')
    if (!row) return ''
    const key = Object.keys(row).find((k) => k !== '文件名')
    return String(row[key] || '')
  } catch {
    return ''
  }
}

const files = fs.readdirSync(sourceRoot).filter((f) => f.endsWith('.xlsx') && !f.startsWith('~$'))
const find = (kw) => files.find((f) => f.includes(kw))

const financeFile = files
  .filter((f) => f.includes('聚合下载'))
  .map((f) => ({ f, rows: readData(path.join(sourceRoot, f)) }))
  .find((x) => x.rows[0] && '总成交额（元）' in x.rows[0])
const trafficFile = files
  .filter((f) => f.includes('聚合下载'))
  .map((f) => ({ f, rows: readData(path.join(sourceRoot, f)) }))
  .find((x) => x.rows[0] && '总曝光人数' in x.rows[0])
const fulfillFile = files
  .filter((f) => f.includes('聚合下载'))
  .map((f) => ({ f, rows: readData(path.join(sourceRoot, f)) }))
  .find((x) => x.rows[0] && '及时送达率' in x.rows[0])

if (!financeFile || !trafficFile || !fulfillFile) {
  console.error('无法识别三份聚合下载文件字段')
  process.exit(1)
}

const financeRows = financeFile.rows
const trafficRows = trafficFile.rows
const fulfillRows = fulfillFile.rows
const activityRows = readData(path.join(sourceRoot, find('活动分析')))
const reverseRows = readData(path.join(sourceRoot, find('订单分析')))

console.log('loading product file (may take ~1min)...')
const productPath = path.join(sourceRoot, find('商品分析'))
const productRows = readData(productPath)

const trafficById = Object.fromEntries(trafficRows.map((r) => [String(r['门店id']), r]))
const fulfillById = Object.fromEntries(fulfillRows.map((r) => [String(r['门店id']), r]))

const stores = financeRows.map((r) => {
  const id = String(r['门店id'])
  const t = trafficById[id] || {}
  const f = fulfillById[id] || {}
  const orders = toNum(r['有效订单'])
  const reverse = toNum(r['逆向订单'])
  const income = toNum(r['预计收入（元）'])
  const expense = toNum(r['总支出（元）'])
  const paid = toNum(r['顾客实付金额（元）'])
  const subsidy = toNum(r['商家补贴（元）'])
  return {
    id,
    name: String(r['门店名称'] || ''),
    shortName: shortName(r['门店名称']),
    city: String(r['城市名称'] || ''),
    province: String(r['省份名称'] || ''),
    gmv: toNum(r['总成交额（元）']),
    net_gmv: toNum(r['净营业额']),
    income,
    expense,
    profit: income - expense,
    paid,
    aov: toNum(r['顾客实付笔单价（元）']),
    orders,
    subsidy,
    subsidy_rate: toNum(r['商家补贴力度']),
    lost_orders: toNum(r['流失订单']),
    lost_loss: toNum(r['流失订单预计损失（元）']),
    reverse_orders: reverse,
    reverse_rate: orders ? reverse / orders : 0,
    user_reverse: toNum(r['用户原因逆向订单数']),
    merchant_reverse: toNum(r['商户原因逆向订单数']),
    logistics_reverse: toNum(r['物流原因逆向订单数']),
    other_reverse: toNum(r['其他原因逆向订单数']),
    stockout_reverse_rate: toNum(r['缺货导致逆向单率']),
    expose: toNum(t['总曝光人数']),
    enter: toNum(t['总进店人数']),
    order_users: toNum(t['总下单人数']),
    enter_rate: toNum(t['进店转化率']),
    order_rate: toNum(t['下单转化率']),
    ontime_rate: toNum(f['及时送达率']),
    accept_t: toNum(f['平均接单时长（分）']),
    delivery_t: toNum(f['平均配送时长（分）']),
    pick_t: toNum(f['平均出货时长（分）']),
    pick_ontime_rate: toNum(f['拣货及时订单率']),
    lost_rate: toNum(f['流失订单率']),
    merchant_lost: toNum(f['商家原因流失订单数']),
    merchant_lost_rate: toNum(f['商家原因流失订单率']),
    timeout_accept: toNum(f['商家超时未接单数']),
    timeout_accept_rate: toNum(f['商家超时未接单率']),
    stockout_lost: toNum(f['缺货导致流失订单数']),
    stockout_lost_rate: toNum(f['缺货导致流失订单率']),
    complaint_rate: toNum(f['客诉订单率']),
    urge_rate: toNum(f['催单订单率']),
    shop_score: toNum(f['店铺评分']),
  }
})

const sum = (arr, k) => arr.reduce((a, r) => a + (typeof k === 'function' ? k(r) : r[k] || 0), 0)
const avg = (arr, k, filterZero = false) => {
  const vals = arr.map((r) => (typeof k === 'function' ? k(r) : r[k])).filter((v) => (filterZero ? v > 0 : Number.isFinite(v)))
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0
}
const weighted = (arr, valueKey, weightKey) => {
  const w = sum(arr, weightKey)
  if (!w) return avg(arr, valueKey)
  return arr.reduce((a, r) => a + r[valueKey] * r[weightKey], 0) / w
}

const activeStores = stores.filter((s) => s.orders > 0)
const overview = {
  date: String(financeRows[0]?.['日期'] || ''),
  store_cnt: stores.length,
  active_store_cnt: activeStores.length,
  city_cnt: new Set(stores.map((s) => s.city)).size,
  gmv: sum(stores, 'gmv'),
  net_gmv: sum(stores, 'net_gmv'),
  paid: sum(stores, 'paid'),
  orders: sum(stores, 'orders'),
  aov: 0,
  income: sum(stores, 'income'),
  expense: sum(stores, 'expense'),
  profit: sum(stores, 'profit'),
  /** 补后毛利近似：预计收入 - 总支出（已含补贴影响） */
  profit_after_subsidy: sum(stores, 'profit'),
  /** 补前毛利近似：补后毛利 + 商家补贴 */
  profit_before_subsidy: sum(stores, (s) => s.profit + s.subsidy),
  subsidy: sum(stores, 'subsidy'),
  subsidy_rate: 0,
  reverse_orders: sum(stores, 'reverse_orders'),
  reverse_rate: 0,
  lost_orders: sum(stores, 'lost_orders'),
  lost_loss: sum(stores, 'lost_loss'),
  expose: sum(stores, 'expose'),
  enter: sum(stores, 'enter'),
  order_users: sum(stores, 'order_users'),
  enter_rate: 0,
  order_rate: 0,
  ontime_rate: weighted(activeStores, 'ontime_rate', 'orders'),
  accept_t: weighted(activeStores, 'accept_t', 'orders'),
  delivery_t: weighted(activeStores, 'delivery_t', 'orders'),
  pick_t: weighted(activeStores, 'pick_t', 'orders'),
  pick_ontime_rate: weighted(activeStores, 'pick_ontime_rate', 'orders'),
  merchant_lost: sum(stores, 'merchant_lost'),
  merchant_lost_rate: 0,
  stockout_lost: sum(stores, 'stockout_lost'),
  merchant_reverse: sum(stores, 'merchant_reverse'),
  user_reverse: sum(stores, 'user_reverse'),
}
overview.aov = overview.orders ? overview.paid / overview.orders : 0
overview.subsidy_rate = overview.gmv ? overview.subsidy / overview.gmv : 0
overview.reverse_rate = overview.orders ? overview.reverse_orders / overview.orders : 0
overview.enter_rate = overview.expose ? overview.enter / overview.expose : 0
overview.order_rate = overview.enter ? overview.order_users / overview.enter : 0
overview.merchant_lost_rate = overview.orders ? overview.merchant_lost / overview.orders : 0

/** 商品聚合 */
let sku_total = 0
let sku_active = 0
let sku_stockout = 0
let stockout_loss = 0
const catSales = {}
const stockoutMap = {}
for (const r of productRows) {
  sku_total += 1
  const sales = toNum(r['实际销售额'])
  const qty = toNum(r['销量(不含退款)']) || toNum(r['销量'])
  if (qty > 0 || sales > 0) sku_active += 1
  const cat = String(r['一级分类'] || '其他')
  catSales[cat] = (catSales[cat] || 0) + sales
  const lost =
    toNum(r['缺货导致的流失订单数']) +
    toNum(r['缺货导致的取消订单数']) +
    toNum(r['缺货导致的整单退订单数']) +
    toNum(r['缺货导致的部分退订单数'])
  const loss =
    toNum(r['缺货导致的流失单预计损失']) +
    toNum(r['缺货导致的取消单预计损失']) +
    toNum(r['缺货导致的整单退预计损失']) +
    toNum(r['缺货导致的部分退预计损失'])
  const times = toNum(r['缺货次数'])
  if (times > 0 || lost > 0 || loss > 0) {
    sku_stockout += 1
    stockout_loss += loss
    const key = String(r['商品名称'] || r['商品id'])
    if (!stockoutMap[key]) {
      stockoutMap[key] = {
        name: String(r['商品名称'] || ''),
        cat,
        times: 0,
        lost: 0,
        loss: 0,
        stores: new Set(),
      }
    }
    stockoutMap[key].times += times
    stockoutMap[key].lost += lost
    stockoutMap[key].loss += loss
    stockoutMap[key].stores.add(String(r['门店名称'] || ''))
  }
}

const stockouts = Object.values(stockoutMap)
  .map((x) => ({
    name: x.name.length > 28 ? x.name.slice(0, 28) + '…' : x.name,
    fullName: x.name,
    cat: x.cat,
    times: x.times,
    lost: x.lost,
    loss: Math.round(x.loss * 100) / 100,
    store_cnt: x.stores.size,
  }))
  .sort((a, b) => b.loss - a.loss)
  .slice(0, 15)

const categories = Object.entries(catSales)
  .map(([name, amount]) => ({ name, amount: Math.round(amount * 100) / 100 }))
  .sort((a, b) => b.amount - a.amount)

overview.sku_total = sku_total
overview.sku_active = sku_active
overview.sku_stockout = sku_stockout
/** 动销缺货率：有缺货记录的动销SKU / 动销SKU */
overview.stockout_rate = sku_active ? sku_stockout / sku_active : 0
overview.stockout_loss = Math.round(stockout_loss * 100) / 100

/** 逆向聚合（按订单去重统计原因用行数；金额按商品行） */
const reasonMap = {}
const typeMap = {}
const revCatMap = {}
const revProductMap = {}
const revStoreMap = {}
let reverse_amount = 0
const orderIds = new Set()
for (const r of reverseRows) {
  const reason = String(r['逆向单原因'] || '未知')
  const type = String(r['逆向单类型'] || '未知')
  const cat = String(r['一级类目'] || '未知')
  const product = String(r['退货商品名称'] || '')
  const store = String(r['商户名称'] || '')
  const amt = toNum(r['退货商品金额'])
  reverse_amount += amt
  orderIds.add(String(r['订单id']))
  reasonMap[reason] = (reasonMap[reason] || 0) + 1
  typeMap[type] = (typeMap[type] || 0) + 1
  revCatMap[cat] = (revCatMap[cat] || 0) + 1
  if (product) {
    if (!revProductMap[product]) revProductMap[product] = { name: product, cat, count: 0, amount: 0 }
    revProductMap[product].count += 1
    revProductMap[product].amount += amt
  }
  if (store) {
    if (!revStoreMap[store]) revStoreMap[store] = { name: store, count: 0, amount: 0 }
    revStoreMap[store].count += 1
    revStoreMap[store].amount += amt
  }
}

const reverse = {
  line_cnt: reverseRows.length,
  order_cnt: orderIds.size,
  amount: Math.round(reverse_amount * 100) / 100,
  reasons: Object.entries(reasonMap)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value),
  types: Object.entries(typeMap)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value),
  categories: Object.entries(revCatMap)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10),
  products: Object.values(revProductMap)
    .map((p) => ({
      name: p.name.length > 24 ? p.name.slice(0, 24) + '…' : p.name,
      fullName: p.name,
      cat: p.cat,
      count: p.count,
      amount: Math.round(p.amount * 100) / 100,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10),
}

const activities = activityRows.map((r) => ({
  id: String(r['活动id'] || ''),
  name: String(r['活动名称'] || ''),
  store: String(r['商家名称'] || ''),
  shortStore: shortName(r['商家名称']),
  status: String(r['活动状态'] || ''),
  source: String(r['活动来源'] || ''),
  paid: toNum(r['实际交易额']),
  subsidy_total: toNum(r['活动总补贴']),
  subsidy_merchant: toNum(r['商家补贴金额']),
  subsidy_platform: toNum(r['平台补贴金额']),
  subsidy_intensity: toNum(r['商户补贴强度']),
  roi: toNum(r['投入产出比']),
  activity_orders: toNum(r['活动订单量']),
  store_orders: toNum(r['门店总订单量']),
  activity_order_rate: toNum(r['活动订单占比']),
  new_users: toNum(r['新客数']),
  new_orders: toNum(r['新客订单数']),
  new_aov: toNum(r['新客笔单价']),
  old_users: toNum(r['老客数']),
  old_orders: toNum(r['老客订单数']),
  old_aov: toNum(r['老客笔单价']),
}))

const activityOverview = {
  cnt: activities.length,
  paid: sum(activities, 'paid'),
  subsidy_merchant: sum(activities, 'subsidy_merchant'),
  roi: avg(activities, 'roi', true),
  new_users: sum(activities, 'new_users'),
  new_orders: sum(activities, 'new_orders'),
  new_aov: avg(activities, 'new_aov', true),
  old_aov: avg(activities, 'old_aov', true),
  activity_orders: sum(activities, 'activity_orders'),
  store_orders: sum(activities, 'store_orders'),
  activity_order_rate: 0,
}
activityOverview.activity_order_rate = activityOverview.store_orders
  ? activityOverview.activity_orders / activityOverview.store_orders
  : 0

/** 问题门店：履约/逆向双差（订单≥10） */
const problemStores = activeStores
  .filter((s) => s.orders >= 10)
  .map((s) => {
    const issues = []
    if (s.ontime_rate < 0.9) issues.push(`及时送达率 ${(s.ontime_rate * 100).toFixed(1)}%`)
    if (s.delivery_t > 18) issues.push(`配送 ${s.delivery_t.toFixed(1)}min`)
    if (s.reverse_rate > 0.1) issues.push(`逆向率 ${(s.reverse_rate * 100).toFixed(1)}%`)
    if (s.merchant_lost_rate > 0.02) issues.push(`商责流失 ${(s.merchant_lost_rate * 100).toFixed(1)}%`)
    if (s.pick_ontime_rate > 0 && s.pick_ontime_rate < 0.7) issues.push(`拣货及时 ${(s.pick_ontime_rate * 100).toFixed(1)}%`)
    if (s.timeout_accept > 0) issues.push(`超时未接单 ${s.timeout_accept}`)
    return { ...s, issues, issue_cnt: issues.length }
  })
  .filter((s) => s.issue_cnt > 0)
  .sort((a, b) => b.issue_cnt - a.issue_cnt || b.reverse_rate - a.reverse_rate)
  .slice(0, 12)
  .map((s) => ({
    id: s.id,
    name: s.shortName,
    fullName: s.name,
    city: s.city,
    orders: s.orders,
    paid: s.paid,
    ontime_rate: s.ontime_rate,
    delivery_t: s.delivery_t,
    reverse_rate: s.reverse_rate,
    merchant_lost_rate: s.merchant_lost_rate,
    pick_ontime_rate: s.pick_ontime_rate,
    issues: s.issues,
  }))

/** 行动建议（基于真实异常） */
const actions = []
if (overview.reverse_rate > 0.05) {
  const topReason = reverse.reasons[0]
  actions.push({
    level: 'red',
    module: '逆向',
    title: `逆向单率 ${(overview.reverse_rate * 100).toFixed(2)}%，目标压降至 ${(overview.reverse_rate * 0.8 * 100).toFixed(2)}%`,
    desc: topReason
      ? `Top原因「${topReason.name}」${topReason.value}单；优先治理缺货/买错买少与履约相关原因。`
      : '优先拆解逆向原因并按门店辅导。',
  })
}
if (overview.stockout_loss > 0) {
  actions.push({
    level: 'red',
    module: '商品',
    title: `缺货预计损失 ¥${overview.stockout_loss.toFixed(0)}`,
    desc: stockouts[0]
      ? `爆款缺货TOP：${stockouts[0].name}（损失¥${stockouts[0].loss}），建立安全库存日检。`
      : '对缺货SKU建立安全库存预警。',
  })
}
const slowDelivery = problemStores.filter((s) => s.delivery_t > 18).slice(0, 3)
if (slowDelivery.length) {
  actions.push({
    level: 'yellow',
    module: '履约',
    title: '配送时长异常门店',
    desc: slowDelivery.map((s) => `${s.name} ${s.delivery_t.toFixed(1)}min`).join('；') + '。检查配送范围与运力。',
  })
}
const lowOntime = problemStores.filter((s) => s.ontime_rate < 0.9).slice(0, 3)
if (lowOntime.length) {
  actions.push({
    level: 'yellow',
    module: '履约',
    title: '及时送达率未达标门店',
    desc: lowOntime.map((s) => `${s.name} ${(s.ontime_rate * 100).toFixed(1)}%`).join('；') + '。优化接单设备与高峰排班。',
  })
}
if (activityOverview.roi > 0 && activityOverview.subsidy_merchant > 0) {
  actions.push({
    level: 'green',
    module: '营销',
    title: `活动平均ROI ${activityOverview.roi.toFixed(1)}，新客 ${activityOverview.new_users}`,
    desc: `活动订单占比 ${(activityOverview.activity_order_rate * 100).toFixed(1)}%；关注商家补贴强度与补后毛利。`,
  })
}

const cities = [...new Set(stores.map((s) => s.city))].filter(Boolean).sort()

const payload = {
  updated_at: readMetaDate(path.join(sourceRoot, financeFile.f)) || new Date().toISOString(),
  source_date: overview.date,
  overview,
  stores: stores
    .map((s) => ({
      id: s.id,
      name: s.name,
      shortName: s.shortName,
      city: s.city,
      gmv: s.gmv,
      paid: s.paid,
      orders: s.orders,
      aov: s.aov,
      profit: s.profit,
      subsidy: s.subsidy,
      subsidy_rate: s.subsidy_rate,
      reverse_rate: s.reverse_rate,
      reverse_orders: s.reverse_orders,
      expose: s.expose,
      enter: s.enter,
      enter_rate: s.enter_rate,
      order_rate: s.order_rate,
      ontime_rate: s.ontime_rate,
      accept_t: s.accept_t,
      delivery_t: s.delivery_t,
      pick_t: s.pick_t,
      pick_ontime_rate: s.pick_ontime_rate,
      merchant_lost_rate: s.merchant_lost_rate,
      lost_orders: s.lost_orders,
      lost_loss: s.lost_loss,
      stockout_lost: s.stockout_lost,
    }))
    .sort((a, b) => b.paid - a.paid),
  cities,
  categories: categories.slice(0, 12),
  stockouts,
  reverse,
  activities,
  activityOverview,
  problemStores,
  actions,
  /** 考核标准（与方案看板对齐，可按业务调整） */
  standards: {
    ontime_rate: 0.9,
    pick_ontime_rate: 0.8,
    reverse_rate: 0.05,
    merchant_lost_rate: 0.01,
    delivery_t: 15,
    enter_rate: 0.08,
    stockout_rate: 0.08,
  },
}

const out = path.join(root, 'web', 'src', 'data', 'opsDashboard.json')
fs.mkdirSync(path.dirname(out), { recursive: true })
fs.writeFileSync(out, JSON.stringify(payload))
console.log('synced ->', out)
console.log({
  stores: stores.length,
  reverseLines: reverseRows.length,
  products: productRows.length,
  gmv: Math.round(overview.gmv),
  reverse_rate: overview.reverse_rate,
  stockout_rate: overview.stockout_rate,
})
