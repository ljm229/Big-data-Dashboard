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
        <div class="topbar__row">
          <h1>{{ currentTab?.label }}</h1>
          <div v-if="hasAssessData" class="health" :class="headerScore >= 60 ? 'ok' : 'warn'">
            <div class="health__grade" :style="{ color: softGrade(health.grade.grade) }">
              {{ health.grade.grade }}
            </div>
            <strong>{{ headerScore }}</strong>
            <div>
              <b>{{ health.grade.label }} · {{ scoreLabel }}</b>
              <span>{{ assessBoard?.passStoreCnt ?? 0 }}/{{ assessBoard?.storeCnt ?? 0 }} 合格店</span>
            </div>
          </div>
        </div>

        <div class="topbar__filters">
          <DateFilterBar variant="light" scope="ops" />
          <div class="filter-divider" />
          <label class="filter">
            <span>城市</span>
            <select v-model="city">
              <option v-for="c in cityOptions" :key="c" :value="c">{{ c }}</option>
            </select>
          </label>
          <label class="filter">
            <span>门店</span>
            <select v-model="storeId">
              <option value="全部">全部门店</option>
              <option v-for="s in storeOptions" :key="s.id" :value="s.id">{{ s.shortName }}</option>
            </select>
          </label>
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
        <OpsTabTraffic v-else-if="activeTab === 'traffic'" />
        <OpsTabSupply v-else-if="activeTab === 'supply'" :date-key="assessKey" :city="city" :store-id="storeId" />
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
import { useOpsAssessment } from '../composables/useOpsAssessment'
import OpsTabOverview from './ops-tabs/OpsTabOverview.vue'
import OpsTabResult from './ops-tabs/OpsTabResult.vue'
import OpsTabTraffic from './ops-tabs/OpsTabTraffic.vue'
import OpsTabSupply from './ops-tabs/OpsTabSupply.vue'
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
    desc: '漏斗与活动质量',
    soon: true,
    hint: '门店/汇总漏斗；商品流量明细回翱象',
    source: '现有大屏流量/活动字段（框架）',
  },
  {
    id: 'supply',
    no: '04',
    label: '商品供给',
    desc: '品类结构与毛利',
    soon: false,
  },
  {
    id: 'reverse',
    no: '05',
    label: '逆向客诉',
    desc: '退款与客诉',
    soon: true,
    hint: '门店退款摘要；负毛利订单明细回翱象',
    source: '逆向/问题单（待补）',
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

const GRADE_SOFT: Record<string, string> = {
  S: '#10b981',
  A: '#3b82f6',
  B: '#f59e0b',
  C: '#f97316',
  D: '#ef4444',
}
function softGrade(g: string) {
  return GRADE_SOFT[g] || '#3b82f6'
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
    font-size: 12px;
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
  flex-direction: column;
  gap: 12px;
  margin-bottom: 14px;
  padding: 14px 16px;
  border-radius: var(--ops-radius);
  background: var(--ops-surface);
  border: 1px solid var(--ops-border);
  box-shadow: var(--ops-shadow);
}
.topbar__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  h1 {
    margin: 0;
    font-size: 20px;
    font-weight: 800;
    color: var(--ops-text);
    letter-spacing: 0.01em;
  }
}
.topbar__filters {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 8px;
  background: #f8fafc;
  border: 1px solid var(--ops-border-soft);
}
.filter-divider {
  width: 1px;
  height: 22px;
  background: var(--ops-border);
  flex-shrink: 0;
}
.filter {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--ops-muted);
  span {
    flex-shrink: 0;
  }
  select {
    min-width: 108px;
    height: 32px;
    border: 1px solid var(--ops-border);
    border-radius: 6px;
    padding: 0 10px;
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
  gap: 10px;
  padding: 6px 12px;
  border-radius: 10px;
  background: var(--ops-primary-soft);
  flex-shrink: 0;
  &__grade {
    width: 30px;
    height: 30px;
    border-radius: 8px;
    display: grid;
    place-items: center;
    font-weight: 900;
    background: #fff;
    border: 1px solid var(--ops-border);
    font-family: var(--ops-font-num);
    font-size: 14px;
  }
  strong {
    font-size: 26px;
    font-family: var(--ops-font-num);
    line-height: 1;
    color: var(--ops-num);
    font-variant-numeric: tabular-nums;
  }
  b {
    display: block;
    font-size: 12px;
    color: var(--ops-text);
  }
  span {
    font-size: 11px;
    color: var(--ops-muted);
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
