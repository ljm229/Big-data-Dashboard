import raw from '../data/costData.json'
import { selectCostFacts, summarizeCosts, type CostData, type CostFilter } from '../utils/costAnalysis'

export const COST_SOURCE = raw.source
export const COST_FIELD_SOURCE = raw.fields
export const COST_DATA_RANGE = [...new Set(raw.facts.map(r => r.date))].sort()
export const costSummary = (filter: CostFilter) => summarizeCosts(selectCostFacts(raw as CostData, filter))
