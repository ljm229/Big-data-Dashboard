/** xlsx 抓取产物 → MySQL(dashboard) 入库，全量 upsert 可重跑。
 * 用法：
 *   node scripts/db-import.mjs --dataset=traffic --file=output/nr-download-center/流量数据下载_2026-09-20-2026-09-21.xlsx
 *   node scripts/db-import.mjs --dataset=all   （按 output/ 下最新归档文件逐个入库）
 *   --date=2026-09-21  业务日期覆盖（ax_profit / ax_quality 无日期列时用；默认取导出时间前一天）
 * 口径：比率一律存小数（6.8%→0.068）；金额 DECIMAL；长尾列收进 JSON。
 */
import fs from 'node:fs'
import path from 'node:path'
import mysql from 'mysql2/promise'
import XLSX from 'xlsx'

const ROOT = path.resolve('.')
const getArg = (n) => {
  const hit = process.argv.find((a) => a.startsWith(`--${n}=`))
  return hit ? hit.slice(n.length + 3) : ''
}
function loadEnv() {
  const out = {}
  try {
    for (const line of fs.readFileSync(path.join(ROOT, '.env'), 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z_]+)=(.*)\s*$/)
      if (m) out[m[1]] = m[2].trim()
    }
  } catch {}
  return out
}
const env = loadEnv()
const pool = mysql.createPool({
  host: env.DB_HOST || '127.0.0.1',
  port: Number(env.DB_PORT || 3306),
  user: env.DB_USER || 'root',
  password: env.DB_PASSWORD || '',
  database: env.DB_NAME || 'taobian',
  connectionLimit: 4,
})

// ---- 通用解析 ----
function toDate(v) {
  if (v == null || v === '') return null
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v.toISOString().slice(0, 10)
  if (typeof v === 'number' && Number.isFinite(v)) {
    if (v > 20000000) return toDate(String(Math.trunc(v)))
    if (v >= 30000 && v < 60000) {
      return new Date(Date.UTC(1899, 11, 30) + Math.trunc(v) * 86400000).toISOString().slice(0, 10)
    }
    return null
  }
  const s = String(v).trim()
  let m = s.match(/^(\d{4})(\d{2})(\d{2})/)
  if (m) return `${m[1]}-${m[2]}-${m[3]}`
  m = s.match(/^(\d{4}-\d{2}-\d{2})/)
  if (m) return m[1]
  return null
}
function toDateTime(v) {
  if (v == null || v === '') return null
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v
  let s = String(v).trim().replace(/\//g, '-')
  const m = s.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?/)
  if (m) {
    return `${m[1]} ${m[2].padStart(2, '0')}:${m[3].padStart(2, '0')}:${(m[4] || '0').padStart(2, '0')}`
  }
  return toDate(s)
}
function toNum(v) {
  if (v == null || v === '') return null
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  const s = String(v).trim().replace(/,/g, '')
  if (!s) return null
  if (s.endsWith('%')) {
    const n = parseFloat(s)
    return Number.isFinite(n) ? n / 100 : null
  }
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}
function toInt(v) {
  const n = toNum(v)
  return n == null ? 0 : Math.round(n)
}
function normStore(name) {
  return String(name || '').replace(/（/g, '(').replace(/）/g, ')').replace(/\s+/g, '').trim()
}
function readSheet(file, name) {
  const wb = XLSX.readFile(file)
  const ws = wb.Sheets[name] || wb.Sheets[wb.SheetNames[0]]
  return XLSX.utils.sheet_to_json(ws, { header: 1 })
}
function exportDate(file) {
  // meta 表导出时间 → 默认业务日期 = 导出前一天（昨日口径）
  try {
    const wb = XLSX.readFile(file)
    if (!wb.Sheets.meta) return null
    for (const row of XLSX.utils.sheet_to_json(wb.Sheets.meta, { header: 1 })) {
      const d = toDate(row[1])
      if (d) return d
    }
  } catch {}
  return null
}
async function upsert(table, cols, rows, updateCols) {
  if (!rows.length) return 0
  const ph = `(${cols.map(() => '?').join(',')})`
  const upd = (updateCols || cols).map((c) => `\`${c}\`=VALUES(\`${c}\`)`).join(',')
  let n = 0
  const conn = await pool.getConnection()
  try {
    for (let i = 0; i < rows.length; i += 1000) {
      const chunk = rows.slice(i, i + 1000)
      const sql = `INSERT INTO \`${table}\` (${cols.map((c) => `\`${c}\``).join(',')}) VALUES ${chunk.map(() => ph).join(',')} ON DUPLICATE KEY UPDATE ${upd}`
      const [r] = await conn.query(sql, chunk.flat())
      n += r.affectedRows
    }
  } finally {
    conn.release()
  }
  return n
}
async function touchStore(conn, names) {
  // 门店维表：见一个收一个
  const uniq = [...new Set(names.filter(Boolean))]
  for (let i = 0; i < uniq.length; i += 500) {
    const chunk = uniq.slice(i, i + 500)
    await conn.query(
      `INSERT INTO dim_store (store_key, store_name) VALUES ${chunk.map(() => '(?,?)').join(',')} ON DUPLICATE KEY UPDATE last_seen=CURDATE()`,
      chunk.flatMap((n) => [`S:${normStore(n)}`, n]),
    )
  }
}
const TABLE_OF = { traffic: 'fact_traffic_daily', product: 'fact_product_store_daily', reverse: 'fact_reverse_order', item_period: 'fact_product_item_period', ax_business: 'fact_ax_business_daily', ax_profit: 'fact_ax_profit_store', ax_margin: 'fact_ax_order_margin', ax_quality: 'fact_store_quality_daily' }
async function markState(dataset, latestBizDate, rowCount, srcFile) {
  await pool.query(
    `INSERT INTO refresh_state (dataset, latest_biz_date, row_count, src_file) VALUES (?,?,?,?)
     ON DUPLICATE KEY UPDATE latest_biz_date=GREATEST(COALESCE(latest_biz_date,'2000-01-01'),VALUES(latest_biz_date)), src_file=VALUES(src_file)`,
    [dataset, latestBizDate, rowCount, path.basename(srcFile)],
  )
  // row_count 以表内真实行数为准，重跑不累加
  try {
    const [[{ c }]] = await pool.query(`SELECT COUNT(*) c FROM \`${TABLE_OF[dataset]}\``)
    await pool.query(`UPDATE refresh_state SET row_count=? WHERE dataset=?`, [c, dataset])
  } catch {}
}

// ---- 各数据集 ----
const importers = {
  async traffic(file) {
    const rows = readSheet(file, 'data')
    const H = rows[0]
    const data = []
    const stores = []
    let skippedPeriod = 0
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i]
      if (!r || r[0] == null || r[0] === '') continue
      const g = classifyDate(r[0])
      if (!g) continue
      if (g.grain === 'period') { skippedPeriod += 1; continue }
      const o = Object.fromEntries(H.map((h, j) => [h, r[j]]))
      if (o.来源分类 && !['分平台渠道', '淘宝闪购APP内渠道'].includes(String(o.来源分类).trim())) {
        throw new Error(`未知来源分类（看板不认）：${o.来源分类}`)
      }
      data.push([g.day, String(o.门店id || ''), o.门店名称 || '', o.城市名称 || '', o.来源分类 || '', o.来源名称 || '', toInt(o.曝光人数), toInt(o.进店人数), toInt(o.下单人数), toNum(o.进店转化率), toNum(o.下单转化率), toNum(o.整体转化率)])
      stores.push(o.门店名称)
    }
    if (!data.length) throw new Error(`拒绝入库：${path.basename(file)} 无按日明细行（混入汇总 ${skippedPeriod} 行或纯汇总文件）`)
    if (skippedPeriod) console.log(`[traffic] 跳过周期汇总行 ${skippedPeriod} 行，保留日明细`)
    const conn = await pool.getConnection()
    try { await touchStore(conn, stores) } finally { conn.release() }
    const n = await upsert('fact_traffic_daily', ['biz_date', 'store_id', 'store_name', 'city', 'source_category', 'source_name', 'exposure', 'visitors', 'orders', 'visit_conv', 'order_conv', 'overall_conv'], data)
    await markState('traffic', maxDate(data, 0), data.length, file)
    return n
  },
  async product(file) {
    const rows = readSheet(file, 'data')
    const H = rows[0]
    const data = []
    const stores = []
    let skippedPeriod = 0
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i]
      if (!r || r[0] == null || r[0] === '') continue
      const g = classifyDate(r[0])
      if (!g) continue
      if (g.grain === 'period') { skippedPeriod += 1; continue }
      const o = Object.fromEntries(H.map((h, j) => [h, r[j]]))
      data.push([g.day, String(o.门店id || ''), o.门店名称 || '', toInt(o.在架商品数), toInt(o.可售商品数), toInt(o.动销商品数), toInt(o.缺货商品数), toInt(o.退款商品数), toInt(o.差评商品数), toNum(o.商品出勤率), toInt(o.缺勤商品数), toNum(o.缺勤商品损失金额)])
      stores.push(o.门店名称)
    }
    if (!data.length) throw new Error(`拒绝入库：${path.basename(file)} 无按日明细行（纯汇总文件）`)
    if (skippedPeriod) console.log(`[product] 跳过周期汇总行 ${skippedPeriod} 行，保留日明细`)
    const conn = await pool.getConnection()
    try { await touchStore(conn, stores) } finally { conn.release() }
    const n = await upsert('fact_product_store_daily', ['biz_date', 'store_id', 'store_name', 'on_shelf', 'saleable', 'active_goods', 'oos_goods', 'refund_goods', 'bad_review_goods', 'attendance_rate', 'absent_cnt', 'absent_loss'], data)
    await markState('product', maxDate(data, 0), data.length, file)
    return n
  },
  async reverse(file) {
    const rows = readSheet(file, 'data')
    const H = rows[0]
    const data = []
    const stores = []
    let skippedPeriod = 0
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i]
      if (!r || r[8] == null || r[8] === '') continue
      const g = classifyDate(r[0])
      if (g && g.grain === 'period') { skippedPeriod += 1; continue }
      const o = Object.fromEntries(H.map((h, j) => [h, r[j]]))
      data.push([String(o.订单id), o.逆向单类型 || '', String(o.退货商品ID || ''), (g && g.day) || toDate(o.日期), o.总管名称 || '', o.供应商名称 || '', o.商户名称 || '', String(o.商户id || ''), o.城市名称 || '', toNum(o.订单成交金额), toDate(o.订单日期), o.退货商品名称 || '', String(o.退货商品条码 || ''), o.一级类目 || '', o.二级类目 || '', o.三级类目 || '', toNum(o.退货商品金额), toDateTime(o.逆向单发起日期), o.逆向单原因 || '', toDateTime(o.订单拣货完成时间), toDateTime(o.订单送货完成时间)])
      stores.push(o.商户名称)
    }
    if (!data.length) throw new Error(`拒绝入库：${path.basename(file)} 无按日明细行（纯汇总文件）`)
    if (skippedPeriod) console.log(`[reverse] 跳过周期汇总行 ${skippedPeriod} 行，保留日明细`)
    const conn = await pool.getConnection()
    try { await touchStore(conn, stores) } finally { conn.release() }
    const n = await upsert('fact_reverse_order', ['order_id', 'reverse_type', 'return_sku_id', 'biz_date', 'manager_name', 'supplier_name', 'store_name', 'store_id', 'city', 'order_amount', 'order_date', 'return_sku_name', 'return_barcode', 'cat1', 'cat2', 'cat3', 'return_amount', 'reverse_start_date', 'reverse_reason', 'pick_done_time', 'deliver_done_time'], data)
    await markState('reverse', maxDate(data, 3), data.length, file)
    return n
  },
  async ax_business(file) {
    const rows = readSheet(file, 'data')
    const H = rows[0]
    const data = []
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i]
      if (!r || r[1] == null || r[1] === '') continue
      const o = Object.fromEntries(H.map((h, j) => [h, r[j]]))
      const metrics = {}
      for (const h of H.slice(3)) metrics[h] = typeof r[H.indexOf(h)] === 'number' ? r[H.indexOf(h)] : String(r[H.indexOf(h)] ?? '')
      data.push([toDate(o.日期), o.渠道 || '', o.门店 || '', JSON.stringify(metrics)])
    }
    const usable = data.filter(([, , , raw]) => {
      const metrics = JSON.parse(raw)
      return metrics['有效订单量'] != null && metrics['有效订单金额（实付）'] != null && metrics['预计毛利'] != null
    }).length
    if (!data.length || usable < Math.max(1, Math.floor(data.length * 0.9))) {
      throw new Error(`拒绝入库：${path.basename(file)} 经营指标不完整（${usable}/${data.length} 行含订单、实付和毛利）`)
    }
    const conn = await pool.getConnection()
    try { await touchStore(conn, data.map((d) => d[2])) } finally { conn.release() }
    const n = await upsert('fact_ax_business_daily', ['biz_date', 'channel', 'store_name', 'metrics'], data)
    await markState('ax_business', maxDate(data, 0), data.length, file)
    return n
  },
  async ax_profit(file, bizDate) {
    const rows = readSheet(file, 'data')
    const H = rows[0]
    const bd = bizDateFromFile(file) || bizDate || prevDay(exportDate(file))
    const data = []
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i]
      if (!r || r[0] == null || r[0] === '') continue
      const metrics = {}
      for (let j = 1; j < H.length; j++) metrics[H[j]] = r[j] ?? null
      data.push([bd, String(r[0]), JSON.stringify(metrics, (k, v) => (typeof v === 'undefined' ? null : v))])
    }
    const conn = await pool.getConnection()
    try { await touchStore(conn, data.map((d) => d[1])) } finally { conn.release() }
    const n = await upsert('fact_ax_profit_store', ['biz_date', 'store_name', 'metrics'], data)
    await markState('ax_profit', bd, data.length, file)
    return n
  },
  async ax_margin(file) {
    const rows = readSheet(file, rows0(file))
    const H = rows[0]
    const data = []
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i]
      if (!r || r[3] == null || r[3] === '') continue
      const o = Object.fromEntries(H.map((h, j) => [h, r[j]]))
      const extra = {}
      for (const h of H) {
        if (!['门店名称', '门店编码', '渠道名称', '订单编码', '创建时间', '应收', '成本', '预计毛利', '结算金额', '退款单号', '订单完成时间', '订单状态'].includes(h)) extra[h] = o[h] ?? null
      }
      data.push([String(o.订单编码), o.门店名称 || '', String(o.门店编码 || ''), o.渠道名称 || '', toDateTime(o.创建时间), toNum(o.应收), toNum(o.成本), toNum(o.预计毛利), toNum(o.结算金额), String(o.退款单号 || ''), toDateTime(o.订单完成时间), o.订单状态 || '', JSON.stringify(extra, (k, v) => (typeof v === 'undefined' ? null : v))])
    }
    const conn = await pool.getConnection()
    try { await touchStore(conn, data.map((d) => d[1])) } finally { conn.release() }
    const n = await upsert('fact_ax_order_margin', ['order_code', 'store_name', 'store_code', 'channel', 'created_time', 'receivable', 'cost', 'est_profit', 'settle_amount', 'refund_no', 'finish_time', 'order_status', 'extra'], data)
    await markState('ax_margin', maxDateTime(data, 4), data.length, file)
    return n
  },
  async item_period(file) {
    // 按商品明细只有周期汇总（日期列形如 20260823-20260921），专表存放，不进日趋势表
    const rows = readSheet(file, 'data')
    const H = rows[0]
    const data = []
    const stores = []
    let bounds = null
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i]
      if (!r || r[3] == null || r[3] === '') continue
      const g = classifyDate(r[0])
      if (!g || g.grain !== 'period') continue
      bounds = [g.from, g.to]
      const o = Object.fromEntries(H.map((h, j) => [h, r[j]]))
      data.push([g.from, g.to, String(o.门店id || ''), o.门店名称 || '', String(o.商品id || ''), String(o.商品名称 || '').slice(0, 500), o.一级分类 || '', o.二级分类 || '', o.三级分类 || '', toNum(o.原价销售额), toNum(o.实际销售额), toInt(o.销量), toInt(o['销量(不含退款)']), toInt(o.带来订单量), toInt(o.下单用户数), toNum(o.订单交易额), toInt(o.退款数量), toNum(o.退款金额), toInt(o.退款单量), toInt(o.缺货次数), toInt(o.缺货导致的流失订单数), toInt(o.缺货导致的取消订单数), toInt(o.缺货导致的整单退订单数), toInt(o.缺货导致的部分退订单数), toNum(o.缺货导致的流失单预计损失), toNum(o.缺货导致的取消单预计损失), toNum(o.缺货导致的整单退预计损失), toNum(o.缺货导致的部分退预计损失)])
      stores.push(o.门店名称)
    }
    if (!data.length) throw new Error(`拒绝入库：${path.basename(file)} 无周期汇总行`)
    const conn = await pool.getConnection()
    try { await touchStore(conn, stores) } finally { conn.release() }
    const n = await upsert('fact_product_item_period', ['period_from', 'period_to', 'store_id', 'store_name', 'item_id', 'item_name', 'cat1', 'cat2', 'cat3', 'list_sales', 'actual_sales', 'qty', 'qty_norefund', 'bring_orders', 'order_buyers', 'order_gmv', 'refund_qty', 'refund_amount', 'refund_orders', 'oos_times', 'oos_lost_orders', 'oos_cancel_orders', 'oos_full_refund_orders', 'oos_part_refund_orders', 'oos_lost_loss', 'oos_cancel_loss', 'oos_full_refund_loss', 'oos_part_refund_loss'], data)
    await markState('item_period', bounds[1], data.length, file)
    return n
  },
  async ax_quality(file, bizDate) {    const rows = readSheet(file, 'data')
    const H = rows[0]
    const fallback = bizDateFromFile(file) || bizDate || prevDay(exportDate(file))
    const data = []
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i]
      if (!r || r[0] == null || r[0] === '') continue
      const o = Object.fromEntries(H.map((h, j) => [h, r[j]]))
      // 有日期列（桥接合并后的历史文件）就按行日期，无则用 --date/导出前一天
      const bd = (H.includes('日期') && toDate(o.日期)) || fallback
      data.push([bd, o.门店名称 || '', String(o.门店编码 || ''), toNum(o.动销商品售罄率), toNum(o.错漏拣率), toNum(o.仓T), toNum(o['IM 3分钟回复率']), toNum(o.商责问题订单率), toNum(o.店铺分)])
    }
    if (!data.length) throw new Error(`拒绝入库：${path.basename(file)} 无有效行`)
    const conn = await pool.getConnection()
    try { await touchStore(conn, data.map((d) => d[1])) } finally { conn.release() }
    const n = await upsert('fact_store_quality_daily', ['biz_date', 'store_name', 'store_code', 'sellout_rate', 'pick_error_rate', 'warehouse_t', 'im_reply_rate', 'merchant_issue_rate', 'shop_score'], data)
    await markState('ax_quality', maxDate(data, 0), data.length, file)
    return n
  },
}
function rows0(file) {
  const wb = XLSX.readFile(file)
  return wb.SheetNames[0]
}
function maxDate(data, i) {
  let m = null
  for (const d of data) if (d[i] && (!m || d[i] > m)) m = d[i]
  return m
}
function maxDateTime(data, i) {
  let m = null
  for (const d of data) {
    const v = d[i] ? String(d[i]).slice(0, 10) : null
    if (v && (!m || v > m)) m = v
  }
  return m
}
function bizDateFromFile(file) {
  const m = path.basename(file).match(/_BIZ-(\d{4}-\d{2}-\d{2})/)
  return m ? m[1] : null
}
function prevDay(iso) {
  if (!iso) return null
  const d = new Date(iso + 'T12:00:00')
  d.setDate(d.getDate() - 1)
  return d.toISOString().slice(0, 10)
}
// 粒度判定（与看板 sync-traffic-data.py 同口径）：YYYYMMDD→day；
// YYYYMMDD-YYYYMMDD 起止相同→day，起止不同→period。
// 日明细+汇总混排→跳过汇总行；纯 period 多周期→抛错拒绝入库；单周期汇总→返回 period  bounds 由调用方决定。
function classifyDate(v) {
  if (v == null) return null
  const s = String(v).trim()
  let m = s.match(/^(\d{4})(\d{2})(\d{2})$/)
  if (m) return { grain: 'day', day: `${m[1]}-${m[2]}-${m[3]}` }
  m = s.match(/^(\d{4}-\d{2}-\d{2})/)
  if (m) return { grain: 'day', day: m[1] }
  m = s.match(/^(\d{8})-(\d{8})$/)
  if (m) {
    const f = `${m[1].slice(0, 4)}-${m[1].slice(4, 6)}-${m[1].slice(6, 8)}`
    const t = `${m[2].slice(0, 4)}-${m[2].slice(4, 6)}-${m[2].slice(6, 8)}`
    if (f > t) throw new Error(`日期周期起止顺序错误：${s}`)
    if (f === t) return { grain: 'day', day: f }
    return { grain: 'period', from: f, to: t }
  }
  return null
}
function latestAll(dir, test) {
  try {
    return fs.readdirSync(path.join(ROOT, dir))
      .filter((f) => f.endsWith('.xlsx') && (!test || test(f)))
      .sort()
      .map((f) => path.join(ROOT, dir, f))
  } catch { return [] }
}
function latest(dir, test) {
  try {
    // 文件名可能带的是查询起止日期，不代表导出时间。例如 8/31-9/29 的新文件
    // 按名称会被 9/20-9/21 的旧文件覆盖，故以归档修改时间选择最近一次导出。
    const base = path.join(ROOT, dir)
    const files = fs.readdirSync(base)
      .filter((f) => f.endsWith('.xlsx') && (!test || test(f)))
      .map((f) => ({ file: f, mtime: fs.statSync(path.join(base, f)).mtimeMs }))
      .sort((a, b) => b.mtime - a.mtime || b.file.localeCompare(a.file))
    return files.length ? path.join(base, files[0].file) : null
  } catch { return null }
}

// ---- 入口 ----
const dataset = getArg('dataset') || 'all'
const fileArg = getArg('file')
const bizDate = getArg('date') || null
const jobs = []
if (dataset === 'all' || dataset === 'traffic') {
  const f = fileArg && dataset !== 'all' ? fileArg : latest('output/nr-download-center', (x) => x.startsWith('流量'))
  if (f) jobs.push(['traffic', f])
}
if (dataset === 'all' || dataset === 'product') {
  const f = fileArg && dataset !== 'all' ? fileArg : latest('output/nr-download-center', (x) => x.startsWith('商品数据'))
  if (f) jobs.push(['product', f])
}
if (dataset === 'all' || dataset === 'reverse') {
  const f = fileArg && dataset !== 'all' ? fileArg : latest('output/nr-download-center', (x) => x.startsWith('异常'))
  if (f) jobs.push(['reverse', f])
}
if (dataset === 'all' || dataset === 'item_period') {
  const f = fileArg && dataset !== 'all' ? fileArg : latest('output/nr-download-center-keep', (x) => x.includes('按商品明细'))
  if (f) jobs.push(['item_period', f])
}
if (dataset === 'all' || dataset === 'ax_business') {
  if (fileArg && dataset !== 'all') jobs.push(['ax_business', fileArg])
  else {
    const files = latestAll('output/aixiang', (x) => x.endsWith('.xlsx'))
    files.forEach((f) => jobs.push(['ax_business', f]))
  }
}
if (dataset === 'all' || dataset === 'ax_profit') {
  if (fileArg && dataset !== 'all') jobs.push(['ax_profit', fileArg])
  else {
    // 先补齐历史单日文件，再导入最新实时导出。两类文件不能二选一：
    // _BIZ-* 只覆盖回填期，非 BIZ 文件才包含当天最新导出。
    const batch = latestAll('output/aixiang-profit', (x) => x.includes('_BIZ-'))
    batch.forEach((f) => jobs.push(['ax_profit', f]))
    const f = latest('output/aixiang-profit', (x) => !x.includes('_BIZ-'))
    if (f) jobs.push(['ax_profit', f])
  }
}
if (dataset === 'all' || dataset === 'ax_margin') {
  const f = latest('output/aixiang-order-margin', (x) => x.endsWith('.xlsx'))
  if (f) jobs.push(['ax_margin', f])
}
if (dataset === 'all' || dataset === 'ax_quality') {
  if (fileArg && dataset !== 'all') jobs.push(['ax_quality', fileArg])
  else {
    const batch = latestAll('output/aixiang-warehouse', (x) => x.includes('_BIZ-'))
    batch.forEach((f) => jobs.push(['ax_quality', f]))
    const f = latest('output/aixiang-warehouse', (x) => !x.includes('_BIZ-'))
    if (f) jobs.push(['ax_quality', f])
  }
}
if (!jobs.length) {
  console.error('没有可入库的文件（检查 output/ 下归档）')
  process.exit(1)
}
let total = 0
for (const [ds, f] of jobs) {
  const n = await importers[ds](f, bizDate)
  total += n
  console.log(`[${ds}] ${path.basename(f)} → affectedRows(含更新) ${n}`)
}
console.log(`完成：${jobs.length} 个数据集，affectedRows ${total}`)
// 门店维表城市回填（fact 表有城市，dim 表见名收名时没有）：每次入库后对齐
try {
  const normSql = `CONCAT('S:', REPLACE(REPLACE(REPLACE(t.store_name, '（', '('), '）', ')'), ' ', ''))`
  await pool.query(`UPDATE dim_store d JOIN (SELECT DISTINCT store_name, city FROM fact_traffic_daily WHERE city <> '') t ON d.store_key = ${normSql} SET d.city = t.city WHERE d.city = '' OR d.city IS NULL`)
  await pool.query(`UPDATE dim_store d JOIN (SELECT DISTINCT store_name, city FROM fact_reverse_order WHERE city <> '') t ON d.store_key = ${normSql} SET d.city = t.city WHERE d.city = '' OR d.city IS NULL`)
} catch (e) {
  console.log('[dim_store] 城市回填跳过:', String(e).slice(0, 120))
}
// 归档：订单毛利在线只留 180 天，超期整行迁入 archive 表（细则不变）
if (jobs.some(([ds]) => ds === 'ax_margin')) {
  const pool2 = mysql.createPool({ host: env.DB_HOST || '127.0.0.1', port: Number(env.DB_PORT || 3306), user: env.DB_USER || 'root', password: env.DB_PASSWORD || '', database: env.DB_NAME || 'taobian', connectionLimit: 2 })
  try {
    await pool2.query(`CREATE TABLE IF NOT EXISTS fact_ax_order_margin_archive LIKE fact_ax_order_margin`)
    const [moved] = await pool2.query(`INSERT INTO fact_ax_order_margin_archive SELECT * FROM fact_ax_order_margin WHERE created_time < CURDATE() - INTERVAL 180 DAY ON DUPLICATE KEY UPDATE order_code=VALUES(order_code)`)
    await pool2.query(`DELETE FROM fact_ax_order_margin WHERE created_time < CURDATE() - INTERVAL 180 DAY`)
    console.log(`[archive] 订单毛利超 180 天归档 ${moved.affectedRows} 行`)
    const [[{ c }]] = await pool2.query(`SELECT COUNT(*) c FROM fact_ax_order_margin_archive`)
    await pool2.query(`INSERT INTO refresh_state (dataset, latest_biz_date, row_count, src_file) VALUES ('ax_margin_archive', CURDATE(), ?, 'auto') ON DUPLICATE KEY UPDATE row_count=VALUES(row_count)`, [c])
  } finally {
    await pool2.end()
  }
}
await pool.end()
