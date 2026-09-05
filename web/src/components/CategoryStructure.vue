<template>
  <article class="card cat-card">
    <header class="card__head">
      <h2>品类结构</h2>
      <p>
        {{ periodLabel }} · Top{{ displayRows.length }}
        <template v-if="summary">
          · 销售额 ¥{{ formatMoney(summary.gmv) }} · 毛利 ¥{{ formatMoney(summary.profit) }}
        </template>
      </p>
    </header>
    <div ref="el" class="chart" />
  </article>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { EChartsOption } from 'echarts'
import { fetchCategoryMix, type CategoryRow } from '../api/dashboard'
import { useEcharts } from '../composables/useEcharts'
import { formatMoney, formatPercent } from '../utils/format'

const props = defineProps<{
  dateKey: string
  city?: string
  storeId?: string
}>()

const el = ref<HTMLElement | null>(null)
const option = ref<EChartsOption | null>(null)
useEcharts(el, option as any)

const rows = ref<CategoryRow[]>([])
const periodLabel = ref('8.21-9.3 合集')
const displayRows = computed(() => rows.value.slice(0, 8))
const summary = computed(() => {
  if (!rows.value.length) return null
  return {
    gmv: rows.value.reduce((a, r) => a + r.total_gmv, 0),
    profit: rows.value.reduce((a, r) => a + r.profit, 0),
  }
})

const COLORS = ['#2A5C82', '#5B9BD5', '#70AD47', '#FFC000', '#E74C3C', '#9B6DFF', '#2A9D8F', '#F4B183']

async function reload() {
  const res = await fetchCategoryMix(props.dateKey, props.city || '全部', props.storeId || '全部')
  rows.value = res.rows || []
  periodLabel.value = res.period?.label ? `${res.period.label} 合集` : '品类合集'

  const top = [...displayRows.value].reverse()
  option.value = {
    grid: { left: 78, right: 110, top: 4, bottom: 4 },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (params: unknown) => {
        const arr = params as Array<{ name: string; value: number; dataIndex: number }>
        const p = arr[0]
        if (!p) return ''
        const row = displayRows.value[displayRows.value.length - 1 - p.dataIndex]
        if (!row) return p.name
        return `${row.name}<br/>销售额 ¥${formatMoney(row.total_gmv)}（${((row.share || 0) * 100).toFixed(1)}%）<br/>毛利率 ${formatPercent(row.profit_rate)}`
      },
    },
    xAxis: {
      type: 'value',
      show: false,
    },
    yAxis: {
      type: 'category',
      data: top.map((r) => r.name),
      axisLabel: { color: '#3d3d3d', fontSize: 12 },
      axisTick: { show: false },
      axisLine: { show: false },
    },
    series: [
      {
        type: 'bar',
        data: top.map((r, i) => ({
          value: Number(r.total_gmv.toFixed(0)),
          itemStyle: {
            color: COLORS[(top.length - 1 - i) % COLORS.length],
            borderRadius: [0, 4, 4, 0],
          },
        })),
        barWidth: 14,
        label: {
          show: true,
          position: 'right',
          color: '#5a6a7a',
          fontSize: 11,
          formatter: (p: unknown) => {
            const d = p as { dataIndex: number; value: number }
            const row = top[d.dataIndex]
            const share = row ? ((row.share || 0) * 100).toFixed(1) : ''
            const money = d.value >= 10000 ? `${(d.value / 10000).toFixed(1)}万` : String(d.value)
            return `${money}  ${share}%`
          },
        },
      },
    ],
  }
}

watch(() => [props.dateKey, props.city, props.storeId], () => void reload(), { immediate: true })
</script>

<style scoped lang="scss">
.cat-card {
  background: #fff;
  border-radius: 12px;
  padding: 10px 14px 8px;
  box-shadow: 0 2px 10px rgba(42, 92, 130, 0.07);
  border: 1px solid rgba(42, 92, 130, 0.06);
}
.card__head {
  display: flex;
  align-items: baseline;
  gap: 10px;
  margin-bottom: 4px;
  h2 {
    margin: 0;
    font-size: 15px;
    color: #2a5c82;
    white-space: nowrap;
  }
  p {
    margin: 0;
    font-size: 12px;
    color: #8c8c8c;
  }
}
.chart {
  width: 100%;
  height: 196px;
}
</style>
