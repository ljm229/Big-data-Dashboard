<!-- 中文名：应用入口（大屏 / 运营看板切换） -->
<template>
  <PasswordGate>
  <div v-if="activeView === 'cockpit'" class="screen-root">
    <div class="screen-spacer" :style="wrapperStyle">
      <div class="screen" :style="style">
        <div class="screen__bg" aria-hidden="true" />
        <div class="screen__frame" aria-hidden="true">
          <i class="frame-corner tl" />
          <i class="frame-corner tr" />
          <i class="frame-corner bl" />
          <i class="frame-corner br" />
        </div>

        <section class="top-stage" data-layout="stack">
          <TopBar data-role="nav" data-height-px="64" data-single-line="true">
            <template #filters>
              <DateFilter variant="dark" scope="cockpit" :show-location="true" />
            </template>
            <template #nav>
              <div class="view-switch view-switch--in-header">
                <button type="button" class="active">数据大屏</button>
                <button
                  type="button"
                  @click="
                    activeView = 'ops';
                    opsEdition = 'classic'
                  "
                >
                  运营·经典
                </button>
                <button
                  type="button"
                  @click="
                    activeView = 'ops';
                    opsEdition = 'tabs'
                  "
                >
                  运营·Tab
                </button>
              </div>
            </template>
          </TopBar>
        </section>

        <!-- 黄金比例：KPI 15% · 主体 60% · 底部 25% -->
        <div class="cockpit-band">
          <section class="kpi-band" aria-label="顶部核心指标">
            <KeyNumbers />
          </section>

          <main class="body-main" data-role="bento-main">
            <ProfitTrend class="mod trend" />
            <div class="mod launch"><LaunchTrack /></div>
            <CityMap class="mod map" />
            <RiskTop class="mod risk" />
            <ChannelProfit class="mod channel" />
          </main>

          <section class="body-bottom" data-role="bento-bottom" aria-label="底部分析">
            <CityMatrix class="mod matrix" />
            <CostBalance class="mod category" />
            <StoreTop class="mod stores" />
          </section>
        </div>

        <footer class="screen__foot">
          <svg class="screen__foot-frame" viewBox="0 0 1920 40" preserveAspectRatio="none" aria-hidden="true">
            <path class="foot-track" d="M0 0 H650 L672 9 H1248 L1270 0 H1920 M0 39 H650 L664 32 H1256 L1270 39 H1920" />
            <path class="foot-highlight" d="M0 0 H136 M1784 0 H1920 M680 9 H1240 M694 32 H1226" />
          </svg>
          <span class="screen__source"><i aria-hidden="true" />数据源1 <em>业务周：周五至周四</em></span>
          <span>{{ footLine }}</span>
        </footer>
      </div>
    </div>
  </div>

  <StoreBoard
    v-else-if="opsEdition === 'classic'"
    @switch-view="activeView = 'cockpit'"
    @switch-edition="opsEdition = 'tabs'"
  />
  <StoreBoardTabs
    v-else
    @switch-view="activeView = 'cockpit'"
    @switch-edition="opsEdition = 'classic'"
  />
  </PasswordGate>
</template>

<script setup lang="ts">
import { computed, provide, ref, watch } from 'vue'
import { SCREEN_SCALE_KEY, useScreenScale } from './composables/useScale'
import { useFilterStore, COCKPIT_DATES } from './stores/filter'
import { hasAssessment } from './api/dashboard'
import PasswordGate from './components/PasswordGate.vue'
import TopBar from './components/boards/TopBar.vue'
import KeyNumbers from './components/boards/KeyNumbers.vue'
import ProfitTrend from './components/boards/ProfitTrend.vue'
import LaunchTrack from './components/boards/LaunchTrack.vue'
import CityMatrix from './components/boards/CityMatrix.vue'
import CityMap from './components/boards/CityMap.vue'
import RiskTop from './components/boards/RiskTop.vue'
import ChannelProfit from './components/boards/ChannelProfit.vue'
import CostBalance from './components/boards/CostBalance.vue'
import StoreTop from './components/boards/StoreTop.vue'
import StoreBoard from './components/StoreBoard.vue'
import StoreBoardTabs from './components/StoreBoardTabs.vue'
import DateFilter from './components/DateFilter.vue'

const boot = new URLSearchParams(typeof location === 'undefined' ? '' : location.search)
const activeView = ref<'cockpit' | 'ops'>(boot.get('view') === 'ops' ? 'ops' : 'cockpit')
const opsEdition = ref<'classic' | 'tabs'>(boot.get('edition') === 'classic' ? 'classic' : 'tabs')
const filter = useFilterStore()
// 按视口宽度铺满（左右不留白）；高度不够时可纵向滚动。
const { scale, style, wrapperStyle } = useScreenScale(1920, 1200, 'width')
const footLine = computed(() => {
  const mode = filter.periodMode === 'day' ? '日' : filter.periodMode === 'week' ? '周' : '月'
  const { from, to } = filter.periodRange
  const range = from === to ? from : `${from} ~ ${to}`
  const store = filter.selectedStore !== '全部' ? ` · ${filter.selectedStore}` : ''
  return `${mode}口径 ${range} · ${filter.cityName} · ${filter.channel}${store}`
})
/** 仅数据大屏做 scale；运营看板保持 1，避免下拉/弹层被二次缩小 */
const overlayScale = computed(() => (activeView.value === 'cockpit' ? scale.value : 1))
provide(SCREEN_SCALE_KEY, overlayScale)
provide('openClassicCity', () => {
  activeView.value = 'ops'
  opsEdition.value = 'classic'
})

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
  gap: 6px;
  button {
    border: 1px solid var(--border);
    border-radius: 0;
    padding: 6px 10px;
    color: var(--c-body);
    background: var(--panel);
    cursor: pointer;
    font-size: 13px;
    font-weight: 600;
    line-height: 1.2;
    white-space: nowrap;
    &.active {
      color: #02162e;
      background: var(--accent-line);
      border-color: var(--accent-line);
      font-weight: 700;
    }
  }
}
.view-switch--in-header {
  flex-shrink: 0;
}

.screen-root {
  width: 100%;
  min-height: 100vh;
  background: var(--gap);
  overflow-x: hidden;
  overflow-y: auto;
}
.screen-spacer {
  position: relative;
  overflow: visible;
}
.screen {
  position: absolute;
  left: 0;
  top: 0;
  box-sizing: border-box;
  padding: 10px 8px 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
  color: var(--c-body);
  overflow: hidden;
  background: var(--bg);
}

.screen__bg {
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  background: var(--bg);
}

.screen__frame {
  position: absolute;
  inset: 6px;
  z-index: 0;
  pointer-events: none;
  border: 0;
  box-shadow: none;
}

.frame-corner {
  position: absolute;
  width: 14px;
  height: 14px;
  &::before,
  &::after {
    content: '';
    position: absolute;
    background: var(--accent-line);
  }
  &::before {
    width: 14px;
    height: 1px;
  }
  &::after {
    width: 1px;
    height: 14px;
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

.screen > :not(.screen__bg):not(.screen__grid):not(.screen__circuit):not(.screen__frame) {
  position: relative;
  z-index: 1;
}
.top-stage {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
  background: transparent;
  /* 高于下方栏目，避免日历/下拉被左侧卡片盖住 */
  z-index: 40;
  overflow: visible;
}
/* 导航以下内容带：KPI 15% · 主体 60% · 底部分析 25% */
.cockpit-band {
  flex: 1 1 auto;
  min-height: 0;
  display: grid;
  grid-template-rows: minmax(0, 15fr) minmax(0, 60fr) minmax(0, 25fr);
  gap: 8px;
  z-index: 1;
}
.kpi-band {
  min-height: 0;
  min-width: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  :deep(.kpi) {
    height: 100%;
    min-height: 0;
  }
}
/* 主体：左 30% · 中 40% · 右 30% */
.body-main {
  min-height: 0;
  min-width: 0;
  display: grid;
  grid-template-columns: minmax(0, 30fr) minmax(0, 40fr) minmax(0, 30fr);
  grid-template-rows: minmax(0, 1fr) minmax(0, 1fr);
  grid-template-areas:
    'trend map risk'
    'launch map channel';
  gap: 8px;
}
/* 底部：城市矩阵 30% · 毛利/收支 35% · 门店表现 35%；可略向下滚动 */
.body-bottom {
  min-height: 0;
  min-width: 0;
  display: grid;
  grid-template-columns: minmax(0, 30fr) minmax(0, 35fr) minmax(0, 35fr);
  grid-template-areas: 'matrix category stores';
  gap: 8px;
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-width: thin;
  scrollbar-color: rgba(94, 200, 255, 0.4) transparent;
  padding-bottom: 2px;
  /* 内容略高于可视区时可下拉 */
  .mod {
    min-height: max(100%, 260px);
  }
}
.screen__foot {
  height: 40px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 0 14px;
  border-top: 0;
  background: var(--gap);
  color: var(--c-body);
  font-size: 14px;
  font-weight: 500;
  letter-spacing: 0.02em;
  z-index: 2;
  span {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  span:last-child {
    color: var(--c-num-accent);
    font-family: var(--font-num);
    font-variant-numeric: tabular-nums;
  }
}
.screen__foot-frame { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; overflow: visible; }
.screen__foot-frame path { fill: none; stroke-width: 1; vector-effect: non-scaling-stroke; }
.foot-track { stroke: var(--accent-line); opacity: 0.55; }
.foot-highlight { stroke: var(--line-glow); filter: drop-shadow(0 0 3px var(--accent-line)) drop-shadow(0 0 8px rgba(60, 140, 255, 0.5)); }
.screen__source {
  display: flex;
  align-items: center;
  gap: 10px;
  i { width: 6px; height: 6px; background: var(--success); border-radius: 50%; }
  em { margin-left: 12px; padding-left: 18px; border-left: 1px solid var(--border); color: var(--muted); font-style: normal; }
}
.mod {
  min-width: 0;
  min-height: 0;
}
.trend { grid-area: trend; }
.launch { grid-area: launch; }
.matrix { grid-area: matrix; }
.map { grid-area: map; }
.risk { grid-area: risk; }
.channel { grid-area: channel; }
.category { grid-area: category; }
.stores { grid-area: stores; }
</style>
