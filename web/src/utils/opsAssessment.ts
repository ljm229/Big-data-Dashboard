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
  sellout_rate: number
  pick_error_rate: number
  warehouse_t: number
  im_reply_rate: number
  merchant_issue_rate: number
  shop_score?: number
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
    color: '#5B9BD5',
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
    color: '#9B6DFF',
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
    color: '#70AD47',
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
    color: '#FFC000',
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
    color: '#2A9D8F',
    tiers: [95, 90, 85],
  },
]

export const GRADE_RULES: Array<{ grade: StoreGrade; label: string; min: number; max: number; color: string }> = [
  { grade: 'S', label: '标杆店', min: 90, max: 100, color: '#3dff7a' },
  { grade: 'A', label: '合格店', min: 80, max: 90, color: '#5B9BD5' },
  { grade: 'B', label: '基准店', min: 60, max: 80, color: '#ffc53d' },
  { grade: 'C', label: '不合格店', min: 40, max: 60, color: '#ff7a45' },
  { grade: 'D', label: '红线店', min: 0, max: 40, color: '#ff5c5c' },
]

/** JSON 里比率多为小数；仓T 为分钟 */
export function displayValue(key: AssessKey, raw: number) {
  if (key === 'warehouse_t') return raw
  return Math.abs(raw) <= 1.5 ? raw * 100 : raw
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

export function calcCompositeScore(raw: AssessRaw) {
  let total = 0
  const parts = ASSESS_DEFS.map((d) => {
    const display = displayValue(d.key, raw[d.key] ?? 0)
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
      tier,
      tierLabel: label,
      score,
      weighted,
      color: d.color,
      lowerBetter: d.lowerBetter,
    }
  })
  const composite = Math.round(total * 10) / 10
  return { composite, grade: gradeOf(composite), parts }
}

export function gradeOf(score: number): (typeof GRADE_RULES)[number] {
  if (score >= 90) return GRADE_RULES[0]
  if (score >= 80) return GRADE_RULES[1]
  if (score >= 60) return GRADE_RULES[2]
  if (score >= 40) return GRADE_RULES[3]
  return GRADE_RULES[4]
}

export function aggregateAssess(rows: AssessRaw[]): AssessRaw | null {
  if (!rows.length) return null
  const avg = (k: keyof AssessRaw) =>
    rows.reduce((a, r) => a + (Number(r[k]) || 0), 0) / rows.length
  return {
    name: '汇总',
    shortName: '汇总',
    sellout_rate: avg('sellout_rate'),
    pick_error_rate: avg('pick_error_rate'),
    warehouse_t: avg('warehouse_t'),
    im_reply_rate: avg('im_reply_rate'),
    merchant_issue_rate: avg('merchant_issue_rate'),
    shop_score: avg('shop_score'),
  }
}
