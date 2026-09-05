<template>
  <Panel title="日趋势" :updated-at="time" :loading="loading && !rows.length" :empty="!loading && !rows.length">
    <div ref="el" class="chart" />
  </Panel>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import Panel from '../Panel.vue'
import { useFilterStore } from '../../stores/filter'
import { fetchDayTrend } from '../../api/dashboard'
import { useEcharts } from '../../composables/useEcharts'
import { formatMoney, formatInt, formatPercent } from '../../utils/format'

const filter = useFilterStore()
const { dataKey, cityName, channel, loadingTick, updatedAt, hasData } = storeToRefs(filter)
const el = ref<HTMLElement | null>(null)
const loading = ref(true)
const rows = ref<
  { date: string; label: string; paid_amount: number; est_profit: number; paid_orders: number; profit_rate: number }[]
>([])
const option = ref<any>(null)
const time = computed(() => (updatedAt.value ? updatedAt.value.slice(5, 10) : ''))
useEcharts(el, option)

async function load() {
  loading.value = true
  try {
    if (!hasData.value) {
      rows.value = []
      option.value = null
      return
    }
    rows.value = await fetchDayTrend(dataKey.value, cityName.value, channel.value)
    const paid = rows.value.map((r) => r.paid_amount)
    const profit = rows.value.map((r) => r.est_profit)

    option.value = {
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(4, 16, 40, 0.94)',
        borderColor: 'rgba(90, 200, 255, 0.4)',
        borderWidth: 1,
        padding: [10, 14],
        extraCssText: 'box-shadow: 0 10px 28px rgba(0,0,0,0.45); backdrop-filter: blur(8px);',
        textStyle: { color: '#e8f3ff', fontSize: 12 },
        axisPointer: {
          type: 'line',
          lineStyle: {
            color: 'rgba(180, 220, 255, 0.45)',
            type: 'dashed',
            width: 1,
          },
          shadowStyle: { color: 'rgba(0, 140, 255, 0.08)' },
        },
        formatter: (params: { dataIndex: number; marker: string; seriesName: string; value: number }[]) => {
          const row = rows.value[params[0]?.dataIndex]
          if (!row) return ''
          const lines = params
            .map((p) => `${p.marker}${p.seriesName}<span style="float:right;margin-left:18px;font-weight:600;font-variant-numeric:tabular-nums">${formatMoney(p.value)}</span>`)
            .join('<br/>')
          return `<div style="font-weight:700;margin-bottom:6px;color:#fff">${row.label}</div>${lines}<br/><span style="color:#8899aa">订单 ${formatInt(row.paid_orders)} · 毛利率 ${formatPercent(row.profit_rate)}</span>`
        },
      },
      legend: {
        data: [
          { name: '实付', icon: 'roundRect' },
          { name: '毛利(含后返)', icon: 'circle' },
        ],
        top: 2,
        right: 4,
        itemWidth: 12,
        itemHeight: 8,
        itemGap: 14,
        textStyle: { color: '#9eb4cc', fontSize: 11 },
      },
      grid: { left: 48, right: 44, top: 30, bottom: 26, containLabel: false },
      xAxis: {
        type: 'category',
        data: rows.value.map((r) => r.label),
        boundaryGap: true,
        axisTick: { show: false },
        axisLine: { lineStyle: { color: 'rgba(120, 180, 230, 0.25)' } },
        axisLabel: {
          color: '#8FA3BF',
          fontSize: 11,
          margin: 10,
        },
      },
      yAxis: [
        {
          type: 'value',
          name: '实付',
          nameTextStyle: { color: '#6f8eae', fontSize: 10, padding: [0, 0, 0, 0] },
          axisTick: { show: false },
          axisLine: { show: false },
          axisLabel: {
            color: '#8FA3BF',
            fontSize: 10,
            formatter: (v: number) => formatMoney(v, 0),
            margin: 6,
          },
          splitLine: {
            lineStyle: { color: 'rgba(120, 180, 230, 0.08)', type: 'dashed' },
          },
        },
        {
          type: 'value',
          name: '毛利',
          nameTextStyle: { color: '#6f8eae', fontSize: 10 },
          axisTick: { show: false },
          axisLine: { show: false },
          axisLabel: {
            color: '#8FA3BF',
            fontSize: 10,
            formatter: (v: number) => formatMoney(v, 0),
            margin: 6,
          },
          splitLine: { show: false },
        },
      ],
      series: [
        {
          name: '实付',
          type: 'bar',
          barWidth: '42%',
          barMaxWidth: 18,
          data: paid,
          itemStyle: {
            borderRadius: [5, 5, 0, 0],
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: '#6ec8ff' },
                { offset: 0.45, color: '#2a8dff' },
                { offset: 1, color: 'rgba(20, 70, 180, 0.55)' },
              ],
            },
            shadowColor: 'rgba(0, 160, 255, 0.35)',
            shadowBlur: 8,
            shadowOffsetY: 2,
          },
          emphasis: {
            itemStyle: {
              color: {
                type: 'linear',
                x: 0,
                y: 0,
                x2: 0,
                y2: 1,
                colorStops: [
                  { offset: 0, color: '#9adbff' },
                  { offset: 1, color: '#3a9bff' },
                ],
              },
            },
          },
          z: 2,
        },
        {
          name: '毛利(含后返)',
          type: 'line',
          yAxisIndex: 1,
          smooth: 0.35,
          symbol: 'circle',
          symbolSize: 8,
          showSymbol: true,
          data: profit,
          lineStyle: {
            width: 2.5,
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 1,
              y2: 0,
              colorStops: [
                { offset: 0, color: '#7dffb0' },
                { offset: 1, color: '#3dff7a' },
              ],
            },
            shadowColor: 'rgba(61, 255, 122, 0.45)',
            shadowBlur: 6,
          },
          itemStyle: {
            color: '#04122f',
            borderColor: '#3dff7a',
            borderWidth: 2,
          },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(61, 255, 122, 0.28)' },
                { offset: 0.7, color: 'rgba(61, 255, 122, 0.06)' },
                { offset: 1, color: 'rgba(61, 255, 122, 0)' },
              ],
            },
          },
          emphasis: {
            scale: true,
            itemStyle: {
              color: '#3dff7a',
              borderColor: '#fff',
              borderWidth: 2,
              shadowColor: 'rgba(61, 255, 122, 0.8)',
              shadowBlur: 10,
            },
          },
          z: 3,
        },
      ],
      animationDuration: 700,
      animationEasing: 'cubicOut',
    }
  } finally {
    loading.value = false
  }
}

watch([dataKey, cityName, channel, loadingTick], load, { immediate: true })
</script>

<style scoped lang="scss">
.chart {
  width: 100%;
  height: 100%;
  min-height: 140px;
}
</style>
