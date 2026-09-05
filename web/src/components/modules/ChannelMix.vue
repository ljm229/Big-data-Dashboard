<template>
  <Panel title="渠道结构" :updated-at="time" :loading="loading && !rows.length" :empty="!loading && !rows.length">
    <div class="wrap">
      <div ref="el" class="chart" />
      <ul class="legend">
        <li v-for="r in rows" :key="r.channel">
          <i :style="{ background: colorOf(r.channel) }" />
          <span class="name">{{ r.channel }}</span>
          <b>{{ formatMoney(r.paid_amount) }}</b>
          <em>{{ (r.paid_share * 100).toFixed(1) }}%</em>
          <small>毛利率 {{ formatPercent(r.profit_rate) }}</small>
        </li>
      </ul>
    </div>
  </Panel>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import Panel from '../Panel.vue'
import { useFilterStore } from '../../stores/filter'
import { fetchChannelMix } from '../../api/dashboard'
import { useEcharts } from '../../composables/useEcharts'
import { formatMoney, formatPercent } from '../../utils/format'

const COLORS: Record<string, string> = {
  淘宝闪购: '#3aa0ff',
  美团: '#ffc53d',
  POS: '#3dff7a',
  京东: '#ff7a45',
}

const filter = useFilterStore()
const { dataKey, cityName, loadingTick, updatedAt, hasData } = storeToRefs(filter)
const el = ref<HTMLElement | null>(null)
const loading = ref(true)
const rows = ref<
  {
    channel: string
    paid_amount: number
    est_profit: number
    paid_orders: number
    profit_rate: number
    paid_share: number
  }[]
>([])
const option = ref<any>(null)
const time = computed(() => (updatedAt.value ? updatedAt.value.slice(5, 10) : ''))
useEcharts(el, option)

function colorOf(ch: string) {
  return COLORS[ch] || '#8899AA'
}

async function load() {
  loading.value = true
  try {
    if (!hasData.value) {
      rows.value = []
      option.value = null
      return
    }
    rows.value = await fetchChannelMix(dataKey.value, cityName.value)
    option.value = {
      tooltip: {
        trigger: 'item',
        formatter: (p: { name: string; percent: number; value: number }) =>
          `${p.name}<br/>实付 ${formatMoney(p.value)}（${p.percent}%）`,
      },
      series: [
        {
          type: 'pie',
          radius: ['42%', '68%'],
          center: ['50%', '50%'],
          label: { show: false },
          data: rows.value.map((r) => ({
            name: r.channel,
            value: r.paid_amount,
            itemStyle: { color: colorOf(r.channel) },
          })),
        },
      ],
    }
  } finally {
    loading.value = false
  }
}

watch([dataKey, cityName, loadingTick], load, { immediate: true })
</script>

<style scoped lang="scss">
.wrap {
  height: 100%;
  min-height: 0;
  display: grid;
  grid-template-columns: 1.1fr 1fr;
  gap: 8px;
}
.chart {
  min-height: 0;
  height: 100%;
}
.legend {
  list-style: none;
  margin: 0;
  padding: 4px 4px 4px 0;
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
  li {
    display: grid;
    grid-template-columns: 8px 1fr auto;
    grid-template-rows: auto auto;
    column-gap: 8px;
    row-gap: 2px;
    align-items: center;
    font-size: 12px;
    color: #cfe0f6;
  }
  i {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    grid-row: 1 / span 2;
  }
  .name {
    font-weight: 600;
  }
  b {
    font-family: var(--font-num);
    color: #fff;
  }
  em {
    grid-column: 2;
    font-style: normal;
    color: #9adfff;
    font-size: 11px;
  }
  small {
    grid-column: 3;
    color: rgba(160, 190, 220, 0.75);
    font-size: 11px;
  }
}
</style>
