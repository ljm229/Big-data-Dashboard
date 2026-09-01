<template>
  <Panel title="城市 TOP10" :updated-at="time" :loading="loading && !rows.length">
    <template #extra>
      <select class="metric" :value="metric" @change="onMetric">
        <option value="paid_amount">实付营业额</option>
        <option value="profit">预计毛利</option>
        <option value="orders">订单量</option>
        <option value="orders_per_store_day">单店日均订单</option>
      </select>
    </template>
    <div ref="el" class="chart" />
  </Panel>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import type { EChartsOption } from 'echarts'
import { storeToRefs } from 'pinia'
import Panel from '../Panel.vue'
import { useFilterStore } from '../../stores/filter'
import { fetchCityRank } from '../../api/dashboard'
import { useEcharts } from '../../composables/useEcharts'
import { formatMoney, formatInt } from '../../utils/format'

const filter = useFilterStore()
const { dataKey, loadingTick, updatedAt } = storeToRefs(filter)
const el = ref<HTMLElement | null>(null)
const loading = ref(true)
const metric = ref('paid_amount')
const option = ref<any>(null)
const rows = ref<Record<string, number | string>[]>([])
const time = computed(() => (updatedAt.value ? updatedAt.value.slice(11, 19) : ''))
const { chart } = useEcharts(el, option)
let timer = 0

function onMetric(e: Event) {
  metric.value = (e.target as HTMLSelectElement).value
  load(false)
}

async function load(showLoading = false) {
  if (showLoading) loading.value = true
  try {
    rows.value = (await fetchCityRank(dataKey.value, metric.value)) as typeof rows.value
    const list = [...rows.value].reverse()
    option.value = {
      grid: { left: 70, right: 50, top: 8, bottom: 8 },
      xAxis: { type: 'value', show: false },
      yAxis: {
        type: 'category',
        data: list.map((r) => String(r.name)),
        axisLabel: { color: '#8FA3BF', fontSize: 12 },
        axisTick: { show: false },
        axisLine: { show: false },
      },
      animationDurationUpdate: 1000,
      series: [
        {
          type: 'bar',
          realtimeSort: true,
          data: list.map((r, i) => ({
            value: Number(r[metric.value] || 0),
            itemStyle:
              i >= list.length - 3
                ? { color: i === list.length - 1 ? '#FFC53D' : '#00FFE4' }
                : undefined,
          })),
          barWidth: 14,
          itemStyle: {
            borderRadius: [0, 6, 6, 0],
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
          },
          label: {
            show: true,
            position: 'right',
            color: '#E6F1FF',
            fontSize: 14,
            fontFamily: 'DIN Alternate, Bahnschrift, sans-serif',
            formatter: (p: { value: number }) =>
              metric.value === 'orders' ? formatInt(p.value) : formatMoney(p.value),
          },
        },
      ],
    }
    chart.value?.off('click')
    chart.value?.on('click', (params: { name?: string }) => {
      const row = rows.value.find((r) => r.name === params.name)
      if (row) {
        filter.setCity(String(row.name), String(row.name))
        filter.openDrawer('city', row)
      }
    })
  } finally {
    loading.value = false
  }
}

watch([dataKey, loadingTick], () => load(true), { immediate: true })
onMounted(() => {
  timer = window.setInterval(() => load(false), 60000)
})
onUnmounted(() => clearInterval(timer))
</script>

<style scoped>
.metric {
  background: rgba(8, 24, 56, 0.9);
  border: 1px solid rgba(0, 170, 255, 0.45);
  color: #e8f3ff;
  border-radius: 4px;
  font-size: var(--fs-axis);
  padding: 4px 6px;
  max-width: 120px;
}
.chart {
  width: 100%;
  height: 100%;
  min-height: 120px;
}
</style>
