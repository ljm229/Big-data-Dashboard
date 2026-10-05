import raw from '../data/trafficData.json'

export interface TrafficFact {
  storeId: string
  store: string
  city: string
  dimension: 'platform' | 'app'
  source: string
  exposure: number | null
  entry: number | null
  orders: number | null
  date?: string
}
export interface TrafficTotals { exposure: number; entry: number; orders: number }
export interface TrafficRates extends TrafficTotals {
  enterRate: number | null
  orderRate: number | null
  overallRate: number | null
}

const data = raw as { period: { from: string; to: string; grain: string }; facts: TrafficFact[] }
export const TRAFFIC_FROM = data.period.from
export const TRAFFIC_TO = data.period.to
const FACTS = data.facts

export interface TrafficScope { from: string; to: string; cities: string[]; stores: string[]; dims: string[] }

export function normList(v: unknown): string[] {
  if (v == null) return []
  if (Array.isArray(v)) return v.map((x) => String(x)).filter((x) => x && x !== '全国' && x !== '全部')
  const s = String(v)
  if (!s || s === '全国' || s === '全部') return []
  return s.split('|').filter(Boolean)
}

export function clampRange(from: string, to: string): [string, string] {
  const f = from < TRAFFIC_FROM ? TRAFFIC_FROM : from
  const t = to > TRAFFIC_TO ? TRAFFIC_TO : to
  return f > t ? [TRAFFIC_TO, TRAFFIC_TO] : [f, t]
}

function daysBetween(a: string, b: string) {
  return Math.round((Date.parse(b) - Date.parse(a)) / 86400000)
}
function addDays(d: string, n: number) {
  const t = new Date(`${d}T00:00:00Z`)
  t.setUTCDate(t.getUTCDate() + n)
  return t.toISOString().slice(0, 10)
}
/** 上期：与本期等长的紧邻前段（流量数据从8-15开始，早期会被截断） */
export function prevRangeOf(from: string, to: string): [string, string] {
  const len = daysBetween(from, to) + 1
  const pTo = addDays(from, -1)
  const pFrom = addDays(from, -len)
  return clampRange(pFrom < TRAFFIC_FROM ? TRAFFIC_FROM : pFrom, pTo)
}

export function scopeFacts(s: TrafficScope): TrafficFact[] {
  const [f, t] = clampRange(s.from, s.to)
  return FACTS.filter((r) => {
    if (!r.date || r.date < f || r.date > t) return false
    if (s.cities.length && !s.cities.some((c) => r.city.includes(c) || c.includes(r.city))) return false
    if (s.stores.length && !s.stores.some((x) => r.store === x || r.store.includes(x) || r.storeId === x)) return false
    if (s.dims.length && !s.dims.includes(r.dimension)) return false
    return true
  })
}

export function sumFacts(list: TrafficFact[]): TrafficTotals {
  let exposure = 0, entry = 0, orders = 0
  for (const r of list) {
    exposure += r.exposure || 0
    entry += r.entry || 0
    orders += r.orders || 0
  }
  return { exposure, entry, orders }
}
export function withRates(t: TrafficTotals): TrafficRates {
  return {
    ...t,
    enterRate: t.exposure ? t.entry / t.exposure : null,
    orderRate: t.entry ? t.orders / t.entry : null,
    overallRate: t.exposure ? t.orders / t.exposure : null,
  }
}

export function groupSum(list: TrafficFact[], key: (r: TrafficFact) => string): Map<string, TrafficRates & { name: string }> {
  const m = new Map<string, TrafficTotals>()
  for (const r of list) {
    const k = key(r)
    const cur = m.get(k) || { exposure: 0, entry: 0, orders: 0 }
    cur.exposure += r.exposure || 0
    cur.entry += r.entry || 0
    cur.orders += r.orders || 0
    m.set(k, cur)
  }
  const out = new Map<string, TrafficRates & { name: string }>()
  for (const [k, v] of m) out.set(k, { name: k, ...withRates(v) })
  return out
}

export function rankMap(list: TrafficFact[], key: (r: TrafficFact) => string): Map<string, number> {
  const arr = [...groupSum(list, key).entries()].sort((a, b) => b[1].orders - a[1].orders)
  const m = new Map<string, number>()
  arr.forEach(([k], i) => m.set(k, i + 1))
  return m
}

/** 门店首次有流量的日期（新店爬坡用） */
const firstSeenCache = new Map<string, string>()
export function storeFirstSeen(store: string): string {
  const hit = firstSeenCache.get(store)
  if (hit) return hit
  let min = ''
  for (const r of FACTS) {
    if (r.store === store && r.date && (!min || r.date < min)) min = r.date
  }
  firstSeenCache.set(store, min)
  return min
}

export function dateList(from: string, to: string): string[] {
  const [f, t] = clampRange(from, to)
  const out: string[] = []
  for (let d = f; d <= t; d = addDays(d, 1)) out.push(d)
  return out
}
export function isWeekend(d: string) {
  const w = new Date(`${d}T00:00:00Z`).getUTCDay()
  return w === 0 || w === 6
}

export function rel(cur: number | null | undefined, prev: number | null | undefined): number | null {
  if (cur == null || prev == null || prev === 0) return null
  return (cur - prev) / Math.abs(prev)
}
export function fmtRel(v: number | null): string {
  if (v == null) return '—'
  return `${v >= 0 ? '+' : ''}${(v * 100).toFixed(1)}%`
}
export function shortStore(n: string) {
  return String(n || '').replace(/^淘宝便利店/, '').replace(/[()]/g, '')
}
