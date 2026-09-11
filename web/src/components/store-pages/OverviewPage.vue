<!-- 中文名：运营总览页 -->
<template>
  <div class="report">
    <p v-if="loading" class="hint">加载考核报告中…</p>
    <p v-else-if="!report" class="hint">当前筛选下暂无考核数据</p>

    <template v-else>
      <section class="card">
        <div class="sec-head">
          <span class="no">1</span>服务商维度 · 营运指标{{ report.deltaColLabel }}
        </div>

        <div class="metric-cards">
          <div v-for="m in report.metrics" :key="m.key" class="mc">
            <div class="mc__head">
              <div class="name">{{ m.name }}</div>
              <span class="pill" :class="m.pass ? 'ok' : 'bad'">{{ m.pass ? '合格' : '不合格' }}</span>
            </div>
            <div class="mc__body">
              <div class="val">{{ fmtVal(m.value, m.unit) }}</div>
              <div class="mc__meta">
                <div class="prev">
                  {{ report.prevColLabel }}
                  {{ m.prev == null ? '—' : fmtVal(m.prev, m.unit) }}
                </div>
                <div class="chg" :class="deltaClass(m)">{{ fmtDelta(m) }}</div>
              </div>
            </div>
            <div class="reach">门店达标 {{ m.storePassCnt }}/{{ m.storeCnt }}（{{ Math.round(m.storePassRate * 100) }}%）</div>
          </div>
        </div>

        <div class="scroll">
          <table>
            <thead>
              <tr>
                <th class="lbl">指标</th>
                <th>{{ report.curColLabel }}</th>
                <th>{{ report.prevColLabel }}</th>
                <th>{{ report.deltaColLabel }}变化</th>
                <th>合格标准</th>
                <th>判定</th>
                <th>门店达标</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(m, idx) in report.metrics" :key="'t-' + m.key" :class="'zebra-' + (idx % 2)">
                <td class="lbl">{{ m.name }}</td>
                <td class="num">{{ fmtVal(m.value, m.unit) }}</td>
                <td class="num muted">{{ m.prev == null ? '—' : fmtVal(m.prev, m.unit) }}</td>
                <td class="num" :class="deltaClass(m)">{{ fmtDelta(m) }}</td>
                <td class="muted">
                  {{ m.lowerBetter ? '≤' : '≥' }}{{ m.passLine }}{{ m.unit === 'min' ? '' : '%' }}
                </td>
                <td>
                  <span class="pill" :class="m.pass ? 'ok' : 'bad'">{{ m.pass ? '合格' : '不合格' }}</span>
                </td>
                <td class="num muted">{{ m.storePassCnt }}/{{ m.storeCnt }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section class="card">
        <div class="sec-head">
          <span class="no">2</span>门店营运数据明细（{{ report.storeCnt }} 家，按综合得分升序）
        </div>
        <div class="scroll">
          <table class="detail">
            <thead>
              <tr>
                <th class="lbl" rowspan="2">门店名称</th>
                <th v-for="m in report.metrics" :key="'h-' + m.key" colspan="2">{{ m.shortName }}</th>
                <th rowspan="2">综合得分</th>
                <th rowspan="2">等级</th>
              </tr>
              <tr>
                <template v-for="m in report.metrics" :key="'h2-' + m.key">
                  <th>{{ report.curColLabel }}</th>
                  <th>{{ report.deltaColLabel }}</th>
                </template>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(row, idx) in report.rowsAsc"
                :key="row.shortName"
                :class="['zebra-' + (idx % 2), 'g-' + rowGrade(row)]"
              >
                <td class="lbl">{{ row.name || row.shortName }}</td>
                <template v-for="m in report.metrics" :key="row.shortName + m.key">
                  <td class="num">
                    <span
                      v-if="!partOf(row, m.key)?.missing"
                      class="val-chip"
                      :class="partOf(row, m.key)?.pass ? '' : 'warn'"
                    >{{ fmtPart(row, m.key) }}</span>
                    <span v-else class="muted">--</span>
                  </td>
                  <td class="num delta-cell" :class="rowDeltaClass(row, m.key)">
                    {{ fmtRowDelta(row, m.key) }}
                  </td>
                </template>
                <td class="num score">
                  <b>{{ row.parts.every((p) => p.missing) ? '--' : Math.round(row.composite) }}</b>
                </td>
                <td>
                  <span class="badge" :class="'b' + rowGrade(row)">{{ rowGrade(row) === 'N' ? '—' : rowGrade(row) }}</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section class="card">
        <div class="sec-head"><span class="no">3</span>门店综合评级分档</div>
        <div class="ggrid">
          <div v-for="g in report.gradeDist" :key="g.grade" class="gcell" :class="'g' + g.grade">
            <div class="n">{{ g.count }}</div>
            <div class="t">{{ g.grade }} · {{ g.label }}</div>
            <div class="p">{{ Math.round(g.share * 100) }}%</div>
          </div>
        </div>
      </section>

      <section class="card">
        <div class="sec-head">
          <span class="no">4</span>商责问题单率概览
          <template v-if="merchantMetric">
            <em class="merchant-sum">
              汇总 <b>{{ fmtVal(merchantMetric.value, '%') }}</b>
              <span class="pill" :class="merchantMetric.pass ? 'ok' : 'bad'">
                {{ merchantMetric.pass ? '合格' : '不合格' }}
              </span>
              <span class="muted">
                {{ report.prevColLabel }}
                {{ merchantMetric.prev == null ? '--' : fmtVal(merchantMetric.prev, '%') }}
              </span>
              <span :class="deltaClass(merchantMetric)">{{ fmtDelta(merchantMetric) }}</span>
            </em>
          </template>
        </div>
        <div class="scroll">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th class="lbl">门店</th>
                <th>商责问题单率</th>
                <th>判定</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(r, i) in report.merchantRank" :key="r.shortName" :class="'zebra-' + (i % 2)">
                <td class="muted">{{ i + 1 }}</td>
                <td class="lbl">{{ r.name || r.shortName }}</td>
                <td class="num">
                  <span v-if="!r.missing && !Number.isNaN(r.value)" class="val-chip" :class="r.pass ? '' : 'warn'">
                    {{ r.value.toFixed(2) }}%
                  </span>
                  <span v-else class="muted">--</span>
                </td>
                <td>
                  <span v-if="!r.missing" class="pill" :class="r.pass ? 'ok' : 'bad'">
                    {{ r.pass ? '合格' : '不合格' }}
                  </span>
                  <span v-else class="muted">--</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section class="card">
        <div class="sec-head"><span class="no">5</span>改善意见与建议</div>
        <ul v-if="report.suggestions.length" class="tips">
          <li v-for="(s, i) in report.suggestions" :key="i" :class="'tip-' + (i % 5)">
            <strong>{{ s.title.replace(/（当前.*?）/, '') }}</strong>
            <span>{{ cleanTip(s.desc) }}</span>
          </li>
        </ul>
        <p v-else class="empty-tip">{{ report.curColLabel }}五项指标均达标</p>
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
import { onUnmounted, ref, watch, computed } from 'vue'
import {
  fetchAssessmentWeeklyReport,
  type AssessmentWeeklyReport,
  type WeeklyMetricCard,
  type WeeklyStoreRow,
} from '../../api/opsDashboard'
import { fetchDatabaseReport, subscribeQualityUpdates } from '../../api/qualityDatabase'
import { ASSESS_DEFS, type AssessKey } from '../../utils/opsAssessment'

const props = defineProps<{
  dateKey: string
  city: string
  storeId: string
}>()

const loading = ref(false)
const report = ref<AssessmentWeeklyReport | null>(null)

const merchantMetric = computed(
  () => report.value?.metrics.find((m) => m.key === 'merchant_issue_rate') || null,
)

function cleanTip(text: string) {
  return String(text || '')
    .replace(/百分点/g, '')
    .replace(/分钟/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

function rowGrade(row: WeeklyStoreRow) {
  return row.parts.every((p) => p.missing) ? 'N' : row.grade.grade
}

function fmtVal(v: number | null | undefined, unit: '%' | 'min' | string) {
  if (v == null || !Number.isFinite(Number(v))) return '--'
  if (unit === 'min') return Number(v).toFixed(2)
  return `${Number(v).toFixed(2)}%`
}

function isWorse(m: Pick<WeeklyMetricCard, 'lowerBetter' | 'delta'>) {
  if (m.delta == null || m.delta === 0) return null
  return m.lowerBetter ? m.delta > 0 : m.delta < 0
}

function deltaClass(m: WeeklyMetricCard) {
  const w = isWorse(m)
  if (w == null) return 'flat'
  return w ? 'worse' : 'better'
}

function fmtDelta(m: WeeklyMetricCard) {
  if (m.delta == null) return '—'
  if (m.delta === 0) return '→ 0'
  const arrow = m.delta > 0 ? '↑' : '↓'
  const sign = m.delta > 0 ? '+' : ''
  return `${arrow} ${sign}${m.delta}`
}

function partOf(row: WeeklyStoreRow, key: AssessKey) {
  return row.parts.find((p) => p.key === key)
}

function fmtPart(row: WeeklyStoreRow, key: AssessKey) {
  const p = partOf(row, key)
  if (!p || p.missing) return '--'
  return p.unit === 'min' ? p.value.toFixed(2) : `${p.value.toFixed(2)}%`
}

function rowDeltaClass(row: WeeklyStoreRow, key: AssessKey) {
  const d = row.deltas[key]
  if (d == null || d === 0) return 'flat'
  const def = ASSESS_DEFS.find((x) => x.key === key)!
  const worse = def.lowerBetter ? d > 0 : d < 0
  return worse ? 'worse' : 'better'
}

function fmtRowDelta(row: WeeklyStoreRow, key: AssessKey) {
  const d = row.deltas[key]
  if (d == null) return '—'
  if (d === 0) return '→ 0'
  const arrow = d > 0 ? '↑' : '↓'
  const sign = d > 0 ? '+' : ''
  return `${arrow} ${sign}${d}`
}

async function reload() {
  if (!props.dateKey) {
    report.value = null
    return
  }
  loading.value = true
  try {
    try {
      report.value = await fetchDatabaseReport(props.dateKey, props.city, props.storeId)
    } catch {
      try {
        report.value = await fetchAssessmentWeeklyReport(props.dateKey, props.city, props.storeId)
      } catch {
        report.value = null
      }
    }
  } finally {
    loading.value = false
  }
}

watch(
  () => [props.dateKey, props.city, props.storeId] as const,
  () => void reload(),
  { immediate: true },
)

const unsubscribe = subscribeQualityUpdates(() => void reload())
onUnmounted(unsubscribe)
</script>

<style scoped lang="scss">
.report {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding-bottom: 28px;
  color: var(--ops-text);
}
.hint {
  text-align: center;
  color: var(--ops-muted);
  padding: 36px;
}
.card {
  background: #fff;
  border-radius: 14px;
  padding: 16px 16px 14px;
  border: 1px solid var(--ops-line);
  box-shadow: var(--ops-shadow);
}
.sec-head {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  font-size: 16px;
  font-weight: 700;
  color: var(--ops-primary);
  margin-bottom: 14px;
  .no {
    display: inline-flex;
    width: 22px;
    height: 22px;
    border-radius: 6px;
    background: linear-gradient(135deg, #1d6bff, #0ea5e9);
    color: #fff;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    font-family: var(--ops-font-num);
    font-weight: 700;
    flex-shrink: 0;
  }
}
.metric-cards {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 16px;
}
.mc {
  display: flex;
  flex-direction: column;
  gap: 10px;
  border: 1px solid var(--ops-line);
  border-radius: 12px;
  padding: 14px;
  background: linear-gradient(180deg, #ffffff 0%, #f8fbff 100%);
  min-width: 0;
}
.mc__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
}
.mc__body {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 10px;
  min-width: 0;
}
.mc__meta {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
  text-align: right;
  flex-shrink: 0;
}
.mc .name {
  font-size: 13px;
  color: var(--ops-text-2);
  font-weight: 600;
  line-height: 1.35;
}
.mc .val {
  font-size: 24px;
  font-weight: 700;
  font-family: var(--ops-font-num);
  font-variant-numeric: tabular-nums;
  line-height: 1;
  color: var(--ops-num);
  letter-spacing: -0.02em;
}
.mc .prev {
  font-size: 11px;
  color: var(--ops-muted);
  white-space: nowrap;
}
.mc .chg {
  font-size: 12px;
  font-weight: 600;
  font-family: var(--ops-font-num);
  white-space: nowrap;
}
.mc .reach {
  font-size: 11px;
  color: var(--ops-muted);
  line-height: 1.4;
  padding-top: 8px;
  border-top: 0;
  margin-top: 2px;
}
.pill {
  display: inline-flex;
  align-items: center;
  height: 22px;
  padding: 0 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
  line-height: 1;
  white-space: nowrap;
  &.ok {
    background: var(--ops-ok-bg);
    color: var(--ops-ok);
  }
  &.bad {
    background: var(--ops-bad-bg);
    color: var(--ops-bad);
  }
}
.val-chip {
  display: inline-flex;
  align-items: center;
  min-height: 22px;
  padding: 0 8px;
  border-radius: 4px;
  font-weight: 600;
  color: var(--ops-text);
  background: transparent;
  &.warn {
    background: var(--ops-bad-bg);
    color: var(--ops-bad);
  }
}
.merchant-sum {
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  font-style: normal;
  font-size: 13px;
  font-weight: 500;
  color: var(--ops-text-2);
  b {
    font-family: var(--ops-font-num);
    font-size: 16px;
    font-weight: 700;
    color: var(--ops-num);
  }
}
.scroll {
  max-height: 320px;
  overflow: auto;
  border: 0;
  border-radius: 8px;
  background: transparent;
}
.scroll table.detail thead tr:first-child th {
  position: sticky;
  top: 0;
  z-index: 3;
  background: #f8fafc;
  box-shadow: 0 1px 0 var(--ops-line);
}
.scroll table.detail thead tr:nth-child(2) th {
  position: sticky;
  top: 34px;
  z-index: 2;
  background: #f1f5f9;
  box-shadow: none;
}
.scroll table:not(.detail) thead th {
  position: sticky;
  top: 0;
  z-index: 2;
  background: #f8fafc;
  box-shadow: 0 1px 0 var(--ops-line);
}
table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
  th,
  td {
    padding: 10px 10px;
    text-align: center;
    border: 0;
    border-bottom: 1px solid #eef2f6;
  }
  td.lbl,
  th.lbl {
    font-family: var(--ops-font);
  }
  thead th {
    background: #f8fafc;
    font-weight: 600;
    color: var(--ops-muted);
    font-size: 12px;
    font-family: var(--ops-font);
    border-bottom: 1px solid var(--ops-line);
  }
  .lbl {
    text-align: left;
    font-weight: 700;
    color: var(--ops-primary);
  }
  .num {
    font-family: var(--ops-font-num);
    font-variant-numeric: tabular-nums;
    text-align: right;
    color: var(--ops-text);
  }
  .score b {
    font-size: 14px;
    color: var(--ops-primary);
  }
}
.detail thead th {
  white-space: nowrap;
}
.delta-cell {
  font-size: 12px;
  white-space: nowrap;
}
.muted {
  color: var(--ops-muted);
  font-weight: 500;
}
.worse {
  color: var(--ops-bad);
  font-weight: 600;
}
.better {
  color: var(--ops-ok);
  font-weight: 600;
}
.flat {
  color: var(--ops-muted);
}
.ggrid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 12px;
}
.gcell {
  border-radius: 12px;
  padding: 16px 12px;
  text-align: center;
  border: 1px solid color-mix(in srgb, var(--g, #dbe3ef) 35%, #ececec);
  border-top: 3px solid var(--g, transparent);
  min-width: 0;
  background: #fff;
  box-shadow: none;
  .n {
    font-size: 28px;
    font-weight: 800;
    font-family: var(--ops-font-num);
    line-height: 1.1;
    color: var(--ops-primary);
  }
  .t {
    font-size: 13px;
    margin-top: 8px;
    font-weight: 600;
    color: var(--ops-muted);
  }
  .p {
    margin-top: 4px;
    font-size: 12px;
    font-weight: 600;
    font-family: var(--ops-font-num);
    color: var(--ops-muted);
  }
}
.gS {
  --g: #10b981;
  background: #ecfdf5;
}
.gA {
  --g: #1d6bff;
  background: #eff6ff;
}
.gB {
  --g: #8b5cf6;
  background: #f5f3ff;
}
.gC {
  --g: #f59e0b;
  background: #fffbeb;
}
.gD {
  --g: #ef4444;
  background: #fef2f2;
}
.badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 28px;
  height: 22px;
  padding: 0 8px;
  border-radius: 6px;
  font-weight: 800;
  font-size: 12px;
  font-family: var(--ops-font-num);
  color: #fff;
}
.bS { background: #10b981; color: #fff; }
.bA { background: #1d6bff; color: #fff; }
.bB { background: #8b5cf6; color: #fff; }
.bC { background: #f59e0b; color: #fff; }
.bD { background: #ef4444; color: #fff; }
.bN { background: #e2e8f0; color: var(--ops-muted); }
tr.zebra-0 > td { background: #fff; }
tr.zebra-1 > td { background: #f8fafc; }
tr.g-S > td:first-child { box-shadow: inset 3px 0 0 #10b981; }
tr.g-A > td:first-child { box-shadow: inset 3px 0 0 #1d6bff; }
tr.g-B > td:first-child { box-shadow: inset 3px 0 0 #8b5cf6; }
tr.g-C > td:first-child { box-shadow: inset 3px 0 0 #f59e0b; }
tr.g-D > td:first-child { box-shadow: inset 3px 0 0 #ef4444; }
.tips {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 8px;
  li {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 12px 14px;
    border-radius: 10px;
    border: 1px solid var(--ops-line);
    border-left: 3px solid var(--ops-primary);
    background: #f5f9ff;
    line-height: 1.55;
  }
  strong {
    font-size: 13px;
    color: var(--ops-primary);
  }
  span {
    font-size: 12px;
    color: var(--ops-muted);
  }
}
.tip-0 { background: #f5f9ff; border-left-color: #1d6bff; }
.tip-1 { background: #fffbeb; border-left-color: #f59e0b; }
.tip-2 { background: #fef2f2; border-left-color: #ef4444; }
.tip-3 { background: #eff6ff; border-left-color: #0ea5e9; }
.tip-4 { background: #fef2f2; border-left-color: #ef4444; }
.empty-tip {
  margin: 0;
  padding: 16px;
  text-align: center;
  color: var(--ops-muted);
  background: #f5f9ff;
  border: 1px dashed rgba(29, 107, 255, 0.28);
  border-radius: 10px;
}
@media (max-width: 1100px) {
  .metric-cards {
    grid-template-columns: repeat(6, minmax(0, 1fr));
  }
  .mc:nth-child(1),
  .mc:nth-child(2) {
    grid-column: span 3;
  }
  .mc:nth-child(n + 3) {
    grid-column: span 2;
  }
}
@media (max-width: 780px) {
  .metric-cards,
  .ggrid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .mc:nth-child(1),
  .mc:nth-child(2),
  .mc:nth-child(n + 3) {
    grid-column: auto;
  }
}
@media (max-width: 520px) {
  .metric-cards,
  .ggrid {
    grid-template-columns: 1fr;
  }
}
</style>
