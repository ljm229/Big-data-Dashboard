import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import { config, projectRoot } from './config.mjs'
import { pool } from './db.mjs'
import { ASSESS_DEFS, GRADE_RULES, aggregateRows, boardFromRows, displayValue, isPass, scoreRow } from './scoring.mjs'

const webDist = path.join(projectRoot, 'web', 'dist')
const clients = new Set()

function json(res, status, body) {
  const payload = JSON.stringify(body)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(payload),
    'cache-control': 'no-store',
    'access-control-allow-origin': '*',
  })
  res.end(payload)
}

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
    const previousMonth = addMonths(period.from, -1).slice(0, 7)
    return { key: `M:${previousMonth}`, ...periodFromKey(`M:${previousMonth}`) }
  }
  const from = addDays(period.from, -7)
  const to = addDays(period.to, -7)
  return { key: `W:${from}_${to}`, kind: 'week', from, to }
}

/** 与大屏一致：默认只看已营业门店；状态未知的历史行仍保留 */
const LAUNCHED_STORE_CLAUSE = `(s.business_status = '' OR s.business_status = '已营业')`

async function qualityRows(periodKey, city = '全部', store = '全部') {
  const period = periodFromKey(periodKey)
  if (!period) return []
  const params = [period.from, period.to]
  const clauses = ['q.business_date BETWEEN $1 AND $2', LAUNCHED_STORE_CLAUSE]
  if (city && city !== '全部' && city !== '全国') {
    params.push(city)
    clauses.push(`(s.city = $${params.length} OR replace(s.city,'市','') = replace($${params.length},'市',''))`)
  }
  if (store && store !== '全部') {
    params.push(store)
    clauses.push(`(q.store_key = $${params.length} OR s.store_name = $${params.length} OR s.short_name = $${params.length})`)
  }
  const result = await pool.query(
    `SELECT q.store_key AS code, s.store_name AS name, s.short_name AS "shortName", s.city,
       avg(q.sellout_rate)::float8 AS sellout_rate,
       avg(q.pick_error_rate)::float8 AS pick_error_rate,
       avg(q.warehouse_t)::float8 AS warehouse_t,
       avg(q.im_reply_rate)::float8 AS im_reply_rate,
       avg(q.merchant_issue_rate)::float8 AS merchant_issue_rate,
       avg(q.shop_score)::float8 AS shop_score
     FROM retail.fact_store_quality_daily q
     JOIN retail.dim_store s USING (store_key)
     WHERE ${clauses.join(' AND ')}
     GROUP BY q.store_key, s.store_name, s.short_name, s.city
     ORDER BY s.short_name`,
    params,
  )
  return result.rows
}

async function coverage() {
  const [dates, state, sources] = await Promise.all([
    pool.query(`SELECT to_char(business_date,'YYYY-MM-DD') AS date, count(*)::int AS "storeCount" FROM retail.fact_store_quality_daily GROUP BY business_date ORDER BY business_date`),
    pool.query(`SELECT dataset, version::int, updated_at, to_char(latest_business_date,'YYYY-MM-DD') AS "latestDate", row_count::int AS "rowCount" FROM retail.refresh_state WHERE dataset='store_quality'`),
    pool.query(`SELECT source_code AS source, count(*)::int AS rows, to_char(min(business_date),'YYYY-MM-DD') AS "dateMin", to_char(max(business_date),'YYYY-MM-DD') AS "dateMax" FROM retail.fact_business_daily GROUP BY source_code ORDER BY source_code`),
  ])
  const expected = [
    ['store_rank', '经营详情·门店排行'],
    ['period_trend', '经营详情·周期趋势'],
    ['store_period_trend', '经营详情·门店周期趋势'],
    ['channel_period_trend', '经营详情·渠道周期趋势'],
    ['channel_store_period_trend', '经营详情·渠道门店周期趋势'],
    ['store_quality', '闪购仓门店运营质量表'],
  ]
  const actual = new Map(sources.rows.map((row) => [row.source, row]))
  if (dates.rowCount) actual.set('store_quality', { source: 'store_quality', rows: dates.rows.reduce((sum, row) => sum + row.storeCount, 0), dateMin: dates.rows[0].date, dateMax: dates.rows.at(-1).date })
  return {
    dates: dates.rows,
    latestDate: dates.rows.at(-1)?.date || null,
    state: state.rows[0] || null,
    sources: expected.map(([source, label]) => ({ source, label, available: actual.has(source), ...(actual.get(source) || {}) })),
    supplementalSources: sources.rows.filter((row) => !expected.some(([source]) => source === row.source)),
  }
}

async function options(periodKey) {
  const period = periodFromKey(periodKey)
  if (!period) return { cities: ['全部'], stores: [] }
  const result = await pool.query(
    `SELECT DISTINCT q.store_key AS id, s.short_name AS "shortName", s.store_name AS name,
       coalesce(s.store_code,'') AS code, s.city
     FROM retail.fact_store_quality_daily q JOIN retail.dim_store s USING (store_key)
     WHERE q.business_date BETWEEN $1 AND $2
       AND ${LAUNCHED_STORE_CLAUSE}
     ORDER BY s.short_name`,
    [period.from, period.to],
  )
  const cities = [...new Set(result.rows.map((row) => row.city).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'zh'))
  return { cities: ['全部', ...cities], stores: result.rows }
}

function buildReport(periodKey, currentRows, previousRows) {
  if (!currentRows.length) return null
  const period = periodFromKey(periodKey)
  const previous = previousPeriod(periodKey, period)
  const ui = period.kind === 'day'
    ? { cur: '本日', prev: '昨日', delta: '日环比' }
    : period.kind === 'month'
      ? { cur: '本月', prev: '上月', delta: '月环比' }
      : { cur: '本周', prev: '上周', delta: '周环比' }
  const previousMap = new Map(previousRows.map((row) => [row.code, row]))
  const scoredRows = currentRows.map((row) => {
    const scored = scoreRow(row)
    const prevRow = previousMap.get(row.code)
    const prevScore = prevRow ? scoreRow(prevRow) : null
    const deltas = {}
    for (const def of ASSESS_DEFS) {
      if (scored.empty || !prevRow || prevScore?.empty || row[def.key] == null || prevRow[def.key] == null) deltas[def.key] = null
      else deltas[def.key] = Number((displayValue(def.key, row[def.key]) - displayValue(def.key, prevRow[def.key])).toFixed(2))
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
      desc: `需重点整改门店：${worst.map((row) => {
        const value = row.parts.find((part) => part.key === metric.key)?.value
        return `${row.name || row.shortName}(${value == null ? '--' : Number(value.toFixed(2))}${metric.unit === 'min' ? '分钟' : '%'})`
      }).join('、')}。`,
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

async function routeApi(req, res, url) {
  if (url.pathname === '/api/collection/status') {
    const file = path.join(projectRoot,'数据采集','state','latest.json')
    const state = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file,'utf8')) : {status:'尚未执行'}
    json(res,200,{status:state.status,startedAt:state.startedAt,finishedAt:state.finishedAt,message:state.message,from:state.from,to:state.to,downloaded:state.downloaded,imported:state.imported})
    return true
  }
  if (req.method === 'OPTIONS') {
    res.writeHead(204, { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET,OPTIONS', 'access-control-allow-headers': 'content-type' })
    res.end()
    return true
  }
  if (url.pathname === '/api/health') {
    const result = await pool.query('SELECT now() AS time, current_database() AS database')
    json(res, 200, { ok: true, ...result.rows[0] })
    return true
  }
  if (url.pathname === '/api/quality/coverage' || url.pathname === '/api/source/coverage') {
    json(res, 200, await coverage())
    return true
  }
  if (url.pathname === '/api/quality/options') {
    json(res, 200, await options(url.searchParams.get('date') || ''))
    return true
  }
  if (url.pathname === '/api/quality/board') {
    const date = url.searchParams.get('date') || ''
    const rows = await qualityRows(date, url.searchParams.get('city') || '全部', url.searchParams.get('store') || '全部')
    json(res, 200, { data: boardFromRows(date, rows) })
    return true
  }
  if (url.pathname === '/api/quality/report') {
    const date = url.searchParams.get('date') || ''
    const city = url.searchParams.get('city') || '全部'
    const store = url.searchParams.get('store') || '全部'
    const period = periodFromKey(date)
    if (!period) {
      json(res, 400, { error: 'invalid date key' })
      return true
    }
    const previous = previousPeriod(date, period)
    const [currentRows, previousRows] = await Promise.all([qualityRows(date, city, store), qualityRows(previous.key, city, store)])
    json(res, 200, { data: buildReport(date, currentRows, previousRows) })
    return true
  }
  if (url.pathname === '/api/events') {
    res.writeHead(200, { 'content-type': 'text/event-stream; charset=utf-8', 'cache-control': 'no-cache, no-transform', connection: 'keep-alive', 'access-control-allow-origin': '*' })
    res.write(`event: ready\ndata: ${JSON.stringify({ connectedAt: new Date().toISOString() })}\n\n`)
    clients.add(res)
    req.on('close', () => clients.delete(res))
    return true
  }
  return false
}

const contentTypes = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2' }

function serveStatic(res, pathname) {
  if (!fs.existsSync(webDist)) return false
  const requested = pathname === '/' ? 'index.html' : decodeURIComponent(pathname).replace(/^\/+/, '')
  let file = path.resolve(webDist, requested)
  const relative = path.relative(webDist,file)
  if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) return false
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(webDist, 'index.html')
  const data = fs.readFileSync(file)
  res.writeHead(200, { 'content-type': contentTypes[path.extname(file)] || 'application/octet-stream', 'content-length': data.length })
  res.end(data)
  return true
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`)
  try {
    if (url.pathname.startsWith('/api/') && await routeApi(req, res, url)) return
    if (serveStatic(res, url.pathname)) return
    json(res, 404, { error: 'not found', hint: 'build the web app first with npm run build in web/' })
  } catch (error) {
    console.error(error)
    json(res, 500, { error: 'server error', message: error.message })
  }
})

const listenClient = await pool.connect()
await listenClient.query('LISTEN retail_data_updated')
listenClient.on('notification', (message) => {
  for (const client of clients) client.write(`event: data-updated\ndata: ${message.payload || '{}'}\n\n`)
})
setInterval(() => {
  for (const client of clients) client.write(`: keepalive ${Date.now()}\n\n`)
}, 15000).unref()

server.listen(config.apiPort, config.apiHost, () => {
  console.log(`dashboard server: http://${config.apiHost}:${config.apiPort}`)
})

async function shutdown() {
  server.close()
  listenClient.release()
  await pool.end()
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
