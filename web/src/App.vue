<template>
  <div v-if="activeView === 'cockpit'" class="screen-root">
    <div class="screen-spacer" :style="wrapperStyle">
      <div class="screen" :style="style">
        <div class="screen__bg" aria-hidden="true" />
        <div class="screen__grid" aria-hidden="true" />
        <div class="screen__rotors" aria-hidden="true">
          <i class="rotor rotor--a" />
          <i class="rotor rotor--b" />
          <i class="rotor rotor--c" />
          <i class="rotor rotor--d" />
          <i class="rotor rotor--e" />
        </div>
        <div class="screen__frame" aria-hidden="true">
          <i class="frame-corner tl" />
          <i class="frame-corner tr" />
          <i class="frame-corner bl" />
          <i class="frame-corner br" />
        </div>

        <section class="top-stage">
          <AppHeader>
            <template #filters>
              <DateFilterBar variant="dark" scope="cockpit" />
            </template>
            <template #nav>
              <div class="view-switch view-switch--in-header">
                <button type="button" class="active">数据大屏</button>
                <button type="button" @click="activeView = 'ops'">门店运营看板</button>
              </div>
            </template>
          </AppHeader>
          <KpiBand />
        </section>

        <main class="body">
          <div class="body-main">
            <section class="col left">
              <StoreLaunchPanorama />
              <ChannelMix />
              <L3Cost class="col-tail" />
            </section>

            <section class="col middle">
              <C1Map class="c1" />
            </section>

            <section class="col right">
              <R2StoreRank />
              <CityContribution />
              <DayTrend class="col-tail" />
            </section>
          </div>
        </main>

        <DetailDrawer />
      </div>
    </div>
  </div>

  <StoreOpsDashboard v-else @switch-view="activeView = 'cockpit'" />
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useScreenScale } from './composables/useScale'
import { useFilterStore, COCKPIT_DATES } from './stores/filter'
import { hasAssessment } from './api/dashboard'
import AppHeader from './components/modules/AppHeader.vue'
import KpiBand from './components/modules/KpiBand.vue'
import StoreLaunchPanorama from './components/modules/StoreLaunchPanorama.vue'
import ChannelMix from './components/modules/ChannelMix.vue'
import L3Cost from './components/modules/L3Cost.vue'
import C1Map from './components/modules/C1Map.vue'
import DayTrend from './components/modules/DayTrend.vue'
import CityContribution from './components/modules/CityContribution.vue'
import R2StoreRank from './components/modules/R2StoreRank.vue'
import DetailDrawer from './components/DetailDrawer.vue'
import StoreOpsDashboard from './components/StoreOpsDashboard.vue'
import DateFilterBar from './components/DateFilterBar.vue'

const activeView = ref<'cockpit' | 'ops'>('cockpit')
const filter = useFilterStore()
const { style, wrapperStyle } = useScreenScale(1920, 1280)

watch(activeView, (view) => {
  const iso = filter.selectedDate
  if (view === 'cockpit' && !COCKPIT_DATES.includes(iso)) {
    filter.setDate(COCKPIT_DATES[COCKPIT_DATES.length - 1] || iso)
  }
  if (view === 'ops' && !hasAssessment(iso) && !COCKPIT_DATES.includes(iso)) {
    const fallback = COCKPIT_DATES[COCKPIT_DATES.length - 1]
    if (fallback) filter.setDate(fallback)
  }
})
</script>

<style scoped lang="scss">
.view-switch {
  display: flex;
  gap: 8px;
  button {
    border: 1px solid rgba(94, 200, 255, 0.35);
    border-radius: 6px;
    padding: 6px 12px;
    color: #cfe0f6;
    background: rgba(255, 255, 255, 0.06);
    cursor: pointer;
    font-size: 12px;
    white-space: nowrap;
    &.active {
      color: #04122a;
      background: linear-gradient(135deg, #9adfff, #3aa0ff);
      border-color: transparent;
      font-weight: 800;
    }
  }
}
.view-switch--in-header {
  flex-shrink: 0;
}

.screen-root {
  width: 100%;
  min-height: 100vh;
  overflow: visible;
  background:
    radial-gradient(ellipse 80% 55% at 50% 28%, rgba(28, 78, 160, 0.38), transparent 62%),
    radial-gradient(ellipse 50% 40% at 50% 100%, rgba(12, 40, 90, 0.35), transparent 55%),
    linear-gradient(180deg, #061a42 0%, #04122f 42%, #020a1c 100%);
}
.screen-spacer {
  position: relative;
}
.screen {
  position: absolute;
  left: 0;
  top: 0;
  box-sizing: border-box;
  padding: 10px 20px 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  color: #e8f3ff;
  overflow: hidden;
  background: transparent;
}

.screen__bg {
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  background:
    radial-gradient(ellipse 70% 50% at 50% 35%, rgba(36, 90, 170, 0.22), transparent 65%),
    linear-gradient(180deg, #071c48 0%, #041330 50%, #020914 100%);
}

.screen__grid {
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  opacity: 0.55;
  background-image:
    linear-gradient(rgba(70, 160, 230, 0.04) 1px, transparent 1px),
    linear-gradient(90deg, rgba(70, 160, 230, 0.04) 1px, transparent 1px);
  background-size: 56px 56px;
  -webkit-mask-image: radial-gradient(circle at center, rgba(0, 0, 0, 0.85), transparent 76%);
  mask-image: radial-gradient(circle at center, rgba(0, 0, 0, 0.85), transparent 76%);
}

.screen__rotors {
  position: absolute;
  inset: 0;
  z-index: 0;
  overflow: hidden;
  pointer-events: none;
}

.rotor {
  position: absolute;
  border-radius: 50%;
  pointer-events: none;
  mix-blend-mode: screen;
  will-change: rotate;
  opacity: 0.45;
  --ring-color: rgba(70, 170, 255, 0.22);
  --glow-color: rgba(30, 110, 220, 0.16);
  --inner-color: rgba(0, 220, 240, 0.12);
  --sweep-color: rgba(80, 190, 255, 0.35);
  border: 2px solid var(--ring-color);
  box-shadow:
    inset 0 0 34px var(--glow-color),
    0 0 44px var(--glow-color);
}

.rotor::before {
  content: '';
  position: absolute;
  inset: 12%;
  border-radius: 50%;
  border: 1px solid var(--inner-color);
  box-shadow:
    inset 0 0 22px var(--inner-color),
    0 0 24px var(--inner-color);
}

.rotor::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background: conic-gradient(
    from 0deg,
    transparent 0deg 250deg,
    var(--sweep-color) 300deg 336deg,
    transparent 360deg
  );
  -webkit-mask: radial-gradient(circle, transparent 0 74%, #000 75% 82%, transparent 83%);
  mask: radial-gradient(circle, transparent 0 74%, #000 75% 82%, transparent 83%);
  opacity: 0.9;
}

.rotor--a {
  left: 10%;
  top: 18%;
  width: 920px;
  height: 920px;
  transform: translate(-50%, -50%);
  rotate: 0deg;
  animation: rotor-spin 38s linear infinite;
}

.rotor--b {
  left: 84%;
  top: 76%;
  width: 780px;
  height: 780px;
  transform: translate(-50%, -50%);
  rotate: 0deg;
  --ring-color: rgba(0, 255, 228, 0.26);
  --glow-color: rgba(0, 255, 228, 0.16);
  --inner-color: rgba(94, 200, 255, 0.18);
  --sweep-color: rgba(0, 255, 228, 0.46);
  animation: rotor-spin 28s linear infinite reverse;
}

.rotor--c {
  left: 58%;
  top: 10%;
  width: 700px;
  height: 700px;
  transform: translate(-50%, -50%);
  rotate: 0deg;
  --ring-color: rgba(116, 142, 255, 0.3);
  --glow-color: rgba(96, 108, 255, 0.22);
  --sweep-color: rgba(116, 142, 255, 0.48);
  animation: rotor-spin 34s linear infinite;
}

.rotor--d {
  left: 88%;
  top: 8%;
  width: 640px;
  height: 640px;
  transform: translate(-50%, -50%);
  rotate: 0deg;
  --ring-color: rgba(94, 200, 255, 0.24);
  --glow-color: rgba(40, 140, 255, 0.18);
  --sweep-color: rgba(94, 200, 255, 0.4);
  animation: rotor-spin 44s linear infinite reverse;
}

.rotor--e {
  left: 8%;
  top: 84%;
  width: 660px;
  height: 660px;
  transform: translate(-50%, -50%);
  rotate: 0deg;
  --ring-color: rgba(0, 255, 228, 0.22);
  --glow-color: rgba(0, 255, 228, 0.14);
  --sweep-color: rgba(0, 255, 228, 0.4);
  animation: rotor-spin 32s linear infinite;
}

@keyframes rotor-spin {
  to {
    rotate: 360deg;
  }
}

.screen__frame {
  position: absolute;
  inset: 8px;
  z-index: 0;
  pointer-events: none;
  border: 1px solid rgba(94, 200, 255, 0.16);
  box-shadow:
    inset 0 0 40px rgba(40, 120, 220, 0.08),
    0 0 24px rgba(40, 140, 255, 0.12);
}

.frame-corner {
  position: absolute;
  width: 28px;
  height: 28px;
  filter: drop-shadow(0 0 6px rgba(94, 200, 255, 0.9));
  &::before,
  &::after {
    content: '';
    position: absolute;
    background: #7ed0ff;
  }
  &::before {
    width: 28px;
    height: 2px;
  }
  &::after {
    width: 2px;
    height: 28px;
  }
  &.tl {
    left: -1px;
    top: -1px;
    &::before {
      left: 0;
      top: 0;
    }
    &::after {
      left: 0;
      top: 0;
    }
  }
  &.tr {
    right: -1px;
    top: -1px;
    &::before {
      right: 0;
      top: 0;
    }
    &::after {
      right: 0;
      top: 0;
    }
  }
  &.bl {
    left: -1px;
    bottom: -1px;
    &::before {
      left: 0;
      bottom: 0;
    }
    &::after {
      left: 0;
      bottom: 0;
    }
  }
  &.br {
    right: -1px;
    bottom: -1px;
    &::before {
      right: 0;
      bottom: 0;
    }
    &::after {
      right: 0;
      bottom: 0;
    }
  }
}

.screen > :not(.screen__bg):not(.screen__grid):not(.screen__rotors):not(.screen__frame) {
  position: relative;
  z-index: 1;
}
.top-stage {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
  background: transparent;
}
.body {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 0;
}
.body-main {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(380px, 26%) 1fr minmax(380px, 26%);
  gap: 10px;
  padding-bottom: 0;
}
.col {
  min-height: 0;
  min-width: 0;
  display: grid;
  gap: 8px;
  align-content: stretch;
}
.left,
.right {
  grid-template-rows: minmax(0, 1fr) minmax(0, 1fr) minmax(140px, 1.05fr);
  overflow-y: auto;
  overflow-x: hidden;
  padding-bottom: 0;
  scrollbar-width: thin;
  scrollbar-color: rgba(0, 180, 255, 0.35) transparent;
}
.middle {
  display: flex;
  align-items: stretch;
  justify-content: center;
  min-height: 0;
  overflow: hidden;
}
.c1 {
  width: 100%;
  height: 100%;
  flex: 1 1 auto;
  min-height: 0;
}
.left > *,
.right > * {
  min-height: 0;
  min-width: 0;
  overflow: hidden;
}
.col-tail {
  overflow: auto;
  scrollbar-width: thin;
  scrollbar-color: rgba(0, 180, 255, 0.35) transparent;
}
.middle > * {
  min-height: 0;
  min-width: 0;
}
</style>
