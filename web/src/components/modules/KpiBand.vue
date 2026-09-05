<template>
  <div class="kpi">
    <article v-for="card in cards" :key="card.key" class="kpi__card">
      <div class="kpi__label">{{ card.label }}</div>
      <FlipNumber :value="card.main" :tone="card.tone" class="kpi__num" />
      <div class="kpi__deltas">
        <span class="kpi__delta" :class="toneClass(card.mom, card.invertDelta)">
          <em>环比</em>{{ fmtDelta(card.mom) }}
        </span>
        <span class="kpi__delta" :class="toneClass(card.wow, card.invertDelta)">
          <em>周同比</em>{{ fmtDelta(card.wow) }}
        </span>
      </div>
    </article>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import FlipNumber from '../FlipNumber.vue'
import { useFilterStore } from '../../stores/filter'
import { fetchOverview } from '../../api/dashboard'
import { formatMoney, formatPercent, formatInt } from '../../utils/format'

const filter = useFilterStore()
const { dataKey, cityName, channel, loadingTick, compareKey, wowKey, selectedDate } = storeToRefs(filter)
const data = ref<Record<string, number> | null>(null)
const compare = ref<Record<string, number> | null>(null)
const wow = ref<Record<string, number> | null>(null)
let timer = 0

async function load() {
  const ch = channel.value
  const ov = await fetchOverview(dataKey.value, cityName.value, ch)
  data.value = ov as Record<string, number> | null
  compare.value = compareKey.value
    ? ((await fetchOverview(compareKey.value, cityName.value, ch)) as Record<string, number> | null)
    : null
  wow.value = wowKey.value
    ? ((await fetchOverview(wowKey.value, cityName.value, ch)) as Record<string, number> | null)
    : null
  filter.updatedAt = String((data.value as { updated_at?: string } | null)?.updated_at || selectedDate.value)
}

function ratio(cur: number | undefined, prev: number | undefined) {
  if (cur == null || prev == null || !prev) return null
  return (cur - prev) / Math.abs(prev)
}

function fmtDelta(v: number | null) {
  if (v == null) return '--'
  const pct = Math.abs(v * 100).toFixed(1)
  return `${v >= 0 ? '↑' : '↓'}${pct}%`
}

function toneClass(v: number | null, invert = false) {
  if (v == null) return 'muted'
  const rising = v >= 0
  // 退款率等：上升为坏 → 红；其余指标上升为好 → 绿
  if (invert) return rising ? 'down' : 'up'
  return rising ? 'up' : 'down'
}

const cards = computed(() => {
  const d = data.value
  if (!d) {
    return Array.from({ length: 7 }, (_, i) => ({
      key: String(i),
      label: '加载中',
      main: '--',
      tone: '' as const,
      mom: null as number | null,
      wow: null as number | null,
      invertDelta: false,
    }))
  }
  const momOf = (k: string) => ratio(d[k], compare.value?.[k])
  const wowOf = (k: string) => ratio(d[k], wow.value?.[k])
  return [
    {
      key: 'paid',
      label: '实付金额',
      main: formatMoney(d.paid_amount),
      tone: '' as const,
      mom: momOf('paid_amount'),
      wow: wowOf('paid_amount'),
      invertDelta: false,
    },
    {
      key: 'gmv',
      label: '总营业额',
      main: formatMoney(d.total_gmv),
      tone: '' as const,
      mom: momOf('total_gmv'),
      wow: wowOf('total_gmv'),
      invertDelta: false,
    },
    {
      key: 'orders',
      label: '有效订单量',
      main: formatInt(d.effective_orders),
      tone: '' as const,
      mom: momOf('effective_orders'),
      wow: wowOf('effective_orders'),
      invertDelta: false,
    },
    {
      key: 'arpu',
      label: '客单价',
      main: formatMoney(d.arpu),
      tone: '' as const,
      mom: momOf('arpu'),
      wow: wowOf('arpu'),
      invertDelta: false,
    },
    {
      key: 'profit',
      label: '预计毛利(含后返)',
      main: formatMoney(d.est_profit),
      tone: (d.est_profit < 0 ? 'danger' : '') as 'danger' | '',
      mom: momOf('est_profit'),
      wow: wowOf('est_profit'),
      invertDelta: false,
    },
    {
      key: 'profit_rate',
      label: '毛利率(含后返)',
      main: formatPercent(d.profit_rate),
      tone: '' as const,
      mom: momOf('profit_rate'),
      wow: wowOf('profit_rate'),
      invertDelta: false,
    },
    {
      key: 'refund',
      label: '退款率',
      main: formatPercent(d.refund_rate),
      tone: (d.refund_rate > 0.05 ? 'danger' : '') as 'danger' | '',
      mom: momOf('refund_rate'),
      wow: wowOf('refund_rate'),
      invertDelta: true,
    },
  ]
})

watch([dataKey, cityName, channel, loadingTick], load, { immediate: true })
onMounted(() => {
  timer = window.setInterval(load, 30000)
})
onUnmounted(() => clearInterval(timer))
</script>

<style scoped lang="scss">
.kpi {
  height: 118px;
  flex-shrink: 0;
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 10px;
  padding: 0 2px;
}

.kpi__card {
  min-width: 0;
  height: 100%;
  padding: 12px 14px 10px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 4px;
  border-radius: 2px;
  background:
    linear-gradient(165deg, rgba(14, 42, 92, 0.62), rgba(6, 20, 48, 0.48)),
    rgba(8, 28, 64, 0.42);
  border: 1px solid rgba(64, 180, 255, 0.32);
  overflow: hidden;
}

.kpi__label {
  font-size: var(--fs-data);
  font-weight: 600;
  color: rgba(200, 225, 250, 0.9);
  letter-spacing: 0.5px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.kpi__num {
  margin: 2px 0 4px;
  font-family: var(--font-num);
  font-size: var(--fs-kpi);
  font-weight: var(--fw-kpi);
  font-variant-numeric: tabular-nums;
  line-height: 1.05;
  letter-spacing: 0.5px;
  color: var(--c-num);
  text-shadow: 0 0 18px rgba(94, 200, 255, 0.25);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.kpi__deltas {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 12px;
  align-items: baseline;
}

.kpi__delta {
  font-family: var(--font-num);
  font-size: var(--fs-axis);
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  line-height: 1.2;
  white-space: nowrap;
  letter-spacing: 0.02em;
  em {
    margin-right: 4px;
    font-style: normal;
    font-weight: 500;
    font-family: var(--font-cn);
    font-size: var(--fs-tiny);
    color: rgba(160, 190, 220, 0.75);
  }
  &.up {
    color: #3dff7a;
  }
  &.down {
    color: #ff6b6b;
  }
  &.muted {
    color: rgba(150, 170, 190, 0.65);
  }
}
</style>
