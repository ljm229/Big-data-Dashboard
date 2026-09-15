/**
 * 只读核验：Excel 数据源1与前端 source1.json 的核心聚合口径。
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import XLSX from 'xlsx'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const srcDir = path.join(root, '数据源1')
const payload = JSON.parse(fs.readFileSync(path.join(root, 'web', 'src', 'data', 'source1.json'), 'utf8'))

function toIso(value) {
  const text = String(value ?? '').trim()
  if (/^\d{8}$/.test(text)) return `${text.slice(0, 4)}-${text.slice(4, 6)}-${text.slice(6, 8)}`
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10)
  return ''
}

function toNum(value) {
  if (value == null || value === '') return null
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  const text = String(value).trim().replace(/,/g, '')
  if (!text) return null
  const number = Number.parseFloat(text)
  if (!Number.isFinite(number)) return null
  return text.endsWith('%') ? number / 100 : number
}

function readRows(file, sheet) {
  const workbook = XLSX.readFile(path.join(srcDir, file), { cellDates: true })
  return XLSX.utils.sheet_to_json(workbook.Sheets[sheet || workbook.SheetNames[0]], { defval: '' })
}

function aggregate(rows) {
  const profitRows = rows.filter((row) => row.profit != null)
  const paidRows = rows.filter((row) => row.paid != null)
  const orderRows = rows.filter((row) => row.orders != null)
  const marginRows = rows.filter(
    (row) => row.marginRate != null && row.profit != null && row.onlineRevenue != null && row.onlineRevenue !== 0,
  )
  const refundRows = rows.filter((row) => row.refundOrders != null && row.orders != null)
  const sum = (items, field) => items.reduce((total, row) => total + row[field], 0)
  const profit = sum(profitRows, 'profit')
  const paid = sum(paidRows, 'paid')
  const orders = sum(orderRows, 'orders')
  const marginRevenue = sum(marginRows, 'onlineRevenue')
  const refundOrderBase = sum(refundRows, 'orders')
  return {
    profit,
    paid,
    orders,
    arpu: orders ? paid / orders : null,
    profitRate: marginRevenue ? sum(marginRows, 'profit') / marginRevenue : null,
    refundRate: refundOrderBase ? sum(refundRows, 'refundOrders') / refundOrderBase : null,
    marginCoveredRows: marginRows.length,
    refundCoveredRows: refundRows.length,
  }
}

function fridayOfWeek(iso) {
  const date = new Date(`${iso}T12:00:00Z`)
  const distance = (date.getUTCDay() + 2) % 7
  date.setUTCDate(date.getUTCDate() - distance)
  return date.toISOString().slice(0, 10)
}

function shiftDay(iso, amount) {
  const date = new Date(`${iso}T12:00:00Z`)
  date.setUTCDate(date.getUTCDate() + amount)
  return date.toISOString().slice(0, 10)
}

function nearlyEqual(actual, expected, tolerance = 1e-9) {
  return actual == null && expected == null || Math.abs(actual - expected) <= tolerance * Math.max(1, Math.abs(expected))
}

const excelRows = readRows(payload.files.facts, 'data')
  .map((row) => ({
    date: toIso(row['日期']),
    channel: String(row['渠道'] || '').trim(),
    store: String(row['门店'] || '').trim(),
    onlineRevenue: toNum(row['预计线上收入']),
    profit: toNum(row['预计毛利(含平台后返)']),
    marginRate: toNum(row['毛利率(含平台后返)']),
    unitProfit: toNum(row['单均毛利(含平台后返)']),
    paid: toNum(row['有效订单金额（实付）']),
    orders: toNum(row['有效订单量']),
    refundRate: toNum(row['退款率']),
    refundOrders: toNum(row['退款订单量']),
  }))
  .filter((row) => row.date && row.channel && row.store)
  .filter((row) => row.onlineRevenue != null || row.profit != null || row.paid != null || row.orders != null)

if (excelRows.length !== payload.facts.length) {
  throw new Error(`事实行数不一致：Excel=${excelRows.length} JSON=${payload.facts.length}`)
}

const latestDay = payload.days.at(-1)
const direct = aggregate(excelRows.filter((row) => row.date === latestDay))
const generated = aggregate(payload.facts.filter((row) => row.date === latestDay))
for (const field of ['profit', 'paid', 'orders', 'arpu', 'profitRate', 'refundRate']) {
  if (!nearlyEqual(generated[field], direct[field])) {
    throw new Error(`${field} 不一致：Excel=${direct[field]} JSON=${generated[field]}`)
  }
}

const weeks = new Map()
for (const day of payload.days) {
  const friday = fridayOfWeek(day)
  const list = weeks.get(friday) || []
  list.push(day)
  weeks.set(friday, list)
}
const completeWeeks = [...weeks.entries()]
  .filter(([friday, days]) => days.length === 7 && shiftDay(friday, 6) <= latestDay)
  .map(([friday]) => `${friday}~${shiftDay(friday, 6)}`)

const rawLaunchRows = readRows(payload.files.launch).filter((row) => String(row['门店'] || '').trim())
const launchRows = rawLaunchRows.filter((row) => String(row['是否上线'] || '').trim())
const onlineOpen = launchRows.filter((row) => String(row['是否上线'] || '').trim() === '已营业').length

console.log(JSON.stringify({
  status: 'PASS',
  latestDay,
  facts: payload.facts.length,
  latestKpi: direct,
  launch: {
    onlineOpen,
    onlinePlan: launchRows.length,
    onlineRate: onlineOpen / launchRows.length,
    ignoredWithoutStatus: rawLaunchRows.length - launchRows.length,
  },
  businessWeekRule: 'Friday-Thursday',
  completeWeeks,
}, null, 2))
