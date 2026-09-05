/**
 * 从 数据源/8.28/淘宝便利店门店信息表.xlsx 重新生成 web/src/data/storeLaunch.json
 * 用法：在项目根目录执行 node scripts/sync-store-launch.mjs
 */
import XLSX from 'xlsx'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const src = path.join(root, '数据源', '8.28-9.3', '淘宝便利店门店信息表.xlsx')
const out = path.join(root, 'web', 'src', 'data', 'storeLaunch.json')

function shortStore(name) {
  return String(name || '')
    .replace(/淘宝便利店/g, '')
    .replace(/[（(]/g, '')
    .replace(/[）)]/g, '')
    .trim()
}

const CITY_ALIAS = {
  苏州昆山市: '苏州',
  泰州姜堰: '泰州',
}

function normCity(city, address) {
  const raw = String(city || '').trim()
  if (CITY_ALIAS[raw]) return CITY_ALIAS[raw]
  if (raw) return raw
  const known = [
    '苏州',
    '无锡',
    '杭州',
    '上海',
    '南京',
    '郑州',
    '武汉',
    '南通',
    '金华',
    '扬州',
    '泰州',
    '淮安',
    '济南',
    '青岛',
    '嘉兴',
    '湖州',
    '绍兴',
    '台州',
    '温州',
    '常州',
  ]
  const addr = String(address || '')
  return known.find((c) => addr.includes(c)) || ''
}

function parseDate(v) {
  if (!v) return null
  const s = String(v).trim()
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/)
  if (!m) return null
  let year = Number(m[3])
  if (year < 100) year += 2000
  const month = Number(m[1])
  const day = Number(m[2])
  return {
    iso: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    mmdd: `${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
  }
}

const wb = XLSX.readFile(src)
const ws = wb.Sheets[wb.SheetNames[0]]
const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: false })

const stores = []
for (const row of rows.slice(1)) {
  const name = String(row[0] || '').trim()
  if (!name) continue
  const status = String(row[4] || '').trim()
  const launched = status === '已营业'
  const pending = status === '待营业'
  const date = parseDate(row[1])
  stores.push({
    name,
    shortName: shortStore(name),
    city: normCity(row[2], row[3]),
    address: String(row[3] || '').trim(),
    status,
    launched,
    pending,
    dateISO: date?.iso || null,
    dateMMDD: date?.mmdd || null,
  })
}

const total = stores.length
const launchedCount = stores.filter((s) => s.launched).length
const pendingRows = stores.filter((s) => s.pending)
const pendingCount = pendingRows.length
const scheduledCount = pendingRows.filter((s) => s.dateISO).length
const unscheduledCount = pendingCount - scheduledCount

const cityMap = new Map()
stores.forEach((s) => {
  const key = s.city || '未标注'
  if (!cityMap.has(key)) cityMap.set(key, { city: key, total: 0, launched: 0, pending: 0 })
  const c = cityMap.get(key)
  c.total += 1
  if (s.launched) c.launched += 1
  if (s.pending) c.pending += 1
})

const cityRows = [...cityMap.values()].sort(
  (a, b) => b.total - a.total || b.launched - a.launched || a.city.localeCompare(b.city),
)
const topCities = cityRows.slice(0, 5)
const rest = cityRows.slice(5)
const other = {
  city: '其他',
  total: rest.reduce((a, c) => a + c.total, 0),
  launched: rest.reduce((a, c) => a + c.launched, 0),
  pending: rest.reduce((a, c) => a + c.pending, 0),
}
const cities = other.total > 0 ? [...topCities, other] : topCities

const schedule = [...pendingRows]
  .sort((a, b) => {
    if (!a.dateISO && !b.dateISO) return a.shortName.localeCompare(b.shortName)
    if (!a.dateISO) return 1
    if (!b.dateISO) return -1
    return a.dateISO.localeCompare(b.dateISO) || a.shortName.localeCompare(b.shortName)
  })
  .map((s) => ({
    date: s.dateMMDD || '待定',
    dateISO: s.dateISO,
    store: s.shortName,
    city: s.city || '未标注',
    address: s.address || '',
  }))

const payload = {
  generatedAt: new Date().toISOString().slice(0, 19).replace('T', ' '),
  source: '数据源/8.28/淘宝便利店门店信息表.xlsx',
  summary: {
    total,
    launched: launchedCount,
    pending: pendingCount,
    scheduled: scheduledCount,
    unscheduled: unscheduledCount,
  },
  cities,
  schedule,
}

fs.writeFileSync(out, JSON.stringify(payload, null, 2))
console.log('synced ->', out)
