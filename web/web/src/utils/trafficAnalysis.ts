export type TrafficDimension = 'platform' | 'app'
export type TrafficMetric = 'exposure' | 'entry' | 'orders' | 'p1' | 'p2' | 'overall'
export type TrafficFact = {
  storeId: string; store: string; city: string; dimension: TrafficDimension; source: string; row: number
  /** ISO date when grain=day; omitted for period UV snapshots */
  date?: string
  exposure: number | null; entry: number | null; orders: number | null
  reportedRates: (string | null)[]
}
export type TrafficData = {
  schemaVersion: number
  period: { from: string; to: string; grain: string }
  source: { file: string; sheet: string; range: string; exportedAt: string; sha256: string }
  facts: TrafficFact[]
}
export type TrafficSummary = {
  exposure: number | null; entry: number | null; orders: number | null
  p1: number | null; p2: number | null; overall: number | null
  rateBasis: 'reported' | 'record-ratio' | 'empty'
  storeCount: number; cityCount: number; recordCount: number
}

export const TRAFFIC_METRICS: { key: TrafficMetric; label: string }[] = [
  { key: 'exposure', label: '曝光人数' }, { key: 'entry', label: '进店人数' }, { key: 'orders', label: '下单人数' },
  { key: 'p1', label: 'P1 进店转化率' }, { key: 'p2', label: 'P2 下单转化率' }, { key: 'overall', label: '整体转化率' },
]

export function trafficCity(city: string) {
  const text = city.replace(/市/g, '').trim()
  if (text.includes('昆山')) return '苏州'
  return text
}
function storeKey(store: string) { return store.replace(/（/g, '(').replace(/）/g, ')').replace(/\s/g, '') }

function selList(v?: string | string[]) {
  if (v == null || v === '') return []
  if (Array.isArray(v)) return v.map((x) => String(x || '').trim()).filter(Boolean)
  const raw = String(v).trim()
  if (!raw) return []
  if (raw.includes('、')) return raw.split('、').map((x) => x.trim()).filter(Boolean)
  if (raw.includes('|')) return raw.split('|').map((x) => x.trim()).filter(Boolean)
  return [raw]
}

function matchTrafficCity(rowCity: string, selected?: string | string[]) {
  const list = selList(selected)
  if (!list.length || list.some((c) => c === '全国' || c === '全部')) return true
  const row = trafficCity(rowCity)
  return list.some((c) => trafficCity(c) === row)
}

function matchTrafficStore(row: TrafficFact, selected?: string | string[]) {
  const list = selList(selected)
  if (!list.length || list.some((s) => s === '全部')) return true
  const key = storeKey(row.store)
  return list.some((s) => s === row.storeId || storeKey(s) === key)
}

function inDateRange(row: TrafficFact, from: string, to: string) {
  if (!row.date) return false
  return row.date >= from && row.date <= to
}

/** Day grain: slice by date. Period grain: only exact full-period match; never invent days. */
export function selectTraffic(data: TrafficData, filters: {
  from: string; to: string; dimension: TrafficDimension; city?: string | string[]; store?: string | string[]; source?: string
}) {
  if (!filters.from || !filters.to || filters.from > filters.to) return []
  const grain = data.period.grain
  if (grain === 'period') {
    if (filters.from !== data.period.from || filters.to !== data.period.to) return []
  } else if (grain !== 'day') {
    return []
  }
  return data.facts.filter(r => {
    if (grain === 'day' && !inDateRange(r, filters.from, filters.to)) return false
    return r.dimension === filters.dimension
      && matchTrafficCity(r.city, filters.city)
      && matchTrafficStore(r, filters.store)
      && (!filters.source || r.source === filters.source)
  })
}

function sumComplete(rows: TrafficFact[], field: 'exposure' | 'entry' | 'orders'): number | null {
  if (!rows.length || rows.some(r => r[field] === null || !Number.isFinite(r[field]) || r[field]! < 0)) return null
  return rows.reduce((n, r) => n + r[field]!, 0)
}

export function trafficRatio(n: number | null, d: number | null): number | null {
  return n === null || d === null || d <= 0 ? null : n / d
}

/** A single record retains the export's rate, including its rounding. */
export function reportedTrafficRate(value: string | null | undefined): number | null {
  if (!value || !/^\d+(\.\d+)?%$/.test(value.trim())) return null
  return Number(value.trim().slice(0, -1)) / 100
}

/** Count sums are record totals, not cross-store/source de-duplicated UV. */
export function summarizeTraffic(rows: TrafficFact[]): TrafficSummary {
  if (new Set(rows.map(r => r.dimension)).size > 1) throw new Error('平台渠道与 APP 内页面不能合并累计')
  const exposure = sumComplete(rows, 'exposure'), entry = sumComplete(rows, 'entry'), orders = sumComplete(rows, 'orders')
  const single = rows.length === 1
  const rates = single ? rows[0]!.reportedRates : []
  return { exposure, entry, orders,
    p1: single ? reportedTrafficRate(rates[0]) : trafficRatio(entry, exposure),
    p2: single ? reportedTrafficRate(rates[1]) : trafficRatio(orders, entry),
    overall: single ? reportedTrafficRate(rates[2]) : trafficRatio(orders, exposure),
    rateBasis: single ? 'reported' : rows.length ? 'record-ratio' : 'empty',
    storeCount: new Set(rows.map(r => r.storeId)).size,
    cityCount: new Set(rows.map(r => trafficCity(r.city))).size, recordCount: rows.length }
}

export function groupTraffic(rows: TrafficFact[], key: 'source' | 'city' | 'store') {
  const groups = new Map<string, TrafficFact[]>()
  for (const row of rows) {
    const id = key === 'store' ? row.storeId : key === 'city' ? trafficCity(row.city) : row.source
    groups.set(id, [...(groups.get(id) || []), row])
  }
  return [...groups].map(([id, facts]) => ({ id, name: key === 'store' ? facts[0]!.store : id,
    city: facts[0]!.city, facts, ...summarizeTraffic(facts) }))
}

/** Daily series within selected rows; missing days are omitted (not zero-filled). */
export function trafficDailySeries(rows: TrafficFact[]) {
  const byDay = new Map<string, TrafficFact[]>()
  for (const row of rows) {
    if (!row.date) continue
    const list = byDay.get(row.date) || []
    list.push(row)
    byDay.set(row.date, list)
  }
  return [...byDay.keys()].sort().map((date) => ({ date, ...summarizeTraffic(byDay.get(date)!) }))
}

/** Relative change. Counts use ratio; rates use percentage-point difference. */
export function trafficDelta(cur: number | null, prev: number | null, kind: 'ratio' | 'pts' = 'ratio') {
  if (cur == null || prev == null) return null
  if (kind === 'pts') return cur - prev
  if (prev === 0) return null
  return (cur - prev) / Math.abs(prev)
}

export function trafficMetricDelta(cur: TrafficSummary, prev: TrafficSummary, metric: TrafficMetric) {
  const kind = metric === 'p1' || metric === 'p2' || metric === 'overall' ? 'pts' : 'ratio'
  return trafficDelta(cur[metric], prev[metric], kind)
}

export function trafficNumber(value: number | null) {
  return value === null ? '—' : value.toLocaleString('zh-CN', { maximumFractionDigits: 0 })
}
export function trafficPercent(value: number | null) {
  return value === null ? '—' : `${(value * 100).toLocaleString('zh-CN', { minimumFractionDigits: 1, maximumFractionDigits: 2 })}%`
}
export function trafficValue(value: number | null, metric: TrafficMetric) {
  return ['p1', 'p2', 'overall'].includes(metric) ? trafficPercent(value) : trafficNumber(value)
}
