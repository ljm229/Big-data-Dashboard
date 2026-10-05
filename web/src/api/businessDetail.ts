/** 经营分析下钻·渠道门店周期趋势（门店×渠道明细 + 日环比） */
export type DetailCell = { v: number | null; wow: number | null; diff: number | null }
export type DetailRow = { channel: string; store: string; city: string; cells: Record<string, DetailCell>; empty: boolean }
export type DetailResp = { date: string; prev: string | null; metrics: string[]; rows: DetailRow[]; total: DetailRow | null }

export const CORE_METRICS = [
  '有效订单量', '有效订单金额（实付）', '有效客单价（实付）',
  '预计毛利(含平台后返)', '单均毛利(含平台后返)', '毛利率(含平台后返)',
  '总营业额', '退款率',
]

const isPct = (m: string) => /率|占比|售中售后/.test(m)
export function fmtVal(m: string, v: number | null): string {
  if (v == null) return '—'
  if (isPct(m)) return `${(v * 100).toFixed(2)}%`
  return Math.abs(v) >= 100 ? v.toLocaleString('zh-CN', { maximumFractionDigits: 2 }) : String(Math.round(v * 100) / 100)
}
export function fmtWow(wow: number | null): string {
  if (wow == null) return '—'
  const s = wow >= 0 ? '▲' : '▼'
  return `${s} ${Math.abs(wow * 100).toFixed(2)}%`
}
export function wowUp(wow: number | null): boolean | null {
  return wow == null ? null : wow >= 0
}

export async function fetchBusinessMeta(): Promise<{ bases: string[]; days: string[]; channels: string[] }> {
  const r = await fetch('/api/business/meta').then((x) => x.json())
  return r
}
export async function fetchBusinessDetail(params: Record<string, string>): Promise<DetailResp> {
  const u = new URL('/api/business/detail', location.origin)
  for (const [k, v] of Object.entries(params)) if (v) u.searchParams.set(k, v)
  return fetch(u.toString().replace(location.origin, '')).then((x) => x.json())
}

/** 本地 xlsx 直读兜底（未入库/断网时，DataUploadPage 上传同文件即看） */
export async function parseBusinessFile(file: File): Promise<{ date: string; metrics: string[]; rows: DetailRow[] }> {
  const XLSX = await import('xlsx')
  const buf = await file.arrayBuffer()
  const wb = XLSX.read(buf)
  const ws = wb.Sheets['data'] || wb.Sheets[wb.SheetNames[0]]
  const grid = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null }) as unknown[][]
  const H = grid[0].map((x) => String(x ?? ''))
  const num = (v: unknown): number | null => {
    if (v == null || v === '') return null
    if (typeof v === 'number') return Number.isFinite(v) ? v : null
    const s = String(v).trim().replace(/,/g, '')
    if (s.endsWith('%')) { const n = parseFloat(s); return Number.isFinite(n) ? n / 100 : null }
    const n = Number(s); return Number.isFinite(n) ? n : null
  }
  const toD = (v: unknown): string => {
    if (typeof v === 'number' && v > 20000000) { const s = String(Math.trunc(v)); return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}` }
    const m = String(v ?? '').match(/(\d{4})-?(\d{2})-?(\d{2})/)
    return m ? `${m[1]}-${m[2]}-${m[3]}` : ''
  }
  const bases = H.slice(3).filter((h) => !/环比|差值/.test(h))
  const rows: DetailRow[] = []
  let date = ''
  for (let i = 1; i < grid.length; i++) {
    const r = grid[i]
    if (r[1] == null || r[1] === '') continue
    date = toD(r[2]) || date
    const cells: Record<string, DetailCell> = {}
    for (const b of bases) {
      const j = H.indexOf(b)
      cells[b] = { v: num(r[j]), wow: num(r[H.indexOf(`${b}_日环比`)]), diff: num(r[H.indexOf(`${b}_日环比差值`)]) }
    }
    rows.push({ channel: String(r[0] ?? ''), store: String(r[1] ?? ''), city: '', cells, empty: false })
  }
  return { date, metrics: bases, rows }
}
