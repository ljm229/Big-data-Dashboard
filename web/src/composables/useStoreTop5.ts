/** 中文名：重点门店排行同源数据 */
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { previousDayRange, source1ByStore, source1StoreCity } from '../api/source1'
import { useFilterStore } from '../stores/filter'

import { STORE_TOP_COLORS } from '../styles/palette'
export { STORE_TOP_COLORS }

export function shortStore(name: string) {
  return name.replace(/^淘宝便利店/, '').replace(/[（）()]/g, '')
}

export function deltaText(v: number | null) {
  return v == null ? '—' : `${v >= 0 ? '+' : ''}${(v * 100).toFixed(1)}%`
}

export function useStoreTop5(limit?: number, cityOverride?: { value: string | string[] }) {
  const filter = useFilterStore()
  const { periodRange, cityQuery, channel, selectedStore, selectedStores } = storeToRefs(filter)
  const rows = computed(() => {
    const query = {
      from: periodRange.value.from,
      to: periodRange.value.to,
      city: cityOverride?.value ?? cityQuery.value,
      channel: channel.value,
    }
    const prevRange = previousDayRange(query.from, query.to)
    const previous = new Map(source1ByStore({ ...query, ...prevRange }).map((r) => [r.key, r.profit]))
    const ranked = source1ByStore(query)
      .map((row) => {
        const prev = previous.get(row.key)
        const delta =
          row.profit != null && prev != null && prev !== 0 ? (row.profit - prev) / Math.abs(prev) : null
        const isLoss = row.profit != null && row.profit < 0
        const highRefund = row.refundRate != null && row.refundRate >= 0.05
        return {
          ...row,
          short: shortStore(row.key),
          city: source1StoreCity(row.key),
          delta,
          status: isLoss ? '负毛利' : highRefund ? '退款偏高' : '正常',
          statusTone: isLoss ? 'bad' : highRefund ? 'warn' : 'good',
        }
      })
      .sort((a, b) => {
        if (a.profit == null && b.profit == null) return 0
        if (a.profit == null) return 1
        if (b.profit == null) return -1
        return b.profit - a.profit
      })
      .map((row, i) => ({
        ...row,
        color: STORE_TOP_COLORS[i % STORE_TOP_COLORS.length],
        rank: i + 1,
      }))
    return limit ? ranked.slice(0, limit) : ranked
  })
  const maxProfit = computed(() => Math.max(0, ...rows.value.map((r) => r.profit || 0)))
  const profitSum = computed(() =>
    rows.value.reduce((s, r) => (r.profit == null ? s : s + Math.abs(r.profit)), 0),
  )
  return { filter, selectedStore, selectedStores, rows, maxProfit, profitSum }
}
