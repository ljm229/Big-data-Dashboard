<template>
  <Panel :title="panelTitle" :updated-at="time" :loading="loading && !rows.length" :empty="!loading && !rows.length">
    <div ref="el" class="chart" />
  </Panel>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { EChartsOption } from 'echarts'
import { storeToRefs } from 'pinia'
import Panel from '../Panel.vue'
import { useFilterStore } from '../../stores/filter'
import { fetchCityCompare } from '../../api/dashboard'
import { useEcharts } from '../../composables/useEcharts'
import { formatMoney, formatInt } from '../../utils/format'

const filter = useFilterStore()
const { dataKey, cityName, loadingTick, updatedAt, compareKey, compareLabel, hasData } = storeToRefs(filter)
const el = ref<HTMLElement | null>(null)
const loading = ref(true)
const rows = ref<
  { label: string; paid_orders: number; paid_amount: number; compare_orders?: number; compare_amount?: number }[]
>([])
const time = computed(() => (updatedAt.value ? updatedAt.value.slice(5, 10) : ''))
const panelTitle = computed(() =>
  cityName.value === '全国' ? '各城市实付对比' : `${cityName.value}门店实付对比`,
)
const option = ref<any>(null)
useEcharts(el, option)

async function load() {
  loading.value = true
  try {
    if (!hasData.value) {
      rows.value = []
      option.value = null
      return
    }
    rows.value = await fetchCityCompare(dataKey.value, compareKey.value, cityName.value)
    const list = [...rows.value].sort((a, b) => b.paid_amount - a.paid_amount)
    option.value = {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (params: unknown) => {
          const ps = params as { dataIndex: number }[]
          const row = list[ps[0]?.dataIndex]
          if (!row) return ''
          const arpu = row.paid_orders ? row.paid_amount / row.paid_orders : 0
          let s = `${row.label}<br/>实付：${formatMoney(row.paid_amount)}<br/>订单：${formatInt(row.paid_orders)}<br/>笔单价：${formatMoney(arpu)}`
          if (row.compare_amount) s += `<br/>${compareLabel.value || '对照日'}实付：${formatMoney(row.compare_amount)}`
          return s
        },
      },
      grid: { left: 76, right: 118, top: 12, bottom: 20 },
      xAxis: {
        type: 'value',
        axisLabel: { color: '#8FA3BF', fontSize: 12, formatter: (v: number) => formatMoney(v, 0) },
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.06)' } },
      },
      yAxis: {
        type: 'category',
        inverse: true,
        data: list.map((r) => r.label),
        axisLabel: { color: '#8FA3BF', fontSize: 12 },
        axisTick: { show: false },
        axisLine: { lineStyle: { color: 'rgba(255,255,255,0.08)' } },
      },
      series: [
        {
          name: '实付营业额',
          type: 'bar',
          barWidth: 16,
          data: list.map((r) => ({
            value: r.paid_amount,
            compare_amount: r.compare_amount,
          })),
          itemStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 1,
              y2: 0,
              colorStops: [
                { offset: 0, color: '#1c28c8' },
                { offset: 1, color: '#0fb6fc' },
              ],
            },
            borderRadius: [0, 6, 6, 0],
          },
          label: {
            show: true,
            position: 'right',
            distance: 10,
            formatter: (p: { dataIndex: number; value: number }) => {
              const row = list[p.dataIndex]
              const value = `{value|${formatMoney(row.paid_amount)}}`
              if (!row.compare_amount) return value
              const delta = (row.paid_amount - row.compare_amount) / row.compare_amount
              const arrow = delta >= 0 ? '▲' : '▼'
              const cls = delta >= 0 ? 'up' : 'down'
              return `${value} {${cls}|${arrow} ${Math.abs(delta * 100).toFixed(1)}%}`
            },
            rich: {
              value: { color: '#E6F1FF', fontSize: 14, fontFamily: 'DIN Alternate, Bahnschrift, monospace', fontWeight: 400 },
              up: { color: '#00FFE4', fontSize: 12, fontFamily: 'DIN Alternate, Bahnschrift, monospace' },
              down: { color: '#FF4D4F', fontSize: 12, fontFamily: 'DIN Alternate, Bahnschrift, monospace' },
            },
          },
        },
      ],
    }
  } finally {
    loading.value = false
  }
}

watch([dataKey, cityName, loadingTick], load, { immediate: true })
</script>

<style scoped>
.chart {
  width: 100%;
  height: 100%;
  min-height: 140px;
}
</style>
