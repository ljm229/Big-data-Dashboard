import * as XLSX from 'xlsx'
import type { CompeteTrackPayload, CompeteTrackRow } from './competeTrack'
import { SOURCE1_STORES, source1StoreCity } from '../api/source1'
import { bareStoreName } from './storeName'

export const COMPETE_TRACK_TEMPLATE_HEADERS = [
  '店名',
  'mtd净G排名_3km',
  'mtd主搜渗透率',
  '主搜渗透排名_3km',
  '当前日均净G',
  '达到top1本月剩余天需达成日均净G',
  '竞对门店主搜渗透率',
  '数据日期',
] as const

const COLUMN_ALIASES: Record<string, string[]> = {
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

/** 城市统一存短名（苏州/杭州），展示与聚合不分裂 */
function normCity(v: unknown) {
  return String(v || '').trim().replace(/市$/, '')
}

/** 城市映射完全根据门店名称识别：精确名称 → 归一名称 → 去品牌短名 */
function resolveCompeteCity(storeName: string) {
  const direct = normCity(source1StoreCity(storeName))
  if (direct) return direct
  const bare = bareStoreName(storeName)
  if (bare) {
    const hit =
      SOURCE1_STORES.find((s) => bareStoreName(s.name) === bare) ||
      SOURCE1_STORES.find((s) => {
        const b = bareStoreName(s.name)
        return b && (b.includes(bare) || bare.includes(b))
      })
    if (hit) return normCity((hit as { city?: string }).city || '')
  }
  return ''
}

function normStore(name: string) {
  return String(name || '')
    .replace(/（/g, '(')
    .replace(/）/g, ')')
    .replace(/\s+/g, '')
    .trim()
}

function toNum(v: unknown): number | null {
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

function toPercentDisplay(v: unknown): number | null {
  const n = toNum(v)
  if (n == null) return null
  if (Math.abs(n) <= 1.5) return Number((n * 100).toFixed(4))
  return Number(n.toFixed(4))
}

function toRank(v: unknown): number | null {
  const n = toNum(v)
  if (n == null || n < 1) return null
  return Math.round(n)
}

function resolveHeaderKey(cell: unknown): string | null {
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

function findHeaderRowIndex(matrix: unknown[][]) {
  for (let i = 0; i < Math.min(matrix.length, 15); i++) {
    const row = matrix[i] || []
    const keys = row.map((c) => resolveHeaderKey(c)).filter(Boolean)
    if (keys.includes('storeName') && keys.includes('currentDailyNetG')) return i
  }
  return 0
}

function buildColumnIndex(headerRow: unknown[]) {
  const idx: Record<string, number> = {}
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
    throw new Error(`Excel 缺少列：${missing.join('、')}。请使用「模板」下载后对照表头填写。`)
  }
  return idx
}

function cell(row: unknown[] | undefined, col: number | undefined) {
  if (col == null || !row) return null
  return row[col] ?? null
}

function formatDataDate(v: unknown): string | null {
  if (v == null || v === '') return null
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    return v.toISOString().slice(0, 10)
  }
  const s = String(v).trim().slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null
}

export function buildCompeteTrackTemplateWorkbook(): ArrayBuffer {
  const aoa: unknown[][] = [
    [...COMPETE_TRACK_TEMPLATE_HEADERS],
    [
      '淘宝便利店(示例店)',
      2,
      0.156,
      3,
      5189,
      5577,
      0.237,
      '2026-09-18',
    ],
  ]
  const ws = XLSX.utils.aoa_to_sheet(aoa)
  ws['!cols'] = [
    { wch: 24 }, { wch: 16 }, { wch: 14 }, { wch: 16 }, { wch: 14 }, { wch: 32 }, { wch: 20 }, { wch: 12 },
  ]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'data')
  return XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer
}

export function downloadCompeteTrackTemplate(filename = '门店核心指标追踪表-上传模板.xlsx') {
  const buf = buildCompeteTrackTemplateWorkbook()
  const blob = new Blob([buf], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export async function parseCompeteTrackFile(file: File): Promise<CompeteTrackPayload> {
  const buf = await file.arrayBuffer()
  const wb = XLSX.read(buf, { type: 'array', cellDates: true })
  const sheetName = wb.SheetNames[0]
  if (!sheetName) throw new Error('Excel 无工作表')
  const matrix = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { defval: null, header: 1 }) as unknown[][]
  const headerIdx = findHeaderRowIndex(matrix)
  const col = buildColumnIndex(matrix[headerIdx] || [])

  let fileDataDate: string | null = null
  const rows: CompeteTrackRow[] = []
  const seen = new Set<string>()

  for (let r = headerIdx + 1; r < matrix.length; r++) {
    const row = matrix[r]
    if (!row || !row.some((c) => c != null && String(c).trim() !== '')) continue

    const storeName = String(cell(row, col.storeName) ?? '').trim()
    if (!storeName || /示例/.test(storeName)) continue

    const key = normStore(storeName)
    if (seen.has(key)) throw new Error(`重复门店：${storeName}`)
    seen.add(key)

    const rowDate = formatDataDate(cell(row, col.dataDate))
    if (rowDate && !fileDataDate) fileDataDate = rowDate

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

    const normalizedName = key.includes('(')
      ? storeName.replace(/（/g, '(').replace(/）/g, ')')
      : storeName

    rows.push({
      storeName: normalizedName,
      storeKey: key,
      city: resolveCompeteCity(normalizedName),
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

  if (!rows.length) throw new Error('未解析到有效门店行，请检查表头与数据')

  if (!fileDataDate) {
    fileDataDate = new Date().toISOString().slice(0, 10)
  }

  return {
    meta: {
      generatedAt: new Date().toISOString(),
      sourcePath: file.name,
      sheetName,
      sha256: '',
      rowCount: rows.length,
      dataDate: fileDataDate,
      updateMode: 'browser_upload',
      sourceLabel: '核心指标追踪表',
    },
    rows,
  }
}
