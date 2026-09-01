/** 金额/数量格式化：≥1亿→X.XX亿，≥1万→X.XX万 */
export function formatMoney(n: number | null | undefined, digits = 2): string {
  if (n == null || Number.isNaN(n)) return '--'
  const v = Number(n)
  const abs = Math.abs(v)
  const sign = v < 0 ? '-' : ''
  if (abs >= 1e8) return `${sign}${(abs / 1e8).toFixed(digits)}亿`
  if (abs >= 1e4) return `${sign}${(abs / 1e4).toFixed(digits)}万`
  return `${sign}${abs.toFixed(digits)}`
}

export function formatInt(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return '--'
  return Math.round(Number(n)).toLocaleString('zh-CN')
}

export function formatPercent(n: number | null | undefined, digits = 1): string {
  if (n == null || Number.isNaN(n)) return '--'
  const v = Number(n)
  // Excel 中已是小数（0.35）或百分比数字（35）均兼容
  const p = Math.abs(v) <= 1 ? v * 100 : v
  return `${p.toFixed(digits)}%`
}

export function formatRatio(a: number, b: number): string {
  if (!b) return '--'
  return `${a}/${b}`
}

export function pad2(n: number) {
  return String(n).padStart(2, '0')
}

export function nowClock() {
  const d = new Date()
  const weeks = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']
  return {
    time: `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`,
    date: `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`,
    week: weeks[d.getDay()],
  }
}
