export const ASSESS_DEFS = [
  { key: 'sellout_rate', name: '动销商品售罄率', shortName: '售罄率', unit: '%', weight: 0.4, passLine: 8, lowerBetter: true, tiers: [7, 8, 10], color: '#1D6BFF' },
  { key: 'pick_error_rate', name: '错漏拣率', shortName: '错漏拣', unit: '%', weight: 0.2, passLine: 0.5, lowerBetter: true, tiers: [0.3, 0.5, 0.8], color: '#0EA5E9' },
  { key: 'warehouse_t', name: '平均实际仓配时效', shortName: '仓配时效', unit: 'min', weight: 0.1, passLine: 5, lowerBetter: true, tiers: [4, 5, 6], color: '#22D3EE' },
  { key: 'merchant_issue_rate', name: '商责问题单率', shortName: '商责单', unit: '%', weight: 0.2, passLine: 1.5, lowerBetter: true, tiers: [1, 1.5, 2.5], color: '#F59E0B' },
  { key: 'im_reply_rate', name: '即时消息3分钟回复率', shortName: '3分钟回复', unit: '%', weight: 0.1, passLine: 90, lowerBetter: false, tiers: [95, 90, 85], color: '#10B981' },
]

export const GRADE_RULES = [
  { grade: 'S', label: '标杆店', min: 90, max: 100, color: '#10b981' },
  { grade: 'A', label: '合格店', min: 80, max: 90, color: '#1d6bff' },
  { grade: 'B', label: '基线店', min: 60, max: 80, color: '#f59e0b' },
  { grade: 'C', label: '不合格店', min: 40, max: 60, color: '#f97316' },
  { grade: 'D', label: '红线店', min: 0, max: 40, color: '#ef4444' },
]

export function gradeOf(score) {
  if (score >= 90) return GRADE_RULES[0]
  if (score >= 80) return GRADE_RULES[1]
  if (score >= 60) return GRADE_RULES[2]
  if (score >= 40) return GRADE_RULES[3]
  return GRADE_RULES[4]
}

export function displayValue(key, raw) {
  if (key === 'warehouse_t') return Number(raw)
  const n = Number(raw)
  return Math.abs(n) <= 1.5 ? n * 100 : n
}

export function isEmptyRow(raw) {
  return ASSESS_DEFS.every(({ key }) => raw[key] == null || raw[key] === '' || !Number.isFinite(Number(raw[key])))
}

function tierOf(def, value) {
  const [a, b, c] = def.tiers
  if (def.lowerBetter) {
    if (value <= a) return { tier: 'excellent', score: 100, label: '优秀' }
    if (value <= b) return { tier: 'pass', score: 80, label: '达标' }
    if (value <= c) return { tier: 'warn', score: 60, label: '预警' }
  } else {
    if (value >= a) return { tier: 'excellent', score: 100, label: '优秀' }
    if (value >= b) return { tier: 'pass', score: 80, label: '达标' }
    if (value >= c) return { tier: 'warn', score: 60, label: '预警' }
  }
  return { tier: 'fail', score: 0, label: '不合格' }
}

export function isPass(def, value) {
  return def.lowerBetter ? value <= def.passLine : value >= def.passLine
}

export function scoreRow(raw) {
  const empty = isEmptyRow(raw)
  let composite = 0
  const parts = ASSESS_DEFS.map((def) => {
    const missing = empty || raw[def.key] == null || !Number.isFinite(Number(raw[def.key]))
    const value = missing ? 0 : displayValue(def.key, raw[def.key])
    const score = missing ? { tier: 'fail', score: 0, label: empty ? '无数据' : '缺失' } : tierOf(def, value)
    const weighted = score.score * def.weight
    composite += weighted
    return {
      key: def.key,
      name: def.name,
      shortName: def.shortName,
      unit: def.unit,
      weight: def.weight,
      value,
      passLine: def.passLine,
      pass: !missing && isPass(def, value),
      missing,
      tier: score.tier,
      tierLabel: score.label,
      score: score.score,
      weighted,
      color: def.color,
      lowerBetter: def.lowerBetter,
    }
  })
  composite = Math.round(composite * 10) / 10
  return { composite, grade: empty ? {grade:'N',label:'无数据，未评级',color:'#94a3b8'} : gradeOf(composite), parts, empty }
}

export function aggregateRows(rows) {
  const valid = rows.filter((row) => !isEmptyRow(row))
  if (!valid.length) return null
  const result = { name: '汇总', shortName: '汇总' }
  for (const { key } of ASSESS_DEFS) {
    const values = valid.map((row) => row[key]).filter((value) => value != null && Number.isFinite(Number(value))).map(Number)
    result[key] = values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null
  }
  return result
}

export function boardFromRows(periodKey, rawRows) {
  if (!rawRows.length) return null
  const rows = rawRows.map((row) => ({ ...row, ...scoreRow(row) })).sort((a, b) => b.composite - a.composite)
  const aggregate = aggregateRows(rawRows)
  const aggregateScore = aggregate ? scoreRow(aggregate) : { composite: 0, grade: gradeOf(0), parts: [] }
  const composites = rows.filter((row) => !row.empty).map((row) => row.composite).sort((a, b) => a - b)
  const mid = Math.floor(composites.length / 2)
  const medianComposite = !composites.length ? 0 : composites.length % 2 ? composites[mid] : Math.round(((composites[mid - 1] + composites[mid]) / 2) * 10) / 10
  const metrics = aggregateScore.parts.map((part) => ({
    key: part.key,
    name: part.name,
    color: part.color,
    unit: part.unit,
    value: Number(part.value.toFixed(2)),
    standard: part.passLine,
    deltaPp: Number((part.value - part.passLine).toFixed(2)),
    direction: part.lowerBetter ? 'down' : 'up',
    met: part.pass,
    trendGood: part.tier === 'excellent' || part.tier === 'pass',
    deltaLabel: '距合格线',
    tier: part.tier,
    tierLabel: part.tierLabel,
    weight: part.weight,
    score: part.score,
    weightedScore: part.weighted,
  }))
  return {
    weekId: periodKey,
    storeCnt: rows.filter((row) => !row.empty).length,
    composite: aggregateScore.composite,
    medianComposite,
    passStoreCnt: rows.filter((row) => !row.empty && row.composite >= 80).length,
    grade: gradeOf(medianComposite),
    metrics,
    rows: rows.filter((row) => !row.empty),
  }
}
