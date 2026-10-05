/** Daily-source exception rules. No cross-unit "impact" score or fabricated loss. */
export type RiskCategory = 'profit' | 'service' | 'supply'
export type RiskScope = 'operating' | 'review'
type Maybe = number | null
type SourceRow = { date: string; store: string; row: number }
export type RiskFact = SourceRow & {
  channel: string; profit: Maybe; orders: Maybe; paid: Maybe; refundRate: Maybe
  refundOrders: Maybe; refundAmount: Maybe; negativeOrders: Maybe; negativeOrderRate: Maybe
}
export type RiskSupply = SourceRow & {
  attendance: Maybe; stockout: Maybe; onShelf: Maybe; absent: Maybe; absentLoss: Maybe
}
export type RiskQuality = SourceRow & {
  sellout: Maybe; pickingError: Maybe; warehouseT: Maybe; imReply: Maybe; merchantIssue: Maybe; rating: Maybe
}
export type RiskStore = { name: string; city: string; status: string; row: number }
export type RiskSource = { path: string; sheet: string; sha256: string }
export type RiskData = {
  generatedAt: string
  stores: RiskStore[]; facts: RiskFact[]; supply: RiskSupply[]; quality: RiskQuality[]
  files: Record<'stores' | 'facts' | 'supply' | 'quality', RiskSource>
}
export type RiskFilter = { from: string; to: string; city?: string | string[]; store?: string | string[]; channel?: string }
export type RiskEvent = {
  id: string; store: string; city: string; channel: string; status: string; scope: RiskScope
  category: RiskCategory; priority: 'high' | 'attention'; title: string; metric: string
  value: number; unit: 'yuan' | 'percent'; asOf: string; hits: number; observedDays: number; expectedDays: number
  rule: string; advice: string; trend: { date: string; value: Maybe; hit: boolean }[]
  evidence: { label: string; value: string }[]; source: RiskSource; sourceRow: number
  quality: RiskQuality | null; qualitySource: RiskSource
}

// Existing project thresholds, pending business confirmation; not platform standards.
export const RISK_RULES = { refundRate: 0.05, attendance: 0.85 } as const
export const RISK_CATEGORY_LABELS: Record<RiskCategory, string> = { profit: '利润', supply: '供给', service: '服务' }
const categoryOrder: Record<RiskCategory, number> = { profit: 0, service: 1, supply: 2 }
export const normRiskStore = (name: string) => name.replace(/（/g, '(').replace(/）/g, ')').replace(/\s+/g, '')
function normCity(name: string) {
  if (name.includes('昆山')) return '苏州'
  if (name.includes('姜堰')) return '泰州'
  return name.replace(/市/g, '').trim()
}
const isNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const rate = (v: Maybe) => isNumber(v) && v >= 0 && v <= 1 ? v : null
export function riskValue(value: Maybe, unit: 'yuan' | 'percent' | 'count' | 'number') {
  if (!isNumber(value)) return '—'
  if (unit === 'percent') return `${(value * 100).toFixed(2)}%`
  return value.toLocaleString('zh-CN', { minimumFractionDigits: unit === 'yuan' ? 2 : 0, maximumFractionDigits: unit === 'count' ? 0 : 2 }) + (unit === 'yuan' ? ' 元' : '')
}
function offset(day: string, n: number) {
  const value = new Date(`${day}T12:00:00Z`)
  value.setUTCDate(value.getUTCDate() + n)
  return value.toISOString().slice(0, 10)
}
function calendar(from: string, to: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || from > to) return []
  const days: string[] = []
  for (let day = from; day <= to && days.length < 366; day = offset(day, 1)) days.push(day)
  return days
}
function group<T>(rows: T[], key: (row: T) => string) {
  const map = new Map<string, T[]>()
  for (const row of rows) { const k = key(row); if (!map.has(k)) map.set(k, []); map.get(k)!.push(row) }
  return [...map.values()]
}
function sum(values: Maybe[]) {
  const known = values.filter(isNumber)
  return known.length ? known.reduce((a, b) => a + b, 0) : null
}

export function analyzeRisks(data: RiskData, filter: RiskFilter) {
  const days = calendar(filter.from, filter.to)
  const byStore = new Map(data.stores.map(s => [normRiskStore(s.name), s]))
  const storeMeta = (name: string): RiskStore => byStore.get(normRiskStore(name)) || { name, city: '', status: '未匹配上线表', row: 0 }
  const matchStore = (name: string) => {
    const store = storeMeta(name)
    const cities = Array.isArray(filter.city)
      ? filter.city
      : filter.city
        ? String(filter.city).split(/[|、,，]/).map((x) => x.trim()).filter(Boolean)
        : []
    const stores = Array.isArray(filter.store)
      ? filter.store
      : filter.store
        ? String(filter.store).split(/[|、,，]/).map((x) => x.trim()).filter(Boolean)
        : []
    const cityOk =
      !cities.length ||
      cities.some((c) => c === '全国' || c === '全部') ||
      cities.some((c) => normCity(store.city) === normCity(c))
    const storeOk =
      !stores.length ||
      stores.some((s) => s === '全部') ||
      stores.some((s) => normRiskStore(name) === normRiskStore(s))
    return cityOk && storeOk
  }
  const matchDay = (day: string) => days.length > 0 && day >= filter.from && day <= filter.to
  const matchChannel = (channel: string) => !filter.channel || filter.channel === '全部' || filter.channel === channel
  const facts = data.facts.filter(r => matchStore(r.store) && matchChannel(r.channel))
  const supply = matchChannel('淘宝闪购') ? data.supply.filter(r => matchStore(r.store)) : []
  const scopeOf = (store: string): RiskScope => storeMeta(store).status === '已营业' ? 'operating' : 'review'
  function coverage<T extends SourceRow>(rows: T[], value: (r: T) => Maybe) {
    const valid = rows.filter(r => matchDay(r.date) && isNumber(value(r)))
    return {
      operating: new Set(valid.filter(r => scopeOf(r.store) === 'operating').map(r => normRiskStore(r.store))).size,
      review: new Set(valid.filter(r => scopeOf(r.store) === 'review').map(r => normRiskStore(r.store))).size,
      rows: valid.length, latest: valid.map(r => r.date).sort().at(-1) || '',
    }
  }
  const coverageByCategory = {
    profit: coverage(facts, (r: RiskFact) => r.profit),
    service: coverage(facts, (r: RiskFact) => rate(r.refundRate)),
    supply: coverage(supply, (r: RiskSupply) => rate(r.attendance)),
  }
  const events: RiskEvent[] = []
  function create<T extends SourceRow>(all: T[], category: RiskCategory, channel: string,
    valueOf: (r: T) => Maybe, isHit: (v: number) => boolean, worst: (a: number, b: number) => number,
    sourceKey: 'facts' | 'supply', evidence: (row: T, selected: T[]) => RiskEvent['evidence']) {
    const selected = all.filter(r => matchDay(r.date))
    const valid = selected.filter(r => isNumber(valueOf(r)))
    const hitRows = valid.filter(r => isHit(valueOf(r)!)).sort((a, b) => worst(valueOf(a)!, valueOf(b)!) || b.date.localeCompare(a.date))
    const record = hitRows[0]
    if (!record) return
    const meta = storeMeta(record.store)
    const scope = scopeOf(record.store)
    const singleDay = days.length === 1
    const trendDays = singleDay ? calendar(offset(filter.to, -6), filter.to) : days
    const daily = new Map(all.map(r => [r.date, valueOf(r)]))
    const descriptions = {
      profit: { title: '单日毛利为负', metric: '最低单日毛利', rule: '单日预计毛利（含平台后返） < 0 元；不以周期净额掩盖负毛利日。', advice: '核对当日商品成本、补贴、配送费用和平台后返，再核查负毛利订单。' },
      service: { title: '退款率偏高', metric: '最高单日退款率', rule: `单日源退款率 ≥ ${RISK_RULES.refundRate * 100}%（沿用项目阈值，待业务确认）；不使用未核实的分母重算。`, advice: '核查当日退款原因、商品质量和拣货问题。退款金额是业务退款，不等同于经营损失。' },
      supply: { title: scope === 'operating' ? '商品出勤不足' : '筹备 / 状态待核对', metric: '最低单日出勤率', rule: `单日商品出勤率 < ${RISK_RULES.attendance * 100}%（沿用项目阈值，待业务确认）。供给仅为淘宝闪购数据。`, advice: scope === 'operating' ? '先排查有销售需求的缺勤商品，再核查库存、补货和上下架状态。' : '先核对门店是否已开业、供给初始化是否完成；不将筹备期缺勤列为营业门店风险。' },
    }[category]
    events.push({
      id: `${normRiskStore(record.store)}|${channel}|${category}`, store: meta.name, city: normCity(meta.city), status: meta.status,
      channel, scope, category, priority: scope === 'operating' && category === 'profit' ? 'high' : 'attention',
      ...descriptions, value: valueOf(record)!, unit: category === 'profit' ? 'yuan' : 'percent', asOf: record.date,
      hits: new Set(hitRows.map(r => r.date)).size, observedDays: new Set(valid.map(r => r.date)).size, expectedDays: days.length,
      trend: trendDays.map(date => { const value = daily.get(date) ?? null; return { date, value, hit: isNumber(value) && isHit(value) } }),
      evidence: evidence(record, selected), source: data.files[sourceKey], sourceRow: record.row,
      quality: data.quality.find(r => normRiskStore(r.store) === normRiskStore(record.store) && r.date === record.date) || null,
      qualitySource: data.files.quality,
    })
  }
  for (const rows of group(facts, r => `${normRiskStore(r.store)}|${r.channel}`)) {
    create(rows, 'profit', rows[0].channel, r => r.profit, v => v < 0, (a, b) => a - b, 'facts', (r, period) => [
      { label: '当日负毛利订单', value: riskValue(r.negativeOrders, 'count') },
      { label: '当日负毛利订单占比', value: riskValue(rate(r.negativeOrderRate), 'percent') },
      { label: '当日有效订单', value: riskValue(r.orders, 'count') },
      { label: '期内已知毛利合计', value: riskValue(sum(period.map(r => r.profit)), 'yuan') },
    ])
    create(rows, 'service', rows[0].channel, r => rate(r.refundRate), v => v >= RISK_RULES.refundRate, (a, b) => b - a, 'facts', r => [
      { label: '当日退款订单', value: riskValue(r.refundOrders, 'count') },
      { label: '当日退款金额（非损失）', value: riskValue(r.refundAmount, 'yuan') },
      { label: '当日有效订单', value: riskValue(r.orders, 'count') },
      { label: '当日实付金额', value: riskValue(r.paid, 'yuan') },
    ])
  }
  for (const rows of group(supply, r => normRiskStore(r.store))) {
    create(rows, 'supply', '淘宝闪购', r => rate(r.attendance), v => v < RISK_RULES.attendance, (a, b) => a - b, 'supply', r => [
      { label: '当日在架商品数', value: riskValue(r.onShelf, 'count') },
      { label: '当日缺货商品数', value: riskValue(r.stockout, 'count') },
      { label: '当日缺勤商品数', value: riskValue(r.absent, 'count') },
      { label: '源表缺勤损失估算（当日）', value: riskValue(r.absentLoss, 'yuan') },
    ])
  }
  events.sort((a, b) =>
    (a.priority === 'high' ? 0 : 1) - (b.priority === 'high' ? 0 : 1) ||
    categoryOrder[a.category] - categoryOrder[b.category] ||
    (a.category === 'service' ? b.value - a.value : a.value - b.value) ||
    b.hits - a.hits || b.asOf.localeCompare(a.asOf) || a.id.localeCompare(b.id))
  return {
    events, coverage: coverageByCategory,
    expectedStores: data.stores.filter(s => s.status === '已营业' && matchStore(s.name)).length,
    latestInSelection: Object.values(coverageByCategory).map(c => c.latest).sort().at(-1) || '',
    latestSource: [...data.facts, ...data.supply].map(r => r.date).sort().at(-1) || '',
    supplyApplicable: matchChannel('淘宝闪购'), generatedAt: data.generatedAt,
  }
}
