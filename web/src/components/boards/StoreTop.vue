<!-- 门店经营表现：看状态与趋势，不比谁第一 -->
<template>
  <Panel title="门店经营表现" :empty="!viewRows.length" empty-text="当前筛选下暂无门店经营数据">
    <template #extra>
      <div class="tools">
        <SelectMenu
          class="tool-select"
          :model-value="scopeCity"
          :options="cityOptions"
          :searchable="false"
          @update:model-value="(v) => (scopeCity = Array.isArray(v) ? v[0] || '全国' : v)"
        />
        <SelectMenu
          class="tool-select wide"
          :model-value="viewFilter"
          :options="filterOptions"
          :searchable="false"
          @update:model-value="(v) => (viewFilter = String(Array.isArray(v) ? v[0] : v) as ViewFilter)"
        />
        <SelectMenu
          class="tool-select wide"
          :model-value="sortBy"
          :options="sortOptions"
          :searchable="false"
          @update:model-value="(v) => (sortBy = String(Array.isArray(v) ? v[0] : v) as SortKey)"
        />
      </div>
    </template>
    <div class="top">
      <div class="top__head">
        <span>门店</span>
        <span>城市</span>
        <span>订单</span>
        <span>实付</span>
        <span>预计毛利</span>
        <span>含后返毛利</span>
        <span>毛利率</span>
        <span>趋势</span>
        <span>状态</span>
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
            <span class="name" :title="row.key">{{ row.short }}</span>
            <span class="city">{{ cityShort(row.city) }}</span>
            <span class="num">{{ formatInt(row.orders) }}</span>
            <span class="num">{{ formatMoney(row.paid) }}</span>
            <span class="num">{{ formatMoney(row.sourceProfit) }}</span>
            <span class="num profit">{{ formatMoney(row.profit) }}</span>
            <span class="rate">{{ formatPercent(row.profitRate) }}</span>
            <span class="trend" :class="trendClass(row.delta)">{{ trendMark(row.delta) }}</span>
            <span class="tag" :class="row.statusTone">{{ row.status }}</span>
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
import { useStoreTop5 } from '../../composables/useStoreTop5'
import { formatInt, formatMoney, formatPercent } from '../../utils/format'

type ViewFilter = 'all' | 'excellent' | 'drop' | 'loss' | 'weak'
type SortKey = 'improve' | 'risk' | 'scale'

const ROW_H = 42
const scopeCity = ref('全国')
const viewFilter = ref<ViewFilter>('all')
const sortBy = ref<SortKey>('improve')
const { filter, selectedStores, rows } = useStoreTop5(undefined, scopeCity)
const cityOptions = COCKPIT_CITIES.map((city) => ({ value: city, label: city === '全国' ? '全部城市' : city }))
const filterOptions = [
  { value: 'all', label: '全部门店' },
  { value: 'excellent', label: '经营优秀' },
  { value: 'drop', label: '毛利下降' },
  { value: 'loss', label: '负毛利门店' },
  { value: 'weak', label: '双弱门店' },
]
const sortOptions = [
  { value: 'improve', label: '经营改善 · 毛利提升最大' },
  { value: 'risk', label: '风险 · 毛利下降最大' },
  { value: 'scale', label: '规模 · 订单最多' },
]

function toggleStore(name: string) {
  const cur = selectedStores.value
  filter.setStores(cur.includes(name) ? cur.filter((s) => s !== name) : [...cur, name])
}
function cityShort(city: string) {
  return (city || '—').replace(/市$/, '')
}
function trendMark(delta: number | null) {
  if (delta == null || Math.abs(delta) <= 0.005) return '→'
  return delta > 0 ? '↑' : '↓'
}
function trendClass(delta: number | null) {
  if (delta == null || Math.abs(delta) <= 0.005) return 'muted'
  return delta > 0 ? 'up' : 'down'
}

const viewRows = computed(() => {
  const filtered = rows.value.filter((row) => {
    if (viewFilter.value === 'excellent') {
      return row.status === '正常' && (row.delta == null || row.delta >= 0) && (row.profitRate == null || row.profitRate >= 0.18)
    }
    if (viewFilter.value === 'drop') return row.delta != null && row.delta < -0.005
    if (viewFilter.value === 'loss') return row.profit != null && row.profit < 0
    if (viewFilter.value === 'weak') return row.status === '双弱'
    return true
  })
  const list = [...filtered]
  list.sort((a, b) => {
    if (sortBy.value === 'scale') return (b.orders || 0) - (a.orders || 0)
    const av = a.profitDeltaAbs
    const bv = b.profitDeltaAbs
    if (sortBy.value === 'risk') {
      const aDrop = av == null ? 0 : Math.min(0, av)
      const bDrop = bv == null ? 0 : Math.min(0, bv)
      return aDrop - bDrop
    }
    const aGain = av == null ? -Infinity : av
    const bGain = bv == null ? -Infinity : bv
    return bGain - aGain
  })
  return list
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
</script>

<style scoped lang="scss">
.tools { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; justify-content: flex-end; max-width: 100%; }
.tool-select { width: 84px; }
.tool-select.wide { width: 140px; }
.tool-select :deep(.dash-select__trigger) {
  height: 30px;
  background: var(--panel-deep);
  font-size: 12px;
  border-color: var(--border);
}
.top { height: 100%; min-height: 0; display: flex; flex-direction: column; gap: 2px; min-width: 0; overflow: hidden; }
.top__head, .row {
  display: grid;
  /* 金额列加宽，避免实付/预计毛利贴在一起 */
  grid-template-columns: minmax(72px, 1.1fr) 40px 44px minmax(78px, 1.15fr) minmax(78px, 1.15fr) minmax(84px, 1.25fr) 52px 26px 44px;
  gap: 8px;
  align-items: center;
  min-width: 0;
  width: 100%;
}
.top__head {
  flex-shrink: 0;
  height: 26px;
  color: var(--muted);
  font-size: 11px;
  padding: 0 4px;
  > span:nth-child(n+3) { text-align: right; }
}
.top__viewport {
  flex: 1;
  min-height: 0;
  min-width: 0;
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
.name { color: #fff; font-size: 14px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.city { font-size: 13px; color: #d4e4f4; white-space: nowrap; }
.num {
  text-align: right;
  color: #fff;
  font: 600 13px var(--font-num);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.profit { color: var(--success); }
.rate { text-align: right; color: var(--success); font: 600 13px var(--font-num); }
.trend {
  text-align: right;
  font: 800 16px/1 var(--font-num);
}
.up { color: var(--success); }
.down { color: var(--danger); }
.muted { color: var(--muted); }
.tag {
  justify-self: end;
  min-width: 48px;
  height: 22px;
  padding: 0 6px;
  border-radius: 3px;
  display: grid;
  place-items: center;
  font-size: 12px;
  font-weight: 700;
}
.tag.good { color: #16f0a0; background: rgba(22, 240, 160, 0.12); }
.tag.warn { color: #ff9234; background: rgba(255, 146, 52, 0.14); }
.tag.bad { color: #ff5268; background: rgba(255, 82, 104, 0.16); }
</style>
