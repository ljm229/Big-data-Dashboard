/** MySQL → 看板 JSON（替代已归档的旧 XLSX 同步脚本，输出形状与前端兼容）。
 * 用法：node scripts/sync-db-to-json.mjs [--only=source1|traffic|cost|profit|margin]
 * 输出：web/src/data/*.json（唯一前端数据目录）
 */
import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import mysql from 'mysql2/promise'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const OUTS = (name) => [path.join(ROOT, 'web/src/data', name)]
const env = {}
try {
  for (const line of fs.readFileSync(path.join(ROOT, 'automation/.env'), 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z_]+)=(.*)\s*$/)
    if (m) env[m[1]] = m[2].trim()
  }
} catch {}
const pool = mysql.createPool({ host: env.DB_HOST || '127.0.0.1', port: Number(env.DB_PORT || 3306), user: env.DB_USER || 'root', password: env.DB_PASSWORD || '', database: env.DB_NAME || 'taobian', connectionLimit: 4, dateStrings: true })
const generatedAt = new Date().toISOString()
const J = (v) => (typeof v === 'string' ? JSON.parse(v) : v)
const N = (v) => {
  if (v == null || v === '') return null
  const n = typeof v === 'number' ? v : Number(String(v).replace(/,/g, '').replace(/%$/, ''))
  if (!Number.isFinite(n)) return null
  if (typeof v === 'string' && v.trim().endsWith('%')) return n / 100
  return n
}
const norm = (s) => String(s || '').replace(/\s+/g, '').replace(/（/g, '(').replace(/）/g, ')')
const BAD = /^(门店|门店名称)$|模板店|优沃森超市/
const only = (process.argv.find((a) => a.startsWith('--only=')) || '').slice(7)
const want = (k) => !only || only === k
const requireHash = (file) => createHash('sha256').update(fs.readFileSync(file)).digest('hex')
function write(name, payload) {
  for (const out of OUTS(name)) {
    fs.mkdirSync(path.dirname(out), { recursive: true })
    const tmp = out + '.tmp'
    fs.writeFileSync(tmp, JSON.stringify(payload), 'utf8')
    fs.renameSync(tmp, out)
  }
  console.log(`[json] ${name} ok`)
}

async function source1() {
  const [brows] = await pool.query(`SELECT DATE_FORMAT(biz_date,'%Y-%m-%d') d, channel, store_name, metrics FROM fact_ax_business_daily ORDER BY d`)
  const [lrows] = await pool.query(`SELECT store_name, city, status, address, is_new FROM dim_store_launch`)
  const [srows] = await pool.query(`SELECT DATE_FORMAT(biz_date,'%Y-%m-%d') d, store_name, on_shelf, saleable, active_goods, oos_goods, refund_goods, bad_review_goods, attendance_rate, absent_cnt, absent_loss FROM fact_product_store_daily ORDER BY d`)
  const [irows] = await pool.query(`SELECT period_from, period_to, store_name, cat1, SUM(actual_sales) sales, SUM(qty) qty, SUM(bring_orders) orders, SUM(refund_amount) refundAmt, SUM(oos_lost_loss+oos_cancel_loss+oos_full_refund_loss+oos_part_refund_loss) stockoutLoss, SUM(oos_times) stockoutTimes FROM fact_product_item_period GROUP BY period_from, period_to, store_name, cat1`)
  const stores = lrows.filter((r) => !BAD.test(r.store_name)).map((r) => ({ name: r.store_name, city: r.city || '', status: r.status || '', address: r.address || '', isNew: r.is_new == null ? null : Boolean(r.is_new) }))
  const facts = []
  const days = new Set()
  const channels = new Set()
  for (const r of brows) {
    if (BAD.test(r.store_name)) continue
    const m = J(r.metrics)
    const f = {
      date: r.d, channel: r.channel, store: r.store_name,
      turnover: N(m['总营业额']), onlineRevenue: N(m['预计线上收入']),
      profit: N(m['预计毛利(含平台后返)']), marginRate: N(m['毛利率(含平台后返)']),
      unitProfit: N(m['单均毛利(含平台后返)']), paid: N(m['有效订单金额（实付）']),
      orders: N(m['有效订单量']), refundRate: N(m['退款率']), refundOrders: N(m['退款订单量']),
    }
    if (f.turnover == null && f.onlineRevenue == null && f.profit == null && f.paid == null && f.orders == null) continue
    days.add(f.date); channels.add(f.channel); facts.push(f)
  }
  const supply = []
  for (const r of srows) {
    if (BAD.test(r.store_name)) continue
    supply.push({ date: r.d, store: r.store_name, onShelf: r.on_shelf, sellable: r.saleable, moving: r.active_goods, stockout: r.oos_goods, refundSku: r.refund_goods, badSku: r.bad_review_goods, attendance: r.attendance_rate != null ? Number(r.attendance_rate) : null, absent: r.absent_cnt, absentLoss: r.absent_loss != null ? Number(r.absent_loss) : null })
  }
  let categoryPeriod = null
  const categoryByStore = []
  if (irows.length) {
    const from = String(irows[0].period_from).slice(0, 10)
    const to = String(irows[0].period_to).slice(0, 10)
    const cat = new Map()
    for (const r of irows) {
      const c = cat.get(r.cat1) || { name: r.cat1, sales: 0, qty: 0, orders: 0, refundAmt: 0, stockoutLoss: 0, stockoutTimes: 0 }
      c.sales += Number(r.sales) || 0; c.qty += Number(r.qty) || 0; c.orders += Number(r.orders) || 0
      c.refundAmt += Number(r.refundAmt) || 0; c.stockoutLoss += Number(r.stockoutLoss) || 0; c.stockoutTimes += Number(r.stockoutTimes) || 0
      cat.set(r.cat1, c)
      categoryByStore.push({ store: r.store_name, category: r.cat1, sales: Math.round((Number(r.sales) || 0) * 100) / 100, qty: Math.round(Number(r.qty) || 0), orders: Math.round(Number(r.orders) || 0), refundAmt: Math.round((Number(r.refundAmt) || 0) * 100) / 100, stockoutLoss: Math.round((Number(r.stockoutLoss) || 0) * 100) / 100, stockoutTimes: Math.round(Number(r.stockoutTimes) || 0) })
    }
    const categories = [...cat.values()].map((c) => ({ ...c, sales: Math.round(c.sales * 100) / 100, refundAmt: Math.round(c.refundAmt * 100) / 100, stockoutLoss: Math.round(c.stockoutLoss * 100) / 100, orders: Math.round(c.orders) })).sort((a, b) => b.sales - a.sales)
    categoryPeriod = { from, to, channel: '淘宝闪购', categories }
  }
  write('source1.json', {
    source: 'mysql:taobian', generatedAt, files: {},
    days: [...days].sort(), channels: [...channels].sort(), stores, facts, supply, categoryPeriod, categoryByStore,
  })
  console.log(`  facts=${facts.length} supply=${supply.length} stores=${stores.length} days=${days.size}`)
}

async function traffic() {
  const [rows] = await pool.query(`SELECT DATE_FORMAT(biz_date,'%Y-%m-%d') d, store_id, store_name, city, source_category, source_name, exposure, visitors, orders, visit_conv, order_conv, overall_conv FROM fact_traffic_daily ORDER BY d`)
  const DIM = { '分平台渠道': 'platform', '淘宝闪购APP内渠道': 'app' }
  const pct = (v) => (v == null ? null : `${Number((Number(v) * 100).toFixed(4))}%`)
  const facts = []
  const daySet = new Set()
  rows.forEach((r, i) => {
    const dim = DIM[String(r.source_category).trim()]
    if (!dim) return
    daySet.add(r.d)
    facts.push({ storeId: String(r.store_id || ''), store: r.store_name, city: r.city || '', dimension: dim, source: r.source_name, row: i + 2, exposure: r.exposure, entry: r.visitors, orders: r.orders, date: r.d, reportedRates: [pct(r.visit_conv), pct(r.order_conv), pct(r.overall_conv)] })
  })
  const days = [...daySet].sort()
  write('trafficData.json', {
    schemaVersion: 2, period: { from: days[0], to: days[days.length - 1], grain: 'day' },
    source: { file: 'mysql:fact_traffic_daily', sheet: 'data', range: '', exportedAt: '', sha256: '' },
    generatedAt, facts,
  })
  console.log(`  facts=${facts.length} ${days[0]}~${days[days.length - 1]}`)
}

async function cost() {
  const COSTMAP = { turnover: '总营业额', goodsOriginal: '商品原价', packaging: '包装费原价', deliveryIncome: '应收配送费&地址变更费', maintenance: '订单线下维护费用', marketing: '营销活动费用', commission: '佣金&其他平台费用', goodsCost: '商品成本', platformDelivery: '平台配送服务费', selfDelivery: '自配送费用', subsidy: '平台补贴', promotion: '推广费用', rebate: '平台后返', onlineIncome: '预计线上收入', onlineExpense: '预计线上支出', sourceProfit: '预计毛利', sourceProfitWithRebate: '预计毛利(含平台后返)' }
  const [rows] = await pool.query(`SELECT DATE_FORMAT(biz_date,'%Y-%m-%d') d, channel, store_name, metrics FROM fact_ax_business_daily ORDER BY d`)
  const [lrows] = await pool.query(`SELECT store_name, city FROM dim_store_launch`)
  const cityOf = new Map(lrows.map((r) => [norm(r.store_name), r.city || '']))
  const facts = []
  rows.forEach((r, i) => {
    if (BAD.test(r.store_name)) return
    const m = J(r.metrics)
    const v = {}
    for (const [k, label] of Object.entries(COSTMAP)) v[k] = N(m[label])
    if (Object.values(v).every((x) => x == null)) return
    facts.push({ date: r.d, store: r.store_name, channel: r.channel, row: i + 2, ...v })
  })
  const seen = new Set()
  const stores = []
  for (const r of lrows) {
    const k = norm(r.store_name)
    if (!k || seen.has(k)) continue
    seen.add(k)
    stores.push({ name: r.store_name, city: r.city || '' })
  }
  write('costData.json', { generatedAt, source: 'mysql:fact_ax_business_daily', storeSource: 'mysql:dim_store_launch', fields: Object.fromEntries(Object.entries(COSTMAP).map(([k, label]) => [k, { label }])), stats: { facts: facts.length }, stores, facts })
  console.log(`  facts=${facts.length}`)
}

async function profit() {
  const [rows] = await pool.query(`SELECT DATE_FORMAT(biz_date,'%Y-%m-%d') d, store_name, metrics FROM fact_ax_profit_store ORDER BY d`)
  const facts = []
  for (const r of rows) {
    if (BAD.test(r.store_name)) continue
    const m = J(r.metrics)
    facts.push({
      date: r.d, store: r.store_name,
      orders: N(m['经营指标/有效订单量']), turnover: N(m['经营指标/总营业额']), paid: N(m['经营指标/有效订单金额（实付）']),
      subsidyRateSrc: N(m['经营指标/商品补贴率']), profit: N(m['净利/净利润']), profitRateSrc: N(m['净利/利润率']),
      incomeTotal: N(m['收入/总收入']),
      incomes: { goodsOriginal: N(m['收入/商品原价']), delivery: N(m['收入/应收配送费']), packaging: N(m['收入/包装费原价']), marketing: N(m['收入/营销活动费用']), addrChange: N(m['收入/地址变更费']), other: N(m['收入/其他收入']), salesOrder: N(m['收入/销售开单收入']) },
      expenseTotal: N(m['支出/总支出']),
      expenses: { goodsCost: N(m['支出/商品成本']), offlineGoods: N(m['支出/线下销售商品成本支出']), selfDelivery: N(m['支出/自配送费用']), platformDelivery: N(m['支出/平台配送服务费']), commission: N(m['支出/佣金']), donation: N(m['支出/公益捐款']), labor: N(m['支出/人力成本']), utilities: N(m['支出/水电杂项']), rent: N(m['支出/房租物业']), other: N(m['支出/其他支出']), promotion: N(m['支出/推广费用']) },
    })
  }
  write('profitPcData.json', { generatedAt, source: 'mysql:fact_ax_profit_store', facts })
  console.log(`  facts=${facts.length}`)
}

const REASON_KEYS = ['商品毛利为负', '营销折扣过高', '配送成本过高', '平台费用占比高', '其他']
const n0 = (v) => N(v) ?? 0
const money = (v) => Math.round(v * 100) / 100
function classifyReason(o) {
  const product = n0(o['应收商品总额']) + n0(o['商家商品优惠']) + n0(o['商品采购成本'])
  const marketing = n0(o['商家商品优惠']) + n0(o['商家整单优惠'])
  const delivery = n0(o['应收配送费']) + n0(o['配送费优惠']) + n0(o['商家自配送成本']) + n0(o['平台配送服务费'])
  const platform = n0(o['佣金']) + n0(o['其他平台费']) + n0(o['平台配送服务费'])
  const parts = [['商品毛利为负', product], ['营销折扣过高', marketing], ['配送成本过高', delivery], ['平台费用占比高', platform]].sort((a, b) => a[1] - b[1])
  return parts[0][1] < 0 ? parts[0][0] : '其他'
}
async function margin() {
  const [rows] = await pool.query(`SELECT order_code, store_name, store_code, channel, DATE_FORMAT(created_time,'%Y-%m-%d %H:%i:%s') ct, receivable, cost, est_profit, settle_amount, refund_no, DATE_FORMAT(finish_time,'%Y-%m-%d %H:%i:%s') dt, order_status, extra FROM fact_ax_order_margin`)
  const map = new Map()
  const seen = new Set()
  let raw = 0, skipped = 0, dupes = 0, positiveOrders = 0, negativeOrders = 0, refundOrders = 0
  const channelTotals = {}, channelNeg = {}
  for (const r of rows) {
    raw++
    if (r.order_code) {
      if (seen.has(r.order_code)) { dupes++; continue }
      seen.add(r.order_code)
    }
    const date = String(r.ct || '').slice(0, 10)
    const store = norm(r.store_name)
    const channel = String(r.channel || '').trim() === 'POS' ? 'POS渠道' : String(r.channel || '').trim()
    const profit = r.est_profit != null ? Number(r.est_profit) : null
    if (!date || !store || !channel || profit == null) { skipped++; continue }
    const ex = J(r.extra || '{}')
    const row = { '应收': r.receivable, '商家商品优惠': ex['商家商品优惠'], '商家整单优惠': ex['商家整单优惠'], '配送费优惠': ex['配送费优惠'], '应收配送费': ex['应收配送费'], '商家自配送成本': ex['商家自配送成本'], '平台配送服务费': ex['平台配送服务费'], '佣金': ex['佣金'], '其他平台费': ex['其他平台费'], '退款单号': r.refund_no, '应收商品总额': ex['应收商品总额'], '商品采购成本': ex['商品采购成本'], '预计毛利': profit }
    const key = `${date}|${store}|${channel}`
    let f = map.get(key)
    if (!f) {
      f = { date, store, storeCode: r.store_code || '', channel, orders: 0, negOrders: 0, negGt3: 0, loss: 0, revenue: 0, profitSum: 0, marketing: 0, delivery: 0, platform: 0, refundOrders: 0, refundProfit: 0, reasons: Object.fromEntries(REASON_KEYS.map((k) => [k, { count: 0, amount: 0 }])) }
      map.set(key, f)
    }
    f.orders++
    f.revenue += n0(row['应收']); f.profitSum += profit
    f.marketing += n0(row['商家商品优惠']) + n0(row['商家整单优惠']) + n0(row['配送费优惠'])
    f.delivery += n0(row['应收配送费']) + n0(row['商家自配送成本']) + n0(row['平台配送服务费'])
    f.platform += n0(row['佣金']) + n0(row['其他平台费'])
    channelTotals[channel] = (channelTotals[channel] || 0) + 1
    if (row['退款单号'] && String(row['退款单号']).trim()) { refundOrders++; f.refundOrders++; f.refundProfit += profit }
    if (profit < 0) {
      negativeOrders++; f.negOrders++; f.loss += profit
      if (profit <= -3) f.negGt3++
      const reason = classifyReason(row)
      f.reasons[reason].count++; f.reasons[reason].amount += profit
      channelNeg[channel] = (channelNeg[channel] || 0) + 1
    } else positiveOrders++
  }
  const facts = [...map.values()].map((f) => ({ ...f, loss: money(f.loss), revenue: money(f.revenue), profitSum: money(f.profitSum), marketing: money(f.marketing), delivery: money(f.delivery), platform: money(f.platform), refundProfit: money(f.refundProfit), reasons: Object.fromEntries(REASON_KEYS.map((k) => [k, { count: f.reasons[k].count, amount: money(f.reasons[k].amount) }])) }))
    .sort((a, b) => a.date.localeCompare(b.date) || a.store.localeCompare(b.store) || a.channel.localeCompare(b.channel))
  const dates = [...new Set(facts.map((f) => f.date))].sort()
  write('orderMarginData.json', {
    generatedAt,
    source: { path: 'mysql:fact_ax_order_margin', sheet: 'data', sha256: '', note: '全量订单；多文件按订单编码去重；负毛利结构按预计毛利<0；＞3元=预计毛利≤-3；变化桥字段=应收/预计毛利/营销/配送/平台费/退款单毛利。' },
    files: [{ file: 'mysql:fact_ax_order_margin', rows: raw }],
    reasonKeys: REASON_KEYS,
    stats: { rawRows: raw, skipped, dupes, positiveOrders, negativeOrders, refundOrders, factRows: facts.length, orderRows: facts.reduce((a, f) => a + f.orders, 0), negOrderRows: facts.reduce((a, f) => a + f.negOrders, 0), negGt3: facts.reduce((a, f) => a + f.negGt3, 0), loss: money(facts.reduce((a, f) => a + f.loss, 0)), revenue: money(facts.reduce((a, f) => a + f.revenue, 0)), profitSum: money(facts.reduce((a, f) => a + f.profitSum, 0)), dateFrom: dates[0] || null, dateTo: dates[dates.length - 1] || null, channels: channelTotals, channelNeg },
    facts,
  })
  console.log(`  facts=${facts.length} orders=${raw - dupes - skipped}`)
}

// 风险与主驾驶舱统一由 MySQL 事实表生成；前端仍消费原有 JSON 形状，避免运行时混源。
async function riskAndDashboard() {
  const [business] = await pool.query(`SELECT DATE_FORMAT(biz_date,'%Y-%m-%d') d, channel, store_name, metrics FROM fact_ax_business_daily ORDER BY d`)
  const [supplyRows] = await pool.query(`SELECT DATE_FORMAT(biz_date,'%Y-%m-%d') d, store_name, on_shelf, oos_goods, attendance_rate, absent_cnt, absent_loss FROM fact_product_store_daily ORDER BY d`)
  const [qualityRows] = await pool.query(`SELECT DATE_FORMAT(biz_date,'%Y-%m-%d') d, store_name, store_code, sellout_rate, pick_error_rate, warehouse_t, im_reply_rate, merchant_issue_rate, shop_score FROM fact_store_quality_daily ORDER BY d`)
  const [launchRows] = await pool.query(`SELECT store_name, city, status FROM dim_store_launch`)
  const cityOf = new Map(launchRows.map(r => [norm(r.store_name), r.city || '']))
  const stores = launchRows.map((r, i) => ({ name: r.store_name, city: r.city || '', status: r.status || '', row: i + 2 }))
  const facts = business.map((r, i) => { const m = J(r.metrics); return { date:r.d, store:r.store_name, channel:r.channel, profit:N(m['预计毛利(含平台后返)']) ?? N(m['预计毛利']), orders:N(m['有效订单量']), paid:N(m['有效订单金额（实付）']), refundRate:N(m['退款率']), refundOrders:N(m['退款订单量']), refundAmount:N(m['退款金额']), negativeOrders:N(m['负毛利订单量']), negativeOrderRate:N(m['负毛利订单占比']), row:i + 2 } })
  const supply = supplyRows.map((r, i) => ({ date:r.d, store:r.store_name, onShelf:r.on_shelf, stockout:r.oos_goods, attendance:r.attendance_rate == null ? null : Number(r.attendance_rate), absent:r.absent_cnt, absentLoss:r.absent_loss == null ? null : Number(r.absent_loss), row:i + 2 }))
  const quality = qualityRows.map((r, i) => ({ date:r.d, store:r.store_name, sellout:r.sellout_rate == null ? null : Number(r.sellout_rate), pickingError:r.pick_error_rate == null ? null : Number(r.pick_error_rate), warehouseT:r.warehouse_t == null ? null : Number(r.warehouse_t), imReply:r.im_reply_rate == null ? null : Number(r.im_reply_rate), merchantIssue:r.merchant_issue_rate == null ? null : Number(r.merchant_issue_rate), rating:r.shop_score == null ? null : Number(r.shop_score), row:i + 2 }))
  const mysqlSource = (table) => ({ path:`mysql:${table}`, sheet:'', sha256:'' })
  write('riskData.json', {
    generatedAt, source:'mysql:dashboard',
    files: {
      stores: mysqlSource('dim_store_launch'),
      facts: mysqlSource('fact_ax_business_daily'),
      supply: mysqlSource('fact_product_store_daily'),
      quality: mysqlSource('fact_store_quality_daily'),
    },
    stats:{}, stores, facts, supply, quality,
  })

  const days = [...new Set(business.map(r => r.d))].sort()
  const storeRank = {}, storeList = {}, channelStores = {}, assessment = {}
  for (const day of days) { storeRank[day] = []; storeList[day] = []; channelStores[day] = [] }
  for (const r of business) {
    const m = J(r.metrics); const city = cityOf.get(norm(r.store_name)) || ''
    const row = { ...m, '城市名称':city, '门店名称':r.store_name, '渠道':r.channel }
    storeRank[r.d].push(row); channelStores[r.d].push(row)
  }
  for (const day of days) { const seen = new Set(); for (const r of storeRank[day]) if (!seen.has(r['门店名称'])) { seen.add(r['门店名称']); storeList[day].push({ city:r['城市名称'], name:r['门店名称'], shortName:r['门店名称'] }) } }
  for (const r of qualityRows) { (assessment[r.d] ||= []).push({ name:r.store_name, shortName:r.store_name, code:r.store_code, sellout_rate:r.sellout_rate == null ? null : Number(r.sellout_rate), pick_error_rate:r.pick_error_rate == null ? null : Number(r.pick_error_rate), warehouse_t:r.warehouse_t == null ? null : Number(r.warehouse_t), im_reply_rate:r.im_reply_rate == null ? null : Number(r.im_reply_rate), merchant_issue_rate:r.merchant_issue_rate == null ? null : Number(r.merchant_issue_rate), shop_score:r.shop_score == null ? null : Number(r.shop_score) }) }
  write('dashboard.json', { schemaVersion:2, source:'mysql:dashboard', generatedAt, days, weeks:[], months:[], channels:[...new Set(business.map(r => r.channel))], storeRank, storeList, channelStores, assessment, category:null })
}

if (want('source1')) await source1()
if (want('traffic')) await traffic()
if (want('cost')) await cost()
if (want('profit')) await profit()
if (want('margin')) await margin()
if (!only || only === 'risk' || only === 'dashboard') await riskAndDashboard()
if (!only) {
  const [[latest]] = await pool.query(`SELECT DATE_FORMAT(MAX(biz_date),'%Y-%m-%d') latest_biz_date FROM fact_ax_business_daily`)
  const datasets = {}
  for (const [name, table] of Object.entries({
    business: 'fact_ax_business_daily', traffic: 'fact_traffic_daily', product: 'fact_product_store_daily',
    profit: 'fact_ax_profit_store', quality: 'fact_store_quality_daily', margin: 'fact_ax_order_margin',
  })) {
    const [[row]] = await pool.query(`SELECT COUNT(*) count FROM ${table}`)
    datasets[name] = Number(row.count)
  }
  const version = `${latest.latest_biz_date}-${generatedAt.replace(/[-:TZ.]/g, '')}`
  write('dataVersion.json', { version, generatedAt, latestBizDate: latest.latest_biz_date, datasets })
  const manifestPath = path.join(ROOT, 'web/src/data/dataVersion.json')
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
  const names = ['source1.json', 'trafficData.json', 'costData.json', 'profitPcData.json', 'orderMarginData.json', 'riskData.json', 'dashboard.json']
  manifest.files = Object.fromEntries(names.map((name) => [name, requireHash(path.join(ROOT, 'web/src/data', name))]))
  write('dataVersion.json', manifest)
}
await pool.end()
console.log('done')
