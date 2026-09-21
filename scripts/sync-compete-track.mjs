/**
 * 门店核心指标追踪表 → web/web/src/data/storeCompeteTrack.json
 * 源：数据源/翱象 下「门店核心指标追踪表」xlsx（递归查找，优先 -上传模板）
 */
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import XLSX from 'xlsx'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const srcDir = path.join(root, '数据源')
const outFile = path.join(root, 'web', 'web', 'src', 'data', 'storeCompeteTrack.json')
const source1File = path.join(root, 'web', 'web', 'src', 'data', 'source1.json')

/** Excel 表头行（第 1 行）→ 逻辑字段 */
export const COLUMN_ALIASES = {
  storeName: ['店名', '门店', '门店名称', 'store_name'],
  mtdNetGRank3km: ['mtd净G排名_3km', 'mtd净g排名_3km', '净G排名_3km', 'MTD净G排名_3km'],
  mtdSearchPenetration: ['mtd主搜渗透率', '主搜渗透率', 'MTD主搜渗透率'],
  mtdSearchRank3km: ['主搜渗透排名_3km', 'mtd主搜排名_3km', '主搜排名_3km'],
  currentDailyNetG: ['当前日均净G', '当前日均净g', '日均净G'],
  top1RequiredDailyNetG: [
    '达到top1本月剩余天需达成日均净G',
    '达到Top1本月剩余天需达成日均净G',
    'top1所需日均净G',
  ],
  competitorSearchPenetration: ['竞对门店主搜渗透率', '竞对主搜渗透率', '竞争对手主搜渗透率'],
  dataDate: ['数据日期', 'date', '统计日期'],
}

function normStore(name) {
  return String(name || '')
    .replace(/（/g, '(')
    .replace(/）/g, ')')
    .replace(/\s+/g, '')
    .trim()
}

function toNum(v) {
  if (v == null || v === '') return null
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  const s = String(v).trim().replace(/,/g, '')
  if (!s) return null
  if (s.endsWith('%')) {
    const n = parseFloat(s)
    return Number.isFinite(n) ? n : null
  }
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

/** 渗透率：小数 → 0–100；已是百分数则保留 */
function toPercentDisplay(v) {
  const n = toNum(v)
  if (n == null) return null
  if (Math.abs(n) <= 1.5) return Number((n * 100).toFixed(4))
  return Number(n.toFixed(4))
}

function toRank(v) {
  const n = toNum(v)
  if (n == null || n < 1) return null
  return Math.round(n)
}

function findCompeteFile() {
  const hits = []
  function walk(dir) {
    if (!fs.existsSync(dir)) return
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, ent.name)
      if (ent.isDirectory()) walk(p)
      else if (/门店核心指标追踪/.test(ent.name) && /\.xlsx$/i.test(ent.name) && !ent.name.startsWith('~$')) {
        hits.push(p)
      }
    }
  }
  walk(srcDir)
  if (!hits.length) return null
  // 优先「-上传模板」，其次按修改时间取最新
  hits.sort((a, b) => {
    const bonus = (p) => (/上传模板/.test(path.basename(p)) ? 1 : 0)
    return bonus(b) - bonus(a) || fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs
  })
  return hits[0]
}

function resolveHeaderKey(cell) {
  const s = String(cell ?? '').trim()
  if (!s) return null
  for (const [field, aliases] of Object.entries(COLUMN_ALIASES)) {
    if (aliases.some((a) => a === s)) return field
  }
  for (const [field, aliases] of Object.entries(COLUMN_ALIASES)) {
    if (aliases.some((a) => a.length >= 4 && s.includes(a))) return field
  }
  return null
}

function normCity(v) {
  return String(v || '').trim().replace(/市/g, '')
}

function bareStore(v) {
  return String(v || '')
    .replace(/淘宝便利店/g, '')
    .replace(/优沃森超市/g, '')
    .replace(/[（()）\s]/g, '')
    .trim()
}

function loadCityMap() {
  const map = new Map()
  try {
    const data = JSON.parse(fs.readFileSync(source1File, 'utf8'))
    for (const s of data.stores || []) {
      const key = normStore(s.name)
      if (key) map.set(key, normCity(s.city))
      const b = bareStore(s.name)
      if (b && !map.has(b)) map.set(b, normCity(s.city))
    }
  } catch {
    /* source1 可选 */
  }
  return map
}

function parseArgs() {
  const dateArg = process.argv.find((a) => a.startsWith('--date='))
  return { dataDate: dateArg ? dateArg.slice(7) : null }
}

function readWorkbook(fullPath) {
  const buf = fs.readFileSync(fullPath)
  const sha256 = crypto.createHash('sha256').update(buf).digest('hex')
  const wb = XLSX.read(buf, { type: 'buffer', cellDates: true })
  const sheetName = wb.SheetNames[0]
  const matrix = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { defval: null, header: 1 })
  return { sha256, sheetName, matrix, relPath: path.relative(root, fullPath).replace(/\\/g, '/') }
}

function findHeaderRowIndex(matrix) {
  for (let i = 0; i < Math.min(matrix.length, 15); i++) {
    const row = matrix[i] || []
    const keys = row.map((c) => resolveHeaderKey(c)).filter(Boolean)
    if (keys.includes('storeName') && keys.includes('currentDailyNetG')) return i
  }
  return 2
}

function buildColumnIndex(headerRow) {
  const idx = {}
  headerRow.forEach((cell, col) => {
    const field = resolveHeaderKey(cell)
    if (field && idx[field] == null) idx[field] = col
  })
  const required = [
    'storeName',
    'mtdNetGRank3km',
    'mtdSearchPenetration',
    'mtdSearchRank3km',
    'currentDailyNetG',
    'top1RequiredDailyNetG',
    'competitorSearchPenetration',
  ]
  const missing = required.filter((k) => idx[k] == null)
  if (missing.length) {
    throw new Error(`Excel 缺少列映射：${missing.join('、')}。表头：${JSON.stringify(headerRow)}`)
  }
  return idx
}

function cell(row, col) {
  if (col == null || !row) return null
  return row[col] ?? null
}

/** 城市映射完全根据门店名称识别：归一全名 → 去品牌短名 */
function resolveCity(storeName, key, cityMap) {
  const direct = normCity(cityMap.get(key))
  if (direct) return direct
  const b = bareStore(storeName)
  if (b) {
    const hit = normCity(cityMap.get(b))
    if (hit) return hit
  }
  return ''
}

function main() {
  const { dataDate: cliDate } = parseArgs()
  const fullPath = findCompeteFile()
  if (!fullPath) throw new Error('未找到 数据源/**/门店核心指标追踪表*.xlsx')

  const { sha256, sheetName, matrix, relPath } = readWorkbook(fullPath)
  const headerIdx = findHeaderRowIndex(matrix)
  const col = buildColumnIndex(matrix[headerIdx])
  const cityMap = loadCityMap()

  let fileDataDate = cliDate
  const rows = []
  const seen = new Set()

  for (let r = headerIdx + 1; r < matrix.length; r++) {
    const row = matrix[r]
    if (!row || !row.some((c) => c != null && String(c).trim() !== '')) continue

    const rawName = cell(row, col.storeName)
    const storeName = String(rawName ?? '').trim()
    if (!storeName) continue

    const key = normStore(storeName)
    if (seen.has(key)) throw new Error(`重复门店：${storeName}`)
    seen.add(key)

    const rowDate = cell(row, col.dataDate)
    if (rowDate && !fileDataDate) {
      const d = String(rowDate).slice(0, 10)
      if (/^\d{4}-\d{2}-\d{2}$/.test(d)) fileDataDate = d
    }

    const mtdSearchPenetration = toPercentDisplay(cell(row, col.mtdSearchPenetration))
    const competitorSearchPenetration = toPercentDisplay(cell(row, col.competitorSearchPenetration))
    const currentDailyNetG = toNum(cell(row, col.currentDailyNetG))
    const mtdNetGRank3km = toRank(cell(row, col.mtdNetGRank3km))
    let top1RequiredDailyNetG = toNum(cell(row, col.top1RequiredDailyNetG))

    if (currentDailyNetG == null) {
      throw new Error(`门店 ${storeName} 缺少当前日均净G`)
    }
    // 已是 Top1 时模板用「-」占位：视为无需冲刺，所需日均=当前，缺口为 0
    if (top1RequiredDailyNetG == null) {
      if (mtdNetGRank3km === 1) top1RequiredDailyNetG = currentDailyNetG
      else throw new Error(`门店 ${storeName} 缺少「达到top1本月剩余天需达成日均净G」`)
    }

    const top1DailyGap = top1RequiredDailyNetG - currentDailyNetG
    const searchGapPp =
      mtdSearchPenetration != null && competitorSearchPenetration != null
        ? Number((mtdSearchPenetration - competitorSearchPenetration).toFixed(2))
        : null

    rows.push({
      storeName: key.includes('(') ? storeName.replace(/（/g, '(').replace(/）/g, ')') : storeName,
      storeKey: key,
      city: resolveCity(storeName, key, cityMap),
      mtdNetGRank3km,
      mtdSearchRank3km: toRank(cell(row, col.mtdSearchRank3km)),
      mtdSearchPenetration,
      competitorSearchPenetration,
      currentDailyNetG,
      top1RequiredDailyNetG,
      top1DailyGap: Number(top1DailyGap.toFixed(2)),
      searchGapPp,
    })
  }

  if (!rows.length) throw new Error('Excel 无有效门店行')

  if (!fileDataDate) {
    const st = fs.statSync(fullPath)
    fileDataDate = st.mtime.toISOString().slice(0, 10)
  }

  const payload = {
    meta: {
      generatedAt: new Date().toISOString(),
      sourcePath: relPath,
      sheetName,
      sha256,
      rowCount: rows.length,
      dataDate: fileDataDate,
      updateMode: 'manual_sync',
      sourceLabel: '核心指标追踪表',
    },
    rows,
  }

  fs.mkdirSync(path.dirname(outFile), { recursive: true })
  const tmp = `${outFile}.tmp`
  fs.writeFileSync(tmp, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
  fs.renameSync(tmp, outFile)
  console.log(`Wrote ${rows.length} stores → ${path.relative(root, outFile)} (dataDate=${fileDataDate})`)
}

main()
