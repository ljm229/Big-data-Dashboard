import raw from '../data/costData.json'
import {
  rebateEffectiveInRange,
  selectCostFacts,
  summarizeCosts,
  type CostData,
  type CostFilter,
} from '../utils/costAnalysis'

export const COST_SOURCE = raw.source
export const COST_FIELD_SOURCE = raw.fields
export const COST_DATA_RANGE = [...new Set(raw.facts.map(r => r.date))].sort()

/** 返回不晚于给定日期的最近一个有成本数据的日期，用于当前日期无成本事实时兜底展示 */
export function latestCostDateOnOrBefore(date: string): string {
  let hit = ''
  for (const d of COST_DATA_RANGE) {
    if (d <= date) hit = d
    else break
  }
  return hit
}

export function costSummary(filter: CostFilter) {
  const rows = selectCostFacts(raw as CostData, filter)
  const rebateActive = rebateEffectiveInRange(filter.from, filter.to)
  return summarizeCosts(rows, { rebateActive })
}

const normStore = (s: string) =>
  String(s || '').replace(/（/g, '(').replace(/）/g, ')').replace(/\s+/g, '').trim()

/** 按门店汇总预计毛利 / 含后返毛利（有有效行即出数，不因个别空字段整店抹掉） */
export function costProfitByStore(filter: CostFilter) {
  const groups = new Map<string, ReturnType<typeof selectCostFacts>>()
  for (const row of selectCostFacts(raw as CostData, filter)) {
    const list = groups.get(row.store) || []
    list.push(row)
    groups.set(row.store, list)
  }
  const rebateActive = rebateEffectiveInRange(filter.from, filter.to)
  const map = new Map<string, { sourceProfit: number | null; withRebate: number | null }>()
  for (const [store, list] of groups) {
    const s = summarizeCosts(list, { rebateActive })
    const src = s.amounts.sourceProfit
    const reb = s.amounts.sourceProfitWithRebate
    map.set(normStore(store), {
      sourceProfit: src.valid ? src.value : null,
      withRebate: rebateActive && reb.valid ? reb.value : null,
    })
  }
  return map
}
