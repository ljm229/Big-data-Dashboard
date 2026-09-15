import raw from '../data/orderMarginData.json'
import { riskSnapshot } from './riskSummary'
import {
  periodDays,
  selectCycleFacts,
  selectOrderMarginFacts,
  storeProfitWeekRows,
  summarizeOrderMargin,
  wowDelta,
  type OrderMarginData,
  type OrderMarginFilter,
} from '../utils/orderMarginAnalysis'

const data = raw as OrderMarginData

export const ORDER_MARGIN_SOURCE = data.source
export const ORDER_MARGIN_STATS = data.stats
export const ORDER_MARGIN_REASON_KEYS = data.reasonKeys

function cycleFacts() {
  return riskSnapshot.facts.map((f) => ({
    date: f.date,
    store: f.store,
    channel: f.channel,
    orders: f.orders,
    negativeOrders: f.negativeOrders,
    profit: f.profit,
  }))
}

export function orderMarginSummary(filter: OrderMarginFilter) {
  const stores = riskSnapshot.stores
  const rows = selectOrderMarginFacts(data, filter, stores)
  const cycle = selectCycleFacts(cycleFacts(), filter, stores)
  return summarizeOrderMargin(rows, cycle, data.reasonKeys)
}

export function orderMarginWeekBoard(filter: OrderMarginFilter, prevFilter: OrderMarginFilter) {
  const stores = riskSnapshot.stores
  const days = periodDays(filter.from, filter.to)
  const prevDays = periodDays(prevFilter.from, prevFilter.to)
  const curCycle = selectCycleFacts(cycleFacts(), filter, stores)
  const prevCycle = selectCycleFacts(cycleFacts(), prevFilter, stores)
  const curMargin = selectOrderMarginFacts(data, filter, stores)
  const prevMargin = selectOrderMarginFacts(data, prevFilter, stores)
  const cur = storeProfitWeekRows(curCycle, curMargin, days)
  const prevMap = new Map(storeProfitWeekRows(prevCycle, prevMargin, prevDays).map((r) => [r.store, r]))
  return cur.map((r) => {
    const p = prevMap.get(r.store)
    return {
      ...r,
      negRateWow: wowDelta(r.negRate, p?.negRate ?? null, 'pts'),
      gt3RateWow: wowDelta(r.gt3Rate, p?.gt3Rate ?? null, 'pts'),
      dailyOrdersWow: wowDelta(r.dailyOrders, p?.dailyOrders ?? null, 'ratio'),
      dailyProfitWow: wowDelta(r.dailyProfit, p?.dailyProfit ?? null, 'ratio'),
    }
  })
}
