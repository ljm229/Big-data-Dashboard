<!-- 中文名：经营趋势（毛利 / 订单 / 毛利率） -->
<template>
  <Panel :title="panelTitle" :empty="empty">
    <div class="trend">
      <div class="trend__stats" :aria-label="panelTitle">
        <div class="stat profit">
          <em>预计毛利</em>
          <b>{{ formatMoney(totals.profit) }}</b>
        </div>
        <div class="stat orders">
          <em>订单量</em>
          <b>{{ formatInt(totals.orders) }}</b>
        </div>
        <div class="stat rate">
          <em>毛利率</em>
          <b>{{ formatPercent(totals.profitRate) }}</b>
        </div>
      </div>
      <div ref="el" class="trend__chart" />
    </div>
  </Panel>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import Panel from '../Panel.vue'
import { useFilterStore } from '../../stores/filter'
import { SOURCE1_DAYS, aggregateSource1Kpi, source1TrendRange } from '../../api/source1'
import { useChart } from '../../composables/useChart'
import { PALETTE } from '../../styles/palette'
import { formatInt, formatMoney, formatPercent } from '../../utils/format'

const WEEK = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
const filter = useFilterStore()
const { cityQuery, channel, storeQuery, periodRange, periodMode } = storeToRefs(filter)
const el = ref<HTMLElement | null>(null)
const option = ref<any>(null)

const windowDays = computed(() => {
  const { from, to } = periodRange.value
  if (periodMode.value === 'week' || periodMode.value === 'month') {
    return SOURCE1_DAYS.filter((d) => d >= from && d <= to)
  }
  const end = to || from
  const idx = SOURCE1_DAYS.indexOf(end)
  if (idx < 0) return SOURCE1_DAYS.slice(-7)
  return SOURCE1_DAYS.slice(Math.max(0, idx - 6), idx + 1)
})
const panelTitle = computed(() => {
  if (periodMode.value === 'week') return '经营趋势（本周）'
  if (periodMode.value === 'month') return '经营趋势（本月）'
  return '经营趋势（近7日）'
})
const points = computed(() =>
  source1TrendRange(
    {
      from: windowDays.value[0] || '',
      to: windowDays.value[windowDays.value.length - 1] || '',
      city: cityQuery.value,
      channel: channel.value,
      store: storeQuery.value,
    },
    windowDays.value,
  ),
)
const empty = computed(
  () =>
    !points.value.some(
      (r) => r.profit != null || r.orders != null || r.profitRate != null,
    ),
)
const totals = computed(() => {
  const days = windowDays.value
  return aggregateSource1Kpi({
    from: days[0] || '',
    to: days[days.length - 1] || '',
    city: cityQuery.value,
    channel: channel.value,
    store: storeQuery.value,
  })
})
useChart(el, option)

function weekday(iso: string) {
  const [y, m, d] = iso.split('-').map(Number)
  return WEEK[new Date(y, (m || 1) - 1, d || 1).getDay()]
}

function niceMax(values: number[], floor: number, pad = 1.16) {
  const peak = Math.max(floor, ...values.map((v) => Math.abs(v)))
  if (!Number.isFinite(peak) || peak <= 0) return floor
  const raw = peak * pad
  const mag = 10 ** Math.floor(Math.log10(raw))
  const n = raw / mag
  const nice = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10
  return nice * mag
}

function rateLabel(v: number | null | undefined) {
  if (v == null || Number.isNaN(v)) return ''
  return `${(Math.abs(v) <= 1 ? v * 100 : v).toFixed(0)}%`
}

watch(
  points,
  () => {
    const rows = points.value
    const profitVals = rows.map((r) => r.profit).filter((v): v is number => v != null)
    const profitMax = niceMax(profitVals, 1000, 1.18)
    const useWan = profitMax >= 1e6
    const rates = rows
      .map((r) => r.profitRate)
      .filter((v): v is number => v != null && Math.abs(v) <= 1)
    const ratePeak = Math.max(0.2, ...(rates.length ? rates : [0.2]))
    const rateMax = Math.min(0.5, Math.max(ratePeak * 1.08, 0.24))
    const orderMax = niceMax(
      rows.map((r) => r.orders).filter((v): v is number => v != null && v >= 0),
      10,
    )
    const cats = rows.map((r) => r.key)
    const dense = cats.length > 10

    option.value = {
      animationDuration: 200,
      animationDurationUpdate: 0,
      color: [PALETTE.chart1, PALETTE.chart3, PALETTE.up],
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow', shadowStyle: { color: 'rgba(80, 180, 255, 0.1)' } },
        backgroundColor: PALETTE.panelDeep,
        borderColor: PALETTE.accent,
        textStyle: { color: '#f3f8ff', fontSize: 15, fontWeight: 700 },
        formatter: (params: { dataIndex: number }[]) => {
          const row = rows[params[0]?.dataIndex]
          if (!row) return ''
          return `<div style="font-weight:700;margin-bottom:8px;color:#fff">${row.key}　${weekday(row.key)}</div>
            <div style="display:grid;grid-template-columns:auto auto;gap:5px 20px;align-items:center">
              <span style="color:#c9d7ea">预计毛利</span><b style="color:#8be7ff">${formatMoney(row.profit)}</b>
              <span style="color:#c9d7ea">订单量</span><b style="color:#ffe08a">${formatInt(row.orders)}</b>
              <span style="color:#c9d7ea">毛利率（含后返）</span><b style="color:#8fd4ff">${formatPercent(row.profitRate)}</b>
            </div>`
        },
      },
      legend: {
        data: ['预计毛利', '订单量', '毛利率'],
        top: 0,
        right: 0,
        itemWidth: 14,
        itemHeight: 10,
        itemGap: 14,
        textStyle: { color: '#f4fbff', fontSize: 13, fontWeight: 700 },
      },
      grid: { left: 46, right: 47, top: 30, bottom: 42, containLabel: false },
      xAxis: {
        type: 'category',
        data: cats,
        boundaryGap: true,
        axisTick: { show: false },
        axisLine: { lineStyle: { color: 'rgba(150,200,235,0.4)' } },
        axisLabel: {
          color: '#d7e8f8',
          margin: 8,
          interval: dense ? 'auto' : 0,
          formatter: (value: string) => `{d|${value.slice(5)}}\n{w|${weekday(value)}}`,
          rich: {
            d: {
              color: '#f4fbff',
              fontSize: 14,
              fontWeight: 800,
              fontFamily: 'Bahnschrift, Segoe UI, sans-serif',
              lineHeight: 18,
            },
            w: { color: '#d0e2f4', fontSize: 13, lineHeight: 16 },
          },
        },
      },
      yAxis: [
        {
          type: 'value',
          name: useWan ? '毛利(万)' : '毛利(元)',
          nameTextStyle: { color: '#8fd4ff', fontSize: 11, padding: [0, 0, 0, 0] },
          min: 0,
          max: profitMax,
          splitNumber: 2,
          splitLine: { lineStyle: { color: 'rgba(70, 210, 255, 0.22)', type: 'dashed', width: 1 } },
          axisLabel: {
            color: '#21D7FF',
            fontSize: 13,
            fontWeight: 800,
            formatter: (v: number) => (useWan ? `${(v / 1e4).toFixed(2)}万` : `${v.toFixed(2)}元`),
          },
        },
        {
          type: 'value',
          min: 0,
          max: orderMax,
          splitNumber: 4,
          splitLine: { show: false },
          axisLabel: {
            color: '#FFD23F',
            fontSize: 13,
            fontWeight: 800,
            formatter: (v: number) => `${Math.round(v)}`,
          },
        },
        {
          type: 'value',
          min: 0,
          max: rateMax,
          splitLine: { show: false },
          axisLabel: { show: false },
          axisTick: { show: false },
          axisLine: { show: false },
        },
      ],
      series: [
        {
          name: '预计毛利',
          type: 'bar',
          yAxisIndex: 0,
          barMaxWidth: 18,
          barGap: '30%',
          data: rows.map((r) => r.profit),
          itemStyle: {
            color: PALETTE.chart1,
            borderRadius: [2, 2, 0, 0],
          },
        },
        {
          name: '订单量',
          type: 'bar',
          yAxisIndex: 1,
          barMaxWidth: 18,
          data: rows.map((r) => r.orders),
          itemStyle: {
            color: PALETTE.chart3,
            borderRadius: [2, 2, 0, 0],
          },
        },
        {
          name: '毛利率',
          type: 'line',
          yAxisIndex: 2,
          smooth: 0.2,
          connectNulls: false,
          showSymbol: true,
          symbol: 'circle',
          symbolSize: 6,
          z: 6,
          clip: false,
          data: rows.map((r) => r.profitRate),
          lineStyle: { width: 2.5, color: PALETTE.up, shadowColor: PALETTE.up, shadowBlur: 5 },
          itemStyle: {
            color: PALETTE.up,
            borderColor: PALETTE.title,
            borderWidth: 1,
            shadowBlur: 7,
            shadowColor: PALETTE.up,
          },
          emphasis: {
            scale: false,
            itemStyle: {
              color: 'rgba(0, 0, 0, 0)',
              borderColor: '#9dffb8',
              borderWidth: 2,
            },
          },
          label: {
            show: false,
            position: 'inside',
            color: '#36E27A',
            fontSize: 12,
            fontWeight: 800,
            formatter: (p: { value: number | null }) => rateLabel(p.value),
          },
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
  gap: 4px;
}
.trend__stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px;
  flex-shrink: 0;
}
.stat {
  min-width: 0;
  padding: 0 8px 4px;
  border: 0;
  border-bottom: 1px solid var(--divider);
  background: transparent;
  em {
    display: block;
    color: var(--muted);
    font-size: 13px;
    font-style: normal;
  }
  b {
    display: block;
    margin-top: 2px;
    color: var(--c-num);
    font: 700 24px/1.1 var(--font-num);
    font-variant-numeric: tabular-nums;
    text-shadow: none;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  small {
    margin-left: 2px;
    color: #d5e6f6;
    font-size: 11px;
    font-weight: 650;
  }
  &.profit b { color: var(--primary-2); }
  &.orders b { color: var(--accent); }
  &.rate b { color: var(--success); }
}
.trend__chart {
  flex: 1;
  min-height: 0;
  width: 100%;
}
</style>
