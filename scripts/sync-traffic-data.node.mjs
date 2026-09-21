/** 用 Node + xlsx 重建流量快照（与 sync-traffic-data.py 同口径，不编造日期）。 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { createHash } from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { readdirSync, statSync } from 'node:fs'
import XLSX from 'xlsx'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const TRAFFIC_DIR = path.join(ROOT, '数据源', '淘宝闪购商家')
const DIMS = { '分平台渠道': 'platform', '淘宝闪购APP内渠道': 'app' }
const DAY_RE = /^\d{8}$/
const PERIOD_RE = /^(\d{8})-(\d{8})$/

function latestSource() {
  const hits = readdirSync(TRAFFIC_DIR)
    .filter((n) => /^流量分析-分来源.*\.xlsx$/.test(n) && !n.startsWith('~$'))
    .map((n) => ({ n, t: statSync(path.join(TRAFFIC_DIR, n)).mtimeMs }))
    .sort((a, b) => b.t - a.t || (a.n < b.n ? 1 : -1))
  if (!hits.length) throw new Error('找不到流量源文件')
  return path.join(TRAFFIC_DIR, hits[0].n)
}

function count(v) {
  if (v == null || String(v).trim() === '' || ['--', '—', '-'].includes(String(v).trim())) return null
  const n = Number(String(v).replace(/,/g, ''))
  if (!Number.isInteger(n) || n < 0) throw new Error(`非法人数：${v}`)
  return n
}
const iso = (t) => `${t.slice(0, 4)}-${t.slice(4, 6)}-${t.slice(6, 8)}`

const source = process.argv[2] ? path.resolve(process.argv[2]) : latestSource()
const buf = readFileSync(source)
const wb = XLSX.read(buf, { type: 'buffer' })
const rows = XLSX.utils.sheet_to_json(wb.Sheets['data'], { defval: null })
const facts = []
const keys = new Set()
const days = new Set()
let grains = new Set()
rows.forEach((r, i) => {
  const raw = String(r['日期'] ?? '').trim()
  if (!raw || ['日期', 'date', 'Date'].includes(raw)) return
  let grain, day = null, start = null, end = null
  if (DAY_RE.test(raw)) { grain = 'day'; day = iso(raw); start = end = day }
  else if (PERIOD_RE.test(raw)) {
    const m = raw.match(PERIOD_RE)
    start = iso(m[1]); end = iso(m[2])
    if (start > end) throw new Error(`周期起止错误行${i + 2}`)
    grain = start === end ? 'day' : 'period'
    if (grain === 'day') day = start
  } else return
  if (grains.size && !grains.has(grain)) return // 日明细+汇总混排时只保留日粒度
  grains.add(grain)
  const dim = DIMS[String(r['来源分类'] ?? '').trim()]
  if (!dim) throw new Error(`未知来源分类：${r['来源分类']}`)
  for (const k of ['城市名称', '门店id', '门店名称', '来源名称']) {
    if (r[k] == null || !String(r[k]).trim()) throw new Error(`第${i + 2}行缺少${k}`)
  }
  const key = `${day || `${start}_${end}`}|${String(r['门店id']).trim()}|${dim}|${String(r['来源名称']).trim()}`
  if (keys.has(key)) throw new Error(`重复门店来源记录：${key}`)
  keys.add(key)
  if (grain === 'day') days.add(day)
  const f = {
    storeId: String(r['门店id']).trim(),
    store: String(r['门店名称']).trim(),
    city: String(r['城市名称']).trim(),
    dimension: dim,
    source: String(r['来源名称']).trim(),
    row: i + 2,
    exposure: count(r['曝光人数']),
    entry: count(r['进店人数']),
    orders: count(r['下单人数']),
    reportedRates: [r['进店转化率'], r['下单转化率'], r['整体转化率']],
  }
  if (day) f.date = day
  facts.push(f)
})
if (!facts.length) throw new Error('空文件，未导入')
const grain = [...grains][0]
const period = grain === 'day'
  ? { from: [...days].sort()[0], to: [...days].sort().pop(), grain: 'day' }
  : (() => { throw new Error('周期汇总文件暂不支持') })()
const payload = {
  schemaVersion: 2,
  period,
  source: { file: path.basename(source), sheet: 'data', range: `A1:P${facts.length + 1}`, exportedAt: '', sha256: createHash('sha256').update(buf).digest('hex') },
  generatedAt: new Date().toISOString(),
  facts,
}
const out = path.join(ROOT, 'web', 'web', 'src', 'data', 'trafficData.json')
mkdirSync(path.dirname(out), { recursive: true })
writeFileSync(out, JSON.stringify(payload))
console.log(JSON.stringify({ file: path.basename(source), period, rows: facts.length, stores: new Set(facts.map((f) => f.storeId)).size }))
