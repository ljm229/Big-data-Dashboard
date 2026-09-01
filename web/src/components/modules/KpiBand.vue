<template>
  <div class="kpi">
    <article v-for="card in cards" :key="card.key" class="kpi__card">
      <div class="kpi__label">{{ card.label }}</div>
      <FlipNumber :value="card.main" :tone="card.tone" class="kpi__num" />
      <div v-if="card.delta != null" class="kpi__delta" :class="card.delta >= 0 ? 'up' : 'down'">
        <span class="kpi__arrow">{{ card.delta >= 0 ? '▲' : '▼' }}</span>{{ Math.abs(card.delta * 100).toFixed(1) }}%
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
const { dataKey, cityName, loadingTick, compareKey, selectedDate } = storeToRefs(filter)
const data = ref<Record<string, number> | null>(null)
const compare = ref<Record<string, number> | null>(null)
let timer = 0

async function load() {
  const ov = await fetchOverview(dataKey.value, cityName.value)
  data.value = ov as Record<string, number> | null
  if (compareKey.value) {
    compare.value = (await fetchOverview(compareKey.value, cityName.value)) as Record<string, number> | null
  } else compare.value = null
  filter.updatedAt = String((data.value as { updated_at?: string } | null)?.updated_at || selectedDate.value)
}

function delta(key: string) {
  if (!data.value || !compare.value || !compare.value[key]) return null
  return (data.value[key] - compare.value[key]) / Math.abs(compare.value[key] || 1)
}

const cards = computed(() => {
  const d = data.value
  if (!d) {
    return Array.from({ length: 7 }, (_, i) => ({
      key: String(i),
      label: '加载中',
      main: '--',
      tone: '' as const,
      delta: null as number | null,
    }))
  }
  return [
    {
      key: 'gmv',
      label: '总营业额',
      main: formatMoney(d.total_gmv),
      tone: '' as const,
      delta: delta('total_gmv'),
    },
    {
      key: 'arpu',
      label: '客单价',
      main: formatMoney(d.arpu),
      tone: '' as const,
      delta: delta('arpu'),
    },
    {
      key: 'orders',
      label: '有效订单量',
      main: formatInt(d.effective_orders),
      tone: '' as const,
      delta: delta('effective_orders'),
    },
    {
      key: 'profit',
      label: '预计毛利',
      main: formatMoney(d.est_profit),
      tone: (d.est_profit < 0 ? 'danger' : '') as 'danger' | '',
      delta: delta('est_profit'),
    },
    {
      key: 'profit_rate',
      label: '毛利率',
      main: formatPercent(d.profit_rate),
      tone: '' as const,
      delta: delta('profit_rate'),
    },
    {
      key: 'income',
      label: '预计线上收入',
      main: formatMoney(d.online_income),
      tone: '' as const,
      delta: delta('online_income'),
    },
    {
      key: 'refund',
      label: '退款率',
      main: formatPercent(d.refund_rate),
      tone: (d.refund_rate > 0.05 ? 'danger' : '') as 'danger' | '',
      delta: delta('refund_rate'),
    },
  ]
})

watch([dataKey, cityName, loadingTick], load, { immediate: true })
onMounted(() => {
  timer = window.setInterval(load, 30000)
})
onUnmounted(() => clearInterval(timer))
</script>

<style scoped lang="scss">
.kpi {
  height: 148px;
  flex-shrink: 0;
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 14px;
}
.kpi__card {
  --glow: #5ec8ff;
  position: relative;
  min-width: 0;
  padding: 14px 18px;
  border-radius: 2px;
  background:
    linear-gradient(155deg, rgba(22, 66, 130, 0.32), rgba(6, 20, 48, 0.4)),
    rgba(6, 22, 54, 0.2);
  border: 1px solid rgba(94, 200, 255, 0.2);
  box-shadow:
    inset 0 0 18px rgba(40, 140, 255, 0.1),
    0 0 14px rgba(40, 140, 255, 0.14);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 8px;
  overflow: hidden;

  &::before,
  &::after {
    content: '';
    position: absolute;
    width: 12px;
    height: 12px;
    pointer-events: none;
    filter: drop-shadow(0 0 3px rgba(94, 200, 255, 0.85));
    background:
      linear-gradient(var(--glow), var(--glow)) left top / 12px 2px no-repeat,
      linear-gradient(var(--glow), var(--glow)) left top / 2px 12px no-repeat;
  }
  &::before {
    left: 0;
    top: 0;
  }
  &::after {
    right: 0;
    bottom: 0;
    background:
      linear-gradient(var(--glow), var(--glow)) right bottom / 12px 2px no-repeat,
      linear-gradient(var(--glow), var(--glow)) right bottom / 2px 12px no-repeat;
  }
}
.kpi__label {
  font-size: var(--fs-sub);
  font-weight: var(--fw-sub);
  color: #9eb6d4;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.kpi__delta {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: var(--fs-sub);
  font-weight: var(--fw-sub);
  font-family: var(--font-num);
  font-variant-numeric: tabular-nums;
  flex-shrink: 0;
  &.up {
    color: #00ffe4;
  }
  &.down {
    color: #ff4d4f;
  }
}
.kpi__arrow {
  font-size: 20px;
  line-height: 1;
}
.kpi__num {
  font-size: var(--fs-kpi);
  font-weight: var(--fw-kpi);
  line-height: 1.1;
  font-family: var(--font-num);
  font-variant-numeric: tabular-nums;
  color: #f2f7ff;
  text-shadow: 0 0 12px rgba(94, 200, 255, 0.25);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
