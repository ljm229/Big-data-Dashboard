<template>
  <div class="ops-tabs">
    <aside class="ops-tabs__nav">
      <div class="nav-brand">
        <b>运</b>
        <div>
          <strong>门店运营</strong>
          <span>Tab 版 · 试对比</span>
        </div>
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

      <div class="nav-foot">
        <button type="button" class="link" @click="emit('switch-edition')">← 经典版</button>
        <button type="button" class="link" @click="emit('switch-view')">数据大屏</button>
      </div>
    </aside>

    <div class="ops-tabs__main">
      <header class="topbar">
        <div class="topbar__title">
          <h1>{{ currentTab?.label }}</h1>
          <p>{{ currentTab?.desc }} · {{ assessWeekLabel }} · {{ storeCntText }}</p>
        </div>

        <div class="topbar__filters">
          <DateFilterBar variant="light" scope="ops" />
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

        <div v-if="hasAssessData" class="health" :class="headerScore >= 60 ? 'ok' : 'warn'">
          <div class="health__grade" :style="{ color: health.grade.color }">{{ health.grade.grade }}</div>
          <strong>{{ headerScore }}</strong>
          <div>
            <b>{{ health.grade.label }} · {{ scoreLabel }}</b>
            <span>{{ assessBoard?.passStoreCnt ?? 0 }}/{{ assessBoard?.storeCnt ?? 0 }} 合格店</span>
          </div>
        </div>
      </header>

      <div v-if="!hasAssessData" class="empty-panel">
        <strong>该周期暂无营运考核数据</strong>
        <p>请切换到 8.21–8.27 或 8.28–9.3。</p>
      </div>

      <div v-else class="tab-body">
        <OpsTabOverview
          v-if="activeTab === 'overview'"
          :date-key="assessKey"
          :city="city"
          :store-id="storeId"
        />
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
import OpsTabSupply from './ops-tabs/OpsTabSupply.vue'
import OpsTabCoach from './ops-tabs/OpsTabCoach.vue'
import OpsTabPlaceholder from './ops-tabs/OpsTabPlaceholder.vue'

const emit = defineEmits<{ 'switch-view': []; 'switch-edition': [] }>()

const tabs = [
  { id: 'overview', no: '01', label: '营运总览', desc: '对齐营运周报 · 五项环比与改善建议', soon: false },
  {
    id: 'result',
    no: '02',
    label: '经营结果',
    desc: '规模与利润',
    soon: true,
    hint: '复用大屏经营 KPI、毛利与退款摘要',
    source: '经营分析-周/门店/城市',
  },
  {
    id: 'channel',
    no: '03',
    label: '渠道诊断',
    desc: '谁贡献、谁拖累',
    soon: true,
    hint: '渠道份额、毛利率、周异动与结论卡',
    source: '渠道门店周趋势',
  },
  {
    id: 'fulfill',
    no: '04',
    label: '履约服务',
    desc: '过程五项过线',
    soon: true,
    hint: '售罄/错漏拣/仓T/IM/商责深化拆解',
    source: '营运考核 + 履约明细（待补）',
  },
  { id: 'supply', no: '05', label: '商品供给', desc: '品类结构与毛利', soon: false },
  {
    id: 'reverse',
    no: '06',
    label: '逆向客诉',
    desc: '钱亏在哪',
    soon: true,
    hint: '商责、逆向原因/品类/金额',
    source: '逆向/问题单（待补）',
  },
  { id: 'coach', no: '07', label: '门店辅导', desc: '红线店与周事项', soon: false },
] as const

type TabId = (typeof tabs)[number]['id']
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
</script>

<style scoped lang="scss">
.ops-tabs {
  --primary: #2a5c82;
  --accent: #5b9bd5;
  --bg: #f3f6f9;
  --text: #3d3d3d;
  --muted: #8c8c8c;
  min-height: 100vh;
  display: grid;
  grid-template-columns: 200px minmax(0, 1fr);
  background: var(--bg);
  color: var(--text);
  font-family: 'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', sans-serif;
}
.ops-tabs__nav {
  background: linear-gradient(180deg, #1e4a6e, #2a5c82 40%, #1a3d5c);
  color: #fff;
  display: flex;
  flex-direction: column;
  padding: 16px 10px 12px;
  min-height: 100vh;
  position: sticky;
  top: 0;
}
.nav-brand {
  display: flex;
  gap: 10px;
  align-items: center;
  padding: 4px 8px 16px;
  b {
    width: 36px;
    height: 36px;
    border-radius: 10px;
    display: grid;
    place-items: center;
    background: rgba(255, 255, 255, 0.16);
  }
  strong {
    display: block;
    font-size: 14px;
  }
  span {
    font-size: 11px;
    opacity: 0.75;
  }
}
nav {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
  button {
    display: grid;
    grid-template-columns: 28px 1fr auto;
    align-items: center;
    gap: 6px;
    text-align: left;
    border: 0;
    background: transparent;
    color: rgba(255, 255, 255, 0.82);
    border-radius: 10px;
    padding: 10px 8px;
    cursor: pointer;
    font-size: 13px;
    em {
      font-style: normal;
      font-size: 11px;
      opacity: 0.7;
      font-family: Rajdhani, Bahnschrift, Consolas, monospace;
    }
    i {
      font-style: normal;
      font-size: 10px;
      padding: 1px 5px;
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.12);
      color: rgba(255, 255, 255, 0.7);
    }
    &.active {
      background: rgba(255, 255, 255, 0.18);
      color: #fff;
      font-weight: 700;
    }
    &.soon:not(.active) {
      opacity: 0.72;
    }
  }
}
.nav-foot {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-top: 12px;
  border-top: 1px solid rgba(255, 255, 255, 0.15);
  .link {
    border: 0;
    background: transparent;
    color: rgba(255, 255, 255, 0.85);
    text-align: left;
    padding: 8px;
    border-radius: 8px;
    cursor: pointer;
    font-size: 12px;
    &:hover {
      background: rgba(255, 255, 255, 0.1);
    }
  }
}
.ops-tabs__main {
  min-width: 0;
  padding: 14px 18px 24px;
}
.topbar {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
  margin-bottom: 14px;
  padding: 12px 14px;
  border-radius: 14px;
  background: #fff;
  border: 1px solid rgba(42, 92, 130, 0.08);
  box-shadow: 0 2px 10px rgba(42, 92, 130, 0.05);
}
.topbar__title {
  min-width: 160px;
  h1 {
    margin: 0;
    font-size: 18px;
    color: var(--primary);
  }
  p {
    margin: 4px 0 0;
    font-size: 12px;
    color: var(--muted);
  }
}
.topbar__filters {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  flex: 1;
}
.filter {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--muted);
  select {
    min-width: 100px;
    border: 1px solid #d7e2ec;
    border-radius: 8px;
    padding: 7px 9px;
    color: var(--primary);
    font-weight: 600;
    background: #fff;
  }
}
.health {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border-radius: 12px;
  background: #f0f6fb;
  margin-left: auto;
  &__grade {
    width: 32px;
    height: 32px;
    border-radius: 8px;
    display: grid;
    place-items: center;
    font-weight: 900;
    background: #fff;
    font-family: Rajdhani, Bahnschrift, Consolas, monospace;
  }
  strong {
    font-size: 28px;
    font-family: Rajdhani, Bahnschrift, Consolas, monospace;
    line-height: 1;
  }
  b {
    display: block;
    font-size: 12px;
    color: var(--primary);
  }
  span {
    font-size: 11px;
    color: var(--muted);
  }
  &.ok strong {
    color: #2f7d48;
  }
  &.warn strong {
    color: #c47d00;
  }
}
.empty-panel {
  margin-top: 20px;
  padding: 28px;
  text-align: center;
  background: #fff;
  border-radius: 12px;
  border: 1px dashed rgba(42, 92, 130, 0.3);
  strong {
    display: block;
    color: var(--primary);
    margin-bottom: 6px;
  }
  p {
    margin: 0;
    color: var(--muted);
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
