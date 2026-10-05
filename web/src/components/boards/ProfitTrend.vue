<!-- 中文名：经营趋势
  按日：近7日逐日趋势 · 较上日
  按周：各业务周周期趋势 · 较上周
  按月：各自然月趋势 · 较上月
-->
<template>
  <Panel :title="panelTitle" :empty="empty">
    <div class="trend">
      <div class="trend__stats" :aria-label="panelTitle">
        <div class="stat orders">
          <em>订单量</em>
          <b>{{ formatInt(totals.orders) }}</b>
        </div>
        <div class="stat paid">
          <em>实付金额</em>
          <b>{{ formatMoney(totals.paid) }}</b>
        </div>
        <div class="stat profit">
          <em>含后返毛利</em>
          <b>{{ formatMoney(totals.profit) }}</b>
        </div>
      </div>
      <p v-if="insight" class="trend__insight" :class="insight.tone">{{ insight.text }}</p>
      <!-- 图例外置，避免与 Y 轴「25万」等刻度叠成看不清的白块 -->
      <ul class="trend__legend" aria-label="图例">
        <li><i class="lg-bar" />订单量</li>
        <li><i class="lg-paid" />实付金额</li>
        <li><i class="lg-profit" />含后返毛利</li>
      </ul>
      <div ref="el" class="trend__chart" />
    </div>
  </Panel>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import Panel from '../Panel.vue'
import { useFilterStore, COCKPIT_WEEKS, COCKPIT_MONTHS } from '../../stores/filter'
import { SOURCE1_DAYS, aggregateSource1Kpi } from '../../api/source1'
import { useChart } from '../../composables/useChart'
import { PALETTE } from '../../styles/palette'
import { formatInt, formatMoney, formatPercent } from '../../utils/format'

type TrendPoint = {
  key: string
  label: string
  sub?: string
  from: string
  to: string
  orders: number | null
  paid: number | null
  profit: number | null
  profitRate: number | null
}

const WEEKDAY = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
const filter = useFilterStore()
const { cityQuery, channel, storeQuery, periodRange, periodMode, selectedWeekId, selectedMonthId } =
  storeToRefs(filter)
const el = ref<HTMLElement | null>(null)
const option = ref<any>(null)

const scopeFilter = computed(() => ({
  city: cityQuery.value,
  channel: channel.value,
  store: storeQuery.value,
}))

function loadBucket(from: string, to: string) {
  if (!from || !to) {
    return { orders: null, paid: null, profit: null, profitRate: null }
  }
  const t = aggregateSource1Kpi({ ...scopeFilter.value, from, to })
  return {
    orders: t.orders,
    paid: t.paid,
    profit: t.profit,
    profitRate: t.profitRate,
  }
}

const panelTitle = computed(() => {
  if (periodMode.value === 'week') return '周周期经营趋势'
  if (periodMode.value === 'month') return '月度经营趋势'
  return '近7日经营趋势'
})

/** 图表点：日=近7日；周=各完整业务周；月=各自然月 */
const points = computed<TrendPoint[]>(() => {
  const loc = scopeFilter.value
  if (periodMode.value === 'week') {
    return COCKPIT_WEEKS.map((w) => {
      const bag = loadBucket(w.start, w.end)
      return {
        key: w.id,
        label: w.label,
        sub: `${w.start.slice(5)}~${w.end.slice(5)}`,
        from: w.start,
        to: w.end,
        ...bag,
      }
    })
  }
  if (periodMode.value === 'month') {
    return COCKPIT_MONTHS.map((m) => {
      const bag = loadBucket(m.start, m.end)
      return {
        key: m.id,
        label: m.label,
        sub: `${m.start.slice(5)}~${m.end.slice(5)}`,
        from: m.start,
        to: m.end,
        ...bag,
      }
    })
  }
  const end = periodRange.value.to || periodRange.value.from
  const idx = SOURCE1_DAYS.indexOf(end)
  const days =
    idx < 0 ? SOURCE1_DAYS.slice(-7) : SOURCE1_DAYS.slice(Math.max(0, idx - 6), idx + 1)
  return days.map((d) => {
    const bag = loadBucket(d, d)
    const [y, m, day] = d.split('-').map(Number)
    return {
      key: d,
      label: d.slice(5),
      sub: WEEKDAY[new Date(y, (m || 1) - 1, day || 1).getDay()],
      from: d,
      to: d,
      ...bag,
    }
  })
})

/** 顶栏合计：跟当前筛选区间（选中的日/周/月），不是整条趋势轴 */
const totals = computed(() => {
  if (periodMode.value === 'week') {
    const w = COCKPIT_WEEKS.find((x) => x.id === selectedWeekId.value)
    return aggregateSource1Kpi({
      ...scopeFilter.value,
      from: w?.start || periodRange.value.from,
      to: w?.end || periodRange.value.to,
    })
  }
  if (periodMode.value === 'month') {
    const m = COCKPIT_MONTHS.find((x) => x.id === selectedMonthId.value)
    return aggregateSource1Kpi({
      ...scopeFilter.value,
      from: m?.start || periodRange.value.from,
      to: m?.end || periodRange.value.to,
    })
  }
  const days = points.value
  return aggregateSource1Kpi({
    ...scopeFilter.value,
    from: days[0]?.from || '',
    to: days[days.length - 1]?.to || '',
  })
})

const empty = computed(
  () => !points.value.some((r) => r.profit != null || r.orders != null || r.paid != null),
)

const compareWord = computed(() =>
  periodMode.value === 'week' ? '较上周' : periodMode.value === 'month' ? '较上月' : '较上日',
)

/** 取当前选中桶 vs 上一桶，生成自动解读 */
const insight = computed(() => {
  const rows = points.value
  if (rows.length < 2) return null

  let curIdx = rows.length - 1
  if (periodMode.value === 'week') {
    const i = rows.findIndex((r) => r.key === selectedWeekId.value)
    if (i >= 0) curIdx = i
  } else if (periodMode.value === 'month') {
    const i = rows.findIndex((r) => r.key === selectedMonthId.value)
    if (i >= 0) curIdx = i
  }
  if (curIdx <= 0) return null

  const cur = rows[curIdx]!
  const prev = rows[curIdx - 1]!
  const dOrders = rel(cur.orders, prev.orders)
  const dPaid = rel(cur.paid, prev.paid)
  const dProfit = rel(cur.profit, prev.profit)
  if (dOrders == null && dPaid == null && dProfit == null) return null

  const word = compareWord.value
  const parts: string[] = []
  if (dOrders != null) parts.push(`订单${word}${dirText(dOrders)}`)
  if (dPaid != null) parts.push(`实付${dirText(dPaid)}`)
  if (dProfit != null) parts.push(`毛利${dirText(dProfit)}`)

  const tone = qualityTone(dOrders, dPaid, dProfit)
  const verdict =
    tone === 'good'
      ? '经营质量改善。'
      : tone === 'warn'
        ? '规模尚可，利润承压。'
        : tone === 'bad'
          ? '经营质量承压。'
          : '规模与利润同步变化。'

  return { text: `${parts.join('，')}，${verdict}`, tone }
})

function rel(cur: number | null, prev: number | null) {
  if (cur == null || prev == null || !prev) return null
  return (cur - prev) / Math.abs(prev)
}

function dirText(v: number) {
  const pct = `${Math.abs(v * 100).toFixed(2)}%`
  if (v > 0.0005) return `提升${pct}`
  if (v < -0.0005) return `下降${pct}`
  return '持平'
}

function qualityTone(
  dOrders: number | null,
  dPaid: number | null,
  dProfit: number | null,
): 'good' | 'warn' | 'bad' | 'neutral' {
  if (dProfit == null) return 'neutral'
  const scale = dPaid ?? dOrders
  if (dProfit > 0.005 && (scale == null || scale > -0.08)) return 'good'
  if (dProfit < -0.005 && scale != null && scale > 0.005) return 'warn'
  if (dProfit < -0.005 && (scale == null || scale < -0.005)) return 'bad'
  if (dProfit > 0.005) return 'good'
  return 'neutral'
}

useChart(el, option)

function axisCap(values: number[], floor: number, pad = 1.12) {
  const peak = Math.max(floor, ...values.map((v) => Math.abs(v)))
  if (!Number.isFinite(peak) || peak <= 0) return floor
  const raw = peak * pad
  const mag = 10 ** Math.floor(Math.log10(raw))
  const n = raw / mag
  const steps = [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]
  const nice = steps.find((s) => n <= s) ?? 10
  return nice * mag
}

function barGradient(active: boolean) {
  return {
    type: 'linear' as const,
    x: 0,
    y: 0,
    x2: 0,
    y2: 1,
    colorStops: [
      { offset: 0, color: active ? '#FFE14A' : '#F0D24A' },
      { offset: 1, color: active ? '#E09418' : '#C9A22E' },
    ],
  }
}

watch(
  [points, periodMode, selectedWeekId, selectedMonthId, periodRange],
  () => {
    const rows = points.value
    const moneyVals = rows.flatMap((r) => [r.paid, r.profit]).filter((v): v is number => v != null)
    const moneyMax = axisCap(moneyVals, 1000, 1.12)
    // 满 1 万即用「万」，避免 250000 / 166667 这类难读刻度
    const useWan = moneyMax >= 1e4
    const orderMax = axisCap(
      rows.map((r) => r.orders).filter((v): v is number => v != null && v >= 0),
      10,
      1.12,
    )
    const orderColor = PALETTE.chart3
    const paidColor = PALETTE.chart2
    const profitColor = PALETTE.up
    const mode = periodMode.value
    const activeKey =
      mode === 'week'
        ? selectedWeekId.value
        : mode === 'month'
          ? selectedMonthId.value
          : periodRange.value.to

    const fmtMoneyAxis = (v: number) => {
      if (!Number.isFinite(v) || v === 0) return '0'
      if (useWan || Math.abs(v) >= 10000) {
        const w = v / 1e4
        return Number.isInteger(w) ? `${w}万` : `${w.toFixed(1)}万`
      }
      if (Math.abs(v) >= 1000) return `${Math.round(v / 100) / 10}k`
      return `${Math.round(v)}`
    }

    option.value = {
      animationDuration: 200,
      animationDurationUpdate: 0,
      color: [orderColor, paidColor, profitColor],
      tooltip: {
        trigger: 'axis',
        confine: true,
        appendToBody: false,
        axisPointer: {
          type: 'shadow',
          shadowStyle: { color: 'rgba(94, 180, 255, 0.12)' },
          label: { show: false },
        },
        backgroundColor: PALETTE.panelDeep,
        borderColor: PALETTE.accent,
        padding: [6, 8],
        textStyle: { color: '#f3f8ff', fontSize: 12, fontWeight: 700 },
        formatter: (params: { dataIndex: number }[]) => {
          const row = rows[params[0]?.dataIndex]
          if (!row) return ''
          const head = row.sub ? `${row.label}　${row.sub}` : row.label
          return `<div style="font-weight:700;margin-bottom:4px;color:#fff;font-size:12px">${head}</div>
            <div style="display:grid;grid-template-columns:auto auto;gap:2px 12px;align-items:center;font-size:11px">
              <span style="color:#c9d7ea;font-weight:500">订单量</span><b style="color:${orderColor}">${formatInt(row.orders)}</b>
              <span style="color:#c9d7ea;font-weight:500">实付金额</span><b style="color:${paidColor}">${formatMoney(row.paid)}</b>
              <span style="color:#c9d7ea;font-weight:500">含后返毛利</span><b style="color:${profitColor}">${formatMoney(row.profit)}</b>
              <span style="color:#c9d7ea;font-weight:500">毛利率</span><b style="color:#8fd4ff">${formatPercent(row.profitRate)}</b>
            </div>`
        },
      },
      legend: { show: false },
      // 图例外置后，绘图区下移一点、底部少留白，避免上挤下空
      grid: { left: 4, right: 4, top: 12, bottom: 8, containLabel: true },
      xAxis: {
        type: 'category',
        data: rows.map((r) => r.key),
        boundaryGap: true,
        axisTick: { show: false },
        axisLine: { lineStyle: { color: 'rgba(150,200,235,0.28)' } },
        axisPointer: { label: { show: false } },
        axisLabel: {
          color: '#d7e8f8',
          margin: 8,
          interval: 0,
          formatter: (_: string, index: number) => {
            const row = rows[index]
            if (!row) return ''
            const active = row.key === activeKey
            return `{${active ? 'a' : 'd'}|${row.label}}\n{w|${row.sub || ''}}`
          },
          rich: {
            d: {
              color: '#e8f4ff',
              fontSize: mode === 'day' ? 12 : 11,
              fontWeight: 700,
              fontFamily: 'Bahnschrift, Segoe UI, sans-serif',
              lineHeight: 16,
            },
            a: {
              color: '#FFE14A',
              fontSize: mode === 'day' ? 12 : 11,
              fontWeight: 800,
              fontFamily: 'Bahnschrift, Segoe UI, sans-serif',
              lineHeight: 16,
            },
            w: { color: '#9bb8d4', fontSize: 10, lineHeight: 14 },
          },
        },
      },
      yAxis: [
        {
          type: 'value',
          name: '',
          nameGap: 6,
          min: 0,
          max: moneyMax,
          interval: moneyMax / 3,
          splitNumber: 3,
          splitLine: { lineStyle: { color: 'rgba(70, 210, 255, 0.14)', type: 'dashed', width: 1 } },
          axisPointer: { label: { show: false } },
          axisLabel: {
            color: '#7ec8ee',
            fontSize: 12,
            fontWeight: 600,
            margin: 8,
            hideOverlap: true,
            formatter: fmtMoneyAxis,
          },
        },
        {
          type: 'value',
          name: '',
          nameGap: 6,
          min: 0,
          max: orderMax,
          interval: orderMax / 3,
          splitNumber: 3,
          splitLine: { show: false },
          axisPointer: { label: { show: false } },
          axisLabel: {
            color: orderColor,
            fontSize: 12,
            fontWeight: 600,
            margin: 8,
            hideOverlap: true,
            formatter: (v: number) => (v >= 1000 ? `${Math.round(v / 100) / 10}k` : `${Math.round(v)}`),
          },
        },
      ],
      series: [
        {
          name: '订单量',
          type: 'bar',
          yAxisIndex: 1,
          barWidth: '42%',
          barMaxWidth: 28,
          z: 3,
          data: rows.map((r) => ({
            value: r.orders,
            itemStyle: {
              color: barGradient(r.key === activeKey),
              borderRadius: [8, 8, 2, 2],
              shadowBlur: r.key === activeKey ? 10 : 0,
              shadowColor: 'rgba(255, 225, 74, 0.35)',
            },
          })),
        },
        {
          name: '实付金额',
          type: 'line',
          yAxisIndex: 0,
          smooth: 0.35,
          connectNulls: false,
          showSymbol: true,
          symbol: 'circle',
          symbolSize: 7,
          z: 5,
          data: rows.map((r) => r.paid),
          lineStyle: { width: 2.4, color: paidColor, type: 'solid' },
          itemStyle: { color: paidColor, borderColor: '#083056', borderWidth: 2 },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(61, 220, 255, 0.18)' },
                { offset: 1, color: 'rgba(61, 220, 255, 0)' },
              ],
            },
          },
        },
        {
          name: '含后返毛利',
          type: 'line',
          yAxisIndex: 0,
          smooth: 0.35,
          connectNulls: false,
          showSymbol: true,
          symbol: 'diamond',
          symbolSize: 8,
          z: 6,
          data: rows.map((r) => r.profit),
          lineStyle: { width: 2.2, color: profitColor, type: [5, 4] },
          itemStyle: { color: profitColor, borderColor: '#083056', borderWidth: 2 },
        },
      ],
    }
  },
  { immediate: true },
)
</script>

<style scoped lang="scss">
.trend {
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
  overflow: hidden;
}
.trend__stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px;
  flex-shrink: 0;
}
.stat {
  min-width: 0;
  padding: 0 6px 2px;
  border: 0;
  border-bottom: 1px solid var(--divider);
  background: transparent;
  em {
    display: block;
    color: var(--muted);
    font-size: 11px;
    font-style: normal;
  }
  b {
    display: block;
    margin-top: 1px;
    color: var(--c-num);
    font: 700 18px/1.1 var(--font-num);
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  &.orders b { color: var(--accent, #FFE14A); }
  &.paid b { color: var(--primary-2, #3DDCFF); }
  &.profit b { color: var(--success, #00F0A8); }
}
.trend__insight {
  flex-shrink: 0;
  margin: 0;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  line-height: 1.35;
  color: #d7e8f8;
  background: rgba(8, 40, 72, 0.55);
  border: 1px solid rgba(94, 180, 255, 0.22);
  &.good {
    color: #9dffc4;
    border-color: rgba(0, 240, 168, 0.35);
  }
  &.warn {
    color: #ffd39a;
    border-color: rgba(255, 138, 31, 0.4);
  }
  &.bad {
    color: #ffb0bc;
    border-color: rgba(255, 61, 90, 0.4);
  }
}
.trend__legend {
  flex-shrink: 0;
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 10px 16px;
  margin: 2px 0 0;
  padding: 0;
  list-style: none;
  color: #d7e8f8;
  font-size: 11px;
  font-weight: 600;
  li {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    white-space: nowrap;
  }
  i {
    display: inline-block;
    flex-shrink: 0;
  }
  .lg-bar {
    width: 12px;
    height: 8px;
    border-radius: 2px;
    background: linear-gradient(180deg, #ffe14a, #e09418);
  }
  .lg-paid {
    width: 14px;
    height: 0;
    border-top: 2px solid #3ddcff;
    border-radius: 1px;
    position: relative;
    &::after {
      content: '';
      position: absolute;
      left: 50%;
      top: -5px;
      width: 6px;
      height: 6px;
      margin-left: -3px;
      border-radius: 50%;
      background: #3ddcff;
      box-shadow: 0 0 0 1px #083056;
    }
  }
  .lg-profit {
    width: 14px;
    height: 0;
    border-top: 2px dashed #00f0a8;
    position: relative;
    &::after {
      content: '';
      position: absolute;
      left: 50%;
      top: -5px;
      width: 6px;
      height: 6px;
      margin-left: -3px;
      background: #00f0a8;
      transform: rotate(45deg);
      box-shadow: 0 0 0 1px #083056;
    }
  }
}
.trend__chart {
  flex: 1 1 auto;
  min-height: 0;
  margin-top: 2px;
  width: 100%;
}
</style>
