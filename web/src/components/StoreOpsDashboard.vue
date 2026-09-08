<template>
  <div class="ops-page">
    <header class="ops-header">
      <div class="ops-header__top">
        <div class="ops-header__left">
          <div class="view-switch">
            <button type="button" @click="emit('switch-view')">数据大屏</button>
            <button type="button" class="active">门店运营·经典</button>
            <button type="button" @click="emit('switch-edition')">Tab 版</button>
          </div>
          <div class="brand">
            <div class="brand__mark">运</div>
            <div>
              <h1>营运核心考核</h1>
              <p>{{ assessWeekLabel }} · {{ storeCntText }}</p>
            </div>
          </div>
        </div>

        <div class="health" :class="headerScore >= 60 ? 'ok' : 'warn'">
          <div class="health__grade" :style="{ color: health.grade.color }">{{ health.grade.grade }}</div>
          <strong>{{ headerScore }}</strong>
          <div>
            <b>{{ health.grade.label }} · {{ scoreLabel }}</b>
            <span
              >合格门店 {{ assessBoard?.passStoreCnt ?? 0 }}/{{ assessBoard?.storeCnt ?? 0 }} · 指标
              {{ health.met }}/{{ health.total }} 项过线 · {{ updatedHint || '—' }}</span
            >
          </div>
        </div>
      </div>

      <div class="ops-header__filters">
        <DateFilterBar scope="ops" />
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
    </header>

    <div v-if="!hasAssessData" class="ops-empty">
      <strong>该周期暂无营运考核数据</strong>
      <p>可切换：按日（如 9/1–9/7）、按月查看 8 月整月，或历史考核周。</p>
    </div>

    <template v-else>
      <section class="kpi-grid">
        <AssessmentCard v-for="m in metrics" :key="m.key" :metric="m" />
      </section>

      <section class="grade-strip">
        <div v-for="g in gradeDist" :key="g.grade" class="grade-pill" :style="{ '--g': g.color }">
          <b>{{ g.grade }}</b>
          <span>{{ g.label }}</span>
          <em>{{ g.count }}</em>
        </div>
      </section>

      <div class="main-grid">
        <div class="main-left">
          <article class="card assess-rank">
            <header class="card__head">
              <div>
                <h2>门店考核榜</h2>
                <p>五维指标 + 加权综合分 · 不合格项标红</p>
              </div>
            </header>
            <div
              ref="rankWrapEl"
              class="rank-wrap"
              @mouseenter="rankPaused = true"
              @mouseleave="rankPaused = false"
            >
              <table class="rank-table">
                <thead>
                  <tr>
                    <th>门店</th>
                    <th>城市</th>
                    <th>售罄率</th>
                    <th>错漏拣</th>
                    <th>仓T</th>
                    <th>商责单</th>
                    <th>IM回复</th>
                    <th>综合分</th>
                    <th>等级</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="row in assessRows" :key="row.shortName">
                    <td class="name">{{ row.shortName }}</td>
                    <td>{{ row.city?.replace(/市$/, '') || '—' }}</td>
                    <td :class="{ bad: !partPass(row, 'sellout_rate'), muted: isMissing(row, 'sellout_rate') }">
                      {{ fmtPart(row, 'sellout_rate') }}
                    </td>
                    <td :class="{ bad: !partPass(row, 'pick_error_rate'), muted: isMissing(row, 'pick_error_rate') }">
                      {{ fmtPart(row, 'pick_error_rate') }}
                    </td>
                    <td :class="{ bad: !partPass(row, 'warehouse_t'), muted: isMissing(row, 'warehouse_t') }">
                      {{ fmtPart(row, 'warehouse_t') }}
                    </td>
                    <td
                      :class="{
                        bad: !partPass(row, 'merchant_issue_rate'),
                        muted: isMissing(row, 'merchant_issue_rate'),
                      }"
                    >
                      {{ fmtPart(row, 'merchant_issue_rate') }}
                    </td>
                    <td :class="{ bad: !partPass(row, 'im_reply_rate'), muted: isMissing(row, 'im_reply_rate') }">
                      {{ fmtPart(row, 'im_reply_rate') }}
                    </td>
                    <td class="score">{{ fmtScore(row) }}</td>
                    <td>
                      <em class="grade-tag" :style="{ background: row.grade.color }">{{ row.grade.grade }}</em>
                    </td>
                  </tr>
                </tbody>
              </table>
              <p v-if="!assessRows.length" class="empty">当前筛选下暂无门店</p>
            </div>
          </article>
        </div>

        <div class="side-col">
          <article class="card">
            <header class="card__head">
              <div>
                <h2>需关注门店</h2>
                <p>综合分 &lt; 60（C/D）</p>
              </div>
            </header>
            <div class="problem-list">
              <div v-for="s in watchStores" :key="s.shortName" class="problem">
                <div class="problem__head">
                  <b>{{ s.shortName }}</b>
                  <span>{{ s.composite.toFixed(0) }}分 · {{ s.grade.grade }}</span>
                </div>
                <div class="problem__tags">
                  <em v-for="tag in failTags(s)" :key="tag">{{ tag }}</em>
                </div>
              </div>
              <p v-if="!watchStores.length" class="empty">暂无 C/D 门店</p>
            </div>
          </article>

          <article class="card notice-card">
            <header class="card__head">
              <div>
                <h2>本周重要事项</h2>
                <p>{{ assessWeekLabel }} · 群通知清单</p>
              </div>
            </header>
            <div class="notice-empty">
              <strong>内容待录入</strong>
              <p>按周同步群内重点：整改 / 活动 / 红线店。字段：优先级 · 标题 · 负责人 · 截止 · 状态。</p>
            </div>
          </article>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import AssessmentCard, { type AssessMetric } from './AssessmentCard.vue'
import DateFilterBar from './DateFilterBar.vue'
import DashSelect from './DashSelect.vue'
import { useFilterStore, COCKPIT_WEEKS, COCKPIT_MONTHS } from '../stores/filter'
import {
  fetchAssessmentCityOptions,
  fetchAssessmentStoreOptions,
  hasAssessment,
  resolveAssessmentWeekId,
} from '../api/dashboard'
import dashRaw from '../data/dashboard.json'
import { fetchAssessmentBoard, healthFromMetrics, type AssessBoard } from '../api/opsDashboard'
import { GRADE_RULES, type AssessKey } from '../utils/opsAssessment'

const emit = defineEmits<{ 'switch-view': []; 'switch-edition': [] }>()

const filter = useFilterStore()
const { selectedDate, dataKey, loadingTick } = storeToRefs(filter)

const city = ref('全部')
const storeId = ref('全部')
const cityOptions = ref<string[]>(['全部'])
const storeOptions = ref<Array<{ id: string; shortName: string; code?: string }>>([])

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

const assessKey = computed(() => dataKey.value || selectedDate.value)
const hasAssessData = computed(() => hasAssessment(assessKey.value))
const updatedHint = String((dashRaw as { updated_at?: string }).updated_at || '').slice(0, 16)

const assessWeekLabel = computed(() => {
  const weekId = resolveAssessmentWeekId(assessKey.value)
  if (!weekId) return selectedDate.value
  if (weekId.startsWith('M:')) {
    const id = weekId.slice(2)
    const [y, mo] = id.split('-')
    return COCKPIT_MONTHS.find((m) => m.id === id)?.label || `${Number(y)}年${Number(mo)}月`
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(weekId)) {
    const [, m, d] = weekId.split('-')
    return `${Number(m)}月${Number(d)}日考核`
  }
  const fromCockpit = COCKPIT_WEEKS.find((x) => x.id === weekId)
  if (fromCockpit?.label) return fromCockpit.label
  const fromRaw = ((dashRaw as { weeks?: Array<{ id: string; label: string }> }).weeks || []).find(
    (x) => x.id === weekId,
  )
  if (fromRaw?.label) return fromRaw.label
  return weekId.replace('_', '～')
})
const storeCntText = computed(() => (assessBoard.value ? `${assessBoard.value.storeCnt} 家门店` : ''))

watch(city, () => {
  storeId.value = '全部'
})
watch([selectedDate, dataKey], () => {
  city.value = '全部'
  storeId.value = '全部'
})

const assessBoard = ref<AssessBoard | null>(null)
const metrics = ref<AssessMetric[]>([])
const assessRows = computed(() => assessBoard.value?.rows || [])

const isSingleStore = computed(() => storeId.value !== '全部' || (assessBoard.value?.storeCnt || 0) <= 1)
const headerScore = computed(() => {
  if (!assessBoard.value) return 0
  return Math.round(isSingleStore.value ? assessBoard.value.composite : assessBoard.value.medianComposite)
})
const scoreLabel = computed(() => (isSingleStore.value ? '综合分' : '门店中位分'))

const health = computed(() => healthFromMetrics(metrics.value, headerScore.value))

const gradeDist = computed(() =>
  GRADE_RULES.map((g) => ({
    ...g,
    count: assessRows.value.filter((r) => r.grade.grade === g.grade).length,
  })),
)

const watchStores = computed(() => assessRows.value.filter((r) => r.composite < 60).slice(0, 8))

function failTags(row: AssessBoard['rows'][number]) {
  return row.parts.filter((p) => !p.pass).map((p) => p.shortName)
}

function isMissing(row: AssessBoard['rows'][number], key: AssessKey) {
  return !!row.parts.find((x) => x.key === key)?.missing
}
function partPass(row: AssessBoard['rows'][number], key: AssessKey) {
  const p = row.parts.find((x) => x.key === key)
  if (!p || p.missing) return false
  return p.pass
}
function fmtPart(row: AssessBoard['rows'][number], key: AssessKey) {
  const p = row.parts.find((x) => x.key === key)
  if (!p || p.missing) return '--'
  if (p.unit === 'min') return p.value.toFixed(1)
  return p.value.toFixed(2) + '%'
}
function fmtScore(row: AssessBoard['rows'][number]) {
  if (row.parts.every((p) => p.missing)) return '--'
  return row.composite.toFixed(1)
}

const rankPaused = ref(false)
const rankWrapEl = ref<HTMLElement | null>(null)
let rankTimer: ReturnType<typeof setInterval> | null = null

function startRankScroll() {
  if (rankTimer) clearInterval(rankTimer)
  rankTimer = setInterval(() => {
    const el = rankWrapEl.value
    if (!el || rankPaused.value || assessRows.value.length <= 8) return
    const max = el.scrollHeight - el.clientHeight
    if (max <= 0) return
    const next = el.scrollTop + 40
    el.scrollTo({ top: next >= max ? 0 : next, behavior: 'smooth' })
  }, 2200)
}
onUnmounted(() => {
  if (rankTimer) clearInterval(rankTimer)
})

async function reloadFilters() {
  const key = assessKey.value
  cityOptions.value = await fetchAssessmentCityOptions(key)
  if (!cityOptions.value.includes(city.value)) city.value = '全部'
  storeOptions.value = await fetchAssessmentStoreOptions(key, city.value)
  if (storeId.value !== '全部' && !storeOptions.value.some((s) => s.id === storeId.value)) {
    storeId.value = '全部'
  }
}

async function reload() {
  if (!hasAssessData.value) {
    assessBoard.value = null
    metrics.value = []
    return
  }
  const board = await fetchAssessmentBoard(assessKey.value, city.value, storeId.value)
  assessBoard.value = board
  metrics.value = board?.metrics || []
  if (rankWrapEl.value) rankWrapEl.value.scrollTop = 0
  startRankScroll()
}

watch([city, storeId, selectedDate, dataKey, loadingTick], async () => {
  await reloadFilters()
  void reload()
})

void (async () => {
  await reloadFilters()
  void reload()
})()
</script>

<style scoped lang="scss">
.ops-page {
  --primary: #1d6bff;
  --primary-deep: #0b3d91;
  --accent: #22d3ee;
  --warn: #f59e0b;
  --good: #10b981;
  --bad: #ef4444;
  --text: #0f172a;
  --muted: #64748b;
  --card: #ffffff;
  --bg: #eef2f7;
  --line: #dbe3ef;
  min-height: 100vh;
  padding: 16px 20px 28px;
  background:
    radial-gradient(circle at 10% 0%, rgba(29, 107, 255, 0.1), transparent 36%),
    radial-gradient(circle at 92% 8%, rgba(34, 211, 238, 0.08), transparent 34%),
    linear-gradient(180deg, #f5f8fc 0%, var(--bg) 48%, #e8eef6 100%);
  color: var(--text);
  font-family: 'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', sans-serif;
}
.ops-empty {
  margin-top: 14px;
  padding: 28px 24px;
  border-radius: 14px;
  background: #fff;
  border: 1px dashed rgba(29, 107, 255, 0.28);
  text-align: center;
  strong {
    display: block;
    font-size: 18px;
    color: var(--primary);
    margin-bottom: 8px;
  }
  p {
    margin: 0;
    color: var(--muted);
  }
}
.ops-header {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 14px 16px;
  border-radius: 16px;
  background: linear-gradient(135deg, #ffffff 0%, #f4f8ff 100%);
  color: var(--text);
  border: 1px solid var(--line);
  box-shadow: 0 10px 28px rgba(15, 55, 120, 0.07);
}
.ops-header__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  min-width: 0;
}
.ops-header__left {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
  flex: 1 1 auto;
}
.ops-header__filters {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px 12px;
  padding-top: 10px;
  border-top: 1px solid rgba(219, 227, 239, 0.9);
}
.view-switch {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
  button {
    border: 1px solid var(--line);
    border-radius: 999px;
    padding: 7px 14px;
    color: var(--muted);
    background: #f8fafc;
    cursor: pointer;
    font-size: 13px;
    font-weight: 600;
    line-height: 1.2;
    white-space: nowrap;
    transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease;
    &:hover {
      border-color: #93c5fd;
      color: var(--primary);
    }
    &.active {
      color: #fff;
      background: linear-gradient(135deg, #1d6bff, #0ea5e9);
      border-color: transparent;
      font-weight: 700;
      box-shadow: 0 4px 14px rgba(29, 107, 255, 0.32);
    }
  }
}
.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  &__mark {
    width: 38px;
    height: 38px;
    border-radius: 12px;
    display: grid;
    place-items: center;
    font-weight: 800;
    color: #fff;
    background: linear-gradient(145deg, #38bdf8, #1d6bff 55%, #0b3d91);
    border: 0;
    box-shadow: 0 4px 14px rgba(29, 107, 255, 0.35);
  }
  h1 {
    margin: 0;
    font-size: 18px;
    font-weight: 800;
    color: var(--text);
  }
  p {
    margin: 2px 0 0;
    font-size: 12px;
    color: var(--muted);
    opacity: 1;
  }
}
.filter {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  span {
    opacity: 1;
    color: var(--muted);
  }
  select,
  :deep(.filter__select) {
    min-width: 108px;
  }
  :deep(.filter__select--store) {
    min-width: 160px;
  }
  select {
    border: 1px solid var(--line);
    border-radius: 8px;
    padding: 7px 9px;
    background: #fff;
    color: var(--text);
    font-weight: 600;
    font-size: 14px;
  }
}
.health {
  margin-left: 0;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 14px;
  border-radius: 14px;
  background: linear-gradient(135deg, #eff6ff, #ecfeff);
  border: 1px solid #bfdbfe;
  flex-shrink: 0;
  max-width: min(520px, 48%);
  &__grade {
    width: 36px;
    height: 36px;
    border-radius: 10px;
    display: grid;
    place-items: center;
    font-size: 20px;
    font-weight: 900;
    background: #fff;
    border: 1px solid #bfdbfe;
    font-family: Rajdhani, Bahnschrift, Consolas, monospace;
  }
  strong {
    font-size: 30px;
    font-family: Rajdhani, Bahnschrift, Consolas, monospace;
    line-height: 1;
  }
  b {
    display: block;
    font-size: 13px;
    color: var(--text);
  }
  span {
    display: block;
    font-size: 11px;
    opacity: 1;
    color: var(--muted);
    line-height: 1.35;
  }
  &.ok strong {
    color: var(--good);
  }
  &.warn strong {
    color: var(--warn);
  }
}
.kpi-grid {
  margin-top: 14px;
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 12px;
}
.grade-strip {
  margin-top: 10px;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}
.grade-pill {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border-radius: 10px;
  background: #fff;
  border: 1px solid color-mix(in srgb, var(--g) 35%, #ececec);
  b {
    width: 22px;
    height: 22px;
    border-radius: 6px;
    display: grid;
    place-items: center;
    background: var(--g);
    color: #fff;
    font-size: 12px;
  }
  span {
    font-size: 12px;
    color: var(--muted);
  }
  em {
    font-style: normal;
    font-weight: 800;
    font-family: Rajdhani, Bahnschrift, Consolas, monospace;
    color: var(--primary);
    font-size: 16px;
  }
}
.main-grid {
  margin-top: 12px;
  display: grid;
  grid-template-columns: minmax(0, 1.7fr) minmax(280px, 0.75fr);
  gap: 12px;
  align-items: start;
}
.main-left {
  display: grid;
  gap: 12px;
  min-width: 0;
}
.side-col {
  display: grid;
  gap: 12px;
  align-content: start;
}
.card {
  background: var(--card);
  border-radius: 14px;
  padding: 12px 14px 14px;
  box-shadow: 0 4px 16px rgba(44, 44, 44, 0.04);
  border: 1px solid var(--line);
  min-width: 0;
}
.card__head {
  margin-bottom: 8px;
  display: flex;
  justify-content: space-between;
  gap: 10px;
  align-items: flex-start;
  h2 {
    margin: 0;
    font-size: 16px;
    color: var(--primary);
  }
  p {
    margin: 4px 0 0;
    font-size: 12px;
    color: var(--muted);
  }
}
.rank-wrap {
  max-height: 300px;
  overflow-y: auto;
  scrollbar-width: thin;
}
.rank-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
  thead th {
    position: sticky;
    top: 0;
    z-index: 2;
  background: #fafafa;
  color: var(--muted);
  font-weight: 600;
  padding: 8px 6px;
  text-align: left;
  box-shadow: 0 1px 0 var(--line);
  }
  td {
    padding: 8px 6px;
    border-bottom: 1px solid #eef2f6;
    font-variant-numeric: tabular-nums;
    &.name {
      font-weight: 700;
      color: var(--primary);
    }
    &.score {
      font-weight: 800;
      color: var(--primary);
    }
    &.bad {
      color: var(--bad);
      font-weight: 700;
    }
    &.muted {
      color: var(--muted);
      font-weight: 600;
    }
  }
}
.grade-tag {
  display: inline-grid;
  place-items: center;
  min-width: 28px;
  height: 22px;
  padding: 0 6px;
  border-radius: 6px;
  color: #fff;
  font-style: normal;
  font-weight: 800;
  font-size: 12px;
}
.notice-empty {
  padding: 12px;
  border: 1px dashed rgba(29, 107, 255, 0.28);
  border-radius: 10px;
  background: #f5f9ff;
  strong {
    display: block;
    color: var(--primary);
    font-size: 13px;
  }
  p {
    margin: 6px 0 0;
    color: var(--muted);
    font-size: 12px;
    line-height: 1.5;
  }
}
.problem-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 320px;
  overflow: auto;
}
.problem {
  padding: 10px;
  border-radius: 10px;
  border: 1px solid var(--line);
  &__head {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    b {
      color: var(--primary);
    }
    span {
      font-size: 12px;
      color: var(--muted);
      white-space: nowrap;
    }
  }
  &__tags {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 8px;
    em {
      font-style: normal;
      font-size: 11px;
      padding: 3px 7px;
      border-radius: 999px;
      background: #fff4e5;
      color: #b86e00;
    }
  }
}
.empty {
  margin: 0;
  padding: 16px;
  text-align: center;
  color: var(--muted);
  font-size: 13px;
}

@media (max-width: 1280px) {
  .ops-header__top {
    flex-direction: column;
    align-items: stretch;
  }
  .health {
    max-width: none;
  }
  .kpi-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .main-grid {
    grid-template-columns: 1fr;
  }
}
</style>
