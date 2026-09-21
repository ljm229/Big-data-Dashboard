<!-- 中文名：数据看板（经典版壳） -->
<template>
  <div class="cockpit" :class="{ 'cockpit--traffic': activeTab === 'traffic' }">
    <header class="ck-chrome">
      <div class="ck-chrome__top">
        <div class="ck-chrome__lead">
          <div class="ck-brand" aria-label="数据看板">
            <span class="ck-brand__icon" aria-hidden="true">淘便</span>
            <strong>数据看板</strong>
          </div>

          <nav class="ck-nav" aria-label="数据看板导航">
            <button
              v-for="item in navItems"
              :key="item.id"
              type="button"
              :class="{ active: item.id !== 'overview' && activeTab === item.id }"
              :aria-current="item.id !== 'overview' && activeTab === item.id ? 'page' : undefined"
              @click="onNav(item.id)"
            >
              {{ item.label }}
            </button>
          </nav>
        </div>

        <div class="ck-meta">
          <button type="button" class="ghost" title="切换运营 Tab 版" @click="emit('switch-edition')">Tab</button>
          <span class="ck-data-status" :title="`当前数据截至 ${statusDate}`">
            <i aria-hidden="true"></i>
            数据至 {{ statusDate }}
          </span>
        </div>
      </div>

      <div class="ck-chrome__bottom">
        <div class="ck-page-heading">
          <h1 class="ck-page-title">{{ pageTitle }}</h1>
          <QualityRulesPop v-if="activeTab === 'quality'" />
          <div
            v-if="activeTab === 'profit'"
            class="ck-dim-seg"
            role="group"
            aria-label="利润成本视角"
          >
            <button
              type="button"
              :aria-pressed="profitDimension === 'balance'"
              :class="{ active: profitDimension === 'balance' }"
              @click="profitDimension = 'balance'"
            >
              盈亏概览
            </button>
            <button
              type="button"
              :aria-pressed="profitDimension === 'profit'"
              :class="{ active: profitDimension === 'profit' }"
              @click="profitDimension = 'profit'"
            >
              毛利概览
            </button>
          </div>
          <div
            v-if="activeTab === 'traffic'"
            class="ck-dim-seg"
            role="group"
            aria-label="来源分析视角"
          >
            <button
              type="button"
              :aria-pressed="trafficDimension === 'platform'"
              :class="{ active: trafficDimension === 'platform' }"
              @click="trafficDimension = 'platform'"
            >
              平台渠道
            </button>
            <button
              type="button"
              :aria-pressed="trafficDimension === 'app'"
              :class="{ active: trafficDimension === 'app' }"
              @click="trafficDimension = 'app'"
            >
              APP 内页面
            </button>
          </div>
        </div>
        <div v-if="activeTab !== 'datasource'" class="ck-filters">
          <DateFilter
            variant="light"
            scope="cockpit"
            :show-location="false"
            :show-channel="true"
          />
            <SelectMenu
              class="ctrl ctrl-city"
              variant="light"
              multiple
              all-value="全国"
              :model-value="selectedCities"
              :options="cityOptions"
              placeholder="全国"
              search-placeholder="搜索城市"
              @update:model-value="onCities"
            />
            <SelectMenu
              class="ctrl ctrl-store"
              variant="light"
              multiple
              all-value="全部"
              :model-value="selectedStores"
              :options="storeOptions"
              search-placeholder="搜索淘宝便利店"
              placeholder="全部门店"
              @update:model-value="onStores"
            />
        </div>
      </div>
    </header>

    <main class="ck-main">
      <ProfitCostPage v-if="activeTab === 'profit'" />
      <NewStoreDiagnosisPage v-else-if="activeTab === 'diag'" />
      <CoreMetricsTrackTab v-else-if="activeTab === 'track'" />
      <TrafficConvertPage v-else-if="activeTab === 'traffic'" />
      <QualityPage v-else-if="activeTab === 'quality'" />
      <DataUploadPage v-else-if="activeTab === 'datasource'" />
      <ProfitCostPage v-else />
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import DateFilter from './DateFilter.vue'
import NewStoreDiagnosisPage from './classic-pages/NewStoreDiagnosisPage.vue'
import SelectMenu from './SelectMenu.vue'
import ProfitCostPage from './classic-pages/ProfitCostPage.vue'
import CoreMetricsTrackTab from './classic-pages/CoreMetricsTrackTab.vue'
import TrafficConvertPage from './classic-pages/TrafficAnalysisPage.vue'
import QualityPage from './classic-pages/QualityPage.vue'
import DataUploadPage from './classic-pages/DataUploadPage.vue'
import QualityRulesPop from './classic-pages/QualityRulesPop.vue'
import { useFilterStore, COCKPIT_CITIES } from '../stores/filter'
import { SOURCE1_STORES, canonCity } from '../api/source1'
import { storeFilterLabel } from '../utils/storeName'
import { trafficDimension } from '../api/trafficSummary'
import { profitDimension } from '../api/profitPc'

const emit = defineEmits<{ 'switch-view': []; 'switch-edition': [] }>()

type TabId = 'overview' | 'profit' | 'track' | 'traffic' | 'quality' | 'diag' | 'datasource'

const navItems: Array<{ id: TabId; label: string }> = [
  { id: 'overview', label: '数据大屏' },
  { id: 'quality', label: '运营质量' },
  { id: 'track', label: '指标追踪' },
  { id: 'profit', label: '利润成本' },
  { id: 'traffic', label: '流量转化' },
  { id: 'diag', label: '新店诊断' },
  { id: 'datasource', label: '数据源' },
]

const requestedRaw = new URLSearchParams(window.location.search).get('tab')
const requestedTab = requestedRaw === 'channel' || requestedRaw === 'city' ? 'quality' : requestedRaw
const classicTabs: Array<Exclude<TabId, 'overview'>> = ['quality', 'profit', 'traffic', 'track', 'diag', 'datasource']
const activeTab = ref<Exclude<TabId, 'overview'>>(
  classicTabs.includes(requestedTab as Exclude<TabId, 'overview'>)
    ? requestedTab as Exclude<TabId, 'overview'>
    : 'quality',
)
const filter = useFilterStore()
const { selectedCities, selectedStores, selectedDate } = storeToRefs(filter)
const statusDate = computed(() => {
  const iso = selectedDate.value
  return iso ? iso.slice(5).replace('-', '.') : '—'
})
const pageTitle = computed(
  () => navItems.find((item) => item.id === activeTab.value)?.label || '数据看板',
)

const cityOptions = computed(() => COCKPIT_CITIES.map((c) => ({ value: c, label: c })))
const storeOptions = computed(() => {
  const cities = selectedCities.value
  const stores =
    !cities.length
      ? SOURCE1_STORES
      : SOURCE1_STORES.filter((s) => cities.some((c) => canonCity(s.city) === canonCity(c)))
  return [{ value: '全部', label: '全部门店' }, ...stores.map((s) => ({ value: s.name, label: storeFilterLabel(s.name) }))]
})

function onCities(value: string | string[]) {
  filter.setCities(Array.isArray(value) ? value : value ? [value] : [])
}

function onStores(value: string | string[]) {
  filter.setStores(Array.isArray(value) ? value : value ? [value] : [])
}

filter.setChannel('全部')

function onNav(id: TabId) {
  if (id === 'overview') {
    emit('switch-view')
    return
  }
  activeTab.value = id
  const url = new URL(window.location.href)
  url.searchParams.set('tab', id)
  window.history.replaceState(window.history.state, '', url)
}
</script>

<style scoped lang="scss">
.cockpit {
  min-height: 100vh;
  width: 100%;
  max-width: 100vw;
  box-sizing: border-box;
  padding: 0;
  background:
    radial-gradient(circle at 12% 0%, var(--ck-bg-glow-a, rgba(255, 185, 0, 0.07)), transparent 40%),
    radial-gradient(circle at 92% 8%, var(--ck-bg-glow-b, rgba(56, 189, 248, 0.06)), transparent 38%),
    var(--ck-bg, #f5f5f7);
  color: var(--ck-text);
  font-family: var(--ck-font);
  font-size: var(--ck-fs-sm);
  font-weight: var(--ck-fw-regular);
  overflow-x: hidden;
}
.ck-chrome {
  position: sticky;
  top: 0;
  z-index: 40;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px 20px 14px;
  background: rgba(255, 255, 255, 0.62);
  border: 0;
  border-bottom: 1px solid rgba(226, 232, 240, 0.75);
  border-radius: 0;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.03);
  backdrop-filter: blur(16px) saturate(1.2);
  -webkit-backdrop-filter: blur(16px) saturate(1.2);
  box-sizing: border-box;
}
.ck-chrome__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  min-width: 0;
}
.ck-chrome__lead {
  display: flex;
  align-items: center;
  gap: 18px;
  min-width: 0;
  flex: 1 1 auto;
}
.ck-chrome__bottom {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  min-width: 0;
}
.ck-brand {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
  strong {
    margin: 0;
    color: #e8a200;
    font-size: 18px;
    font-weight: 700;
    letter-spacing: -0.01em;
    white-space: nowrap;
    line-height: 1;
  }
}
.ck-brand__icon {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border-radius: 8px;
  color: #fff;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.02em;
  line-height: 1;
  background: linear-gradient(145deg, #fbbf24 0%, #f59e0b 100%);
  border: 1px solid rgba(245, 158, 11, 0.45);
  box-shadow: 0 4px 12px rgba(245, 158, 11, 0.28);
  flex-shrink: 0;
}
.ck-nav {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  flex-wrap: nowrap;
  gap: 4px;
  min-width: 0;
  overflow-x: auto;
  scrollbar-width: none;
  &::-webkit-scrollbar { display: none; }
  button {
    height: 32px;
    padding: 0 12px;
    border: 0;
    border-radius: 999px;
    background: transparent;
    color: var(--ck-body);
    font-size: 13px;
    font-weight: var(--ck-fw-medium);
    letter-spacing: 0;
    cursor: pointer;
    white-space: nowrap;
    flex-shrink: 0;
    transition: background 0.15s ease, color 0.15s ease;
    &:hover {
      color: var(--ck-text);
      background: rgba(255, 255, 255, 0.72);
    }
    &.active {
      color: #fff;
      background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%);
      font-weight: var(--ck-fw-title);
      box-shadow: 0 4px 12px rgba(245, 158, 11, 0.25);
    }
  }
}
.ck-meta {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  flex-shrink: 0;
}
.ck-page-heading {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}
.ck-dim-seg {
  display: inline-flex;
  border: 1px solid var(--ck-line);
  border-radius: 999px;
  overflow: hidden;
  background: var(--ck-btn);
  flex-shrink: 0;
  button {
    height: 30px;
    padding: 0 12px;
    border: 0;
    border-right: 1px solid var(--ck-line);
    background: transparent;
    color: var(--ck-body);
    font-size: 12px;
    font-weight: var(--ck-fw-medium);
    cursor: pointer;
    white-space: nowrap;
    &:last-child { border-right: 0; }
    &.active {
      color: #fff;
      background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%);
      font-weight: var(--ck-fw-title);
    }
  }
}
.ck-page-title {
  margin: 0;
  color: #e8a200;
  font-size: 20px;
  font-weight: 700;
  letter-spacing: -0.01em;
  line-height: 1.2;
  white-space: nowrap;
}
.ck-filters {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  min-width: 0;
  max-width: min(720px, 100%);
  margin-right: 4px;
  --filter-fill: var(--ck-btn);
  --filter-fill-hover: var(--ck-btn-hover);
  --filter-line: var(--ck-line);
  :deep(.date-bar) {
    width: auto;
    flex-wrap: nowrap;
    gap: 8px;
  }
  :deep(.seg) {
    gap: 0 !important;
    border: 1px solid var(--filter-line) !important;
    border-radius: 999px !important;
    background: var(--filter-fill) !important;
    overflow: hidden;
  }
  :deep(.seg button) {
    height: 34px !important;
    padding: 0 12px !important;
    font-size: var(--ck-fs-xs) !important;
    font-weight: var(--ck-fw-medium) !important;
    border-radius: 0 !important;
    color: var(--ck-body) !important;
    background: transparent !important;
  }
  :deep(.seg button:hover) {
    background: var(--filter-fill-hover) !important;
    color: var(--ck-text) !important;
  }
  :deep(.seg button.active) {
    color: #fff !important;
    background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%) !important;
    box-shadow: 0 2px 8px rgba(245, 158, 11, 0.22) !important;
  }
  :deep(.dash-date),
  :deep(.ctrl),
  :deep(.ctrl-select) { width: 118px; }
  :deep(.ctrl-city) { width: 96px; }
  :deep(.ctrl-store) { width: 128px; }
  :deep(.ctrl-select--week) { width: 148px; }
  :deep(.ctrl-select--month) { width: 112px; }
  :deep(.dash-date__trigger),
  :deep(.dash-select__trigger) {
    height: 34px !important;
    border: 1px solid var(--filter-line) !important;
    border-radius: 999px !important;
    background: var(--filter-fill) !important;
    color: var(--ck-text-2) !important;
    font-size: var(--ck-fs-xs);
    font-weight: var(--ck-fw-medium);
    padding: 0 12px;
  }
  :deep(.dash-date__trigger:hover),
  :deep(.dash-select__trigger:hover),
  :deep(.dash-date.open .dash-date__trigger),
  :deep(.dash-select.open .dash-select__trigger) {
    background: var(--filter-fill-hover) !important;
    border-color: #d1d5db !important;
  }
}
.ck-data-status {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: var(--ck-muted);
  font-size: 11px;
  font-weight: var(--ck-fw-medium);
  white-space: nowrap;
  i {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: #10b981;
    box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.12);
  }
}
.ghost {
  border: 1px solid rgba(255, 255, 255, 0.55);
  background: rgba(255, 255, 255, 0.72);
  color: var(--ck-text-2);
  border-radius: 999px;
  height: 34px;
  padding: 0 12px;
  font-size: var(--ck-fs-xs);
  font-weight: var(--ck-fw-medium);
  cursor: pointer;
  white-space: nowrap;
  flex-shrink: 0;
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  &:hover { background: rgba(255, 255, 255, 0.9); border-color: #d1d5db; }
}
.ck-main {
  padding: 18px 20px 22px;
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
  overflow-x: hidden;
  min-height: calc(100vh - 120px);
  background: transparent;
  border: 0;
  border-radius: 0;
  box-shadow: none;
}
@media (max-width: 1100px) {
  .ck-chrome__lead { gap: 12px; }
  .ck-nav button { padding: 0 9px; font-size: 13px; }
}
@media (max-width: 900px) {
  .ck-chrome__bottom {
    flex-direction: column;
    align-items: flex-start;
  }
  .ck-filters { justify-content: flex-start; width: 100%; }
  .ck-main { padding: 12px 16px; }
}
@media (max-width: 640px) {
  .ck-chrome { padding: 10px 12px; }
  .ck-chrome__lead { gap: 10px; }
  .ck-brand strong { font-size: 16px; }
  .ck-brand__icon { width: 26px; height: 26px; }
  .ck-page-title { font-size: 18px; }
  .ck-data-status { display: none; }
  .ck-main { padding: 12px; }
}
</style>

<style lang="scss">
@use '../styles/classic-cockpit.scss';
</style>
