<template>
  <Panel title="健康度预警" :updated-at="time" :loading="loading && !data">
    <div class="tiles">
      <article class="tile" :class="negTone">
        <div class="tile__top">
          <span class="tile__value tile__value--lg" :class="negTone">{{ formatPercent(data?.neg_rate) }}</span>
          <span class="tile__trend" :class="negTrendTone">
            {{ negRateDiff >= 0 ? '▲' : '▼' }}{{ Math.abs(negRateDiff * 100).toFixed(1) }}%
          </span>
        </div>
        <div class="tile__sub">负毛利订单占比</div>
        <div class="gauge">
          <i class="gauge__track" />
          <i class="gauge__fill" :style="{ width: negGaugeWidth, background: negToneColor }" />
          <i class="gauge__alert" />
          <i class="gauge__dot" :style="{ left: negGaugeWidth }" />
        </div>
      </article>

      <article class="tile" :class="buyerToneValue">
        <div class="tile__top">
          <span class="tile__value tile__value--sm" :class="buyerToneValue">{{ formatInt(data?.buyer_cnt) }}人</span>
          <span class="tile__trend tile__trend--lg" :class="buyerToneValue">{{ buyerGrowth >= 0 ? '▲' : '▼' }}</span>
          <span class="tile__note" :class="buyerToneValue">{{ buyerGrowth >= 0 ? '+' : '' }}{{ formatPercent(buyerGrowth) }}</span>
        </div>
        <div class="tile__aux">人均下单 {{ ordersPerBuyer }}次</div>
        <div class="tile__sub">有效买家数</div>
      </article>

      <article
        class="tile tile--action"
        :class="marketingToneValue"
        @click="onMarketingClick"
      >
        <div class="tile__split">
          <div class="tile__main">
            <span class="tile__value tile__value--sm" :class="marketingToneValue">{{ formatPercent(data?.marketing_rate) }}</span>
            <div class="tile__sub">营销费用占营业额比</div>
          </div>
          <svg class="ring" viewBox="0 0 36 36" aria-hidden="true">
            <path class="ring__bg" d="M18 2 A16 16 0 0 1 34 18" />
            <path
              class="ring__val"
              d="M18 2 A16 16 0 0 1 34 18"
              :style="{ stroke: marketingToneColor, strokeDasharray: `${marketingRingValue} 25.13` }"
            />
          </svg>
        </div>
        <div class="tile__net">真实净利率 ≈ {{ formatPercent(data?.net_rate) }}</div>
        <div class="tile__formula">毛利率{{ formatPercent(data?.gross_rate) }} - 营销费用率{{ formatPercent(data?.marketing_rate) }}</div>
        <div class="tile__action">点击查看费用明细 →</div>
      </article>

      <article
        class="tile tile--action"
        :class="[abnormalToneValue, { 'is-active': abnormalOnly }]"
        @click="toggleAbnormal"
      >
        <div class="tile__top">
          <span class="tile__value tile__value--lg" :class="abnormalToneValue">{{ formatInt(data?.abnormal_store_cnt) }}家</span>
          <span class="tile__note">共{{ formatInt(data?.store_cnt) }}家门店，{{ formatInt(data?.abnormal_store_cnt) }}家异常</span>
        </div>
        <div class="tile__sub">异常门店数</div>
        <div class="tile__action">{{ abnormalOnly ? '已筛选异常门店，点击取消' : '点击筛选异常门店' }}</div>
      </article>
    </div>
  </Panel>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import Panel from '../Panel.vue'
import { useFilterStore } from '../../stores/filter'
import { fetchHealth } from '../../api/dashboard'
import { formatInt, formatPercent } from '../../utils/format'
import { abnormalTone, buyerTone, marketingTone, negRateTone } from '../../utils/health'

type HealthData = Awaited<ReturnType<typeof fetchHealth>>

const filter = useFilterStore()
const { dataKey, cityName, loadingTick, updatedAt, compareKey, abnormalOnly } = storeToRefs(filter)
const loading = ref(true)
const data = ref<HealthData | null>(null)
const time = computed(() => (updatedAt.value ? updatedAt.value.slice(11, 19) : ''))
let timer = 0

const negTone = computed(() => negRateTone(data.value?.neg_rate || 0))
const negToneColor = computed(() => {
  if (negTone.value === 'good') return '#3bfe91'
  if (negTone.value === 'warn') return '#faad14'
  return '#ff4d4f'
})
const negRateDiff = computed(() => data.value?.neg_rate_diff || 0)
const negTrendTone = computed(() => (negRateDiff.value > 0 ? 'bad' : negRateDiff.value < 0 ? 'good' : 'warn'))
const negGaugeWidth = computed(() => `${Math.min(100, (data.value?.neg_rate || 0) * 1000)}%`)

const buyerToneValue = computed(() => buyerTone(data.value?.buyer_growth || 0))
const buyerGrowth = computed(() => data.value?.buyer_growth || 0)
const ordersPerBuyer = computed(() => (data.value?.orders_per_buyer || 0).toFixed(1))

const marketingToneValue = computed(() => marketingTone(data.value?.marketing_rate || 0))
const marketingRingValue = computed(() => Math.min(25.13, (data.value?.marketing_rate || 0) * 25.13).toFixed(2))
const marketingToneColor = computed(() => {
  const tone = marketingToneValue.value
  if (tone === 'good') return '#3bfe91'
  if (tone === 'warn') return '#faad14'
  return '#ff4d4f'
})

const abnormalToneValue = computed(() => abnormalTone(data.value?.abnormal_store_cnt || 0))

function toggleAbnormal() {
  const next = !abnormalOnly.value
  filter.setAbnormalOnly(next)
  if (next) {
    filter.flashProductStores(data.value?.abnormal_store_names || [])
  }
}

function onMarketingClick() {
  filter.flashCostPanel()
}

async function load(showLoading = false) {
  if (showLoading) loading.value = true
  try {
    data.value = await fetchHealth(dataKey.value, compareKey.value, cityName.value)
  } finally {
    loading.value = false
  }
}

watch([dataKey, cityName, loadingTick], () => load(true), { immediate: true })
onMounted(() => {
  timer = window.setInterval(() => load(false), 60000)
})
onUnmounted(() => clearInterval(timer))
</script>

<style scoped lang="scss">
.tiles {
  height: 100%;
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-template-rows: 1fr 1fr;
  gap: 10px;
  min-height: 0;
}
.tile {
  min-width: 0;
  min-height: 0;
  padding: 12px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(7, 24, 56, 0.5);
  display: flex;
  flex-direction: column;
  gap: 6px;
  overflow: hidden;
  &.good {
    border-color: rgba(59, 254, 145, 0.42);
  }
  &.warn {
    border-color: rgba(250, 173, 20, 0.5);
  }
  &.bad {
    border-color: rgba(255, 77, 79, 0.5);
  }
}
.tile--action {
  cursor: pointer;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 6px 18px rgba(0, 0, 0, 0.2);
  }
  &.is-active {
    outline: 1px solid #00ffe4;
  }
}
.tile__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  min-width: 0;
}
.tile__value {
  color: var(--c-primary);
  font-family: var(--font-num);
  font-weight: 700;
  line-height: 1;
  white-space: nowrap;
  &.good {
    color: #3bfe91;
  }
  &.warn {
    color: #faad14;
  }
  &.bad {
    color: #ff4d4f;
  }
}
.tile__value--lg {
  font-size: 48px;
}
.tile__value--sm {
  font-size: 36px;
}
.tile__trend {
  font-family: var(--font-num);
  font-size: var(--fs-axis);
  white-space: nowrap;
  &.good {
    color: #3bfe91;
  }
  &.warn {
    color: #faad14;
  }
  &.bad {
    color: #ff4d4f;
  }
}
.tile__trend--lg {
  font-size: 24px;
}
.tile__note {
  color: var(--c-muted);
  font-size: var(--fs-axis);
  white-space: nowrap;
  &.good {
    color: #3bfe91;
  }
  &.warn {
    color: #faad14;
  }
  &.bad {
    color: #ff4d4f;
  }
}
.tile__aux,
.tile__formula {
  color: var(--c-muted);
  font-size: var(--fs-axis);
  line-height: 1.3;
}
.tile__sub {
  color: var(--c-normal);
  font-size: var(--fs-data);
  font-weight: 500;
  margin-top: auto;
}
.tile__net {
  color: #00ffe4;
  font-family: var(--font-num);
  font-size: var(--fs-data);
}
.tile__action {
  color: #00d4ff;
  font-size: var(--fs-axis);
}
.gauge {
  position: relative;
  height: 10px;
  margin-top: 4px;
}
.gauge__track {
  position: absolute;
  inset: 0;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.08);
  overflow: hidden;
}
.gauge__fill {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  border-radius: 4px;
  background: currentColor;
  opacity: 0.85;
}
.gauge__alert {
  position: absolute;
  left: 50%;
  top: -2px;
  bottom: -2px;
  width: 0;
  border-left: 2px dashed #ff4d4f;
}
.gauge__dot {
  position: absolute;
  top: 50%;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #fff;
  transform: translate(-50%, -50%);
  box-shadow: 0 0 0 2px rgba(0, 0, 0, 0.25);
}
.tile__split {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  min-height: 0;
}
.tile__main {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.ring {
  width: 48px;
  height: 48px;
  flex-shrink: 0;
}
.ring__bg,
.ring__val {
  fill: none;
  stroke-width: 6;
  stroke-linecap: round;
}
.ring__bg {
  stroke: rgba(255, 255, 255, 0.08);
}
.ring__val {
  transition: stroke-dasharray 0.3s ease;
}
</style>
