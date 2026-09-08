<template>
  <div class="ops-tabs ops-theme">
    <aside class="ops-tabs__nav">
      <div class="nav-brand">
        <b>运</b>
        <div>
          <strong>门店运营</strong>
          <span>Tab 版 · 试对比</span>
        </div>
      </div>

      <div class="nav-switch">
        <button type="button" class="link" @click="emit('switch-edition')">← 经典版</button>
        <button type="button" class="link" @click="emit('switch-view')">数据大屏</button>
      </div>

      <nav>
        <button
          v-for="t in tabs"
          :key="t.id"
          type="button"
          :class="{ active: activeTab === t.id, soon: t.soon }"
          @click="activeTab = t.id"
        >
          <em>{{ t.no }}</em>
          <span>{{ t.label }}</span>
          <i v-if="t.soon">待接入</i>
        </button>
      </nav>
    </aside>

    <div class="ops-tabs__main">
      <header class="topbar">
        <h1>{{ currentTab?.label }}</h1>
        <div class="topbar__filters">
          <DateFilterBar variant="light" scope="ops" />
          <div class="filter-divider" />
          <label class="filter">
            <span>城市</span>
            <DashSelect
              class="filter__select"
              variant="light"
              :model-value="city"
              :options="citySelectOptions"
              search-placeholder="搜索城市"
              @update:model-value="city = $event"
            />
          </label>
          <label class="filter">
            <span>门店</span>
            <DashSelect
              class="filter__select filter__select--store"
              variant="light"
              :model-value="storeId"
              :options="storeSelectOptions"
              search-placeholder="搜索门店名/编码"
              @update:model-value="storeId = $event"
            />
          </label>
        </div>
        <div v-if="hasAssessData" class="health" :class="headerScore >= 60 ? 'ok' : 'warn'">
          <div class="health__grade" :style="{ color: softGrade(health.grade.grade) }">
            {{ health.grade.grade }}
          </div>
          <strong>{{ headerScore }}</strong>
          <div class="health__meta">
            <b>{{ health.grade.label }} · {{ scoreLabel }}</b>
            <span>{{ assessBoard?.passStoreCnt ?? 0 }}/{{ assessBoard?.storeCnt ?? 0 }} 合格店</span>
          </div>
        </div>
      </header>

      <div v-if="!hasAssessData" class="empty-panel">
        <strong>该周期暂无营运考核数据</strong>
        <p>请切换到 8.21–8.27 或 8.28–9.3（建议按周查看）。</p>
      </div>

      <div v-else class="tab-body">
        <OpsTabOverview
          v-if="activeTab === 'overview'"
          :date-key="assessKey"
          :city="city"
          :store-id="storeId"
        />
        <OpsTabResult
          v-else-if="activeTab === 'result'"
          :date-key="assessKey"
          :city="city"
          :store-id="storeId"
        />
        <OpsTabTraffic
          v-else-if="activeTab === 'traffic'"
          :date-key="assessKey"
          :city="city"
          :store-id="storeId"
          :store-hint="storeHint"
        />
        <OpsTabSupply
          v-else-if="activeTab === 'supply'"
          :date-key="assessKey"
          :city="city"
          :store-id="storeId"
          :store-hint="storeHint"
        />
        <OpsTabReverse
          v-else-if="activeTab === 'reverse'"
          :date-key="assessKey"
          :store-id="storeId"
          :store-hint="storeHint"
        />
        <OpsTabCoach
          v-else-if="activeTab === 'coach'"
          :watch-stores="watchStores"
          :week-label="assessWeekLabel"
          :fail-tags="failTags"
        />
        <OpsTabPlaceholder
          v-else
          :title="currentTab?.label || ''"
          :hint="currentTab?.hint || ''"
          :source="currentTab?.source || ''"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import DateFilterBar from './DateFilterBar.vue'
import DashSelect from './DashSelect.vue'
import { useOpsAssessment } from '../composables/useOpsAssessment'
import OpsTabOverview from './ops-tabs/OpsTabOverview.vue'
import OpsTabResult from './ops-tabs/OpsTabResult.vue'
import OpsTabTraffic from './ops-tabs/OpsTabTraffic.vue'
import OpsTabSupply from './ops-tabs/OpsTabSupply.vue'
import OpsTabReverse from './ops-tabs/OpsTabReverse.vue'
import OpsTabCoach from './ops-tabs/OpsTabCoach.vue'
import OpsTabPlaceholder from './ops-tabs/OpsTabPlaceholder.vue'
import '../styles/ops-theme.scss'

const emit = defineEmits<{ 'switch-view': []; 'switch-edition': [] }>()

type TabDef = {
  id: string
  no: string
  label: string
  desc: string
  soon: boolean
  hint?: string
  source?: string
}

const tabs: TabDef[] = [
  {
    id: 'overview',
    no: '01',
    label: '门店运营质量',
    desc: '履约五项是否过线',
    soon: false,
  },
  {
    id: 'result',
    no: '02',
    label: '经营结果',
    desc: '门店×渠道 · 规模利润可视化',
    soon: false,
  },
  {
    id: 'traffic',
    no: '03',
    label: '流量与活动',
    desc: '漏斗与来源效率',
    soon: false,
  },
  {
    id: 'supply',
    no: '04',
    label: '商品供给',
    desc: '出勤·缺货损失·组套',
    soon: false,
  },
  {
    id: 'reverse',
    no: '05',
    label: '逆向客诉',
    desc: '退款·差评·缺货连带',
    soon: false,
  },
  {
    id: 'coach',
    no: '06',
    label: '门店辅导',
    desc: '本周盯哪些店',
    soon: false,
  },
]

type TabId = string
const activeTab = ref<TabId>('overview')
const currentTab = computed(() => tabs.find((t) => t.id === activeTab.value))

const {
  city,
  storeId,
  cityOptions,
  storeOptions,
  assessKey,
  hasAssessData,
  assessWeekLabel,
  storeCntText,
  assessBoard,
  headerScore,
  scoreLabel,
  health,
  watchStores,
  failTags,
} = useOpsAssessment()

const citySelectOptions = computed(() =>
  cityOptions.value.map((c) => ({ value: c, label: c === '全部' ? '全部城市' : c })),
)
const storeSelectOptions = computed(() => [
  { value: '全部', label: '全部门店' },
  ...storeOptions.value.map((s) => ({
    value: s.id,
    label: s.code ? `${s.shortName}（${s.code}）` : s.shortName,
  })),
])

const storeHint = computed(() => {
  if (storeId.value === '全部') return ''
  return storeOptions.value.find((s) => s.id === storeId.value)?.shortName || storeId.value
})

const GRADE_SOFT: Record<string, string> = {
  S: '#10b981',
  A: '#1d6bff',
  B: '#f59e0b',
  C: '#f97316',
  D: '#ef4444',
}
function softGrade(g: string) {
  return GRADE_SOFT[g] || '#1d6bff'
}
</script>

<style scoped lang="scss">
.ops-tabs {
  min-height: 100vh;
  display: grid;
  grid-template-columns: 196px minmax(0, 1fr);
  background: var(--ops-bg);
  color: var(--ops-text);
  font-family: var(--ops-font);
}
.ops-tabs__nav {
  background: var(--ops-nav);
  color: #fff;
  display: flex;
  flex-direction: column;
  padding: 18px 10px 14px;
  min-height: 100vh;
  position: sticky;
  top: 0;
}
.nav-brand {
  display: flex;
  gap: 10px;
  align-items: center;
  padding: 2px 8px 18px;
  b {
    width: 34px;
    height: 34px;
    border-radius: 9px;
    display: grid;
    place-items: center;
    background: var(--ops-nav-active);
    color: #fff;
    font-weight: 800;
    font-size: 14px;
  }
  strong {
    display: block;
    font-size: 14px;
    color: #fff;
    font-weight: 700;
  }
  span {
    font-size: 11px;
    color: var(--ops-nav-text);
  }
}
.nav-switch {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin: 0 0 12px;
  padding: 0 0 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  .link {
    border: 0;
    background: transparent;
    color: var(--ops-nav-text);
    text-align: left;
    padding: 8px 10px;
    border-radius: 8px;
    cursor: pointer;
    font-size: 15px;
    font-weight: 600;
    &:hover {
      background: rgba(255, 255, 255, 0.06);
      color: #e2e8f0;
    }
  }
}
nav {
  display: flex;
  flex-direction: column;
  gap: 2px;
  button {
    display: grid;
    grid-template-columns: 28px 1fr auto;
    align-items: center;
    gap: 4px;
    text-align: left;
    border: 0;
    background: transparent;
    color: var(--ops-nav-text);
    border-radius: 8px;
    padding: 10px 10px;
    cursor: pointer;
    font-size: 13px;
    transition: background 0.15s ease, color 0.15s ease;
    em {
      font-style: normal;
      font-size: 11px;
      color: #64748b;
      font-family: var(--ops-font-num);
      font-weight: 600;
    }
    i {
      font-style: normal;
      font-size: 10px;
      padding: 2px 5px;
      border-radius: 4px;
      background: rgba(255, 255, 255, 0.08);
      color: #94a3b8;
    }
    &:hover {
      background: rgba(255, 255, 255, 0.06);
      color: #e2e8f0;
    }
    &.active {
      background: var(--ops-nav-active);
      color: #fff;
      font-weight: 700;
      em {
        color: rgba(255, 255, 255, 0.85);
      }
      i {
        background: rgba(255, 255, 255, 0.2);
        color: #fff;
      }
    }
    &.soon:not(.active) {
      opacity: 0.72;
    }
  }
}
.ops-tabs__main {
  min-width: 0;
  padding: 16px 20px 28px;
  background: var(--ops-bg);
}
.topbar {
  display: flex;
  align-items: center;
  gap: 12px 14px;
  margin-bottom: 12px;
  padding: 8px 12px;
  border-radius: var(--ops-radius);
  background: var(--ops-surface);
  border: 1px solid var(--ops-border);
  box-shadow: var(--ops-shadow);
  min-height: 44px;
  h1 {
    margin: 0;
    flex-shrink: 0;
    font-size: 16px;
    font-weight: 800;
    color: var(--ops-text);
    letter-spacing: 0.01em;
    white-space: nowrap;
  }
}
.topbar__filters {
  display: flex;
  flex: 1;
  flex-wrap: nowrap;
  align-items: center;
  gap: 8px;
  min-width: 0;
  overflow-x: auto;
  :deep(.date-bar.light .seg button) {
    height: 30px;
    padding: 0 10px;
    font-size: 12px;
  }
  :deep(.date-bar.light .ctrl-date),
  :deep(.date-bar.light .ctrl-select),
  :deep(.date-bar.light .ctrl-select--week),
  :deep(.date-bar.light .ctrl-select--month) {
    height: 30px;
  }
  :deep(.dash-select.light .dash-select__trigger) {
    height: 30px;
    font-size: 12px;
    padding: 0 28px 0 10px;
  }
  :deep(.filter__select) {
    font-size: 12px;
  }
}
.filter-divider {
  width: 1px;
  height: 18px;
  background: var(--ops-border);
  flex-shrink: 0;
}
.filter {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  color: var(--ops-muted);
  white-space: nowrap;
  span {
    flex-shrink: 0;
  }
  :deep(.filter__select) {
    min-width: 96px;
  }
  :deep(.filter__select--store) {
    min-width: 140px;
  }
  select {
    min-width: 96px;
    height: 30px;
    border: 1px solid var(--ops-border);
    border-radius: 6px;
    padding: 0 8px;
    color: var(--ops-text);
    font-weight: 600;
    font-size: 12px;
    background: #fff;
    box-sizing: border-box;
  }
}
.health {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: auto;
  padding: 4px 10px 4px 6px;
  border-radius: 8px;
  background: #f8fbff;
  border: 1px solid #dbeafe;
  flex-shrink: 0;
  &__grade {
    width: 24px;
    height: 24px;
    border-radius: 6px;
    display: grid;
    place-items: center;
    font-weight: 800;
    background: #fff;
    border: 1px solid #bfdbfe;
    font-family: var(--ops-font-num);
    font-size: 12px;
  }
  strong {
    font-size: 18px;
    font-family: var(--ops-font-num);
    line-height: 1;
    color: var(--ops-num);
    font-variant-numeric: tabular-nums;
    font-weight: 800;
  }
  &__meta {
    b {
      display: block;
      font-size: 11px;
      font-weight: 700;
      color: var(--ops-text);
      line-height: 1.2;
    }
    span {
      font-size: 10px;
      color: var(--ops-muted);
      line-height: 1.2;
    }
  }
  &.ok strong {
    color: var(--ops-ok);
  }
  &.warn strong {
    color: var(--ops-warn);
  }
}
.empty-panel {
  margin-top: 20px;
  padding: 28px;
  text-align: center;
  background: var(--ops-surface);
  border-radius: var(--ops-radius);
  border: 1px dashed var(--ops-border);
  strong {
    display: block;
    color: var(--ops-text);
    margin-bottom: 6px;
  }
  p {
    margin: 0;
    color: var(--ops-muted);
  }
}
.tab-body {
  min-width: 0;
}
@media (max-width: 1100px) {
  .ops-tabs {
    grid-template-columns: 1fr;
  }
  .ops-tabs__nav {
    position: relative;
    min-height: auto;
    nav {
      flex-direction: row;
      flex-wrap: wrap;
    }
  }
}
</style>
