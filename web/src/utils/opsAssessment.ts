/** 门店营运核心指标：合格线 + 综合打分 + S/A/B/C/D 分级 */

export type AssessKey =
  | 'sellout_rate'
  | 'pick_error_rate'
  | 'warehouse_t'
  | 'merchant_issue_rate'
  | 'im_reply_rate'

export type Tier = 'excellent' | 'pass' | 'warn' | 'fail'

export type StoreGrade = 'S' | 'A' | 'B' | 'C' | 'D'

export type AssessRaw = {
  name: string
  shortName: string
  code?: string
  sellout_rate: number | null
  pick_error_rate: number | null
  warehouse_t: number | null
  im_reply_rate: number | null
  merchant_issue_rate: number | null
  shop_score?: number | null
}

export const ASSESS_DEFS: Array<{
  key: AssessKey
  name: string
  shortName: string
  unit: '%' | 'min'
  weight: number
  /** 合格线（展示单位：% 或 min） */
  passLine: number
  /** 越小越好 */
  lowerBetter: boolean
  color: string
  /** 分档阈值（展示单位），按优秀→达标→预警 */
  tiers: [number, number, number]
}> = [
  {
    key: 'sellout_rate',
    name: '动销商品售罄率',
    shortName: '售罄率',
    unit: '%',
    weight: 0.4,
    passLine: 8,
    lowerBetter: true,
    color: '#1D6BFF',
    tiers: [7, 8, 10],
  },
  {
    key: 'pick_error_rate',
    name: '错漏拣率',
    shortName: '错漏拣',
    unit: '%',
    weight: 0.2,
    passLine: 0.5,
    lowerBetter: true,
    color: '#0EA5E9',
    tiers: [0.3, 0.5, 0.8],
  },
  {
    key: 'warehouse_t',
    name: '平均实际仓T',
    shortName: '仓T',
    unit: 'min',
    weight: 0.1,
    passLine: 5,
    lowerBetter: true,
    color: '#22D3EE',
    tiers: [4, 5, 6],
  },
  {
    key: 'merchant_issue_rate',
    name: '商责问题单率',
    shortName: '商责单',
    unit: '%',
    weight: 0.2,
    passLine: 1.5,
    lowerBetter: true,
    color: '#F59E0B',
    tiers: [1, 1.5, 2.5],
  },
  {
    key: 'im_reply_rate',
    name: 'IM 3分钟回复率',
    shortName: 'IM回复',
    unit: '%',
    weight: 0.1,
    passLine: 90,
    lowerBetter: false,
    color: '#10B981',
    tiers: [95, 90, 85],
  },
]

export const GRADE_RULES: Array<{ grade: StoreGrade; label: string; min: number; max: number; color: string }> = [
  { grade: 'S', label: '标杆店', min: 90, max: 100, color: '#10b981' },
  { grade: 'A', label: '合格店', min: 80, max: 90, color: '#1d6bff' },
  { grade: 'B', label: '基线店', min: 60, max: 80, color: '#f59e0b' },
  { grade: 'C', label: '不合格店', min: 40, max: 60, color: '#f97316' },
  { grade: 'D', label: '红线店', min: 0, max: 40, color: '#ef4444' },
]

/** JSON 里比率多为小数；仓T 为分钟 */
export function displayValue(key: AssessKey, raw: number) {
  if (key === 'warehouse_t') return raw
  return Math.abs(raw) <= 1.5 ? raw * 100 : raw
}

/** 五项全空/全 0：多为 Excel 空行/未营业，不能按「越小越好」打成满分 */
export function isEmptyAssessRaw(raw: Pick<AssessRaw, AssessKey>) {
  return ASSESS_DEFS.every((d) => {
    const v = raw[d.key]
    if (v == null) return true
    const n = Number(v)
    return !Number.isFinite(n) || n === 0
  })
}

export function scoreTier(key: AssessKey, display: number): { tier: Tier; score: number; label: string } {
  const def = ASSESS_DEFS.find((d) => d.key === key)!
  const [a, b, c] = def.tiers
  if (def.lowerBetter) {
    if (display <= a) return { tier: 'excellent', score: 100, label: '优秀' }
    if (display <= b) return { tier: 'pass', score: 80, label: '达标' }
    if (display <= c) return { tier: 'warn', score: 60, label: '预警' }
    return { tier: 'fail', score: 0, label: '不合格' }
  }
  // 越大越好（IM）
  if (display >= a) return { tier: 'excellent', score: 100, label: '优秀' }
  if (display >= b) return { tier: 'pass', score: 80, label: '达标' }
  if (display >= c) return { tier: 'warn', score: 60, label: '预警' }
  return { tier: 'fail', score: 0, label: '不合格' }
}

export function isPass(key: AssessKey, display: number) {
  const def = ASSESS_DEFS.find((d) => d.key === key)!
  return def.lowerBetter ? display <= def.passLine : display >= def.passLine
}

export function formatAssessDisplay(value: number | null | undefined, unit: '%' | 'min' | string, digits = 2) {
  if (value == null || !Number.isFinite(Number(value))) return '--'
  if (unit === 'min') return Number(value).toFixed(digits === 2 ? 1 : digits)
  return `${Number(value).toFixed(digits)}%`
}

export function calcCompositeScore(raw: AssessRaw) {
  if (isEmptyAssessRaw(raw)) {
    const parts = ASSESS_DEFS.map((d) => ({
      key: d.key,
      name: d.name,
      shortName: d.shortName,
      unit: d.unit,
      weight: d.weight,
      value: 0,
      passLine: d.passLine,
      pass: false,
      missing: true,
      tier: 'fail' as Tier,
      tierLabel: '无数据',
      score: 0,
      weighted: 0,
      color: d.color,
      lowerBetter: d.lowerBetter,
    }))
    return { composite: 0, grade: gradeOf(0), parts, empty: true as const }
  }

  let total = 0
  const parts = ASSESS_DEFS.map((d) => {
    const missing = raw[d.key] == null
    if (missing) {
      return {
        key: d.key,
        name: d.name,
        shortName: d.shortName,
        unit: d.unit,
        weight: d.weight,
        value: 0,
        passLine: d.passLine,
        pass: false,
        missing: true,
        tier: 'fail' as Tier,
        tierLabel: '无数据',
        score: 0,
        weighted: 0,
        color: d.color,
        lowerBetter: d.lowerBetter,
      }
    }
    const display = displayValue(d.key, Number(raw[d.key]))
    const { tier, score, label } = scoreTier(d.key, display)
    const weighted = score * d.weight
    total += weighted
    return {
      key: d.key,
      name: d.name,
      shortName: d.shortName,
      unit: d.unit,
      weight: d.weight,
      value: display,
      passLine: d.passLine,
      pass: isPass(d.key, display),
      missing: false,
      tier,
      tierLabel: label,
      score,
      weighted,
      color: d.color,
      lowerBetter: d.lowerBetter,
    }
  })
  const composite = Math.round(total * 10) / 10
  return { composite, grade: gradeOf(composite), parts, empty: false as const }
}

export function gradeOf(score: number): (typeof GRADE_RULES)[number] {
  if (score >= 90) return GRADE_RULES[0]
  if (score >= 80) return GRADE_RULES[1]
  if (score >= 60) return GRADE_RULES[2]
  if (score >= 40) return GRADE_RULES[3]
  return GRADE_RULES[4]
}

export function aggregateAssess(rows: AssessRaw[]): AssessRaw | null {
  const valid = rows.filter((r) => !isEmptyAssessRaw(r))
  if (!valid.length) return null
  const avg = (k: AssessKey) => {
    const vals = valid.map((r) => r[k]).filter((v): v is number => v != null && Number.isFinite(Number(v)))
    if (!vals.length) return null
    return vals.reduce((a, b) => a + Number(b), 0) / vals.length
  }
  const scores = valid.map((r) => r.shop_score).filter((v): v is number => v != null && Number.isFinite(Number(v)))
  return {
    name: '汇总',
    shortName: '汇总',
    sellout_rate: avg('sellout_rate'),
    pick_error_rate: avg('pick_error_rate'),
    warehouse_t: avg('warehouse_t'),
    im_reply_rate: avg('im_reply_rate'),
    merchant_issue_rate: avg('merchant_issue_rate'),
    shop_score: scores.length ? scores.reduce((a, b) => a + Number(b), 0) / scores.length : null,
  }
}
