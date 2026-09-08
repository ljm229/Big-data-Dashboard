<template>
  <Panel title="城市 TOP10" :updated-at="time" :loading="loading && !rows.length">
    <template #extra>
      <DashSelect
        class="metric-select"
        :model-value="metric"
        :options="metricOptions"
        @update:model-value="onMetric"
      />
    </template>
    <div ref="el" class="chart" />
  </Panel>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import Panel from '../Panel.vue'
import DashSelect from '../DashSelect.vue'
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

const metricOptions = [
  { value: 'paid_amount', label: '实付营业额' },
  { value: 'profit', label: '预计毛利' },
  { value: 'orders', label: '订单量' },
  { value: 'orders_per_store_day', label: '单店日均订单' },
]

function onMetric(value: string) {
  metric.value = value
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
.metric-select {
  width: 136px;
}
.chart {
  width: 100%;
  height: 100%;
  min-height: 120px;
}
</style>
