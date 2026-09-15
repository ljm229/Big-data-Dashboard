/**
 * 将 数据源1 转为大屏 JSON。
 * 源：
 * - 翱象/渠道门店周期数据近30日.xlsx + 城市门店及上线进度.xlsx
 * - 淘宝闪购商家/商品分析-按店铺汇总（缺货/出勤）
 * - 淘宝闪购商家/商品分析-按商品明细（品类销售）
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import XLSX from 'xlsx'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const srcDir = path.join(root, '数据源1')
const outFile = path.join(root, 'web', 'src', 'data', 'source1.json')
const opsPackFile = path.join(root, 'web', 'src', 'data', 'opsPack.json')

function toIso(v) {
  const s = String(v ?? '').trim()
  if (/^\d{8}$/.test(s)) return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)
  if (/^\d{8}-\d{8}$/.test(s)) return null
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    const y = v.getFullYear()
    const m = String(v.getMonth() + 1).padStart(2, '0')
    const d = String(v.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }
  return ''
}

function parsePeriod(v) {
  const s = String(v ?? '').trim()
  const m = s.match(/^(\d{8})-(\d{8})$/)
  if (!m) return null
  return { from: toIso(m[1]), to: toIso(m[2]) }
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

function normStore(name) {
  return String(name || '')
    .replace(/（/g, '(')
    .replace(/）/g, ')')
    .replace(/\s+/g, '')
    .trim()
}

const PREFECTURE_CITIES = ['杭州', '苏州', '南通', '上海', '武汉', '无锡', '金华', '济南', '郑州', '扬州', '泰州', '淮安', '南京', '青岛']
function canonCity(raw) {
  const s = String(raw || '').trim()
  if (!s) return ''
  if (s.includes('昆山')) return '苏州'
  if (s.includes('姜堰')) return '泰州'
  const compact = s.replace(/市/g, '')
  return PREFECTURE_CITIES.find((c) => compact === c || compact.startsWith(c)) || compact
}

function findFile(relDir, matcher) {
  const dir = path.join(srcDir, relDir)
  if (!fs.existsSync(dir)) return null
  const hit = fs
    .readdirSync(dir)
    .filter((n) => matcher(n))
    .sort()
    .at(-1)
  return hit ? path.join(relDir, hit) : null
}

function readSheet(relFile, sheet) {
  const full = path.join(srcDir, relFile)
  const wb = XLSX.readFile(full, { cellDates: true })
  const name = sheet || wb.SheetNames.find((n) => n === 'data') || wb.SheetNames[0]
  return XLSX.utils.sheet_to_json(wb.Sheets[name], { defval: '' })
}

const launchFile =
  findFile('翱象', (n) => n.includes('城市门店及上线进度') && n.endsWith('.xlsx')) ||
  findFile('.', (n) => n.includes('城市门店及上线进度') && n.endsWith('.xlsx'))
const factFile =
  findFile('翱象', (n) => n.includes('渠道门店周期数据') && n.endsWith('.xlsx')) ||
  findFile('.', (n) => n.includes('渠道门店周期数据') && n.endsWith('.xlsx'))
const supplyFile = findFile('淘宝闪购商家', (n) => n.includes('按店铺汇总') && n.endsWith('.xlsx'))
const productFile = findFile('淘宝闪购商家', (n) => n.includes('按商品明细') && n.endsWith('.xlsx'))

if (!launchFile || !factFile) {
  throw new Error('缺少翱象渠道/上线进度 Excel，请放到 数据源1/翱象/')
}

const launchRows = readSheet(launchFile)
const stores = []
const cityByStore = new Map()
const storeAlias = new Map()

function registerStore(name, city = '', status = '', address = '') {
  const key = normStore(name)
  if (!key) return null
  const existing = cityByStore.get(key)
  if (existing) {
    if (!existing.city && city) existing.city = city
    if (!existing.status && status) existing.status = status
    if (!existing.address && address) existing.address = address
    storeAlias.set(name, existing.name)
    storeAlias.set(key, existing.name)
    return existing.name
  }
  const row = { name: key.includes('(') ? key : normStore(name) || name, city, status, address }
  // 优先保留翱象侧带城市的规范名
  const preferred = String(name).trim() || row.name
  const final = { name: preferred.replace(/（/g, '(').replace(/）/g, ')'), city, status, address }
  stores.push(final)
  cityByStore.set(key, final)
  storeAlias.set(name, final.name)
  storeAlias.set(key, final.name)
  storeAlias.set(final.name, final.name)
  return final.name
}

for (const r of launchRows) {
  registerStore(
    String(r['门店'] || '').trim(),
    canonCity(String(r['城市'] || '').trim()),
    String(r['是否上线'] || '').trim(),
    String(r['地址'] || '').trim(),
  )
}

function resolveStore(raw) {
  const name = String(raw || '').trim()
  if (!name) return ''
  const key = normStore(name)
  if (storeAlias.has(name)) return storeAlias.get(name)
  if (storeAlias.has(key)) return storeAlias.get(key)
  return registerStore(name)
}

const factRows = readSheet(factFile, 'data')
const facts = []
const days = new Set()
const channels = new Set()

for (const r of factRows) {
  const date = toIso(r['日期'])
  const channel = String(r['渠道'] || '').trim()
  const store = resolveStore(r['门店'])
  if (!date || !channel || !store) continue
  const profit = toNum(r['预计毛利(含平台后返)'])
  const onlineRevenue = toNum(r['预计线上收入'])
  const marginRate = toNum(r['毛利率(含平台后返)'])
  const unitProfit = toNum(r['单均毛利(含平台后返)'])
  const paid = toNum(r['有效订单金额（实付）'])
  const orders = toNum(r['有效订单量'])
  const refundRate = toNum(r['退款率'])
  const refundOrders = toNum(r['退款订单量'])
  if (onlineRevenue == null && profit == null && paid == null && orders == null) continue
  days.add(date)
  channels.add(channel)
  facts.push({
    date,
    channel,
    store,
    onlineRevenue,
    profit,
    marginRate,
    unitProfit,
    paid,
    orders,
    refundRate,
    refundOrders,
  })
}

/** 门店日供给：缺货 / 出勤 / 缺勤损失 */
const supply = []
const opsSupply = {}
if (supplyFile) {
  for (const r of readSheet(supplyFile, 'data')) {
    const date = toIso(r['日期'])
    const store = resolveStore(r['门店名称'] || r['门店'])
    if (!date || !store) continue
    const row = {
      date,
      store,
      storeId: String(r['门店id'] || '').trim(),
      onShelf: toNum(r['在架商品数']),
      sellable: toNum(r['可售商品数']),
      moving: toNum(r['动销商品数']),
      stockout: toNum(r['缺货商品数']),
      refundSku: toNum(r['退款商品数']),
      badSku: toNum(r['差评商品数']),
      attendance: toNum(r['商品出勤率']),
      absent: toNum(r['缺勤商品数']),
      absentLoss: toNum(r['缺勤商品损失金额']),
    }
    supply.push(row)
    if (!opsSupply[date]) opsSupply[date] = { summary: null, stores: [] }
    opsSupply[date].stores.push({
      name: store,
      shortName: store.replace(/^淘宝便利店/, '').replace(/[()]/g, ''),
      id: row.storeId || store,
      online: row.onShelf,
      sellable: row.sellable,
      active: row.moving,
      stockout: row.stockout,
      refundSku: row.refundSku,
      badSku: row.badSku,
      attendance: row.attendance,
      absent: row.absent,
      absentLoss: row.absentLoss,
      bundleCnt: null,
      bundleOrders: null,
      bundleGmv: null,
      bundlePaid: null,
      bundleUsers: null,
    })
  }
  for (const [date, block] of Object.entries(opsSupply)) {
    const list = block.stores
    const attendanceVals = list.map((s) => s.attendance).filter((v) => v != null)
    block.summary = {
      storeCnt: list.length,
      online: list.reduce((a, s) => a + (s.online || 0), 0),
      sellable: list.reduce((a, s) => a + (s.sellable || 0), 0),
      active: list.reduce((a, s) => a + (s.active || 0), 0),
      stockout: list.reduce((a, s) => a + (s.stockout || 0), 0),
      refundSku: list.reduce((a, s) => a + (s.refundSku || 0), 0),
      badSku: list.reduce((a, s) => a + (s.badSku || 0), 0),
      attendance: attendanceVals.length ? attendanceVals.reduce((a, b) => a + b, 0) / attendanceVals.length : null,
      absent: list.reduce((a, s) => a + (s.absent || 0), 0),
      absentLoss: Math.round(list.reduce((a, s) => a + (s.absentLoss || 0), 0) * 100) / 100,
      bundlePaid: 0,
      bundleOrders: 0,
    }
  }
}

/** 品类区间汇总（淘宝闪购商品明细，无品类毛利字段，用实际销售额） */
let categoryPeriod = null
const categoryByStore = []
if (productFile) {
  console.log('reading product detail…')
  const rows = readSheet(productFile, 'data')
  const catMap = new Map()
  const storeCatMap = new Map()
  let from = ''
  let to = ''
  for (const r of rows) {
    const period = parsePeriod(r['日期'])
    if (period) {
      from = period.from
      to = period.to
    }
    const store = resolveStore(r['门店名称'] || r['门店'])
    const category = String(r['一级分类'] || '未分类').trim() || '未分类'
    if (!store) continue
    const sales = toNum(r['实际销售额']) ?? toNum(r['订单交易额']) ?? 0
    const qty = toNum(r['销量(不含退款)']) ?? toNum(r['销量']) ?? 0
    const orders = toNum(r['带来订单量']) ?? 0
    const refundAmt = toNum(r['退款金额']) ?? 0
    const stockoutLoss =
      (toNum(r['缺货导致的流失单预计损失']) || 0) +
      (toNum(r['缺货导致的取消单预计损失']) || 0) +
      (toNum(r['缺货导致的整单退预计损失']) || 0) +
      (toNum(r['缺货导致的部分退预计损失']) || 0)
    const stockoutTimes = toNum(r['缺货次数']) || 0

    const cat = catMap.get(category) || { name: category, sales: 0, qty: 0, orders: 0, refundAmt: 0, stockoutLoss: 0, stockoutTimes: 0 }
    cat.sales += sales
    cat.qty += qty
    cat.orders += orders
    cat.refundAmt += refundAmt
    cat.stockoutLoss += stockoutLoss
    cat.stockoutTimes += stockoutTimes
    catMap.set(category, cat)

    const sk = `${store}||${category}`
    const sc = storeCatMap.get(sk) || { store, category, sales: 0, qty: 0, orders: 0, refundAmt: 0, stockoutLoss: 0, stockoutTimes: 0 }
    sc.sales += sales
    sc.qty += qty
    sc.orders += orders
    sc.refundAmt += refundAmt
    sc.stockoutLoss += stockoutLoss
    sc.stockoutTimes += stockoutTimes
    storeCatMap.set(sk, sc)
  }
  const round2 = (n) => Math.round(n * 100) / 100
  const categories = [...catMap.values()]
    .map((c) => ({
      name: c.name,
      sales: round2(c.sales),
      qty: Math.round(c.qty),
      orders: Math.round(c.orders),
      refundAmt: round2(c.refundAmt),
      stockoutLoss: round2(c.stockoutLoss),
      stockoutTimes: Math.round(c.stockoutTimes),
    }))
    .sort((a, b) => b.sales - a.sales)
  for (const sc of storeCatMap.values()) {
    categoryByStore.push({
      store: sc.store,
      category: sc.category,
      sales: round2(sc.sales),
      qty: Math.round(sc.qty),
      orders: Math.round(sc.orders),
      refundAmt: round2(sc.refundAmt),
      stockoutLoss: round2(sc.stockoutLoss),
      stockoutTimes: Math.round(sc.stockoutTimes),
    })
  }
  categoryPeriod = { from, to, channel: '淘宝闪购', categories }
}

const payload = {
  source: '数据源1',
  generatedAt: new Date().toISOString(),
  files: { launch: launchFile, facts: factFile, supply: supplyFile, product: productFile },
  days: [...days].sort(),
  channels: [...channels],
  stores,
  facts,
  supply,
  categoryPeriod,
  categoryByStore,
}

fs.mkdirSync(path.dirname(outFile), { recursive: true })
fs.writeFileSync(outFile, JSON.stringify(payload), 'utf8')

if (fs.existsSync(opsPackFile) && Object.keys(opsSupply).length) {
  const pack = JSON.parse(fs.readFileSync(opsPackFile, 'utf8'))
  pack.supply = opsSupply
  pack.updated_at = new Date().toISOString()
  const notes = Array.isArray(pack.notes) ? pack.notes.filter((n) => !String(n).startsWith('供给：')) : []
  notes.push(`供给：淘宝闪购店铺汇总 ${Object.keys(opsSupply).length} 天`)
  pack.notes = notes
  fs.writeFileSync(opsPackFile, JSON.stringify(pack), 'utf8')
}

console.log(
  JSON.stringify(
    {
      outFile,
      days: payload.days.length,
      range: [payload.days[0], payload.days.at(-1)],
      channels: payload.channels,
      stores: payload.stores.length,
      facts: payload.facts.length,
      supply: payload.supply.length,
      categoryPeriod: payload.categoryPeriod
        ? { from: payload.categoryPeriod.from, to: payload.categoryPeriod.to, cats: payload.categoryPeriod.categories.length }
        : null,
      categoryByStore: payload.categoryByStore.length,
      opsSupplyDays: Object.keys(opsSupply).length,
    },
    null,
    2,
  ),
)
