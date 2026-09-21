/** 门店 3km 竞争力追踪：类型、分色、状态（全自动：仅依赖追踪表既有字段） */

export type CompeteTrackRow = {
  storeName: string
  storeKey: string
  city: string
  mtdNetGRank3km: number | null
  mtdSearchRank3km: number | null
  mtdSearchPenetration: number | null
  competitorSearchPenetration: number | null
  currentDailyNetG: number
  top1RequiredDailyNetG: number
  top1DailyGap: number
  searchGapPp: number | null
}

export type CompeteTrackMeta = {
  generatedAt: string
  sourcePath: string
  sheetName: string
  sha256: string
  rowCount: number
  dataDate: string
  updateMode: string
  sourceLabel: string
}

export type CompeteTrackPayload = {
  meta: CompeteTrackMeta
  rows: CompeteTrackRow[]
}

export type RankFilter = 'all' | 'top1' | 'top2' | 'top3' | 'other'

/** 待业务确认：接近 Top1 的最大排名与缺口 */
export const STATUS_CONFIG = {
  nearTop1MaxRank: 3,
  /** 缺口 ≤ 该值且排名≤nearTop1MaxRank → 接近Top1；null 时用样本中位数 */
  nearTop1MaxGap: 500 as number | null,
  sprintMaxRank: 5,
}

/** 三态主色（本模块主用） */
export const TRI_COLOR = {
  good: '#52C41A',
  warn: '#FA8C16',
  bad: '#F5222D',
  neutral: '#BFBFBF',
} as const

export type CompeteGrade = 'S' | 'A' | 'B' | 'C' | 'D'

/** 缺口倍数 = 需达日均 / 当前日均（全自动，仅依赖表内两列） */
export function gapMultiple(row: CompeteTrackRow): number | null {
  if (!row.currentDailyNetG || row.currentDailyNetG <= 0) return null
  if (!row.top1RequiredDailyNetG || row.top1RequiredDailyNetG <= 0) return null
  return Number((row.top1RequiredDailyNetG / row.currentDailyNetG).toFixed(2))
}

export function isDualTop1(row: CompeteTrackRow) {
  return row.mtdNetGRank3km === 1 && row.mtdSearchRank3km === 1
}

/**
 * 状态分级 S~D（规则引擎，全自动，随追踪表刷新）：
 * S = 双榜Top1 且渗透≥40%（当前样本恰为5家）
 * A = 双榜Top1 且渗透<40%（当前样本恰为8家）
 * B = 待冲榜且缺口倍数<1.3
 * C = 缺口倍数 1.3–2.0
 * D = 缺口倍数≥2.0
 */
export function gradeOf(row: CompeteTrackRow): CompeteGrade {
  if (isDualTop1(row)) {
    return (row.mtdSearchPenetration ?? 0) >= 40 ? 'S' : 'A'
  }
  const m = gapMultiple(row)
  if (m == null) return row.top1DailyGap > 0 ? 'B' : 'A'
  if (m >= 2) return 'D'
  if (m >= 1.3) return 'C'
  return 'B'
}

export function gradeCounts(rows: CompeteTrackRow[]) {
  const out: Record<CompeteGrade, number> = { S: 0, A: 0, B: 0, C: 0, D: 0 }
  for (const r of rows) out[gradeOf(r)] += 1
  return out
}

export function gradeTone(grade: CompeteGrade): 'ok' | 'warn' | 'bad' {
  if (grade === 'S' || grade === 'A') return 'ok'
  if (grade === 'B') return 'warn'
  return 'bad'
}

export function gradeColor(grade: CompeteGrade) {
  if (grade === 'S' || grade === 'A') return TRI_COLOR.good
  if (grade === 'B') return TRI_COLOR.warn
  return TRI_COLOR.bad
}

/** 待冲榜：按缺口倍数降序（倍数越高越警示，直指“追不上的店”） */
export function chaseByMultiple(rows: CompeteTrackRow[]) {
  return [...rows]
    .filter((r) => r.top1DailyGap > 0)
    .map((r) => ({ row: r, multiple: gapMultiple(r) ?? 1 }))
    .sort((a, b) => b.multiple - a.multiple)
}

/** 门店详情冲刺建议（规则引擎，零维护） */
export function sprintTips(row: CompeteTrackRow): string[] {
  const tips: string[] = []
  const m = gapMultiple(row)
  if (row.top1DailyGap <= 0 && isDualTop1(row)) {
    tips.push('已双榜登顶：守住主搜渗透，避免大促期被竞对反超')
    if ((row.mtdSearchPenetration ?? 0) < 40) tips.push('渗透未达40%标线：补主搜坑产，冲S级')
    return tips
  }
  if (m != null) {
    if (m >= 2) tips.push(`缺口倍数 ${m.toFixed(2)}×：常规追赶已不够，需专项资源或调整对标`)
    else if (m >= 1.3) tips.push(`缺口倍数 ${m.toFixed(2)}×：需提日均净G ${Math.round(row.top1DailyGap).toLocaleString('zh-CN')}/日`)
    else tips.push(`缺口 ${Math.round(row.top1DailyGap).toLocaleString('zh-CN')}/日：小步快追，优先补主搜`)
  }
  if ((row.searchGapPp ?? 0) < 0) tips.push(`渗透落后竞对 ${Math.abs(row.searchGapPp ?? 0).toFixed(1)}pp：先追渗透再追净G`)
  if ((row.mtdNetGRank3km ?? 99) > 3) tips.push('3km排名3名开外：先定小目标进Top3')
  return tips.slice(0, 4)
}

export type CompeteStatus = 'Top1' | '接近Top1' | '重点冲刺' | '差距较大'

const RANK_COLORS: Record<number, string> = {
  1: '#22C55E',
  2: '#3B82F6',
  3: '#EAB308',
}

export function rankColor(rank: number | null) {
  if (rank == null) return '#EF4444'
  return RANK_COLORS[rank] ?? '#EF4444'
}

export function matchesRankFilter(row: CompeteTrackRow, filter: RankFilter) {
  const r = row.mtdNetGRank3km
  if (filter === 'all') return true
  if (r == null) return filter === 'other'
  if (filter === 'top1') return r === 1
  if (filter === 'top2') return r === 2
  if (filter === 'top3') return r === 3
  return r > 3
}

export function medianGap(rows: CompeteTrackRow[]) {
  const gaps = rows.map((r) => r.top1DailyGap).filter((g) => g > 0).sort((a, b) => a - b)
  if (!gaps.length) return 500
  const mid = Math.floor(gaps.length / 2)
  return gaps.length % 2 ? gaps[mid]! : (gaps[mid - 1]! + gaps[mid]!) / 2
}

export function competeStatus(row: CompeteTrackRow, rows: CompeteTrackRow[]): CompeteStatus {
  if (row.mtdNetGRank3km === 1 || row.top1DailyGap <= 0) return 'Top1'
  const gapLimit = STATUS_CONFIG.nearTop1MaxGap ?? medianGap(rows)
  if (
    row.mtdNetGRank3km != null &&
    row.mtdNetGRank3km <= STATUS_CONFIG.nearTop1MaxRank &&
    row.top1DailyGap > 0 &&
    row.top1DailyGap <= gapLimit
  ) {
    return '接近Top1'
  }
  if (row.top1DailyGap > 0 && row.mtdNetGRank3km != null && row.mtdNetGRank3km <= STATUS_CONFIG.sprintMaxRank) {
    return '重点冲刺'
  }
  return '差距较大'
}

export function statusTone(status: CompeteStatus): 'ok' | 'warn' | 'bad' | '' {
  if (status === 'Top1') return 'ok'
  if (status === '接近Top1') return 'ok'
  if (status === '重点冲刺') return 'warn'
  return 'bad'
}

export function rankBucketCounts(rows: CompeteTrackRow[], field: 'mtdNetGRank3km' | 'mtdSearchRank3km') {
  const out = { top1: 0, top2: 0, top3: 0, other: 0 }
  for (const r of rows) {
    const rank = r[field]
    if (rank === 1) out.top1 += 1
    else if (rank === 2) out.top2 += 1
    else if (rank === 3) out.top3 += 1
    else out.other += 1
  }
  return out
}
