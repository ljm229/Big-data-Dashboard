import type { AssessBoard, AssessmentWeeklyReport } from './opsDashboard'
import { formatStoreName } from '../utils/storeName'

const API_BASE = String(import.meta.env.VITE_API_BASE || '/api').replace(/\/$/, '')

function withStoreLabel<T extends { shortName?: string; name?: string }>(row: T): T {
  const shortName = formatStoreName(row.shortName || row.name) || row.shortName
  const name = formatStoreName(row.name || row.shortName) || row.name
  return { ...row, shortName, name }
}

export type QualityCoverage = {
  dates: Array<{ date: string; storeCount: number }>
  latestDate: string | null
  state: { version: number; updated_at: string; latestDate: string; rowCount: number } | null
  sources: Array<{
    source: string
    label: string
    available: boolean
    rows?: number
    dateMin?: string
    dateMax?: string
  }>
}

export type QualityOptions = {
  cities: string[]
  stores: Array<{ id: string; shortName: string; name: string; code: string; city: string }>
}

async function getJson<T>(path: string, timeoutMs = 2500): Promise<T> {
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(`${API_BASE}${path}`, { signal: controller.signal, cache: 'no-store' })
    if (!response.ok) throw new Error(`API ${response.status}`)
    return (await response.json()) as T
  } finally {
    window.clearTimeout(timer)
  }
}

function query(date: string, city = '全部', store = '全部') {
  const params = new URLSearchParams({ date, city, store })
  return params.toString()
}

export function fetchDatabaseCoverage() {
  return getJson<QualityCoverage>('/quality/coverage')
}

export function fetchDatabaseOptions(date: string) {
  return getJson<QualityOptions>(`/quality/options?${query(date)}`).then((options) => ({
    ...options,
    stores: (options.stores || []).map((s) => withStoreLabel(s)),
  }))
}

export async function fetchDatabaseBoard(date: string, city = '全部', store = '全部') {
  const result = await getJson<{ data: AssessBoard | null }>(`/quality/board?${query(date, city, store)}`)
  if (!result.data) return null
  return {
    ...result.data,
    rows: (result.data.rows || []).map((r) => withStoreLabel(r)),
  }
}

export async function fetchDatabaseReport(date: string, city = '全部', store = '全部') {
  const result = await getJson<{ data: AssessmentWeeklyReport | null }>(`/quality/report?${query(date, city, store)}`)
  if (!result.data) return null
  return {
    ...result.data,
    rowsAsc: (result.data.rowsAsc || []).map((r) => withStoreLabel(r)),
    merchantRank: (result.data.merchantRank || []).map((r) => withStoreLabel(r)),
  }
}

export function subscribeQualityUpdates(onUpdate: (payload: unknown) => void) {
  let stopped = false, busy = false
  let version: number | null | undefined
  const notify = async (payload: unknown) => { if (!stopped) await Promise.resolve(onUpdate(payload)).catch(() => {}) }
  const poll = async () => {
    if (busy || stopped) return
    busy = true
    try {
      const coverage = await fetchDatabaseCoverage()
      const next = coverage.state?.version ?? null
      if (version !== next) { version = next; await notify(coverage) }
    } catch { version = undefined; await notify(null) }
    finally { busy = false }
  }
  const source = typeof EventSource === 'undefined' ? null : new EventSource(`${API_BASE}/events`)
  source?.addEventListener('data-updated', () => { void poll() })
  source?.addEventListener('ready', () => { void poll() })
  const timer = window.setInterval(() => { void poll() }, 15000)
  void poll()
  return () => { stopped = true; window.clearInterval(timer); source?.close() }
}
