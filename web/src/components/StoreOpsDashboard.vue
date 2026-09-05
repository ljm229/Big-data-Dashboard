<template>
  <div class="ops-page">
    <header class="ops-header">
      <div class="ops-header__left">
        <div class="view-switch">
          <button type="button" @click="emit('switch-view')">数据大屏</button>
          <button type="button" class="active">门店运营看板</button>
        </div>
        <div class="brand">
          <div class="brand__mark">运</div>
          <div>
            <h1>营运核心考核</h1>
            <p>{{ assessWeekLabel }} · {{ storeCntText }}</p>
          </div>
        </div>
      </div>

      <div class="ops-header__mid">
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
    </header>

    <div v-if="!hasAssessData" class="ops-empty">
      <strong>该周期暂无营运考核数据</strong>
      <p>请切换到 8.21–8.27 或 8.28–9.3 考核周。</p>
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
        <p class="grade-hint">
          权重：售罄 40% · 错漏拣 20% · 仓T 10% · 商责 20% · IM 10%｜分档 100/80/60/0｜多店顶栏取综合分中位数
        </p>
      </section>

      <div class="main-grid">
        <article class="card assess-rank">
          <header class="card__head">
            <div>
              <h2>门店考核榜</h2>
              <p>五维指标 + 加权综合分 · 不合格项标红</p>
            </div>
          </header>
          <div class="rank-wrap" @mouseenter="rankPaused = true" @mouseleave="rankPaused = false">
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
              <tbody :style="rankScrollStyle">
                <tr v-for="(row, idx) in rankLoop" :key="row.shortName + '-' + idx">
                  <td class="name">{{ row.shortName }}</td>
                  <td>{{ row.city?.replace(/市$/, '') || '—' }}</td>
                  <td :class="{ bad: !partPass(row, 'sellout_rate') }">{{ fmtPart(row, 'sellout_rate') }}</td>
                  <td :class="{ bad: !partPass(row, 'pick_error_rate') }">{{ fmtPart(row, 'pick_error_rate') }}</td>
                  <td :class="{ bad: !partPass(row, 'warehouse_t') }">{{ fmtPart(row, 'warehouse_t') }}</td>
                  <td :class="{ bad: !partPass(row, 'merchant_issue_rate') }">
                    {{ fmtPart(row, 'merchant_issue_rate') }}
                  </td>
                  <td :class="{ bad: !partPass(row, 'im_reply_rate') }">{{ fmtPart(row, 'im_reply_rate') }}</td>
                  <td class="score">{{ row.composite.toFixed(1) }}</td>
                  <td>
                    <em class="grade-tag" :style="{ background: row.grade.color }">{{ row.grade.grade }}</em>
                  </td>
                </tr>
              </tbody>
            </table>
            <p v-if="!assessRows.length" class="empty">当前筛选下暂无门店</p>
          </div>
        </article>

        <div class="side-col">
          <article class="card notice-card">
            <header class="card__head">
              <div>
                <h2>本周重要事项</h2>
                <p>周维度 · 运营群重点通知清单（内容待录入）</p>
              </div>
              <div class="notice-tabs" aria-hidden="true">
                <button type="button" class="active">全部</button>
                <button type="button">P0</button>
                <button type="button">P1</button>
                <button type="button">P2</button>
              </div>
            </header>

            <div class="notice-schema">
              <span>优先级</span>
              <span>事项标题</span>
              <span>负责人</span>
              <span>截止</span>
              <span>状态</span>
            </div>

            <div class="notice-empty">
              <strong>结构已预留，本周暂不填写内容</strong>
              <p>
                用途：同步群里本周必须跟进的通知（考核整改、活动节点、红线门店、临时制度等）。建议每条含优先级 /
                标题 / 负责人 / 截止日期 / 状态；按考核周切换，不按自然日碎片化。
              </p>
              <ul>
                <li>P0 · 红线 / 当日必须闭环</li>
                <li>P1 · 本周必须完成</li>
                <li>P2 · 周知 / 跟踪即可</li>
              </ul>
            </div>
          </article>

          <article class="card">
            <header class="card__head">
              <div>
                <h2>需关注门店</h2>
                <p>综合分 &lt; 60（C/D）· 来自考核表</p>
              </div>
            </header>
            <div class="problem-list">
              <div v-for="s in watchStores" :key="s.shortName" class="problem">
                <div class="problem__head">
                  <b>{{ s.shortName }}</b>
                  <span>{{ s.city?.replace(/市$/, '') || '—' }} · {{ s.composite.toFixed(0) }}分 · {{ s.grade.grade }}</span>
                </div>
                <div class="problem__tags">
                  <em v-for="tag in failTags(s)" :key="tag">{{ tag }}</em>
                </div>
              </div>
              <p v-if="!watchStores.length" class="empty">当前筛选下暂无 C/D 门店</p>
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
import { useFilterStore, COCKPIT_WEEKS } from '../stores/filter'
import {
  fetchAssessmentCityOptions,
  fetchAssessmentStoreOptions,
  hasAssessment,
} from '../api/dashboard'
import dashRaw from '../data/dashboard.json'
import { fetchAssessmentBoard, healthFromMetrics, type AssessBoard } from '../api/opsDashboard'
import { GRADE_RULES, type AssessKey } from '../utils/opsAssessment'

const emit = defineEmits<{ 'switch-view': [] }>()

const filter = useFilterStore()
const { selectedDate, dataKey, loadingTick } = storeToRefs(filter)

const city = ref('全部')
const storeId = ref('全部')
const cityOptions = ref<string[]>(['全部'])
const storeOptions = ref<Array<{ id: string; shortName: string }>>([])

const assessKey = computed(() => dataKey.value || selectedDate.value)
const hasAssessData = computed(() => hasAssessment(assessKey.value))
const updatedHint = String((dashRaw as { updated_at?: string }).updated_at || '').slice(0, 16)

const assessWeekLabel = computed(() => {
  const key = assessKey.value
  const weekId = key.startsWith('W:')
    ? key.slice(2)
    : COCKPIT_WEEKS.find((w) => w.days.includes(selectedDate.value))?.id
  const w = COCKPIT_WEEKS.find((x) => x.id === weekId)
  return w?.label || weekId || selectedDate.value
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

function partPass(row: AssessBoard['rows'][number], key: AssessKey) {
  return row.parts.find((p) => p.key === key)?.pass ?? true
}
function fmtPart(row: AssessBoard['rows'][number], key: AssessKey) {
  const p = row.parts.find((x) => x.key === key)
  if (!p) return '—'
  if (p.unit === 'min') return p.value.toFixed(1)
  return p.value.toFixed(2) + '%'
}

const rankPaused = ref(false)
const rankOffset = ref(0)
let rankTimer: ReturnType<typeof setInterval> | null = null
const rankLoop = computed(() => {
  const rows = assessRows.value
  if (rows.length <= 8) return rows
  return [...rows, ...rows]
})
const rankScrollStyle = computed(() => {
  if (assessRows.value.length <= 8) return {}
  return {
    transform: `translateY(-${rankOffset.value}px)`,
    transition: rankPaused.value ? 'none' : 'transform 0.6s ease-in-out',
  }
})

function startRankScroll() {
  if (rankTimer) clearInterval(rankTimer)
  rankTimer = setInterval(() => {
    if (rankPaused.value || assessRows.value.length <= 8) return
    const rowH = 40
    rankOffset.value += rowH
    if (rankOffset.value >= assessRows.value.length * rowH) rankOffset.value = 0
  }, 2000)
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
  rankOffset.value = 0
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
  --primary: #2a5c82;
  --accent: #5b9bd5;
  --warn: #ffc000;
  --good: #70ad47;
  --bad: #e74c3c;
  --text: #3d3d3d;
  --muted: #8c8c8c;
  --card: #ffffff;
  --bg: #f3f6f9;
  min-height: 100vh;
  padding: 16px 20px 28px;
  background:
    radial-gradient(circle at 12% 0%, rgba(91, 155, 213, 0.16), transparent 36%),
    radial-gradient(circle at 88% 100%, rgba(42, 92, 130, 0.1), transparent 40%),
    var(--bg);
  color: var(--text);
  font-family: 'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', sans-serif;
}
.ops-empty {
  margin-top: 14px;
  padding: 28px 24px;
  border-radius: 14px;
  background: #fff;
  border: 1px dashed rgba(42, 92, 130, 0.35);
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
  display: grid;
  grid-template-columns: minmax(280px, 1.1fr) minmax(420px, 1.4fr) minmax(240px, 0.9fr);
  align-items: center;
  gap: 14px;
  padding: 12px 14px;
  border-radius: 14px;
  background: linear-gradient(135deg, #2a5c82, #3d7aa8 55%, #5b9bd5);
  color: #fff;
  box-shadow: 0 8px 24px rgba(42, 92, 130, 0.28);
}
.ops-header__left {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
}
.ops-header__mid {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  justify-content: center;
}
.view-switch {
  display: flex;
  gap: 6px;
  button {
    border: 1px solid rgba(255, 255, 255, 0.35);
    border-radius: 6px;
    padding: 5px 10px;
    color: rgba(255, 255, 255, 0.82);
    background: rgba(255, 255, 255, 0.1);
    cursor: pointer;
    font-size: 12px;
    &.active {
      color: #2a5c82;
      background: #fff;
      border-color: transparent;
      font-weight: 800;
    }
  }
}
.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  &__mark {
    width: 38px;
    height: 38px;
    border-radius: 10px;
    display: grid;
    place-items: center;
    font-weight: 800;
    background: rgba(255, 255, 255, 0.18);
    border: 1px solid rgba(255, 255, 255, 0.28);
  }
  h1 {
    margin: 0;
    font-size: 18px;
    font-weight: 800;
  }
  p {
    margin: 2px 0 0;
    font-size: 12px;
    opacity: 0.86;
  }
}
.filter {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  span {
    opacity: 0.9;
  }
  select {
    min-width: 108px;
    border: 0;
    border-radius: 8px;
    padding: 7px 9px;
    background: rgba(255, 255, 255, 0.95);
    color: var(--primary);
    font-weight: 600;
  }
}
.health {
  justify-self: end;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border-radius: 12px;
  background: rgba(0, 0, 0, 0.16);
  max-width: 100%;
  &__grade {
    width: 36px;
    height: 36px;
    border-radius: 10px;
    display: grid;
    place-items: center;
    font-size: 20px;
    font-weight: 900;
    background: rgba(255, 255, 255, 0.14);
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
  }
  span {
    display: block;
    font-size: 11px;
    opacity: 0.85;
    line-height: 1.35;
  }
  &.ok strong {
    color: #b7f0c4;
  }
  &.warn strong {
    color: #ffe08a;
  }
}
.kpi-grid {
  margin-top: 14px;
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 12px;
}
.grade-strip {
  margin-top: 12px;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
}
.grade-pill {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 10px;
  background: #fff;
  border: 1px solid color-mix(in srgb, var(--g) 35%, #e8eef5);
  b {
    width: 26px;
    height: 26px;
    border-radius: 8px;
    display: grid;
    place-items: center;
    background: var(--g);
    color: #04122a;
    font-size: 13px;
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
    font-size: 18px;
  }
}
.grade-hint {
  margin: 0;
  flex: 1 1 280px;
  font-size: 12px;
  color: var(--muted);
  line-height: 1.45;
}
.main-grid {
  margin-top: 12px;
  display: grid;
  grid-template-columns: minmax(0, 1.55fr) minmax(320px, 0.9fr);
  gap: 12px;
  align-items: start;
}
.side-col {
  display: grid;
  gap: 12px;
}
.card {
  background: var(--card);
  border-radius: 12px;
  padding: 12px 14px 14px;
  box-shadow: 0 2px 10px rgba(42, 92, 130, 0.07);
  border: 1px solid rgba(42, 92, 130, 0.06);
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
  max-height: 420px;
  overflow: hidden;
}
.rank-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
  thead th {
    background: #f5f8fb;
    color: var(--muted);
    font-weight: 600;
    padding: 8px 6px;
    text-align: left;
  }
  tbody {
    display: block;
  }
  thead,
  tbody tr {
    display: table;
    width: 100%;
    table-layout: fixed;
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
  }
}
.grade-tag {
  display: inline-grid;
  place-items: center;
  min-width: 28px;
  height: 22px;
  padding: 0 6px;
  border-radius: 6px;
  color: #04122a;
  font-style: normal;
  font-weight: 800;
  font-size: 12px;
}
.notice-tabs {
  display: flex;
  gap: 4px;
  button {
    border: 1px solid #d7e2ec;
    background: #f7fafc;
    color: var(--muted);
    border-radius: 999px;
    padding: 3px 9px;
    font-size: 11px;
    cursor: default;
    &.active {
      background: #2a5c82;
      border-color: #2a5c82;
      color: #fff;
      font-weight: 700;
    }
  }
}
.notice-schema {
  display: grid;
  grid-template-columns: 56px 1.4fr 72px 72px 64px;
  gap: 6px;
  padding: 6px 8px;
  margin-bottom: 8px;
  border-radius: 8px;
  background: #f5f8fb;
  color: var(--muted);
  font-size: 11px;
  font-weight: 600;
}
.notice-empty {
  padding: 16px 12px 8px;
  border: 1px dashed rgba(42, 92, 130, 0.28);
  border-radius: 10px;
  background: #fafcfe;
  strong {
    display: block;
    color: var(--primary);
    font-size: 14px;
  }
  p {
    margin: 8px 0;
    color: var(--muted);
    font-size: 12px;
    line-height: 1.55;
  }
  ul {
    margin: 0;
    padding-left: 18px;
    color: #5a6a7a;
    font-size: 12px;
    line-height: 1.7;
  }
}
.problem-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-height: 280px;
  overflow: auto;
}
.problem {
  padding: 10px;
  border-radius: 10px;
  border: 1px solid #e7eef5;
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
  .ops-header {
    grid-template-columns: 1fr;
  }
  .health {
    justify-self: start;
  }
  .kpi-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .main-grid {
    grid-template-columns: 1fr;
  }
}
</style>
