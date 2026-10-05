<!-- 商务科技驾驶舱：单层切角标题线 -->
<template>
  <header class="header" data-role="nav" data-height-px="64" data-single-line="true">
    <div class="header__left"><slot name="filters" /></div>
    <div class="header__center">
      <h1>电商即时零售经营数据驾驶舱</h1>
    </div>
    <div class="header__right">
      <slot name="nav" />
      <div class="header__meta">
        <time :datetime="clock.iso">{{ clock.full }}</time>
        <span><i aria-hidden="true" />截止 {{ dataDay }}</span>
      </div>
    </div>
    <svg class="header__line" viewBox="0 0 1920 64" preserveAspectRatio="none" aria-hidden="true">
      <path d="M0 58 H640 L666 64 H1254 L1280 58 H1920 M630 0 L665 52 H1255 L1290 0" />
    </svg>
  </header>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { pad2 } from '../../utils/format'
import { SOURCE1_DAYS } from '../../api/source1'

function buildClock() {
  const date = new Date()
  const y = date.getFullYear()
  const m = pad2(date.getMonth() + 1)
  const d = pad2(date.getDate())
  const time = `${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`
  const weeks = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
  return { full: `${y}/${m}/${d} ${weeks[date.getDay()]} ${time}`, iso: `${y}-${m}-${d}T${time}` }
}
const clock = ref(buildClock())
const latestDay = SOURCE1_DAYS.at(-1) || ''
const dataDay = latestDay ? latestDay.slice(5).replace('-', '/') : '--'
let timer = 0
onMounted(() => { timer = window.setInterval(() => { clock.value = buildClock() }, 1000) })
onUnmounted(() => window.clearInterval(timer))
</script>

<style scoped lang="scss">
.header {
  position: relative;
  height: 64px;
  flex-shrink: 0;
  display: grid;
  grid-template-columns: 610px minmax(0, 1fr) 610px;
  align-items: start;
  gap: 12px;
  z-index: 50;
}
.header__left { display: flex; align-items: center; min-width: 0; height: 48px; }
.header__center {
  text-align: center;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 48px;
  padding-top: 0;
}
h1 { margin: 0; color: var(--c-primary); font-size: 32px; line-height: 1.25; font-weight: 750; letter-spacing: 2px; white-space: nowrap; text-shadow: 0 0 8px rgba(80, 160, 255, 0.75), 0 0 18px #006de0, 0 0 28px rgba(0, 100, 255, 0.4); }
.header__right { display: flex; flex-direction: column; align-items: flex-end; gap: 7px; }
.header__meta { display: flex; align-items: center; gap: 14px; color: var(--muted); font-size: 13px; white-space: nowrap; }
time { font-family: var(--font-num); font-variant-numeric: tabular-nums; }
.header__meta span { display: inline-flex; align-items: center; gap: 6px; color: var(--success); }
.header__meta i { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
.header__line { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; overflow: visible; }
.header__line path { fill: none; stroke: var(--accent-line); stroke-width: 1.15; vector-effect: non-scaling-stroke; filter: drop-shadow(0 0 3px var(--accent-line)) drop-shadow(0 0 8px rgba(60, 140, 255, 0.5)); }
.header__left :deep(.ctrl-date) { width: 112px; }
.header__left :deep(.ctrl-select--city) { width: 80px; }
.header__left :deep(.ctrl-select--channel) { width: 112px; }
.header__left :deep(.ctrl-select--store) { width: 124px; }
.header__left :deep(.seg) { height: 36px; }
.header__left :deep(.seg button.active) { background: var(--accent-line); color: var(--gap); }
</style>
