<!-- 中文名：即时零售经营驾驶舱（经典版壳） -->
<template>
  <div class="cockpit">
    <header class="ck-top">
      <div class="ck-top__brand">
        <div class="ck-top__mark" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8">
            <path d="M4 8h16l-1.2 11.2a2 2 0 0 1-2 1.8H7.2a2 2 0 0 1-2-1.8L4 8Z" />
            <path d="M8 8V6a4 4 0 0 1 8 0v2" />
          </svg>
        </div>
        <div class="ck-top__titles">
          <h1>闪玩家数据看板</h1>
          <p>数据驱动经营 · 让好商品更快到达消费者</p>
        </div>
      </div>

      <nav class="ck-nav" aria-label="驾驶舱导航">
        <button
          v-for="item in navItems"
          :key="item.id"
          type="button"
          :class="{ active: activeTab === item.id }"
          @click="onNav(item.id)"
        >
          <span class="ck-nav__glyph" v-html="item.svg" aria-hidden="true" />
          <span class="ck-nav__label">{{ item.label }}</span>
        </button>
      </nav>

      <div class="ck-top__tools">
        <button type="button" class="ghost" @click="emit('switch-edition')">运营·Tab</button>
        <span class="updated">数据更新时间 · 待同步</span>
        <button type="button" class="icon-btn" title="刷新" @click="refreshTick++">↻</button>
      </div>
    </header>

    <div class="ck-filters">
      <template v-if="activeTab === 'quality'">
        <DateFilter variant="light" scope="ops" />
        <label class="filter">
          <span>城市</span>
          <SelectMenu
            class="filter__select"
            variant="light"
            :model-value="qualityCity"
            :options="qualityCityOptions"
            search-placeholder="搜索城市"
            @update:model-value="qualityCity = $event"
          />
        </label>
        <label class="filter">
          <span>门店</span>
          <SelectMenu
            class="filter__select filter__select--store"
            variant="light"
            :model-value="qualityStoreId"
            :options="qualityStoreOptions"
            search-placeholder="搜索门店"
            @update:model-value="qualityStoreId = $event"
          />
        </label>
      </template>
      <template v-else>
        <label class="filter">
          <span>经营日期</span>
          <DatePicker
            class="ctrl-date"
            variant="light"
            :model-value="selectedDate"
            :dates="filterDates"
            @update:model-value="filter.setDate"
          />
        </label>
        <label class="filter">
          <span>城市</span>
          <SelectMenu
            class="filter__select"
            variant="light"
            :model-value="city"
            :options="cityOptions"
            search-placeholder="搜索城市"
            @update:model-value="city = $event"
          />
        </label>
        <label class="filter">
          <span>渠道</span>
          <SelectMenu
            class="filter__select"
            variant="light"
            :model-value="channel"
            :options="channelOptions"
            @update:model-value="onChannel"
          />
        </label>
        <label class="filter">
          <span>门店</span>
          <SelectMenu
            class="filter__select filter__select--store"
            variant="light"
            :model-value="storeId"
            :options="storeOptions"
            search-placeholder="搜索门店"
            @update:model-value="storeId = $event"
          />
        </label>
        <label v-if="activeTab === 'category'" class="filter">
          <span>品类</span>
          <SelectMenu
            class="filter__select"
            variant="light"
            :model-value="category"
            :options="categoryOptions"
            @update:model-value="category = $event"
          />
        </label>
      </template>
      <div class="ck-filters__slogan" aria-hidden="true">即时零售，近在身边</div>
    </div>

    <main class="ck-main" :key="`${activeTab}-${refreshTick}`">
      <CityStorePage v-if="activeTab === 'city'" />
      <ProfitCostPage v-else-if="activeTab === 'profit'" />
      <ChannelOrderPage v-else-if="activeTab === 'channel'" />
      <CategoryPage v-else-if="activeTab === 'category'" />
      <WarningPage v-else-if="activeTab === 'warning'" />
      <QualityPage
        v-else-if="activeTab === 'quality'"
        :city="qualityCity"
        :store-id="qualityStoreId"
        :assess-key="assessKey"
        :has-assess-data="hasAssessData"
        :data-source="dataSource"
        :updated-hint="updatedHint"
      />
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import DatePicker from './DatePicker.vue'
import DateFilter from './DateFilter.vue'
import SelectMenu from './SelectMenu.vue'
import CityStorePage from './classic-pages/CityStorePage.vue'
import ProfitCostPage from './classic-pages/ProfitCostPage.vue'
import ChannelOrderPage from './classic-pages/ChannelOrderPage.vue'
import CategoryPage from './classic-pages/CategoryPage.vue'
import WarningPage from './classic-pages/WarningPage.vue'
import QualityPage from './classic-pages/QualityPage.vue'
import { useFilterStore, COCKPIT_CHANNELS, UNIFIED_DATES } from '../stores/filter'
import { useStoreScore } from '../composables/useStoreScore'

const emit = defineEmits<{ 'switch-view': []; 'switch-edition': [] }>()

type TabId = 'flash' | 'city' | 'profit' | 'channel' | 'category' | 'warning' | 'quality'

const navItems: Array<{ id: TabId; label: string; svg: string }> = [
  {
    id: 'flash',
    label: '数据大屏',
    svg: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M3 5h18v12H3z"/><path d="M8 21h8M12 17v4"/></svg>`,
  },
  {
    id: 'city',
    label: '城市门店经营',
    svg: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M4 20V9l8-5 8 5v11"/><path d="M9 20v-6h6v6"/><path d="M9 10h.01M15 10h.01"/></svg>`,
  },
  {
    id: 'profit',
    label: '利润成本拆解',
    svg: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M12 3a9 9 0 1 0 9 9"/><path d="M12 3v9h9"/></svg>`,
  },
  {
    id: 'channel',
    label: '渠道订单大盘',
    svg: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="9" cy="20" r="1.4"/><circle cx="18" cy="20" r="1.4"/><path d="M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h7.8a2 2 0 0 0 2-1.5L21 8H7"/></svg>`,
  },
  {
    id: 'category',
    label: '商品品类大盘',
    svg: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M4 8h16v4H4zM6 12h12v4H6zM8 16h8v4H8z"/></svg>`,
  },
  {
    id: 'warning',
    label: '经营预警中心',
    svg: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M12 3 2.5 20h19L12 3Z"/><path d="M12 10v4M12 17h.01"/></svg>`,
  },
  {
    id: 'quality',
    label: '门店运营质量',
    svg: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M4 19h16M7 19V9l5-4 5 4v10"/><path d="M10 19v-5h4v5"/></svg>`,
  },
]

const activeTab = ref<Exclude<TabId, 'flash'>>('city')
const refreshTick = ref(0)
const city = ref('全部')
const storeId = ref('全部')
const category = ref('全部')

const filter = useFilterStore()
const { channel, selectedDate } = storeToRefs(filter)
const filterDates = UNIFIED_DATES

const {
  city: qualityCity,
  storeId: qualityStoreId,
  cityOptions: qualityCities,
  storeOptions: qualityStores,
  assessKey,
  hasAssessData,
  updatedHint,
  dataSource,
} = useStoreScore()

const qualityCityOptions = computed(() =>
  qualityCities.value.map((c) => ({ value: c, label: c === '全部' ? '全部城市' : c })),
)
const qualityStoreOptions = computed(() => [
  { value: '全部', label: '全部门店' },
  ...qualityStores.value.map((s) => ({ value: s.id, label: s.shortName })),
])

const cityOptions = [
  { value: '全部', label: '全部城市' },
  { value: '杭州市', label: '杭州市' },
  { value: '南京市', label: '南京市' },
  { value: '上海市', label: '上海市' },
]
const storeOptions = [{ value: '全部', label: '全部门店' }]
const categoryOptions = [
  { value: '全部', label: '全部品类' },
  { value: '生鲜', label: '生鲜' },
  { value: '餐饮', label: '餐饮' },
  { value: '日配', label: '日配' },
]
const channelOptions = computed(() =>
  COCKPIT_CHANNELS.map((c) => ({ value: c, label: c === '全部' ? '全部渠道' : c })),
)

function onChannel(value: string) {
  filter.setChannel(value)
}

function onNav(id: TabId) {
  if (id === 'flash') {
    emit('switch-view')
    return
  }
  activeTab.value = id
}
</script>

<style scoped lang="scss">
.cockpit {
  --primary: #1d6bff;
  --line: #dbe3ef;
  --text: #0f172a;
  --muted: #64748b;
  min-height: 100vh;
  min-width: 1280px;
  padding: 0 0 28px;
  background: linear-gradient(180deg, #f5f8fc 0%, #eef2f7 50%, #e8eef6 100%);
  color: var(--text);
  font-family: 'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', sans-serif;
}
.ck-top {
  display: grid;
  grid-template-columns: minmax(240px, 0.95fr) minmax(720px, 2.6fr) minmax(200px, 0.85fr);
  align-items: stretch;
  gap: 8px 12px;
  padding: 10px 20px 0;
  background: #fff;
  border-bottom: 1px solid var(--line);
}
.ck-top__brand {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
  padding-bottom: 10px;
}
.ck-top__mark {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  display: grid;
  place-items: center;
  color: #fff;
  background: linear-gradient(145deg, #38bdf8, #1d6bff 55%, #0b3d91);
  box-shadow: 0 4px 14px rgba(29, 107, 255, 0.3);
  flex-shrink: 0;
}
.ck-top__titles {
  min-width: 0;
  h1 {
    margin: 0;
    font-size: 17px;
    font-weight: 800;
    color: #0b3d91;
    white-space: nowrap;
  }
  p {
    margin: 3px 0 0;
    font-size: 12px;
    color: var(--muted);
    white-space: nowrap;
  }
}

/* 原型导航：五枚横排，图标在上、文字在下 */
.ck-nav {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  align-items: stretch;
  min-width: 0;
  height: 100%;
  button {
    appearance: none;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 6px;
    width: 100%;
    margin: 0;
    padding: 10px 8px 12px;
    border: 0;
    border-radius: 0;
    background: transparent;
    color: #475569;
    cursor: pointer;
    position: relative;
    transition: background 0.15s ease, color 0.15s ease;
    &:hover {
      background: #f5f9ff;
      color: var(--primary);
    }
    &.active {
      background: #eaf2ff;
      color: var(--primary);
      &::after {
        content: '';
        position: absolute;
        left: 12%;
        right: 12%;
        bottom: 0;
        height: 3px;
        border-radius: 3px 3px 0 0;
        background: #1d6bff;
      }
    }
  }
}
.ck-nav__glyph {
  display: grid;
  place-items: center;
  height: 24px;
  color: inherit;
  :deep(svg) {
    display: block;
  }
}
.ck-nav__label {
  font-size: 13px;
  font-weight: 700;
  line-height: 1.2;
  white-space: nowrap;
}
.ck-top__tools {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  padding-bottom: 10px;
  min-width: 0;
}
.ghost {
  border: 1px solid var(--line);
  background: #f8fafc;
  color: var(--muted);
  border-radius: 999px;
  height: 30px;
  padding: 0 12px;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  white-space: nowrap;
  &:hover {
    border-color: #93c5fd;
    color: var(--primary);
    background: #eff6ff;
  }
}
.updated {
  font-size: 12px;
  color: var(--muted);
  white-space: nowrap;
}
.icon-btn {
  width: 30px;
  height: 30px;
  border-radius: 8px;
  border: 1px solid var(--line);
  background: #fff;
  color: var(--primary);
  cursor: pointer;
  font-size: 15px;
}
.ck-filters {
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  gap: 14px 18px;
  margin: 0;
  padding: 12px 20px;
  background: #fff;
  border-bottom: 1px solid var(--line);
  overflow-x: auto;
}
.filter {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--muted);
  flex-shrink: 0;
  span {
    flex-shrink: 0;
    font-weight: 600;
  }
  :deep(.date-bar) {
    gap: 8px;
  }
  :deep(.ctrl-date),
  :deep(.dash-date) {
    width: 132px;
  }
  :deep(.filter__select) {
    min-width: 110px;
  }
  :deep(.filter__select--store) {
    min-width: 140px;
  }
}
.ck-filters__slogan {
  margin-left: auto;
  flex-shrink: 0;
  font-size: 12px;
  color: #93c5fd;
  font-weight: 700;
  letter-spacing: 0.04em;
  white-space: nowrap;
}
.ck-main {
  padding: 14px 20px 0;
  width: 100%;
  box-sizing: border-box;
}
</style>

<style lang="scss">
@use '../styles/classic-cockpit.scss';
</style>
