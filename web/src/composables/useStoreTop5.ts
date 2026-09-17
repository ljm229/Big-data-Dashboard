/** 中文名：门店经营表现同源数据 */
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { costProfitByStore } from '../api/costSummary'
import { previousPeriodRange, source1ByStore, source1StoreCity } from '../api/source1'
import { useFilterStore } from '../stores/filter'

import { STORE_TOP_COLORS } from '../styles/palette'
export { STORE_TOP_COLORS }

export function shortStore(name: string) {
  return name.replace(/^淘宝便利店/, '').replace(/[（）()]/g, '')
}

export function deltaText(v: number | null) {
  return v == null ? '—' : `${v >= 0 ? '+' : ''}${(v * 100).toFixed(2)}%`
}

function normStore(name: string) {
  return String(name || '').replace(/（/g, '(').replace(/）/g, ')').replace(/\s+/g, '').trim()
}

function storeStatus(row: {
  profit: number | null
  profitRate: number | null
  refundRate: number | null
  delta: number | null
}) {
  const loss = row.profit != null && row.profit < 0
  const dropHard = row.delta != null && row.delta < -0.08
  const drop = row.delta != null && row.delta < -0.005
  const weak = row.profitRate != null && row.profitRate < 0.12
  const thin = row.profitRate != null && row.profitRate < 0.18
  const highRefund = row.refundRate != null && row.refundRate >= 0.05
  if (loss || (dropHard && weak)) return { status: '双弱', statusTone: 'bad' as const }
  if (drop || highRefund || thin) return { status: '关注', statusTone: 'warn' as const }
  return { status: '正常', statusTone: 'good' as const }
}

export function useStoreTop5(limit?: number, cityOverride?: { value: string | string[] }) {
  const filter = useFilterStore()
  const { periodRange, cityQuery, channel, selectedStore, selectedStores, periodMode } = storeToRefs(filter)
  const deltaLabel = computed(() =>
    periodMode.value === 'week' ? '周比' : periodMode.value === 'month' ? '月比' : '日比',
  )
  const rows = computed(() => {
    const query = {
      from: periodRange.value.from,
      to: periodRange.value.to,
      city: cityOverride?.value ?? cityQuery.value,
      channel: channel.value,
    }
    const prevRange = previousPeriodRange(query.from, query.to, periodMode.value)
    const previous = new Map(
      source1ByStore({ ...query, ...prevRange }).map((r) => [r.key, { profit: r.profit, orders: r.orders }]),
    )
    const costMap = costProfitByStore({
      from: query.from,
      to: query.to,
      city: query.city === '全国' ? undefined : query.city,
      channel: query.channel === '全部' ? undefined : query.channel,
    })
    const ranked = source1ByStore(query)
      .map((row) => {
        const prev = previous.get(row.key)
        const delta =
          row.profit != null && prev?.profit != null && prev.profit !== 0
            ? (row.profit - prev.profit) / Math.abs(prev.profit)
            : null
        const profitDeltaAbs =
          row.profit != null && prev?.profit != null ? row.profit - prev.profit : null
        const cost = costMap.get(normStore(row.key))
        const tag = storeStatus({ ...row, delta })
        return {
          ...row,
          short: shortStore(row.key),
          city: source1StoreCity(row.key),
          delta,
          profitDeltaAbs,
          sourceProfit: cost?.sourceProfit ?? null,
          ...tag,
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
  return { filter, selectedStore, selectedStores, rows, maxProfit, profitSum, deltaLabel }
}
