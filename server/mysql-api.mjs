/** MySQL 直连 API（看板/大屏运行时现查，刷新即最新，无需重新构建）。
 * 启动：node server/mysql-api.mjs [port=8787]   （vite 已把 /api 代理到 127.0.0.1:8787）
 * 连接：复用 automation/.env 的 DB_*（DB_HOST/DB_PORT/DB_USER/DB_PASSWORD/DB_NAME）。
 * 契约见 server/API-CONTRACT-v1.md。缺值一律 null；比率小数；日期 ISO。
 */
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { ASSESS_DEFS, GRADE_RULES, aggregateRows, boardFromRows, displayValue, isPass, scoreRow } from './server/src/scoring.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const PORT = Number(process.argv[2] || process.env.API_PORT || 8787)

// mysql2 装在 automation/node_modules（本机唯一的 node 依赖目录），server 侧零安装复用
const require = createRequire(import.meta.url)
function loadMysql() {
  for (const p of [
    path.join(ROOT, 'automation/node_modules/mysql2/promise.js'),
    path.join(ROOT, 'node_modules/mysql2/promise.js'),
    path.join(ROOT, 'server/node_modules/mysql2/promise.js'),
  ]) {
    try { if (fs.existsSync(p)) return require(p) } catch {}
  }
  try { return require('mysql2/promise') } catch {}
  throw new Error('找不到 mysql2，请先在 automation/ 下 npm i mysql2')
}
const mysql = loadMysql()

function loadEnv() {
  const out = {}
  for (const f of [path.join(ROOT, 'automation/.env'), path.join(ROOT, 'server/.env')]) {
    try {
      for (const line of fs.readFileSync(f, 'utf8').split('\n')) {
        const m = line.match(/^\s*([A-Z_]+)=(.*)\s*$/)
        if (m) out[m[1]] = m[2].trim()
      }
    } catch {}
  }
  return out
}
const env = loadEnv()
const pool = mysql.createPool({
  host: env.DB_HOST || '127.0.0.1',
  port: Number(env.DB_PORT || 3306),
  user: env.DB_USER || 'root',
  password: env.DB_PASSWORD || '',
  database: env.DB_NAME || 'dashboard',
  connectionLimit: 8,
  dateStrings: true,
})

// ---- 与前端 source1.ts 同口径的工具 ----
const normStore = (s) => String(s || '').replace(/（/g, '(').replace(/）/g, ')').replace(/\s+/g, '').trim()
const PREFECTURE = ['杭州', '苏州', '南通', '上海', '武汉', '无锡', '金华', '济南', '郑州', '扬州', '泰州', '淮安', '南京', '青岛']
function canonCity(raw) {
  const s = String(raw || '').trim()
  if (!s || s === '全国') return s
  if (s.includes('昆山')) return '苏州市'
  if (s.includes('姜堰')) return '泰州市'
  const compact = s.replace(/市/g, '')
  const hit = PREFECTURE.find((c) => compact === c || compact.startsWith(c))
  if (hit) return `${hit}市`
  if (!compact) return s
  return /市$/.test(s) ? s : `${compact}市`
}
const BAD_STORE = /^(门店|门店名称)$|模板店|优沃森超市/
const J = (v) => (typeof v === 'string' ? JSON.parse(v) : v)
const N = (v) => {
  if (v == null || v === '') return null
  const n = typeof v === 'number' ? v : Number(String(v).replace(/,/g, '').replace(/%$/, ''))
  if (!Number.isFinite(n)) return null
  if (typeof v === 'string' && v.trim().endsWith('%')) return n / 100
  return n
}
// 翱象经营下钻 metrics键 → Fact字段（与 sync-source1.mjs 同映射）
function toFact(channel, store, date, m) {
  return {
    date, channel, store,
    turnover: N(m['总营业额']),
    onlineRevenue: N(m['预计线上收入']),
    profit: N(m['预计毛利(含平台后返)']),
    marginRate: N(m['毛利率(含平台后返)']),
    unitProfit: N(m['单均毛利(含平台后返)']),
    paid: N(m['有效订单金额（实付）']),
    orders: N(m['有效订单量']),
    refundRate: N(m['退款率']),
    refundOrders: N(m['退款订单量']),
  }
}
function sumNum(rows, f) {
  let t = 0, n = 0
  for (const r of rows) {
    const v = r[f]
    if (v == null || Number.isNaN(v)) continue
    t += v; n++
  }
  return n ? t : null
}
function weightedAvg(rows, vf, wf) {
  let nn = 0, dd = 0, ps = 0, pn = 0
  for (const r of rows) {
    const v = vf(r)
    if (v == null || Number.isNaN(v)) continue
    ps += v; pn++
    const w = wf(r)
    if (w != null && w > 0 && !Number.isNaN(w)) { nn += v * w; dd += w }
  }
  if (dd) return nn / dd
  if (pn) return ps / pn
  return null
}
const rateWeight = (r) => {
  for (const f of ['turnover', 'onlineRevenue', 'paid']) {
    if (r[f] != null && r[f] !== 0) return Math.abs(r[f])
  }
  return null
}
function sumRows(rows) {
  const r2 = (v) => (v == null ? null : Math.round(v * 100) / 100)
  const profit = sumNum(rows, 'profit')
  const paid = sumNum(rows, 'paid')
  const turnover = sumNum(rows, 'turnover')
  const onlineRevenue = sumNum(rows, 'onlineRevenue')
  const orders = sumNum(rows, 'orders')
  const refundOrders = sumNum(rows, 'refundOrders')
  return {
    profit: r2(profit), paid: r2(paid), turnover: r2(turnover), onlineRevenue: r2(onlineRevenue), orders, refundOrders,
    profitRate: weightedAvg(rows, (r) => r.marginRate, rateWeight),
    arpu: paid != null && orders != null && orders !== 0 ? Math.round((paid / orders) * 100) / 100 : null,
    unitProfit: weightedAvg(rows, (r) => r.unitProfit, (r) => r.orders),
    refundRate: weightedAvg(rows, (r) => r.refundRate, (r) => r.orders),
  }
}
// 筛选：city/channel/store（store 支持逗号多选），store 归一匹配，city 规范匹配
function makeFilter(q, cityOf) {
  const cities = String(q.city || '全国').split(',').map((s) => s.trim()).filter(Boolean)
  const allCity = !cities.length || cities.some((c) => ['全国', '全部', 'all'].includes(c))
  const channels = String(q.channel || '全部').split(',').map((s) => s.trim()).filter(Boolean)
  const allCh = !channels.length || channels.includes('全部')
  const stores = String(q.store || '全部').split(',').map((s) => s.trim()).filter(Boolean)
  const allSt = !stores.length || stores.includes('全部')
  const storeSet = new Set(stores.map(normStore))
  return (r) => {
    if (q.from && r.date < q.from) return false
    if (q.to && r.date > q.to) return false
    if (!allCh && !channels.includes(r.channel)) return false
    if (!allSt && !storeSet.has(normStore(r.store))) return false
    if (!allCity) {
      const c = canonCity(cityOf(r.store) || '')
      if (!cities.some((x) => canonCity(x) === c)) return false
    }
    return true
  }
}
function fold(rows, keyOf) {
  const g = new Map()
  for (const r of rows) {
    const k = keyOf(r)
    if (!k) continue
    if (!g.has(k)) g.set(k, [])
    g.get(k).push(r)
  }
  return [...g.entries()].map(([key, group]) => {
    const lastDate = group.reduce((m, r) => (r.date > m ? r.date : m), '')
    return { key, lastDate, ...sumRows(group) }
  })
}
// 门店→城市：launch表优先，dim_store兜底
let cityCache = null
async function cityMap() {
  if (cityCache) return cityCache
  const m = new Map()
  try {
    const [rows] = await pool.query(`SELECT store_name, city FROM dim_store_launch`)
    for (const r of rows) if (r.city) m.set(normStore(r.store_name), r.city)
  } catch {}
  const [rows] = await pool.query(`SELECT store_name, city FROM dim_store WHERE city <> ''`)
  for (const r of rows) {
    const k = normStore(r.store_name)
    if (!m.has(k)) m.set(k, r.city)
  }
  cityCache = m
  setTimeout(() => { cityCache = null }, 60000)
  return m
}
async function loadFacts() {
  const [rows] = await pool.query(
    `SELECT DATE_FORMAT(biz_date,'%Y-%m-%d') d, channel, store_name, metrics FROM fact_ax_business_daily`)
  return rows.filter((r) => !BAD_STORE.test(r.store_name)).map((r) => toFact(r.channel, r.store_name, r.d, J(r.metrics)))
}
async function loadSupply() {
  const [rows] = await pool.query(
    `SELECT DATE_FORMAT(biz_date,'%Y-%m-%d') d, store_name, on_shelf, saleable, active_goods, oos_goods, refund_goods, bad_review_goods, attendance_rate, absent_cnt, absent_loss FROM fact_product_store_daily`)
  return rows.filter((r) => !BAD_STORE.test(r.store_name)).map((r) => ({
    date: r.d, store: r.store_name,
    onShelf: r.on_shelf, sellable: r.saleable, moving: r.active_goods, stockout: r.oos_goods,
    refundSku: r.refund_goods, badSku: r.bad_review_goods, attendance: r.attendance_rate != null ? Number(r.attendance_rate) : null,
    absent: r.absent_cnt, absentLoss: r.absent_loss != null ? Number(r.absent_loss) : null,
  }))
}

// ---- 路由 ----
const routes = {
  '/api/health': async () => ({ ok: true, time: new Date().toISOString() }),
  '/api/meta/refresh-state': async () => {
    const [rows] = await pool.query(`SELECT dataset, updated_at, DATE_FORMAT(latest_biz_date,'%Y-%m-%d') latest_biz_date, row_count, src_file FROM refresh_state ORDER BY dataset`)
    return rows
  },
  '/api/meta/days': async (q) => {
    const t = { business: 'fact_ax_business_daily', supply: 'fact_product_store_daily', profit: 'fact_ax_profit_store' }[q.dataset || 'business'] || 'fact_ax_business_daily'
    const [rows] = await pool.query(`SELECT DISTINCT DATE_FORMAT(biz_date,'%Y-%m-%d') d FROM \`${t}\` ORDER BY d`)
    return { days: rows.map((r) => r.d) }
  },
  '/api/meta/stores': async () => {
    const [rows] = await pool.query(`SELECT store_name name, store_code code, city, platform FROM dim_store ORDER BY store_name`)
    return rows.filter((r) => !BAD_STORE.test(r.name))
  },
  '/api/kpi': async (q) => {
    const cm = await cityMap()
    const rows = (await loadFacts()).filter(makeFilter(q, (s) => cm.get(normStore(s))))
    const t = sumRows(rows)
    const stores = new Set(rows.map((r) => normStore(r.store)))
    const lossStores = [...fold(rows, (r) => normStore(r.store))].filter((r) => r.profit != null && r.profit < 0).length
    return { ...t, stores: stores.size, lossStores: rows.length ? lossStores : null }
  },
  '/api/trend': async (q) => {
    const cm = await cityMap()
    const rows = (await loadFacts()).filter(makeFilter({ ...q, from: '', to: '' }, (s) => cm.get(normStore(s))))
    const byDay = fold(rows, (r) => r.date).sort((a, b) => a.key.localeCompare(b.key))
    const out = byDay.filter((r) => (!q.from || r.key >= q.from) && (!q.to || r.key <= q.to))
      .map((r) => ({ date: r.key, ...sumRows(rows.filter((x) => x.date === r.key)) }))
    return out
  },
  '/api/group/city': async (q) => {
    const cm = await cityMap()
    const rows = (await loadFacts()).filter(makeFilter(q, (s) => cm.get(normStore(s))))
    return fold(rows, (r) => canonCity(cm.get(normStore(r.store)) || '')).filter((r) => r.key)
      .map((r) => ({ city: r.key, ...r }))
  },
  '/api/group/channel': async (q) => {
    const cm = await cityMap()
    const rows = (await loadFacts()).filter(makeFilter(q, (s) => cm.get(normStore(s))))
    return fold(rows, (r) => r.channel).map((r) => ({ channel: r.key, ...r }))
  },
  '/api/group/store': async (q) => {
    const cm = await cityMap()
    const rows = (await loadFacts()).filter(makeFilter(q, (s) => cm.get(normStore(s))))
    return fold(rows, (r) => r.store).map((r) => ({ store: r.key, city: cm.get(normStore(r.key)) || '', ...r }))
  },
  '/api/risk': async (q) => {
    const cm = await cityMap()
    const f = makeFilter(q, (s) => cm.get(normStore(s)))
    const facts = (await loadFacts()).filter(f)
    const out = []
    for (const row of fold(facts, (r) => `${r.store}	${r.channel}`)) {
      const [store, channel] = row.key.split('	')
      if (row.profit != null && row.profit < 0) {
        out.push({ key: store, city: cm.get(normStore(store)) || '', channel, type: '毛利为负', impact: Math.abs(row.profit), profit: row.profit, refundRate: row.refundRate, refundOrders: row.refundOrders, asOf: row.lastDate || q.to || '' })
      }
      if (row.refundRate != null && row.refundRate >= 0.05) {
        out.push({ key: store, city: cm.get(normStore(store)) || '', channel, type: '退款偏高', impact: row.refundOrders ?? row.refundRate, profit: row.profit, refundRate: row.refundRate, refundOrders: row.refundOrders, asOf: row.lastDate || q.to || '' })
      }
    }
    const supply = (await loadSupply()).filter(f)
    const byStore = new Map()
    for (const r of supply) {
      if (!byStore.has(r.store)) byStore.set(r.store, [])
      byStore.get(r.store).push(r)
    }
    for (const [store, rs] of byStore) {
      const atts = rs.map((r) => r.attendance).filter((v) => v != null)
      const att = atts.length ? atts.reduce((a, b) => a + b, 0) / atts.length : null
      const loss = rs.reduce((a, r) => a + (r.absentLoss || 0), 0)
      if ((att != null && att < 0.85) || loss > 0) {
        out.push({ key: store, city: cm.get(normStore(store)) || '', channel: '', type: '缺货偏高', impact: loss, profit: null, refundRate: null, refundOrders: null, asOf: rs.reduce((m, r) => (r.date > m ? r.date : m), ''), attendance: att, stockout: rs.reduce((a, r) => a + (r.stockout || 0), 0) })
      }
    }
    return out.sort((a, b) => b.impact - a.impact)
  },
  '/api/map/cities': async (q) => {
    const cm = await cityMap()
    const rows = (await loadFacts()).filter(makeFilter(q, (s) => cm.get(normStore(s))))
    const g = new Map()
    for (const r of fold(rows, (x) => canonCity(cm.get(normStore(x.store)) || ''))) {
      if (!r.key) continue
      g.set(r.key, r)
    }
    return [...g.entries()].map(([city, r]) => ({ city, ...r }))
  },
  '/api/supply/stores': async (q) => {
    const cm = await cityMap()
    const rows = (await loadSupply()).filter(makeFilter(q, (s) => cm.get(normStore(s))))
    const g = new Map()
    for (const r of rows) {
      if (!g.has(r.store)) g.set(r.store, [])
      g.get(r.store).push(r)
    }
    return [...g.entries()].map(([store, rs]) => {
      const atts = rs.map((r) => r.attendance).filter((v) => v != null)
      return {
        store, city: cm.get(normStore(store)) || '',
        attendance: atts.length ? atts.reduce((a, b) => a + b, 0) / atts.length : null,
        stockout: rs.reduce((a, r) => a + (r.stockout || 0), 0),
        absentLoss: rs.reduce((a, r) => a + (r.absentLoss || 0), 0),
        moving: rs.reduce((a, r) => a + (r.moving || 0), 0),
        lastDate: rs.reduce((m, r) => (r.date > m ? r.date : m), ''),
      }
    }).sort((a, b) => b.absentLoss - a.absentLoss)
  },
  '/api/cost/summary': async (q) => {
    // 收支构成：metrics 的 收入/*/支出/* 键按区间加总（后返活动期判断由前端 rebateEffectiveInRange 保留）
    const cm = await cityMap()
    const f = makeFilter(q, (s) => cm.get(normStore(s)))
    const [rows] = await pool.query(`SELECT DATE_FORMAT(biz_date,'%Y-%m-%d') d, channel, store_name, metrics FROM fact_ax_business_daily`)
    const inc = {}, exp = {}
    let n = 0
    for (const r of rows) {
      const m = J(r.metrics)
      const row = { date: r.d, channel: r.channel, store: r.store_name }
      if (!f(row) || BAD_STORE.test(row.store)) continue
      n++
      for (const [k, v] of Object.entries(m)) {
        const num = N(v)
        if (num == null || /环比|差值/.test(k)) continue
        if (k.startsWith('收入/')) inc[k] = (inc[k] || 0) + num
        else if (k.startsWith('支出/')) exp[k] = (exp[k] || 0) + num
      }
    }
    return { rows: n, income: inc, expense: exp }
  },
  '/api/cost/by-store': async (q) => {
    const cm = await cityMap()
    const f = makeFilter(q, (s) => cm.get(normStore(s)))
    const [rows] = await pool.query(`SELECT DATE_FORMAT(biz_date,'%Y-%m-%d') d, channel, store_name, metrics FROM fact_ax_business_daily`)
    const g = new Map()
    for (const r of rows) {
      const row = { date: r.d, channel: r.channel, store: r.store_name }
      if (!f(row) || BAD_STORE.test(row.store)) continue
      const m = J(r.metrics)
      const cur = g.get(row.store) || { profit: 0, has: false }
      const p = N(m['预计毛利(含平台后返)'])
      if (p != null) { cur.profit += p; cur.has = true }
      g.set(row.store, cur)
    }
    return [...g.entries()].map(([store, v]) => ({ store, profit: v.has ? v.profit : null }))
  },
  '/api/profit/store': async (q) => {
    const cm = await cityMap()
    const f = makeFilter(q, (s) => cm.get(normStore(s)))
    const [rows] = await pool.query(`SELECT DATE_FORMAT(biz_date,'%Y-%m-%d') d, store_name, metrics FROM fact_ax_profit_store`)
    const out = []
    for (const r of rows) {
      const row = { date: r.d, channel: '', store: r.store_name }
      if (!f(row) || BAD_STORE.test(row.store)) continue
      out.push({ date: r.d, store: r.store_name, city: cm.get(normStore(r.store_name)) || '', metrics: J(r.metrics) })
    }
    return out.sort((a, b) => a.date.localeCompare(b.date) || a.store.localeCompare(b.store))
  },
  '/api/launch/by-city': async (q) => {
    const [rows] = await pool.query(`SELECT store_name, city, status, address, is_new FROM dim_store_launch`)
    const cities = String(q.city || '全国').split(',').map((s) => s.trim()).filter(Boolean)
    const allCity = !cities.length || cities.some((c) => ['全国', '全部', 'all'].includes(c))
    const map = new Map()
    for (const s of rows) {
      if (!s.status) continue
      if (!allCity && !cities.some((c) => canonCity(c) === canonCity(s.city))) continue
      const key = canonCity(s.city) || '未标注'
      const cur = map.get(key) || { plan: 0, open: 0 }
      cur.plan++
      if (s.status === '已营业') cur.open++
      map.set(key, cur)
    }
    return [...map.entries()].map(([city, v]) => ({ city, ...v, pending: v.plan - v.open, rate: v.plan ? v.open / v.plan : 0 }))
      .sort((a, b) => b.rate - a.rate || b.open - a.open)
  },
  '/api/launch/stores': async (q) => {
    const [rows] = await pool.query(`SELECT store_name name, city, status, address, is_new isNew FROM dim_store_launch`)
    const kind = q.kind || 'all'
    return rows.filter((s) => {
      if (!s.status) return false
      if (kind === 'open' && s.status !== '已营业') return false
      if (kind === 'pending' && s.status === '已营业') return false
      return true
    })
  },
  '/api/category/top': async (q) => {
    const [rows] = await pool.query(`SELECT period_from, period_to, store_name, cat1, SUM(actual_sales) sales, SUM(qty) qty, SUM(bring_orders) orders, SUM(refund_amount) refundAmt, SUM(oos_lost_loss+oos_cancel_loss+oos_full_refund_loss+oos_part_refund_loss) stockoutLoss, SUM(oos_times) stockoutTimes, COUNT(*) n FROM fact_product_item_period GROUP BY period_from, period_to, store_name, cat1`)
    if (!rows.length) return { from: null, to: null, categories: [] }
    const from = String(rows[0].period_from).slice(0, 10)
    const to = String(rows[0].period_to).slice(0, 10)
    const cm = await cityMap()
    const stores = String(q.store || '全部').split(',').map((s) => s.trim()).filter(Boolean)
    const cities = String(q.city || '全国').split(',').map((s) => s.trim()).filter(Boolean)
    const allSt = !stores.length || stores.includes('全部')
    const allCity = !cities.length || cities.some((c) => ['全国', '全部', 'all'].includes(c))
    const storeSet = new Set(stores.map(normStore))
    const map = new Map()
    for (const r of rows) {
      if (!allSt && !storeSet.has(normStore(r.store_name))) continue
      if (!allCity && !cities.some((c) => canonCity(c) === canonCity(cm.get(normStore(r.store_name)) || ''))) continue
      const cur = map.get(r.cat1) || { name: r.cat1, sales: 0, qty: 0, orders: 0, refundAmt: 0, stockoutLoss: 0, stockoutTimes: 0 }
      const r2 = (v) => Math.round(v * 100) / 100
      cur.sales = r2(cur.sales + (Number(r.sales) || 0))
      cur.qty += Number(r.qty) || 0
      cur.orders += Number(r.orders) || 0
      cur.refundAmt = r2(cur.refundAmt + (Number(r.refundAmt) || 0))
      cur.stockoutLoss = r2(cur.stockoutLoss + (Number(r.stockoutLoss) || 0))
      cur.stockoutTimes += Number(r.stockoutTimes) || 0
      map.set(r.cat1, cur)
    }
    return { from, to, channel: '淘宝闪购', categories: [...map.values()].sort((a, b) => b.sales - a.sales) }
  },
  // ---- 品质考核（前端 qualityDatabase.ts 直调的 MySQL API） ----
  '/api/quality/coverage': async () => {
    const [dates] = await pool.query(`SELECT DATE_FORMAT(biz_date,'%Y-%m-%d') date, COUNT(*) storeCount FROM fact_store_quality_daily GROUP BY biz_date ORDER BY biz_date`)
    const [st] = await pool.query(`SELECT dataset, updated_at, DATE_FORMAT(latest_biz_date,'%Y-%m-%d') latestDate, row_count rowCount FROM refresh_state WHERE dataset='ax_quality'`)
    const [biz] = await pool.query(`SELECT COUNT(*) \`rows\`, DATE_FORMAT(MIN(biz_date),'%Y-%m-%d') dateMin, DATE_FORMAT(MAX(biz_date),'%Y-%m-%d') dateMax FROM fact_ax_business_daily`)
    const qrows = dates.reduce((a, r) => a + Number(r.storeCount), 0)
    return {
      dates, latestDate: dates.length ? dates[dates.length - 1].date : null,
      state: st.length ? { version: Math.floor(new Date(st[0].updated_at).getTime() / 1000), updated_at: st[0].updated_at, latestDate: st[0].latestDate, rowCount: st[0].rowCount } : null,
      sources: [
        { source: 'store_quality', label: '闪购仓门店运营质量表', available: dates.length > 0, rows: qrows, dateMin: dates.length ? dates[0].date : undefined, dateMax: dates.length ? dates[dates.length - 1].date : undefined },
        { source: 'channel_store_period_trend', label: '经营详情·渠道门店周期趋势', available: biz[0].rows > 0, rows: Number(biz[0].rows), dateMin: biz[0].dateMin, dateMax: biz[0].dateMax },
      ],
    }
  },
  '/api/quality/options': async (q) => {
    const p = periodFromKey(q.date || '')
    if (!p) return { cities: ['全部'], stores: [] }
    const [rows] = await pool.query(
      `SELECT q.store_name id, q.store_name shortName, q.store_name name, COALESCE(q.store_code,'') code, COALESCE(l.city, d.city, '') city
       FROM fact_store_quality_daily q
       LEFT JOIN dim_store_launch l ON l.store_name = q.store_name
       LEFT JOIN dim_store d ON d.store_key = CONCAT('S:', REPLACE(REPLACE(REPLACE(q.store_name,'（','('),'）',')'),' ',''))
       WHERE q.biz_date BETWEEN ? AND ? AND (l.status IS NULL OR l.status = '' OR l.status = '已营业')
       GROUP BY q.store_name, q.store_code, l.city, d.city ORDER BY q.store_name`,
      [p.from, p.to])
    const cities = [...new Set(rows.map((r) => r.city).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'zh'))
    return { cities: ['全部', ...cities], stores: rows }
  },
  '/api/quality/board': async (q) => {
    const rows = await qualityRows(q.date || '', q.city || '全部', q.store || '全部')
    return { data: boardFromRows(q.date || '', rows) }
  },
  '/api/quality/report': async (q) => {
    const date = q.date || ''
    const period = periodFromKey(date)
    if (!period) return { data: null }
    const prev = previousPeriod(date, period)
    const [cur, prv] = await Promise.all([
      qualityRows(date, q.city || '全部', q.store || '全部'),
      qualityRows(prev.key, q.city || '全部', q.store || '全部'),
    ])
    return { data: buildReport(date, cur, prv) }
  },
  // ---- 经营分析下钻·渠道门店周期趋势（门店×渠道明细 + 日环比） ----
  // 表头：渠道,门店,日期 + 50 指标×(值, _日环比, _日环比差值)，150 列
  // _日环比=比率小数(如-0.0718)，_日环比差值=绝对差额；空=当日无经营(关店)
  '/api/business/meta': async () => {
    const [cols] = await pool.query(
      `SELECT DISTINCT JSON_KEYS(metrics) ks FROM fact_ax_business_daily LIMIT 20`)
    const set = new Set()
    for (const r of cols) {
      try { for (const k of J(r.ks)) set.add(k) } catch {}
    }
    const bases = [...set].filter((k) => !/环比|差值/.test(k)).sort((a, b) => String(a).localeCompare(b, 'zh'))
    const [days] = await pool.query(`SELECT DISTINCT DATE_FORMAT(biz_date,'%Y-%m-%d') d FROM fact_ax_business_daily ORDER BY d`)
    const [chs] = await pool.query(`SELECT DISTINCT channel FROM fact_ax_business_daily ORDER BY channel`)
    return { bases, days: days.map((r) => r.d), channels: chs.map((r) => r.channel) }
  },
  '/api/business/detail': async (q) => {
    // q: date(必填,YYYY-MM-DD) city/channel/store(多选,逗号) metric(指标多选,逗号,默认核心8个) sort/key order/q(搜索)
    const date = q.date || ''
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { date, prev: null, metrics: [], rows: [], total: null }
    const prev = addDays(date, -1)
    const cm = await cityMap()
    const f = makeFilter({ ...q, from: '', to: '' }, (s) => cm.get(normStore(s)))
    const wanted = String(q.metric || '').split(',').map((s) => s.trim()).filter(Boolean)
    const DEFAULTS = ['有效订单量', '有效订单金额（实付）', '有效客单价（实付）', '预计毛利(含平台后返)', '单均毛利(含平台后返)', '毛利率(含平台后返)', '总营业额', '退款率']
    const [rows] = await pool.query(
      `SELECT DATE_FORMAT(biz_date,'%Y-%m-%d') d, channel, store_name, metrics FROM fact_ax_business_daily WHERE biz_date IN (?, ?)`, [prev, date])
    const cur = new Map(), prv = new Map()
    for (const r of rows) {
      if (BAD_STORE.test(r.store_name)) continue
      const key = `${r.channel}	${r.store_name}`
      const m = J(r.metrics)
      if (r.d === date) cur.set(key, { channel: r.channel, store: r.store_name, m })
      else prv.set(key, { channel: r.channel, store: r.store_name, m })
    }
    let bases = wanted.length ? wanted : DEFAULTS
    if (q.metric === '__all__') {
      const s = new Set()
      for (const [, v] of cur) for (const k of Object.keys(v.m)) if (!/环比|差值/.test(k)) s.add(k)
      bases = [...s].sort((a, b) => String(a).localeCompare(b, 'zh'))
    }
    const cell = (m, b) => {
      const v = N(m?.[b])
      let wow = N(m?.[`${b}_日环比`])
      const diff = N(m?.[`${b}_日环比差值`])
      return { v, wow, diff }
    }
    let list = []
    for (const [key, c] of cur) {
      const row = { date: c.date, channel: c.channel, store: c.store }
      if (!f(row)) continue
      const p = prv.get(key)
      const cells = {}
      for (const b of bases) {
        let { v, wow, diff } = cell(c.m, b)
        // 库内环比缺失时用前后两天现算兜底
        if (wow == null && p) {
          const pv = N(p.m?.[b])
          if (v != null && pv != null && pv !== 0) { wow = (v - pv) / Math.abs(pv); diff == null && (diff = v - pv) }
          else if (v != null && pv != null) diff == null && (diff = v - pv)
        }
        cells[b] = { v, wow, diff }
      }
      const hay = `${c.store} ${c.channel}`
      if (q.q && !hay.includes(String(q.q).trim())) continue
      list.push({ channel: c.channel, store: c.store, city: cm.get(normStore(c.store)) || '', cells, empty: Object.values(cells).every((x) => x.v == null) })
    }
    // 合计行：金额/量加总，比率按营业额加权
    const sumOf = (b, rows_) => {
      const vs = rows_.map((r) => r.cells[b]?.v).filter((v) => v != null)
      if (!vs.length) return null
      if (/率|占比|单均|客单|笔单|店日均|售中售后/.test(b)) {
        let nn = 0, dd = 0
        for (const r of rows_) {
          const v = r.cells[b]?.v
          if (v == null) continue
          const w = Math.abs(r.cells['总营业额']?.v ?? r.cells['有效订单金额（实付）']?.v ?? r.cells['有效订单量']?.v ?? 0) || 0
          if (w > 0) { nn += v * w; dd += w }
        }
        return dd ? nn / dd : vs.reduce((a, x) => a + x, 0) / vs.length
      }
      return vs.reduce((a, x) => a + x, 0)
    }
    const total = { store: '总计', channel: '', city: '', cells: Object.fromEntries(bases.map((b) => [b, { v: sumOf(b, list), wow: null, diff: null }])), empty: !list.length }
    const key = q.sort || '有效订单量'
    const dir = q.order === 'asc' ? 1 : -1
    list.sort((a, b) => {
      const av = a.cells[key]?.v, bv = b.cells[key]?.v
      if (av == null && bv == null) return a.store.localeCompare(b.store, 'zh')
      if (av == null) return 1
      if (bv == null) return -1
      return (av - bv) * dir || a.store.localeCompare(b.store, 'zh')
    })
    return { date, prev, metrics: bases, rows: list, total }
  },
}

async function qualityRows(periodKey, city = '全部', store = '全部') {
  const period = periodFromKey(periodKey)
  if (!period) return []
  const params = [period.from, period.to]
  const clauses = ['q.biz_date BETWEEN ? AND ?', `(l.status IS NULL OR l.status = '' OR l.status = '已营业')`]
  const splitLoc = (v) => String(v || '').split(/[,，、|]/).map((x) => x.trim()).filter((x) => x && !['全部', '全国', 'all'].includes(x))
  for (const c of splitLoc(city)) {
    params.push(c, c.replace(/市/g, ''))
    clauses.push(`(COALESCE(l.city, d.city, '') = ? OR REPLACE(COALESCE(l.city, d.city, ''),'市','') = ?)`)
  }
  for (const s of splitLoc(store)) {
    params.push(s, s)
    clauses.push(`(q.store_name = ? OR q.store_code = ?)`)
  }
  const [rows] = await pool.query(
    `SELECT q.store_name code, q.store_name name, q.store_name shortName, COALESCE(l.city, d.city, '') city,
       AVG(q.sellout_rate) sellout_rate, AVG(q.pick_error_rate) pick_error_rate, AVG(q.warehouse_t) warehouse_t,
       AVG(q.im_reply_rate) im_reply_rate, AVG(q.merchant_issue_rate) merchant_issue_rate, AVG(q.shop_score) shop_score
     FROM fact_store_quality_daily q
     LEFT JOIN dim_store_launch l ON l.store_name = q.store_name
     LEFT JOIN dim_store d ON d.store_key = CONCAT('S:', REPLACE(REPLACE(REPLACE(q.store_name,'（','('),'）',')'),' ',''))
     WHERE ${clauses.join(' AND ')}
     GROUP BY q.store_name, l.city, d.city ORDER BY q.store_name`,
    params)
  return rows.map((r) => ({ ...r, sellout_rate: numOrNull(r.sellout_rate), pick_error_rate: numOrNull(r.pick_error_rate), warehouse_t: numOrNull(r.warehouse_t), im_reply_rate: numOrNull(r.im_reply_rate), merchant_issue_rate: numOrNull(r.merchant_issue_rate), shop_score: numOrNull(r.shop_score) }))
}
function numOrNull(v) {
  if (v == null) return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}
// ---- 周期工具（MySQL API 内部使用） ----
function periodFromKey(key) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(key)) return { kind: 'day', from: key, to: key }
  const month = key.match(/^M:(\d{4})-(\d{2})$/)
  if (month) {
    const from = `${month[1]}-${month[2]}-01`
    const next = new Date(`${from}T12:00:00`)
    next.setMonth(next.getMonth() + 1)
    next.setDate(0)
    return { kind: 'month', from, to: next.toISOString().slice(0, 10) }
  }
  const week = key.replace(/^W:/, '').match(/^(\d{4}-\d{2}-\d{2})_(\d{4}-\d{2}-\d{2})$/)
  if (week) return { kind: 'week', from: week[1], to: week[2] }
  return null
}
function addDays(iso, amount) {
  const date = new Date(`${iso}T12:00:00`)
  date.setDate(date.getDate() + amount)
  return date.toISOString().slice(0, 10)
}
function addMonths(iso, amount) {
  const date = new Date(`${iso}T12:00:00`)
  date.setMonth(date.getMonth() + amount)
  return date.toISOString().slice(0, 10)
}
function periodLabel(key, kind) {
  if (kind === 'day') {
    const [, month, day] = key.split('-')
    return `${Number(month)}月${Number(day)}日`
  }
  if (kind === 'month') {
    const [year, month] = key.slice(2).split('-')
    return `${Number(year)}年${Number(month)}月`
  }
  return key.replace(/^W:/, '').replace('_', '～')
}
function previousPeriod(key, period) {
  if (period.kind === 'day') return { key: addDays(key, -1), from: addDays(key, -1), to: addDays(key, -1) }
  if (period.kind === 'month') {
    const pm = addMonths(period.from, -1).slice(0, 7)
    return { key: `M:${pm}`, ...periodFromKey(`M:${pm}`) }
  }
  return { key: `W:${addDays(period.from, -7)}_${addDays(period.to, -7)}`, kind: 'week', from: addDays(period.from, -7), to: addDays(period.to, -7) }
}
function buildReport(periodKey, currentRows, previousRows) {
  if (!currentRows.length) return null
  const period = periodFromKey(periodKey)
  const previous = previousPeriod(periodKey, period)
  const ui = period.kind === 'day' ? { cur: '本日', prev: '昨日', delta: '日比' } : period.kind === 'month' ? { cur: '本月', prev: '上月', delta: '月比' } : { cur: '本周', prev: '上周', delta: '周比' }
  const previousMap = new Map(previousRows.map((row) => [row.code, row]))
  const scoredRows = currentRows.map((row) => {
    const scored = scoreRow(row)
    const prevRow = previousMap.get(row.code)
    const prevScore = prevRow ? scoreRow(prevRow) : null
    const deltas = {}
    for (const def of ASSESS_DEFS) {
      deltas[def.key] = (scored.empty || !prevRow || prevScore?.empty || row[def.key] == null || prevRow[def.key] == null)
        ? null : Number((displayValue(def.key, row[def.key]) - displayValue(def.key, prevRow[def.key])).toFixed(2))
    }
    return { ...row, composite: scored.composite, grade: scored.grade, parts: scored.parts, prevComposite: prevScore?.empty ? null : (prevScore?.composite ?? null), deltas, failCnt: scored.parts.filter((part) => !part.missing && !part.pass).length }
  })
  const currentAggregate = aggregateRows(currentRows)
  const previousAggregate = aggregateRows(previousRows)
  const metrics = ASSESS_DEFS.map((def) => {
    const value = currentAggregate?.[def.key] == null ? null : displayValue(def.key, currentAggregate[def.key])
    const prev = previousAggregate?.[def.key] == null ? null : displayValue(def.key, previousAggregate[def.key])
    const validParts = scoredRows.map((row) => row.parts.find((part) => part.key === def.key)).filter((part) => part && !part.missing)
    const storePassCnt = validParts.filter((part) => part.pass).length
    return {
      key: def.key, name: def.name, shortName: def.shortName, unit: def.unit,
      value: value == null ? 0 : Number(value.toFixed(2)),
      prev: prev == null ? null : Number(prev.toFixed(2)),
      delta: value == null || prev == null ? null : Number((value - prev).toFixed(2)),
      pass: value != null && isPass(def, value), passLine: def.passLine, lowerBetter: def.lowerBetter,
      storePassCnt, storeCnt: validParts.length || scoredRows.length,
      storePassRate: validParts.length ? storePassCnt / validParts.length : 0,
    }
  })
  const activeRows = scoredRows.filter((row) => !row.empty)
  const gradeDist = GRADE_RULES.map((grade) => {
    const count = activeRows.filter((row) => row.grade.grade === grade.grade).length
    return { ...grade, count, share: activeRows.length ? count / activeRows.length : 0 }
  })
  const merchantRank = activeRows.map((row) => {
    const part = row.parts.find((item) => item.key === 'merchant_issue_rate')
    return { shortName: row.shortName, name: row.name, value: part?.missing ? null : part?.value, pass: !!part && !part.missing && part.pass, missing: part?.missing ?? true }
  }).sort((a, b) => (b.value ?? -1) - (a.value ?? -1))
  const suggestions = []
  for (const metric of metrics.filter((item) => !item.pass)) {
    const worst = activeRows.filter((row) => !row.parts.find((part) => part.key === metric.key)?.missing).sort((a, b) => {
      const av = a.parts.find((part) => part.key === metric.key)?.value ?? 0
      const bv = b.parts.find((part) => part.key === metric.key)?.value ?? 0
      return metric.lowerBetter ? bv - av : av - bv
    }).slice(0, 3)
    suggestions.push({
      title: `${metric.name} 未达标（当前 ${metric.value}${metric.unit === 'min' ? '分钟' : '%'}，标准 ${metric.lowerBetter ? '≤' : '≥'}${metric.passLine}${metric.unit === 'min' ? '分钟' : '%'}）`,
      desc: `需重点整改门店：${worst.map((row) => { const value = row.parts.find((part) => part.key === metric.key)?.value; return `${row.name || row.shortName}(${value == null ? '--' : Number(value.toFixed(2))}${metric.unit === 'min' ? '分钟' : '%'})` }).join('、')}。`,
    })
  }
  const redStores = activeRows.filter((row) => row.grade.grade === 'D')
  if (redStores.length) suggestions.push({ title: `D 红线店 ${redStores.length} 家`, desc: `${redStores.map((row) => row.name || row.shortName).join('、')}。逐店挂账跟踪，制定一店一策专项改善动作。` })
  const summary = metrics.filter((metric) => metric.delta != null && metric.delta !== 0).map((metric) => {
    const worse = metric.lowerBetter ? metric.delta > 0 : metric.delta < 0
    return `${metric.name}${worse ? '恶化' : '改善'}(${metric.delta > 0 ? '+' : ''}${metric.delta})`
  }).join('；')
  return {
    weekId: periodKey, prevWeekId: previous.key, weekLabel: periodLabel(periodKey, period.kind), prevLabel: periodLabel(previous.key, period.kind), periodKind: period.kind,
    curColLabel: ui.cur, prevColLabel: ui.prev, deltaColLabel: ui.delta,
    storeCnt: activeRows.length, failMetricCnt: metrics.filter((metric) => !metric.pass).length,
    metrics, rowsAsc: activeRows.sort((a, b) => a.composite - b.composite), gradeDist, merchantRank, suggestions,
    summaryNote: summary ? `关键变化：${summary}` : `${ui.cur}无对比数据`,
  }
}

const server = http.createServer(async (req, res) => {
  const send = (code, obj) => {
    res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' })
    res.end(JSON.stringify(obj))
  }
  // SSE：前端 subscribeQualityUpdates 用 EventSource 订阅（无 PG LISTEN，按 15s 保活即可，前端另有轮询）
  if (req.url === '/api/events' || req.url === '/api/events/') {
    res.writeHead(200, { 'content-type': 'text/event-stream; charset=utf-8', 'cache-control': 'no-cache, no-transform', connection: 'keep-alive', 'access-control-allow-origin': '*' })
    res.write(`event: ready\ndata: ${JSON.stringify({ connectedAt: new Date().toISOString() })}\n\n`)
    const timer = setInterval(() => { try { res.write(`: keepalive ${Date.now()}\n\n`) } catch {} }, 15000)
    req.on('close', () => clearInterval(timer))
    return
  }
  try {
    const u = new URL(req.url, 'http://localhost')
    const fn = routes[u.pathname]
    if (!fn) return send(404, { error: 'unknown api ' + u.pathname })
    const q = Object.fromEntries(u.searchParams.entries())
    send(200, await fn(q))
  } catch (e) {
    send(500, { error: String(e && e.message || e).slice(0, 300) })
  }
})
server.listen(PORT, '127.0.0.1', () => console.log(`mysql-api listening on 127.0.0.1:${PORT}`))
