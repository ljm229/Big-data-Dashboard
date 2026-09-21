import { computed, ref } from 'vue'
import raw from '../data/storeCompeteTrack.json'
import { canonCity, source1StoreCity } from './source1'
import { bareStoreName, sameStore } from '../utils/storeName'
import {
  type CompeteTrackPayload,
  type CompeteTrackRow,
  type RankFilter,
  chaseByMultiple,
  gradeCounts,
  matchesRankFilter,
  rankBucketCounts,
} from '../utils/competeTrack'

const builtin = raw as CompeteTrackPayload
const LS_KEY = 'storeCompeteTrack.override'

function readOverride(): CompeteTrackPayload | null {
  try {
    const s = localStorage.getItem(LS_KEY)
    if (!s) return null
    return JSON.parse(s) as CompeteTrackPayload
  } catch {
    return null
  }
}

const HISTORY_KEY = 'storeCompeteTrack.history'
type HistoryEntry = { dataDate: string; rows: CompeteTrackRow[] }
function readHistory(): HistoryEntry[] {
  try {
    const s = localStorage.getItem(HISTORY_KEY)
    if (!s) return []
    const v = JSON.parse(s)
    return Array.isArray(v) ? v : []
  } catch {
    return []
  }
}
function writeHistory(list: HistoryEntry[]) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(list.slice(-12)))
  } catch { /* 忽略 */ }
}
/** 上一期快照：同一 dataDate 去重，按日期取最近一期 */
export function getPrevCompeteSnapshot(curDate: string): HistoryEntry | null {
  const list = readHistory().filter((h) => h.dataDate && h.dataDate < curDate).sort((a, b) => a.dataDate.localeCompare(b.dataDate))
  if (list.length) return list[list.length - 1]!
  // 内置只有一期时回退：无上一期
  return null
}
/** 取某门店上一期行 */
export function getPrevCompeteRow(curDate: string, storeKey: string, storeName: string): CompeteTrackRow | null {
  const snap = getPrevCompeteSnapshot(curDate)
  if (!snap) return null
  return snap.rows.find((r) => r.storeKey === storeKey || sameStore(r.storeName, storeName) || sameStore(r.storeKey, storeKey)) || null
}
/** 环比：(cur - prev) / |prev|，prev 缺失或为 0 返回 null */
export function wowRate(cur: number | null | undefined, prev: number | null | undefined) {
  if (cur == null || prev == null || !Number.isFinite(cur) || !Number.isFinite(prev) || prev === 0) return null
  return (cur - prev) / Math.abs(prev)
}

const payload = ref<CompeteTrackPayload>(readOverride() || builtin)

export const competeTrackPayload = payload
export const competeTrackRevision = computed(() => payload.value.meta?.generatedAt || '')

export function applyCompeteTrackPayload(next: CompeteTrackPayload) {
  const prev = payload.value
  payload.value = next
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(next))
    // 历史快照：按 dataDate 去重保留，便于计算环比
    const hist = readHistory().filter((h) => h.dataDate !== next.meta.dataDate)
    if (prev?.meta?.dataDate && prev.meta.dataDate !== next.meta.dataDate && prev.rows?.length) {
      hist.push({ dataDate: prev.meta.dataDate, rows: prev.rows })
    }
    hist.push({ dataDate: next.meta.dataDate, rows: next.rows })
    hist.sort((a, b) => a.dataDate.localeCompare(b.dataDate))
    writeHistory(hist)
  } catch { /* 忽略 */ }
}

export function resetCompeteTrackToBuiltin() {
  payload.value = builtin
  localStorage.removeItem(LS_KEY)
}

export function getCompeteTrackMeta() {
  return payload.value.meta
}

export function getCompeteTrackRows(): CompeteTrackRow[] {
  return payload.value.rows || []
}

export function hasCompeteTrackData() {
  return (payload.value.rows?.length || 0) > 0
}

function rowCity(row: CompeteTrackRow) {
  if (row.city) return row.city
  return source1StoreCity(row.storeName) || ''
}

function matchCity(row: CompeteTrackRow, cities: string[]) {
  if (!cities.length || cities.includes('全国')) return true
  const c = rowCity(row)
  return cities.some((sel) => canonCity(sel) === canonCity(c) || c.includes(sel.replace(/市$/, '')))
}

function matchStore(row: CompeteTrackRow, stores: string[]) {
  if (!stores.length || stores.includes('全部')) return true
  return stores.some((s) => sameStore(s, row.storeName) || sameStore(s, row.storeKey))
}

export type CompeteFilterOpts = {
  cities: string[]
  stores: string[]
  rankFilter: RankFilter
  needSprint: boolean
}

export function filterCompeteRows(opts: CompeteFilterOpts): CompeteTrackRow[] {
  let rows = getCompeteTrackRows().filter((r) => matchCity(r, opts.cities) && matchStore(r, opts.stores))
  if (opts.rankFilter !== 'all') rows = rows.filter((r) => matchesRankFilter(r, opts.rankFilter))
  if (opts.needSprint) rows = rows.filter((r) => r.top1DailyGap > 0)
  return rows
}

/** 第1行 5 卡：参评 / 双榜Top1 / 待冲榜 / 渗透落后竞对 / 需增日均净G（全自动） */
export function competeKpis(rows: CompeteTrackRow[]) {
  const n = rows.length
  if (!n) {
    return {
      storeCnt: 0,
      dualTop1: 0,
      dualTop1Rate: null as number | null,
      sprintCnt: 0,
      lagCnt: 0,
      worstGapPp: null as number | null,
      totalGap: 0,
      grade: { S: 0, A: 0, B: 0, C: 0, D: 0 },
    }
  }
  const dualTop1 = rows.filter((r) => r.mtdNetGRank3km === 1 && r.mtdSearchRank3km === 1).length
  const gaps = rows.map((r) => r.top1DailyGap).filter((g) => Number.isFinite(g) && g > 0)
  const lagGaps = rows
    .map((r) => r.searchGapPp)
    .filter((v): v is number => v != null && Number.isFinite(v) && v < 0)
  return {
    storeCnt: n,
    dualTop1,
    dualTop1Rate: dualTop1 / n,
    sprintCnt: gaps.length,
    lagCnt: lagGaps.length,
    worstGapPp: lagGaps.length ? Math.min(...lagGaps) : null,
    totalGap: Math.round(gaps.reduce((a, b) => a + b, 0)),
    grade: gradeCounts(rows),
  }
}

/** 重点冲刺榜：top1DailyGap>0，按缺口倍数降序 */
export function top1ChaseRows(rows: CompeteTrackRow[]) {
  return chaseByMultiple(rows)
    .slice(0, 12)
    .map(({ row, multiple }) => ({ ...row, gapMultiple: multiple }))
}

/** 城市分布：参评/登顶（按城市聚合，全自动） */
export function cityDistribute(rows: CompeteTrackRow[]) {
  const map = new Map<string, { city: string; total: number; top1: number }>()
  for (const r of rows) {
    const city = r.city || '未标注'
    const cur = map.get(city) || { city, total: 0, top1: 0 }
    cur.total += 1
    if (r.mtdNetGRank3km === 1) cur.top1 += 1
    map.set(city, cur)
  }
  return [...map.values()].sort((a, b) => b.total - a.total || b.top1 - a.top1)
}

export function shortStoreLabel(name: string) {
  return bareStoreName(name) || name
}

export { rankBucketCounts }
