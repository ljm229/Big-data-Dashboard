<template>
  <header class="header">
    <div class="header__top">
      <div class="header__left">
        <slot name="filters" />
      </div>

      <div class="header__center">
        <h1 class="header__title">电商经营数据驾驶舱</h1>
        <p class="header__subtitle">E-COMMERCE BUSINESS DATA COCKPIT</p>
      </div>

      <div class="header__right">
        <slot name="nav" />
        <time class="clock" :datetime="clock.iso">{{ clock.full }}</time>
      </div>
    </div>

    <div class="header__deco" aria-hidden="true">
      <i class="header__wing left" />
      <i class="header__wing right" />
      <svg class="header__frame" viewBox="0 0 1920 42" preserveAspectRatio="none">
        <defs>
          <linearGradient id="hdrBase" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="rgba(0, 160, 255, 0)" />
            <stop offset="10%" stop-color="rgba(40, 160, 220, 0.28)" />
            <stop offset="50%" stop-color="rgba(70, 180, 230, 0.38)" />
            <stop offset="90%" stop-color="rgba(40, 160, 220, 0.28)" />
            <stop offset="100%" stop-color="rgba(0, 160, 255, 0)" />
          </linearGradient>
          <filter id="hdrDropGlow" x="-5%" y="-140%" width="110%" height="380%">
            <feGaussianBlur stdDeviation="2.2" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <!-- 底线：压暗常亮 -->
        <path
          class="header__base"
          :d="PATH"
          fill="none"
          stroke="url(#hdrBase)"
          stroke-width="1.4"
          stroke-linejoin="round"
        />
        <path
          class="header__base-soft"
          :d="PATH"
          fill="none"
          stroke="rgba(60, 160, 220, 0.14)"
          stroke-width="3.2"
          stroke-linejoin="round"
        />

        <!-- 水滴光流：头粗尾细、逐渐变细拉长 -->
        <path
          class="header__drop header__drop--t5"
          :d="PATH"
          fill="none"
          stroke="rgba(70, 180, 240, 0.22)"
          stroke-width="0.7"
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-dasharray="380 620"
          pathLength="1000"
        />
        <path
          class="header__drop header__drop--t4"
          :d="PATH"
          fill="none"
          stroke="rgba(90, 200, 250, 0.32)"
          stroke-width="1"
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-dasharray="280 720"
          pathLength="1000"
        />
        <path
          class="header__drop header__drop--t3"
          :d="PATH"
          fill="none"
          stroke="rgba(120, 215, 255, 0.48)"
          stroke-width="1.35"
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-dasharray="170 830"
          pathLength="1000"
        />
        <path
          class="header__drop header__drop--t2"
          :d="PATH"
          fill="none"
          stroke="rgba(160, 230, 255, 0.62)"
          stroke-width="1.8"
          stroke-linecap="round"
          stroke-linejoin="round"
          filter="url(#hdrDropGlow)"
          stroke-dasharray="90 910"
          pathLength="1000"
        />
        <path
          class="header__drop header__drop--t1"
          :d="PATH"
          fill="none"
          stroke="rgba(200, 240, 255, 0.78)"
          stroke-width="2.25"
          stroke-linecap="round"
          stroke-linejoin="round"
          filter="url(#hdrDropGlow)"
          stroke-dasharray="42 958"
          pathLength="1000"
        />
        <path
          class="header__drop header__drop--head"
          :d="PATH"
          fill="none"
          stroke="rgba(235, 250, 255, 0.92)"
          stroke-width="2.7"
          stroke-linecap="round"
          stroke-linejoin="round"
          filter="url(#hdrDropGlow)"
          stroke-dasharray="16 984"
          pathLength="1000"
        />

        <g class="header__nodes" fill="rgba(150, 210, 240, 0.5)">
          <circle cx="620" cy="10" r="1.8" />
          <circle cx="700" cy="34" r="2.1" />
          <circle cx="1220" cy="34" r="2.1" />
          <circle cx="1300" cy="10" r="1.8" />
        </g>
      </svg>
    </div>
  </header>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { pad2 } from '../../utils/format'

/** 两侧高、中间下凹 */
const PATH = 'M40 10 H620 L700 34 H1220 L1300 10 H1880'

function buildClock() {
  const d = new Date()
  const y = d.getFullYear()
  const m = pad2(d.getMonth() + 1)
  const day = pad2(d.getDate())
  const h = pad2(d.getHours())
  const min = pad2(d.getMinutes())
  const s = pad2(d.getSeconds())
  return {
    full: `${y}年${m}月${day}日 ${h}时${min}分${s}秒`,
    iso: `${y}-${m}-${day}T${h}:${min}:${s}`,
  }
}

const clock = ref(buildClock())
let timer = 0

onMounted(() => {
  timer = window.setInterval(() => {
    clock.value = buildClock()
  }, 1000)
})
onUnmounted(() => clearInterval(timer))
</script>

<style scoped lang="scss">
.header {
  position: relative;
  flex-shrink: 0;
  z-index: 2;
  background: transparent;
  padding-bottom: 4px;
}

.header__top {
  display: grid;
  grid-template-columns: minmax(360px, 1.1fr) auto minmax(220px, 1fr);
  align-items: center;
  gap: 12px;
  min-height: 56px;
  padding: 4px 20px 0;
}

.header__left {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.header__right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  justify-content: center;
  gap: 4px;
  min-width: 0;
}

.clock {
  font-size: var(--fs-axis);
  font-family: var(--font-num);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.5px;
  color: rgba(180, 205, 230, 0.78);
  white-space: nowrap;
  line-height: 1.2;
}

.header__center {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  position: relative;
  z-index: 1;
}

.header__title {
  margin: 0;
  font-family: var(--font-cn);
  font-size: 36px;
  font-weight: 800;
  letter-spacing: 8px;
  line-height: 1.1;
  white-space: nowrap;
  color: #f5fbff;
  text-shadow:
    0 0 16px rgba(64, 180, 255, 0.55),
    0 2px 8px rgba(0, 40, 80, 0.45);
}

.header__subtitle {
  margin: 0;
  font-size: var(--fs-tiny);
  font-weight: 500;
  letter-spacing: 4px;
  color: rgba(150, 200, 240, 0.7);
  white-space: nowrap;
}

.header__deco {
  position: relative;
  height: 42px;
  margin-top: -6px;
}

.header__wing {
  position: absolute;
  top: 2px;
  width: min(280px, 22%);
  height: 14px;
  pointer-events: none;
  opacity: 0.55;
  background: linear-gradient(180deg, rgba(50, 140, 210, 0.28), rgba(20, 80, 160, 0.04));
  border-top: 1px solid rgba(100, 180, 230, 0.4);
  box-shadow: 0 0 8px rgba(40, 140, 220, 0.18);
  &.left {
    left: 4%;
    clip-path: polygon(0 0, 100% 0, 92% 100%, 0 100%);
  }
  &.right {
    right: 4%;
    clip-path: polygon(0 0, 100% 0, 100% 100%, 8% 100%);
  }
}

.header__frame {
  display: block;
  width: 100%;
  height: 42px;
  overflow: visible;
  pointer-events: none;
}

/* 水滴：头粗尾细，6 层渐变拉长，约 1.5s 扫过 */
.header__drop--t5 {
  animation: hdr-d5 1.5s linear infinite;
}
.header__drop--t4 {
  animation: hdr-d4 1.5s linear infinite;
}
.header__drop--t3 {
  animation: hdr-d3 1.5s linear infinite;
}
.header__drop--t2 {
  animation: hdr-d2 1.5s linear infinite;
}
.header__drop--t1 {
  animation: hdr-d1 1.5s linear infinite;
}
.header__drop--head {
  animation: hdr-dh 1.5s linear infinite;
}

.header__nodes {
  opacity: 0.65;
}

/* 尾长 380，各层前端对齐到水滴头部，整体变细 */
@keyframes hdr-d5 {
  from {
    stroke-dashoffset: 1000;
  }
  to {
    stroke-dashoffset: 0;
  }
}
@keyframes hdr-d4 {
  from {
    stroke-dashoffset: 900;
  }
  to {
    stroke-dashoffset: -100;
  }
}
@keyframes hdr-d3 {
  from {
    stroke-dashoffset: 790;
  }
  to {
    stroke-dashoffset: -210;
  }
}
@keyframes hdr-d2 {
  from {
    stroke-dashoffset: 710;
  }
  to {
    stroke-dashoffset: -290;
  }
}
@keyframes hdr-d1 {
  from {
    stroke-dashoffset: 662;
  }
  to {
    stroke-dashoffset: -338;
  }
}
@keyframes hdr-dh {
  from {
    stroke-dashoffset: 636;
  }
  to {
    stroke-dashoffset: -364;
  }
}

@media (prefers-reduced-motion: reduce) {
  .header__drop--t5,
  .header__drop--t4,
  .header__drop--t3,
  .header__drop--t2,
  .header__drop--t1,
  .header__drop--head {
    animation: none;
    opacity: 0.35;
  }
}
</style>
