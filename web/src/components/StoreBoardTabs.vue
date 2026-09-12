<!-- 中文名：门店运营看板（分页版） -->
<template>
  <div class="ops-tabs ops-theme">
    <aside class="ops-tabs__nav">
      <div class="nav-brand">
        <b>运</b>
        <div>
          <strong>经营管理工作台</strong>
          <span>老板总览 · 主管诊断</span>
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
          :class="{ active: activeTab === t.id }"
          @click="activeTab = t.id"
        >
          <em>{{ t.no }}</em>
          <span>{{ t.label }}</span>
          <i :class="'status-' + t.status">{{ t.dataLabel }}</i>
        </button>
      </nav>

      <div class="nav-foot">
        <span>同一套数据，两种管理视角</span>
        <b>结果 → 诊断 → 辅导 → 复盘</b>
      </div>
    </aside>

    <div class="ops-tabs__main">
      <header class="topbar">
        <div class="topbar__row">
          <div class="page-heading">
            <h1>{{ currentTab?.label }}</h1>
            <p>{{ currentTab?.desc }}</p>
          </div>
          <div class="source-pill" :class="currentSourceTone">
            <i />{{ currentSourceLabel }}
            <span v-if="activeTab === 'overview' && updatedHint">{{ updatedHint }}</span>
          </div>
          <div class="role-switch" role="group" aria-label="看板视角">
            <button type="button" :class="{ active: viewRole === 'boss' }" @click="viewRole = 'boss'">
              老板视角
            </button>
            <button type="button" :class="{ active: viewRole === 'manager' }" @click="viewRole = 'manager'">
              主管视角
            </button>
          </div>
          <details v-if="activeTab === 'overview'" class="rules">
            <summary>考核规则</summary>
            <div class="rules__panel">
              <div class="rules__block">
                <b>合格标准</b>
                <ul>
                  <li v-for="d in assessDefs" :key="d.key">
                    {{ d.shortName }}
                    {{ d.lowerBetter ? '≤' : '≥' }}{{ d.passLine }}{{ d.unit === 'min' ? '' : '%' }}
                  </li>
                </ul>
              </div>
              <div class="rules__block">
                <b>综合打分</b>
                <p>满分 100 = 售罄 40% + 错漏拣 20% + 仓配 10% + 商责 20% + 回复 10%</p>
              </div>
              <div class="rules__block">
                <b>等级划分</b>
                <p>
                  <span v-for="g in gradeRules" :key="g.grade" class="rules__grade" :class="'g-' + g.grade">
                    {{ g.grade }} {{ g.label }} {{ g.min }}–{{ g.max }}
                  </span>
                </p>
              </div>
            </div>
          </details>
        </div>
          <div class="filter-toolbar">
            <DateFilter variant="light" scope="ops" />
            <label class="filter">
              <span>城市</span>
              <SelectMenu
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
              <SelectMenu
                class="filter__select filter__select--store"
                variant="light"
                :model-value="storeId"
                :options="storeSelectOptions"
                search-placeholder="搜索门店名/编码"
                @update:model-value="storeId = $event"
              />
            </label>
          </div>
          <div class="role-brief">
            <div>
              <b>{{ viewRole === 'boss' ? '老板关注' : '主管关注' }}</b>
              <span>{{ roleDescription }}</span>
            </div>
            <ul>
              <li v-for="item in roleFocus" :key="item">{{ item }}</li>
            </ul>
            <small v-if="viewRole === 'manager'">当前通过城市和门店筛选查看；接入主管—门店映射后自动限定管辖范围。</small>
          </div>
      </header>

      <div v-if="activeTab === 'overview' && !hasAssessData" class="empty-panel">
        <strong>该周期暂无营运考核数据</strong>
      </div>

      <div v-else class="tab-body">
        <OverviewPage
          v-if="activeTab === 'overview'"
          :date-key="assessKey"
          :city="city"
          :store-id="storeId"
        />
        <ResultPage
          v-else-if="activeTab === 'result'"
          :date-key="assessKey"
          :city="city"
          :store-id="storeId"
        />
        <TrafficPage
          v-else-if="activeTab === 'traffic'"
          :date-key="assessKey"
          :city="city"
          :store-id="storeId"
          :store-hint="storeHint"
        />
        <PromoPage
          v-else-if="activeTab === 'promo'"
          :date-key="assessKey"
          :store-id="storeId"
          :store-hint="storeHint"
        />
        <SupplyPage
          v-else-if="activeTab === 'supply'"
          :date-key="assessKey"
          :city="city"
          :store-id="storeId"
          :store-hint="storeHint"
        />
        <ReturnPage
          v-else-if="activeTab === 'reverse'"
          :date-key="assessKey"
          :city="city"
          :store-id="storeId"
          :store-hint="storeHint"
        />
        <CoachPage
          v-else-if="activeTab === 'coach'"
          :watch-stores="watchStores"
          :week-label="assessWeekLabel"
          :fail-tags="failTags"
        />
        <EmptyPage v-else :title="currentTab?.label || ''" hint="" source="" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import DateFilter from './DateFilter.vue'
import SelectMenu from './SelectMenu.vue'
import { useStoreScore } from '../composables/useStoreScore'
import OverviewPage from './store-pages/OverviewPage.vue'
import ResultPage from './store-pages/ResultPage.vue'
import TrafficPage from './store-pages/TrafficPage.vue'
import PromoPage from './store-pages/PromoPage.vue'
import SupplyPage from './store-pages/SupplyPage.vue'
import ReturnPage from './store-pages/ReturnPage.vue'
import CoachPage from './store-pages/CoachPage.vue'
import EmptyPage from './store-pages/EmptyPage.vue'
import { ASSESS_DEFS, GRADE_RULES } from '../utils/opsAssessment'
import '../styles/ops-theme.scss'

const emit = defineEmits<{ 'switch-view': []; 'switch-edition': [] }>()

type TabDef = {
  id: string
  no: string
  label: string
  desc: string
  status: 'ready' | 'partial' | 'pending'
  dataLabel: string
}

/** 分析路径：结果定性 → 流量断点 → 推广投放 → 供给/逆向下钻 → 辅导闭环；01 履约质量保持不变 */
const tabs: TabDef[] = [
  {
    id: 'overview',
    no: '01',
    label: '门店运营质量',
    desc: '履约五项是否过线',
    status: 'ready',
    dataLabel: '已接入',
  },
  {
    id: 'result',
    no: '02',
    label: '经营结果',
    desc: '订单 / 实付 / 毛利是否达标',
    status: 'partial',
    dataLabel: '可展示',
  },
  {
    id: 'traffic',
    no: '03',
    label: '流量与转化',
    desc: 'UV · P1进店 · P2下单断点',
    status: 'partial',
    dataLabel: '已接入',
  },
  {
    id: 'promo',
    no: '04',
    label: '推广消耗',
    desc: '费用趋势 · 活动产出 · 拉新',
    status: 'partial',
    dataLabel: '可分析',
  },
  {
    id: 'supply',
    no: '05',
    label: '商品供给',
    desc: '品类 · 数量 · 缺货损失下钻',
    status: 'partial',
    dataLabel: '已接入',
  },
  {
    id: 'reverse',
    no: '06',
    label: '逆向客诉',
    desc: '逆向原因 · 配送异常 · 客诉商品',
    status: 'ready',
    dataLabel: '已接入',
  },
  {
    id: 'coach',
    no: '07',
    label: '门店辅导',
    desc: '按断点打标签 · 本周盯店动作',
    status: 'partial',
    dataLabel: '待任务闭环',
  },
]

type TabId = string
const activeTab = ref<TabId>('overview')
const viewRole = ref<'boss' | 'manager'>('boss')
const currentTab = computed(() => tabs.find((t) => t.id === activeTab.value))

const sourceCopy: Record<string, { label: string; tone: string }> = {
  result: { label: '经营趋势与渠道门店数据', tone: 'static' },
  traffic: { label: '流量分来源 · 30 日明细', tone: 'static' },
  promo: { label: '推广费用趋势 + 活动明细', tone: 'static' },
  supply: { label: '商品销售、退款与缺货明细', tone: 'static' },
  reverse: { label: '逆向订单 + 配送异常明细', tone: 'static' },
  coach: { label: '质量评分可用 · 辅导任务待接', tone: 'partial' },
}

const currentSourceLabel = computed(() => {
  if (activeTab.value !== 'overview') return sourceCopy[activeTab.value]?.label || '数据口径待确认'
  if (dataSource.value === 'database') return '数据库 · 门店营运质量'
  if (dataSource.value === 'static') return '静态包 · 门店营运质量'
  return '门店营运质量数据库暂未连接'
})

const currentSourceTone = computed(() => {
  if (activeTab.value !== 'overview') return sourceCopy[activeTab.value]?.tone || 'pending'
  return dataSource.value
})

const roleDescriptions: Record<'boss' | 'manager', string> = {
  boss: '先判断整体是否达标，再定位区域、主管和风险门店。',
  manager: '先看负责门店的异常，再下钻原因并形成当天动作。',
}
const roleDescription = computed(() => roleDescriptions[viewRole.value])

const focusMap: Record<'boss' | 'manager', Record<string, string[]>> = {
  boss: {
    overview: ['健康门店率', '主管对比', '风险门店'],
    result: ['经营规模', '环比趋势', '门店贡献'],
    traffic: ['整体漏斗', '来源结构', '转化短板'],
    promo: ['总消耗', '投产效率', '预算风险'],
    supply: ['供给健康', '缺货损失', '品类风险'],
    reverse: ['退款损失', '原因结构', '风险门店'],
    coach: ['覆盖率', '完成率', '改善率'],
  },
  manager: {
    overview: ['门店扣分项', '未达标指标', '优先处理店'],
    result: ['目标缺口', '下降门店', '渠道原因'],
    traffic: ['低转化门店', '低效来源', '改善动作'],
    promo: ['计划异常', '预算进度', '调价复查'],
    supply: ['缺货商品', '低动销商品', '补货清单'],
    reverse: ['异常订单', '责任原因', '处理时效'],
    coach: ['今日待办', '责任人', '复查结果'],
  },
}
const roleFocus = computed(() => focusMap[viewRole.value][activeTab.value] || [])

const {
  city,
  storeId,
  cityOptions,
  storeOptions,
  assessKey,
  hasAssessData,
  assessWeekLabel,
  updatedHint,
  dataSource,
  watchStores,
  failTags,
} = useStoreScore()

const citySelectOptions = computed(() =>
  cityOptions.value.map((c) => ({ value: c, label: c === '全部' ? '全部城市' : c })),
)
const storeSelectOptions = computed(() => [
  { value: '全部', label: '全部门店' },
  ...storeOptions.value.map((s) => ({
    value: s.id,
    label: s.shortName,
  })),
])

const storeHint = computed(() => {
  if (storeId.value === '全部') return ''
  return storeOptions.value.find((s) => s.id === storeId.value)?.shortName || storeId.value
})

const assessDefs = ASSESS_DEFS
const gradeRules = GRADE_RULES
</script>

<style scoped lang="scss">
.ops-tabs {
  min-height: 100vh;
  display: grid;
  grid-template-columns: 228px minmax(0, 1fr);
  background:
    radial-gradient(circle at 10% 0%, rgba(29, 107, 255, 0.1), transparent 36%),
    radial-gradient(circle at 92% 8%, rgba(34, 211, 238, 0.08), transparent 34%),
    linear-gradient(180deg, var(--ops-bg-top) 0%, var(--ops-bg) 48%, var(--ops-bg-bottom) 100%);
  color: var(--ops-text);
  font-family: var(--ops-font);
}
.ops-tabs__nav {
  background: linear-gradient(180deg, #ffffff 0%, #f4f8ff 100%);
  color: var(--ops-text);
  display: flex;
  flex-direction: column;
  padding: 18px 12px 16px;
  min-height: 100vh;
  position: sticky;
  top: 0;
  border-right: 1px solid var(--ops-line);
  box-shadow: none;
}
.nav-brand {
  display: flex;
  gap: 10px;
  align-items: center;
  padding: 2px 8px 16px;
  b {
    width: 36px;
    height: 36px;
    border-radius: 12px;
    display: grid;
    place-items: center;
    background: linear-gradient(145deg, #38bdf8, #1d6bff 55%, #0b3d91);
    color: #fff;
    font-weight: 800;
    font-size: 14px;
    box-shadow: 0 4px 14px rgba(29, 107, 255, 0.35);
  }
  strong {
    display: block;
    font-size: 14px;
    color: var(--ops-text);
    font-weight: 800;
  }
  span {
    font-size: 11px;
    color: var(--ops-muted);
  }
}
.nav-switch {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin: 0 0 14px;
  padding: 0 0 14px;
  border-bottom: 1px solid var(--ops-border-soft);
  .link {
    border: 1px solid transparent;
    background: transparent;
    color: var(--ops-muted);
    text-align: left;
    padding: 8px 10px;
    border-radius: 999px;
    cursor: pointer;
    font-size: 13px;
    font-weight: 600;
    transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease;
    &:hover {
      background: var(--ops-nav-hover);
      color: var(--ops-primary);
      border-color: #bfdbfe;
    }
  }
}
nav {
  display: flex;
  flex-direction: column;
  gap: 4px;
  button {
    display: grid;
    grid-template-columns: 28px 1fr auto;
    align-items: center;
    gap: 4px;
    text-align: left;
    border: 1px solid transparent;
    background: transparent;
    color: var(--ops-nav-text);
    border-radius: 12px;
    padding: 10px 10px;
    cursor: pointer;
    font-size: 13px;
    transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease;
    em {
      font-style: normal;
      font-size: 11px;
      color: #94a3b8;
      font-family: var(--ops-font-num);
      font-weight: 600;
    }
    i {
      font-style: normal;
      font-size: 10px;
      padding: 2px 6px;
      border-radius: 999px;
      background: #f1f5f9;
      color: #94a3b8;
      white-space: nowrap;
      &.status-ready {
        color: #059669;
        background: #ecfdf5;
      }
      &.status-partial {
        color: #b45309;
        background: #fffbeb;
      }
      &.status-pending {
        color: #64748b;
        background: #f1f5f9;
      }
    }
    &:hover {
      background: var(--ops-nav-hover);
      color: var(--ops-primary);
      border-color: #dbeafe;
    }
    &.active {
      background: linear-gradient(135deg, #1d6bff, #0ea5e9);
      color: #fff;
      font-weight: 700;
      border-color: transparent;
      box-shadow: 0 6px 16px rgba(29, 107, 255, 0.28);
      em {
        color: rgba(255, 255, 255, 0.88);
      }
      i {
        background: rgba(255, 255, 255, 0.22);
        color: #fff;
      }
    }
  }
}
.nav-foot {
  margin-top: auto;
  padding: 14px 10px 2px;
  border-top: 1px solid var(--ops-border-soft);
  span,
  b {
    display: block;
  }
  span {
    color: var(--ops-muted);
    font-size: 11px;
  }
  b {
    margin-top: 5px;
    color: var(--ops-primary-deep);
    font-size: 12px;
  }
}
.ops-tabs__main {
  min-width: 0;
  padding: 16px 20px 28px;
  background: transparent;
}

.source-pill {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 6px 10px;
  border: 0;
  border-radius: 999px;
  color: #64748b;
  background: #f1f5f9;
  font-size: 12px;
  white-space: nowrap;
  flex-shrink: 1;
  min-width: 0;
  i {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: #94a3b8;
    flex-shrink: 0;
  }
  span {
    color: #64748b;
  }
  &.database,
  &.static {
    color: #059669;
    background: #ecfdf5;
    i {
      background: #10b981;
      box-shadow: none;
    }
  }
  &.partial {
    color: #b45309;
    background: #fffbeb;
    i { background: #f59e0b; }
  }
  &.pending {
    color: #64748b;
    background: #f1f5f9;
    i { background: #94a3b8; }
  }
}
.topbar {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 12px;
  margin-bottom: 14px;
  padding: 14px 16px;
  border-radius: 16px;
  background: linear-gradient(135deg, #ffffff 0%, #f4f8ff 100%);
  border: 1px solid var(--ops-line);
  box-shadow: var(--ops-shadow-lg);
  h1 {
    margin: 0;
    flex-shrink: 0;
    font-size: 18px;
    font-weight: 800;
    color: var(--ops-text);
    letter-spacing: 0.01em;
    white-space: nowrap;
  }
}
.topbar__row {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}
.page-heading {
  min-width: 180px;
  p {
    margin: 3px 0 0;
    color: var(--ops-muted);
    font-size: 12px;
  }
}
.role-switch {
  display: inline-flex;
  margin-left: auto;
  padding: 3px;
  border-radius: 10px;
  background: #eef2f7;
  button {
    border: 0;
    border-radius: 8px;
    padding: 7px 12px;
    background: transparent;
    color: var(--ops-muted);
    cursor: pointer;
    font-size: 12px;
    font-weight: 700;
    &.active {
      color: #fff;
      background: var(--ops-primary);
      box-shadow: 0 3px 10px rgba(29, 107, 255, 0.22);
    }
  }
}
.role-brief {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 10px;
  background: #f8fafc;
  border: 1px solid var(--ops-border-soft);
  > div {
    min-width: 260px;
    b,
    span { display: block; }
    b { color: var(--ops-primary-deep); font-size: 12px; }
    span { margin-top: 2px; color: var(--ops-text-2); font-size: 12px; }
  }
  ul {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin: 0;
    padding: 0;
    list-style: none;
    li {
      padding: 4px 8px;
      border-radius: 999px;
      background: var(--ops-primary-soft);
      color: var(--ops-primary);
      font-size: 11px;
      font-weight: 700;
    }
  }
  small {
    margin-left: auto;
    color: var(--ops-muted);
    font-size: 11px;
    text-align: right;
    max-width: 260px;
  }
}
.filter-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
  width: 100%;
  min-width: 0;
  padding: 10px 0 0;
  border-top: 1px solid rgba(219, 227, 239, 0.9);
  background: transparent;
  :deep(.date-bar) {
    flex-shrink: 0;
    gap: 8px;
  }
  :deep(.date-bar.light .seg) {
    border: 1px solid var(--ops-line);
    background: #f8fafc;
    gap: 0;
    border-radius: 999px;
    overflow: hidden;
  }
  :deep(.date-bar.light .seg button) {
    height: 34px;
    padding: 0 14px;
    font-size: 13px;
    border-radius: 0;
    color: var(--ops-muted);
    background: transparent;
  }
  :deep(.date-bar.light .seg button:hover) {
    background: #eff6ff;
    color: var(--ops-primary);
  }
  :deep(.date-bar.light .seg button.active) {
    color: #fff;
    background: linear-gradient(135deg, #1d6bff, #0ea5e9);
    box-shadow: 0 4px 14px rgba(29, 107, 255, 0.28);
    font-weight: 700;
  }
  :deep(.date-bar.light .ctrl-date),
  :deep(.date-bar.light .ctrl-select),
  :deep(.date-bar.light .ctrl-select--week),
  :deep(.date-bar.light .ctrl-select--month) {
    height: 34px;
  }
  :deep(.dash-date.light .dash-date__trigger),
  :deep(.dash-select.light .dash-select__trigger) {
    height: 34px;
    border: 1px solid var(--ops-line) !important;
    background: #fff !important;
    box-shadow: none;
    font-size: 13px;
    padding: 0 10px;
    border-radius: 8px;
    color: var(--ops-text);
    font-weight: 600;
  }
  :deep(.dash-date.light .dash-date__trigger:hover),
  :deep(.dash-select.light .dash-select__trigger:hover),
  :deep(.dash-select.light.open .dash-select__trigger),
  :deep(.dash-date.light.open .dash-date__trigger) {
    border-color: #93c5fd !important;
    background: #eff6ff !important;
  }
  :deep(.filter__select) {
    font-size: 13px;
  }
}
.filter {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--ops-muted);
  white-space: nowrap;
  flex-shrink: 0;
  padding: 0 4px;
  span {
    flex-shrink: 0;
  }
  :deep(.filter__select) {
    min-width: 96px;
  }
  :deep(.filter__select--store) {
    min-width: 140px;
  }
}
.rules {
  position: relative;
  margin-left: auto;
  flex-shrink: 0;
  summary {
    list-style: none;
    cursor: pointer;
    user-select: none;
    height: 34px;
    padding: 0 14px;
    border-radius: 999px;
    border: 1px solid var(--ops-line);
    background: #f8fafc;
    color: var(--ops-primary);
    font-size: 13px;
    font-weight: 700;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    &::-webkit-details-marker {
      display: none;
    }
    &::after {
      content: '▾';
      font-size: 11px;
      color: var(--ops-muted);
    }
    &:hover {
      border-color: #93c5fd;
      background: #eff6ff;
      color: var(--ops-primary);
    }
  }
  &[open] summary {
    border-color: #93c5fd;
    background: #eff6ff;
    color: var(--ops-primary);
  }
  &[open] summary::after {
    content: '▴';
  }
  &__panel {
    position: absolute;
    right: 0;
    top: calc(100% + 8px);
    z-index: 40;
    width: min(420px, 72vw);
    padding: 14px;
    border-radius: 12px;
    background: #fff;
    border: 1px solid var(--ops-line);
    box-shadow: 0 10px 28px rgba(15, 55, 120, 0.12);
    display: grid;
    gap: 12px;
  }
  &__block {
    b {
      display: block;
      font-size: 12px;
      color: var(--ops-text);
      margin-bottom: 6px;
    }
    ul {
      margin: 0;
      padding: 0;
      list-style: none;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 4px 12px;
    }
    li,
    p {
      margin: 0;
      font-size: 12px;
      color: var(--ops-text-2);
      line-height: 1.5;
    }
  }
  &__grade {
    display: inline-block;
    margin: 0 6px 4px 0;
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 600;
    background: #f1f5f9;
    color: var(--ops-text-2);
    &.g-S {
      background: var(--ops-ok-bg);
      color: var(--ops-ok);
    }
    &.g-A {
      background: var(--ops-primary-soft);
      color: var(--ops-primary);
    }
    &.g-B {
      background: #f5f3ff;
      color: #8b5cf6;
    }
    &.g-C {
      background: var(--ops-warn-bg);
      color: var(--ops-warn);
    }
    &.g-D {
      background: var(--ops-bad-bg);
      color: var(--ops-bad);
    }
  }
}
.empty-panel {
  margin-top: 20px;
  padding: 28px;
  text-align: center;
  background: #fff;
  border-radius: 14px;
  border: 1px dashed rgba(29, 107, 255, 0.28);
  box-shadow: var(--ops-shadow);
  strong {
    display: block;
    color: var(--ops-primary);
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
    border-right: 0;
    border-bottom: 1px solid var(--ops-nav-border);
    box-shadow: none;
    nav {
      flex-direction: row;
      flex-wrap: wrap;
    }
  }
}
</style>
