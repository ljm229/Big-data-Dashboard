import raw from '../data/riskData.json'
import { analyzeRisks, type RiskData, type RiskFilter } from '../utils/riskAnalysis'

// Isolated snapshot: this module does not change the rest of the cockpit's KPI definitions.
export const riskSnapshot = raw as RiskData
export const getRiskSummary = (filter: RiskFilter) => analyzeRisks(riskSnapshot, filter)
