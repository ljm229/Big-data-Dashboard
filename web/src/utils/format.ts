/**
 * 金额展示约定（源数据均为「元」）：
 * - |n| < 100万 → 数值 + 单位「元」
 * - |n| ≥ 100万 → 数值（万）+ 单位「万元」
 * - |n| ≥ 1亿 → 数值（亿）+ 单位「亿元」
 * 金额、百分比统一保留 2 位小数。
 */
function moneyNumber(abs: number, digits = 2): string {
  const factor = 10 ** digits
  const rounded = Math.round(abs * factor) / factor
  return rounded.toLocaleString('zh-CN', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
}

export type MoneyUnit = '' | '元' | '万元' | '亿元'

export function formatMoneyParts(
  n: number | null | undefined,
  digits = 2,
): { value: string; unit: MoneyUnit } {
  if (n == null || Number.isNaN(n)) return { value: '—', unit: '' }
  const v = Number(n)
  const abs = Math.abs(v)
  const sign = v < 0 ? '-' : ''
  if (abs >= 1e8) {
    return {
      value: `${sign}${moneyNumber(abs / 1e8, digits)}`,
      unit: '亿元',
    }
  }
  if (abs >= 1e6) {
    return {
      value: `${sign}${moneyNumber(abs / 1e4, digits)}`,
      unit: '万元',
    }
  }
  return {
    value: `${sign}${moneyNumber(abs, digits)}`,
    unit: '元',
  }
}

export function formatMoney(n: number | null | undefined, digits = 2): string {
  const { value, unit } = formatMoneyParts(n, digits)
  if (!unit || value === '—') return value
  return unit === '万元' ? `${value}万` : unit === '亿元' ? `${value}亿` : `${value}元`
}

/** 与 formatMoney 同口径；兼容旧调用 */
export function formatYuan(n: number | null | undefined, digits = 2): string {
  return formatMoney(n, digits)
}

export function formatInt(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return '—'
  return Math.round(Number(n)).toLocaleString('zh-CN')
}

/** 百分比：小数(0.35)或百分数(35)均兼容，默认两位小数 */
export function formatPercent(n: number | null | undefined, digits = 2): string {
  if (n == null || Number.isNaN(n)) return '—'
  const v = Number(n)
  const p = Math.abs(v) <= 1 ? v * 100 : v
  return `${p.toFixed(digits)}%`
}

/** 相对变化（如日比 +5.50%），默认两位小数 */
export function formatDeltaPercent(n: number | null | undefined, digits = 2): string {
  if (n == null || Number.isNaN(n)) return '—'
  const p = Number(n) * 100
  const sign = p > 0 ? '+' : ''
  return `${sign}${p.toFixed(digits)}%`
}

export function formatRatio(a: number, b: number): string {
  if (!b) return '—'
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
