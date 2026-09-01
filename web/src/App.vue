<template>
  <div class="global-toolbar" :class="{ 'global-toolbar--ops': activeView === 'ops' }">
    <div class="view-switch">
      <button type="button" :class="{ active: activeView === 'cockpit' }" @click="activeView = 'cockpit'">数据大屏</button>
      <button type="button" :class="{ active: activeView === 'ops' }" @click="activeView = 'ops'">门店运营看板</button>
    </div>
    <DateFilterBar :variant="activeView === 'ops' ? 'light' : 'dark'" />
  </div>

  <div v-if="activeView === 'cockpit'" class="screen-root">
    <div class="screen-spacer" :style="wrapperStyle">
      <div class="screen" :style="style">
        <div class="screen__bg" :style="{ '--bg-image': bgImage }" aria-hidden="true" />
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

        <AppHeader />
        <KpiBand />

        <main class="body">
          <div class="body-main">
            <section class="col left">
              <L1Trend />
              <R4Orders />
            </section>

            <section class="col middle">
              <C1Map class="c1" />
            </section>

            <section class="col right">
              <HealthBoard class="health" />
              <R2StoreRank />
            </section>
          </div>

          <section class="body-bottom">
            <L3Cost />
            <R3Reverse />
            <C4Product />
          </section>
        </main>

        <DetailDrawer />
      </div>
    </div>
  </div>

  <StoreOpsDashboard v-else />
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useScreenScale } from './composables/useScale'
import AppHeader from './components/modules/AppHeader.vue'
import KpiBand from './components/modules/KpiBand.vue'
import L1Trend from './components/modules/L1Trend.vue'
import L3Cost from './components/modules/L3Cost.vue'
import C1Map from './components/modules/C1Map.vue'
import C4Product from './components/modules/C4Product.vue'
import HealthBoard from './components/modules/HealthBoard.vue'
import R2StoreRank from './components/modules/R2StoreRank.vue'
import R3Reverse from './components/modules/R3Reverse.vue'
import R4Orders from './components/modules/R4Orders.vue'
import DetailDrawer from './components/DetailDrawer.vue'
import StoreOpsDashboard from './components/StoreOpsDashboard.vue'
import DateFilterBar from './components/DateFilterBar.vue'
import bgUrl from './assets/beijing.png'

const activeView = ref<'cockpit' | 'ops'>('cockpit')
const { style, wrapperStyle } = useScreenScale(1920, 1760)
const bgImage = `url(${bgUrl})`
</script>

<style scoped lang="scss">
.global-toolbar {
  position: fixed;
  top: 14px;
  right: 18px;
  z-index: 20;
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 0;
  background: transparent;
  border: 0;
  box-shadow: none;
  backdrop-filter: none;
}
.view-switch {
  display: flex;
  gap: 8px;
  padding: 0;
  button {
    border: 0;
    border-radius: 7px;
    padding: 8px 12px;
    color: #cfe0f6;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(94, 200, 255, 0.28);
    cursor: pointer;
    font-size: var(--fs-axis);
    &.active {
      color: #04122a;
      background: linear-gradient(135deg, #9adfff, #3aa0ff);
      border-color: transparent;
      font-weight: 800;
    }
  }
}
.global-toolbar--ops {
  .view-switch button {
    color: #5a6a7a;
    background: rgba(255, 255, 255, 0.92);
    border: 1px solid rgba(42, 92, 130, 0.18);
    &.active {
      color: #fff;
      background: linear-gradient(135deg, #2a5c82, #5b9bd5);
      border-color: transparent;
    }
  }
}

.screen-root {
  width: 100%;
  min-height: 100vh;
  overflow: visible;
  background:
    radial-gradient(ellipse at 50% 30%, rgba(20, 70, 150, 0.45), transparent 55%),
    linear-gradient(180deg, #020b22 0%, #041433 48%, #020816 100%);
}
.screen-spacer {
  position: relative;
}
.screen {
  position: absolute;
  left: 0;
  top: 0;
  box-sizing: border-box;
  padding: 14px 24px 22px;
  display: flex;
  flex-direction: column;
  gap: 14px;
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
    linear-gradient(180deg, rgba(2, 10, 30, 0.28), rgba(2, 10, 30, 0.42)),
    var(--bg-image) center / cover no-repeat;
  opacity: 0.92;
}

.screen__grid {
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  background-image:
    linear-gradient(rgba(94, 200, 255, 0.045) 1px, transparent 1px),
    linear-gradient(90deg, rgba(94, 200, 255, 0.045) 1px, transparent 1px);
  background-size: 48px 48px;
  -webkit-mask-image: radial-gradient(circle at center, rgba(0, 0, 0, 0.9), transparent 78%);
  mask-image: radial-gradient(circle at center, rgba(0, 0, 0, 0.9), transparent 78%);
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
  --ring-color: rgba(94, 200, 255, 0.3);
  --glow-color: rgba(40, 140, 255, 0.28);
  --inner-color: rgba(0, 255, 228, 0.18);
  --sweep-color: rgba(94, 200, 255, 0.5);
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
    &::before { left: 0; top: 0; }
    &::after { left: 0; top: 0; }
  }
  &.tr {
    right: -1px;
    top: -1px;
    &::before { right: 0; top: 0; }
    &::after { right: 0; top: 0; }
  }
  &.bl {
    left: -1px;
    bottom: -1px;
    &::before { left: 0; bottom: 0; }
    &::after { left: 0; bottom: 0; }
  }
  &.br {
    right: -1px;
    bottom: -1px;
    &::before { right: 0; bottom: 0; }
    &::after { right: 0; bottom: 0; }
  }
}

.screen > :not(.screen__bg):not(.screen__grid):not(.screen__rotors):not(.screen__frame) {
  position: relative;
  z-index: 1;
}
.body {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.body-main {
  flex: 1.35;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(420px, 28%) 1fr minmax(420px, 28%);
  gap: 14px;
}
.body-bottom {
  flex: 1;
  min-height: 280px;
  display: grid;
  grid-template-columns: 38% 24% 38%;
  gap: 14px;
  > * {
    min-height: 0;
    min-width: 0;
    overflow: hidden;
  }
}
.col {
  min-height: 0;
  min-width: 0;
  display: grid;
  gap: 14px;
}
.left {
  grid-template-rows: 1fr 1.15fr;
}
.middle {
  grid-template-rows: 1fr;
}
.right {
  grid-template-rows: 1.1fr 1fr;
}
.left > *,
.middle > *,
.right > * {
  min-height: 0;
  min-width: 0;
  overflow: hidden;
}
</style>
