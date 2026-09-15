<!-- 重点门店经营排行：表头固定；列表自动滚动，悬停暂停可手动滑 -->
<template>
  <Panel title="重点门店经营排行" :empty="!viewRows.length">
    <template #extra>
      <div class="tools">
        <SelectMenu
          class="city-select"
          :model-value="scopeCity"
          :options="cityOptions"
          :searchable="false"
          @update:model-value="(v) => (scopeCity = Array.isArray(v) ? v[0] || '全国' : v)"
        />
        <div class="tabs" role="tablist" aria-label="门店分型">
          <button type="button" role="tab" :aria-selected="tab === 'all'" :class="{ on: tab === 'all' }" @click="tab = 'all'">全部</button>
          <button type="button" role="tab" :aria-selected="tab === 'risk'" :class="{ on: tab === 'risk' }" @click="tab = 'risk'">预警门店</button>
          <button type="button" role="tab" :aria-selected="tab === 'high'" :class="{ on: tab === 'high' }" @click="tab = 'high'">高毛利门店</button>
        </div>
      </div>
    </template>
    <div class="top">
      <div class="top__head">
        <span>#</span>
        <span>门店名称</span>
        <span>城市</span>
        <span>毛利</span>
        <span>毛利率</span>
        <span>有效订单量</span>
        <span>日比</span>
        <span>异常状态</span>
      </div>
      <div
        ref="viewport"
        class="top__viewport"
        :class="{ 'is-loop': needLoop && !userScroll }"
        @mouseenter="paused = true"
        @mouseleave="onLeave"
        @wheel="onWheel"
      >
        <div class="top__track" :style="trackStyle">
          <button
            v-for="(row, idx) in loopRows"
            :key="`${row.key}-${idx}`"
            type="button"
            class="row"
            :class="{ active: selectedStores.includes(row.key) }"
            @click="toggleStore(row.key)"
          >
            <em class="rank" :class="'r' + Math.min(row.rank, 4)">{{ row.rank }}</em>
            <span class="name">{{ row.short }}</span>
            <span class="city">{{ row.city || '—' }}</span>
            <span class="profit">{{ formatMoney(row.profit) }}</span>
            <span class="rate">{{ formatPercent(row.profitRate) }}</span>
            <span class="orders">{{ formatInt(row.orders) }}</span>
            <span class="delta" :class="row.delta == null ? 'muted' : row.delta < 0 ? 'down' : 'up'">{{ deltaText(row.delta) }}</span>
            <span class="tag" :class="row.statusTone">{{ statusText(row.status) }}</span>
          </button>
        </div>
      </div>
    </div>
  </Panel>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import Panel from '../Panel.vue'
import SelectMenu from '../SelectMenu.vue'
import { COCKPIT_CITIES } from '../../stores/filter'
import { deltaText, useStoreTop5 } from '../../composables/useStoreTop5'
import { formatInt, formatMoney, formatPercent } from '../../utils/format'

const ROW_H = 42
const scopeCity = ref('全国')
const tab = ref<'all' | 'risk' | 'high'>('all')
const { filter, selectedStore, selectedStores, rows } = useStoreTop5(undefined, scopeCity)
const cityOptions = COCKPIT_CITIES.map((city) => ({ value: city, label: city === '全国' ? '全部城市' : city }))
function toggleStore(name: string) {
  const cur = selectedStores.value
  filter.setStores(cur.includes(name) ? cur.filter((s) => s !== name) : [...cur, name])
}
const viewRows = computed(() => {
  const filtered = rows.value.filter((row) => {
    if (tab.value === 'risk') return row.statusTone !== 'good'
    if (tab.value === 'high') return row.profitRate != null && row.profitRate >= 0.2
    return true
  })
  return filtered.map((row, i) => ({ ...row, rank: i + 1 }))
})

const viewport = ref<HTMLElement | null>(null)
const offset = ref(0)
const paused = ref(false)
const needLoop = ref(false)
const userScroll = ref(false)
const reduceMotion = ref(false)
let raf = 0
let lastTs = 0
let resumeTimer = 0

const loopRows = computed(() => (needLoop.value && !userScroll.value ? [...viewRows.value, ...viewRows.value] : viewRows.value))
const trackStyle = computed(() =>
  userScroll.value ? undefined : { transform: `translate3d(0, ${-offset.value}px, 0)` },
)

function measure() {
  const vp = viewport.value
  if (!vp || !viewRows.value.length) {
    needLoop.value = false
    offset.value = 0
    return
  }
  const contentH = viewRows.value.length * ROW_H
  needLoop.value = !reduceMotion.value && contentH > vp.clientHeight + 4
  if (!needLoop.value) offset.value = 0
}

function tick(ts: number) {
  raf = requestAnimationFrame(tick)
  if (!needLoop.value || paused.value || userScroll.value || document.hidden || reduceMotion.value) {
    lastTs = ts
    return
  }
  const dt = Math.min(48, ts - (lastTs || ts))
  lastTs = ts
  const cycle = viewRows.value.length * ROW_H
  if (cycle <= 0) return
  offset.value += (dt / 1000) * 26
  if (offset.value >= cycle) offset.value -= cycle
}

function onWheel() {
  userScroll.value = true
  paused.value = true
  offset.value = 0
  window.clearTimeout(resumeTimer)
  resumeTimer = window.setTimeout(() => {
    /* 离开列表后再恢复自动滚动，见 onLeave */
  }, 0)
}

function onLeave() {
  paused.value = false
  window.clearTimeout(resumeTimer)
  resumeTimer = window.setTimeout(() => {
    if (!viewport.value?.matches(':hover')) {
      userScroll.value = false
      if (viewport.value) viewport.value.scrollTop = 0
      offset.value = 0
      measure()
    }
  }, 1200)
}

watch(viewRows, async () => {
  offset.value = 0
  userScroll.value = false
  await nextTick()
  measure()
})

onMounted(async () => {
  reduceMotion.value = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  await nextTick()
  measure()
  raf = requestAnimationFrame(tick)
  window.addEventListener('resize', measure)
})
onUnmounted(() => {
  cancelAnimationFrame(raf)
  window.clearTimeout(resumeTimer)
  window.removeEventListener('resize', measure)
})

function statusText(status: string) {
  if (status === '退款偏高') return '退款高'
  return status
}
</script>

<style scoped lang="scss">
.tools { display: flex; align-items: center; gap: 8px; }
.city-select { width: 108px; }
.city-select :deep(.dash-select__trigger) {
  height: 30px;
  background: var(--panel-deep);
  font-size: 14px;
  border-color: var(--border);
}
.tabs { display: flex; gap: 0; border: 1px solid var(--border); }
.tabs button {
  height: 30px;
  padding: 0 11px;
  border: 0;
  background: transparent;
  color: var(--c-body);
  font-size: 14px;
  cursor: pointer;
  &.on { background: var(--primary-2); color: #032043; font-weight: 700; }
  & + button { border-left: 1px solid var(--border); }
}
.top { height: 100%; min-height: 0; display: flex; flex-direction: column; gap: 2px; }
.top__head, .row {
  display: grid;
  grid-template-columns: 28px minmax(92px, 1.4fr) 56px 88px 68px 86px 72px 72px;
  gap: 6px;
  align-items: center;
}
.top__head {
  flex-shrink: 0;
  height: 26px;
  color: var(--muted);
  font-size: 14px;
  padding: 0 4px;
  > span:nth-child(n+4) { text-align: right; }
}
.top__viewport {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  mask-image: linear-gradient(180deg, transparent 0, #000 8px, #000 calc(100% - 8px), transparent 100%);
  &:not(.is-loop) {
    overflow-y: auto;
    mask-image: none;
    scrollbar-width: thin;
    scrollbar-color: color-mix(in srgb, var(--accent-line) 45%, transparent) transparent;
  }
}
.top__track { will-change: transform; }
.row {
  height: 42px;
  box-sizing: border-box;
  padding: 0 4px;
  border: 0;
  border-bottom: 1px solid var(--divider);
  background: transparent;
  color: var(--c-body);
  text-align: left;
  cursor: pointer;
  width: 100%;
}
.row:hover, .row.active { background: var(--panel-hover); }
.rank {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  font: 700 14px var(--font-num);
  font-style: normal;
}
.rank.r1 { background: #f0c14b; color: #1a1204; }
.rank.r2 { background: #9aadc2; color: #0d1a28; }
.rank.r3 { background: #d08a4a; color: #1a1008; }
.rank.r4 { background: #163a62; color: #d8e8ff; }
.name { color: #fff; font-size: 16px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.city { font-size: 15px; color: #d4e4f4; }
.profit, .orders { text-align: right; color: #fff; font: 600 16px var(--font-num); font-variant-numeric: tabular-nums; }
.rate { text-align: right; color: var(--success); font: 600 16px var(--font-num); }
.delta { text-align: right; font: 600 15px var(--font-num); }
.up { color: var(--success); } .down { color: var(--danger); } .muted { color: var(--muted); }
.tag {
  justify-self: end;
  min-width: 54px;
  height: 26px;
  padding: 0 8px;
  border-radius: 3px;
  display: grid;
  place-items: center;
  font-size: 14px;
  font-weight: 700;
}
.tag.good { color: #16f0a0; background: rgba(22, 240, 160, 0.12); }
.tag.warn { color: #ff9234; background: rgba(255, 146, 52, 0.14); }
.tag.bad { color: #ff5268; background: rgba(255, 82, 104, 0.16); }
</style>
