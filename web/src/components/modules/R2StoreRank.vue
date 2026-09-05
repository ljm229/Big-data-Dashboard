<template>
  <Panel :title="title" :updated-at="time" :loading="loading && !rows.length">
    <div
      class="viewport"
      @mouseenter="onPause"
      @mouseleave="onResume"
    >
      <ul class="list" :style="{ transform: `translate3d(0, ${-offsetY}px, 0)` }">
        <li
          v-for="(row, i) in loopRows"
          :key="`${i}-${row.name}-${row.city}`"
          class="row"
          :class="{
            'is-leaving': i === offsetIndex && scrolling,
            'is-focus': i === offsetIndex && !scrolling,
          }"
          @click="onSelect(row)"
        >
          <em :class="{ top: rankOf(i) <= 3 }">{{ rankOf(i) }}</em>
          <div class="meta">
            <span class="name" :title="row.fullName || row.name">{{ row.name }}</span>
            <span class="city">{{ row.city }}</span>
          </div>
          <div class="bar">
            <i
              :style="{
                width: widthOf(row.paid_amount),
                background: row.profit_rate < 0 ? '#ff4d4f' : undefined,
              }"
            />
          </div>
          <b>{{ formatMoney(row.paid_amount) }}</b>
          <small :class="{ danger: row.profit_rate < 0 }">{{ formatPercent(row.profit_rate) }}</small>
        </li>
      </ul>
    </div>
  </Panel>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import Panel from '../Panel.vue'
import { useFilterStore } from '../../stores/filter'
import { fetchStoreRank, fetchStoreProfile } from '../../api/dashboard'
import { formatMoney, formatPercent } from '../../utils/format'

type RankRow = {
  name: string
  fullName?: string
  city: string
  paid_amount: number
  profit_rate: number
  paid_orders: number
  avg_item_price: number
  active_sku_cnt: number
  refund_amount: number
  self_delivery_cost: number
}

const ROW_H = 38
const HOLD_MS = 2000
const ANIM_MS = 680
const MAX_ROWS = 30

const filter = useFilterStore()
const { dataKey, loadingTick, updatedAt, cityName, channel } = storeToRefs(filter)
const loading = ref(true)
const rows = ref<RankRow[]>([])
const offsetIndex = ref(0)
const offsetY = ref(0)
const scrolling = ref(false)
const paused = ref(false)
const time = computed(() => (updatedAt.value ? updatedAt.value.slice(11, 19) : ''))
const cityFilter = computed(() => (cityName.value === '全国' ? '全国' : cityName.value))
const title = computed(() => (cityFilter.value === '全国' ? '门店效能榜' : `门店榜 · ${cityFilter.value}`))
const max = computed(() => Math.max(...rows.value.map((r) => r.paid_amount), 1))

const baseLen = computed(() => Math.min(rows.value.length, MAX_ROWS))

/** 复制列表做无缝循环 */
const loopRows = computed(() => {
  const list = rows.value.slice(0, MAX_ROWS)
  if (list.length <= 1) return list
  return [...list, ...list]
})

function widthOf(v: number) {
  return `${Math.max(6, (v / max.value) * 100)}%`
}

function rankOf(i: number) {
  const n = baseLen.value || 1
  return (i % n) + 1
}

async function onSelect(row: RankRow) {
  const profile = await fetchStoreProfile(dataKey.value, row.fullName || row.name)
  if (profile) filter.openDrawer('store', profile as unknown as Record<string, unknown>)
  else filter.openDrawer('store', row as unknown as Record<string, unknown>)
}

let refreshTimer = 0
let holdTimer = 0
let rafId = 0

function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

function clearTimers() {
  if (holdTimer) {
    window.clearTimeout(holdTimer)
    holdTimer = 0
  }
  if (rafId) {
    cancelAnimationFrame(rafId)
    rafId = 0
  }
}

function scheduleNext() {
  clearTimers()
  if (baseLen.value <= 1) return
  holdTimer = window.setTimeout(() => {
    void stepOne()
  }, HOLD_MS)
}

/** 逐条：缓动滚过一行高度，再停留 */
function stepOne() {
  const n = baseLen.value
  if (n <= 1 || paused.value) {
    scheduleNext()
    return
  }

  const from = offsetY.value
  const to = (offsetIndex.value + 1) * ROW_H
  const start = performance.now()
  scrolling.value = true

  const tick = (now: number) => {
    if (paused.value) {
      scrolling.value = false
      scheduleNext()
      return
    }
    const t = Math.min(1, (now - start) / ANIM_MS)
    const e = easeInOutCubic(t)
    offsetY.value = from + (to - from) * e

    if (t < 1) {
      rafId = requestAnimationFrame(tick)
      return
    }

    offsetIndex.value += 1
    offsetY.value = offsetIndex.value * ROW_H
    scrolling.value = false

    // 滚完一轮：无动画复位到开头副本位置
    if (offsetIndex.value >= n) {
      offsetIndex.value = 0
      offsetY.value = 0
    }
    scheduleNext()
  }

  rafId = requestAnimationFrame(tick)
}

function onPause() {
  paused.value = true
  clearTimers()
  scrolling.value = false
}

function onResume() {
  paused.value = false
  scheduleNext()
}

async function load(showLoading = false) {
  if (showLoading) loading.value = true
  try {
    rows.value = (await fetchStoreRank(dataKey.value, cityFilter.value, channel.value)) as RankRow[]
    clearTimers()
    offsetIndex.value = 0
    offsetY.value = 0
    scrolling.value = false
    await nextTick()
    scheduleNext()
  } finally {
    loading.value = false
  }
}

watch([dataKey, loadingTick, cityFilter, channel], () => load(true), { immediate: true })

onMounted(() => {
  refreshTimer = window.setInterval(() => load(false), 60000)
})
onUnmounted(() => {
  window.clearInterval(refreshTimer)
  clearTimers()
})
</script>

<style scoped lang="scss">
.viewport {
  height: 100%;
  min-height: 0;
  overflow: hidden;
  /* 上下羽化，更像逐条滑过 */
  mask-image: linear-gradient(
    180deg,
    transparent 0%,
    #000 8%,
    #000 88%,
    transparent 100%
  );
}
.list {
  margin: 0;
  padding: 0;
  list-style: none;
  will-change: transform;
}
.row {
  display: grid;
  grid-template-columns: 32px 96px 1fr 82px 56px;
  gap: 8px;
  align-items: center;
  height: 38px;
  box-sizing: border-box;
  cursor: pointer;
  font-size: var(--fs-data);
  transition:
    opacity 0.35s ease,
    background-color 0.25s ease;
  &:hover {
    background: rgba(0, 140, 255, 0.12);
  }
  &.is-focus {
    background: rgba(0, 140, 255, 0.08);
  }
  /* 当前滚出的那一条：淡出上移感 */
  &.is-leaving {
    opacity: 0.35;
  }
  em {
    font-style: normal;
    text-align: center;
    color: #8aa0bf;
    font-family: var(--font-num);
    &.top {
      color: #ffc53d;
      font-weight: 700;
    }
  }
  .name {
    display: block;
    color: var(--c-normal);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .city {
    color: var(--c-muted);
    font-size: var(--fs-axis);
  }
  .bar {
    height: 12px;
    background: rgba(255, 255, 255, 0.06);
    border-radius: 4px;
    overflow: hidden;
    i {
      display: block;
      height: 100%;
      background: linear-gradient(90deg, #1c28c8, #0fb6fc);
      border-radius: 4px;
      transition: width 0.8s;
    }
  }
  b {
    color: var(--c-num-accent);
    font-size: var(--fs-sub);
    font-family: var(--font-num);
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    text-align: right;
    letter-spacing: 0.02em;
  }
  small {
    color: #3bfe91;
    font-size: var(--fs-data);
    font-family: var(--font-num);
    font-variant-numeric: tabular-nums;
    text-align: right;
    &.danger {
      color: #ff4d4f;
    }
  }
}
</style>
