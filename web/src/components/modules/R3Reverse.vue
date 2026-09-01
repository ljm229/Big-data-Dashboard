<template>
  <Panel title="🔄 逆向健康度" :updated-at="time" :loading="loading && !data">
    <div class="cards">
      <article
        v-for="card in cards"
        :key="card.key"
        class="card"
        :class="{ active: storeSortBy === card.sort }"
        @click="filter.setStoreSortBy(card.sort)"
      >
        <div class="card__label">{{ card.icon }} {{ card.label }}</div>
        <div class="card__value">{{ card.value }}</div>
        <div class="card__trend" :class="card.tone">
          {{ card.arrow }} {{ card.diffText }}
          <span>较{{ compareLabel || '对照日' }}</span>
        </div>
      </article>
    </div>
  </Panel>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import Panel from '../Panel.vue'
import { useFilterStore, type StoreSortBy } from '../../stores/filter'
import { fetchReverse } from '../../api/dashboard'
import { formatMoney, formatInt, formatPercent } from '../../utils/format'

type ReverseData = Awaited<ReturnType<typeof fetchReverse>>

const filter = useFilterStore()
const { dataKey, cityName, loadingTick, updatedAt, compareKey, compareLabel, storeSortBy } = storeToRefs(filter)
const loading = ref(true)
const data = ref<ReverseData | null>(null)
const time = computed(() => (updatedAt.value ? updatedAt.value.slice(11, 19) : ''))
let timer = 0

function toneOf(diff: number, invert = false): 'up' | 'down' | 'flat' {
  if (Math.abs(diff) < 1e-9) return 'flat'
  const bad = invert ? diff < 0 : diff > 0
  return bad ? 'up' : 'down'
}

const cards = computed(() => {
  const d = data.value
  const amountDiffRate = d?.refund_amount_diff_rate || 0
  const rateDiff = d?.refund_rate_diff || 0
  const ordersDiff = d?.refund_orders_diff || 0
  const ratioDiff = d?.inafter_refund_ratio_diff || 0

  const mk = (
    key: string,
    icon: string,
    label: string,
    value: string,
    sort: StoreSortBy,
    diff: number,
    diffText: string,
    invert = false,
  ) => {
    const tone = toneOf(diff, invert)
    return {
      key,
      icon,
      label,
      value,
      sort,
      tone,
      arrow: tone === 'flat' ? '—' : tone === 'up' ? '▲' : '▼',
      diffText,
    }
  }

  return [
    mk(
      'amount',
      '💰',
      '退款金额',
      formatMoney(d?.refund_amount),
      'refund_amount',
      amountDiffRate,
      `${Math.abs(amountDiffRate * 100).toFixed(1)}%`,
    ),
    mk(
      'rate',
      '📉',
      '退款率',
      formatPercent(d?.refund_rate),
      'refund_rate',
      rateDiff,
      `${Math.abs(rateDiff).toFixed(1)}pt`,
    ),
    mk(
      'orders',
      '📦',
      '退款订单',
      `${formatInt(d?.refund_orders)}单`,
      'refund_orders',
      ordersDiff,
      `${Math.abs(Math.round(ordersDiff))}单`,
    ),
    mk(
      'ratio',
      '⚖️',
      '售中/售后比',
      d?.inafter_refund_ratio == null ? '--' : d.inafter_refund_ratio.toFixed(2),
      'inafter_ratio',
      ratioDiff,
      `${Math.abs(ratioDiff).toFixed(2)}pt`,
    ),
  ]
})

async function load(showLoading = false) {
  if (showLoading) loading.value = true
  try {
    data.value = await fetchReverse(dataKey.value, cityName.value, compareKey.value)
  } finally {
    loading.value = false
  }
}

watch([dataKey, cityName, loadingTick, compareKey], () => load(true), { immediate: true })
onMounted(() => {
  timer = window.setInterval(() => load(false), 60000)
})
onUnmounted(() => clearInterval(timer))
</script>

<style scoped lang="scss">
.cards {
  height: 100%;
  display: grid;
  grid-template-rows: repeat(4, 1fr);
  gap: 6px;
  min-height: 0;
}
.card {
  min-height: 0;
  padding: 8px 12px;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid transparent;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 2px;
  cursor: pointer;
  transition: border-color 0.15s ease, background 0.15s ease;
  &:hover {
    background: rgba(255, 255, 255, 0.07);
  }
  &.active {
    border-color: rgba(0, 143, 251, 0.55);
    background: rgba(0, 143, 251, 0.1);
  }
}
.card__label {
  font-size: 11px;
  color: #8899aa;
}
.card__value {
  font-size: 22px;
  font-weight: 700;
  color: #fff;
  font-family: var(--font-num);
  font-variant-numeric: tabular-nums;
  line-height: 1.2;
}
.card__trend {
  font-size: 11px;
  font-family: var(--font-num);
  display: flex;
  align-items: center;
  gap: 4px;
  span {
    color: #8899aa;
  }
  &.up {
    color: #ff4560;
  }
  &.down {
    color: #00e396;
  }
  &.flat {
    color: #8899aa;
  }
}
</style>
