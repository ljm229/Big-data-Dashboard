/** 经典管理层页：金额与对比文案（无数据一律「—」）
 * 展示约定：百分比一律用 %，不用 pct；
 * 日对比用「日比」，周对比用「周比」，月对比用「月比」，不用「较上期 / 日环比 / 周环比」。
 */
import { formatMoney, formatMoneyParts, type MoneyUnit } from './format'

export const LABEL_DAY = '日比'
export const LABEL_WEEK = '周比'
export const LABEL_MONTH = '月比'

/** 与大屏 formatMoney 同口径：不到 100 万用元，≥100 万用万，≥1 亿用亿 */
export function fmtWan(n: number | null | undefined, digits = 2): string {
  return formatMoney(n, digits)
}

/** KPI 卡：数值与单位拆开，单位进标题（元）/（万元）/（亿元） */
export function fmtMoneyKpi(
  n: number | null | undefined,
  digits = 2,
): { value: string; unit: MoneyUnit } {
  return formatMoneyParts(n, digits)
}

/** 表格单元格：只写数字，单位放表头 */
export function fmtMoneyNum(n: number | null | undefined, digits = 2): string {
  return formatMoneyParts(n, digits).value
}

/** 一组金额共用表头单位（取绝对值最大那档） */
export function moneyUnitOf(values: Array<number | null | undefined>): MoneyUnit {
  let max = 0
  for (const v of values) {
    if (v == null || Number.isNaN(v)) continue
    max = Math.max(max, Math.abs(Number(v)))
  }
  if (!max) return '元'
  return formatMoneyParts(max).unit || '元'
}

/** 按统一单位输出数字（与 moneyUnitOf 配套，避免同行不同档） */
export function fmtMoneyInUnit(
  n: number | null | undefined,
  unit: MoneyUnit = '元',
  digits = 2,
): string {
  if (n == null || Number.isNaN(n)) return '—'
  const v = Number(n)
  const sign = v < 0 ? '-' : ''
  const abs = Math.abs(v)
  const scale = unit === '亿元' ? 1e8 : unit === '万元' ? 1e4 : 1
  const x = abs / scale
  return `${sign}${x.toLocaleString('zh-CN', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}`
}

export function fmtPct(n: number | null | undefined, digits = 1): string {
  if (n == null || Number.isNaN(n)) return '—'
  const v = Number(n)
  const p = Math.abs(v) <= 1 ? v * 100 : v
  return `${p.toFixed(digits)}%`
}

/** 相对变化或百分点差，统一用 % 展示 */
export function ratioValue(delta: number | null | undefined): string {
  if (delta == null || Number.isNaN(delta)) return '—'
  const sign = delta >= 0 ? '+' : ''
  return `${sign}${(delta * 100).toFixed(1)}%`
}

/** @deprecated 与 ratioValue 同形，保留别名避免旧调用断裂 */
export function ptsValue(delta: number | null | undefined): string {
  return ratioValue(delta)
}

export function hintRatio(delta: number | null | undefined, label = LABEL_DAY): string {
  if (delta == null || Number.isNaN(delta)) return `${label} —`
  return `${label} ${ratioValue(delta)}`
}

export function hintPts(delta: number | null | undefined, label = LABEL_DAY): string {
  return hintRatio(delta, label)
}

/** KPI 结构化对比：标签灰、数值按涨跌着色 */
export function kpiHint(
  label: string,
  value: string,
  tone: '' | 'is-red' | 'is-green' = '',
): { label: string; value: string; tone: '' | 'is-red' | 'is-green' } {
  return { label, value, tone }
}

export function kpiRatioHint(
  delta: number | null | undefined,
  label = LABEL_DAY,
  invert = false,
) {
  return [kpiHint(label, ratioValue(delta), toneOf(delta, invert))]
}

export function kpiPtsHint(
  delta: number | null | undefined,
  label = LABEL_DAY,
  invert = false,
) {
  return kpiRatioHint(delta, label, invert)
}

export function hintCount(delta: number | null | undefined, unit: string, label = LABEL_DAY): string {
  if (delta == null || Number.isNaN(delta)) return `${label} —`
  const sign = delta >= 0 ? '+' : ''
  return `${label} ${sign}${Math.round(delta)}${unit}`
}

export function toneOf(delta: number | null | undefined, invert = false): '' | 'is-red' | 'is-green' {
  if (delta == null || Number.isNaN(delta) || delta === 0) return ''
  const up = delta > 0
  if (invert) return up ? 'is-red' : 'is-green'
  return up ? 'is-green' : 'is-red'
}
