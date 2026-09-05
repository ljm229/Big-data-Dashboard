<template>
  <div class="report">
    <p v-if="loading" class="hint">加载周报中…</p>
    <p v-else-if="!report" class="hint">当前筛选下暂无周报数据</p>

    <template v-else>
      <details class="card standards">
        <summary>营运核心指标考核标准 & 综合打分规则</summary>
        <div class="std-grid">
          <table>
            <thead>
              <tr>
                <th class="lbl">指标</th>
                <th>合格标准</th>
                <th>不合格标准</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="d in assessDefs" :key="d.key">
                <td class="lbl">{{ d.name }}</td>
                <td class="ok">
                  {{ d.lowerBetter ? '≤' : '≥' }}{{ d.passLine }}{{ d.unit === 'min' ? '分钟' : '%' }}
                </td>
                <td class="bad">
                  {{ d.lowerBetter ? '>' : '<' }}{{ d.passLine }}{{ d.unit === 'min' ? '分钟' : '%' }}
                </td>
              </tr>
            </tbody>
          </table>
          <p class="note">
            满分 100 = 售罄×40% + 错漏拣×20% + 仓T×10% + 商责×20% + IM×10% ·
            <b class="g-s">S 90–100</b> ·
            <b class="g-a">A 80–90</b> ·
            <b class="g-b">B 60–80</b> ·
            <b class="g-c">C 40–60</b> ·
            <b class="g-d">D 0–40</b>
          </p>
        </div>
      </details>

      <section class="card">
        <div class="sec-head"><span class="no">1</span>服务商维度 · 营运指标周环比</div>
        <div class="banner">
          优沃森/YOWATSON · 门店 {{ report.storeCnt }} 家 · 五项指标不合格
          {{ report.failMetricCnt }} 项
          <template v-if="report.prevLabel">
            · 本周 {{ report.weekLabel }} vs 上周 {{ report.prevLabel }}
          </template>
        </div>

        <div class="metric-cards">
          <div
            v-for="m in report.metrics"
            :key="m.key"
            class="mc"
            :class="m.pass ? 'pass' : 'fail'"
          >
            <div class="name">{{ m.name }}</div>
            <div class="val" :class="m.pass ? 'ok' : 'bad'">{{ fmtVal(m.value, m.unit) }}</div>
            <div class="prev">上周: {{ m.prev == null ? '—' : fmtVal(m.prev, m.unit) }}</div>
            <div class="chg" :class="deltaClass(m)">{{ fmtDelta(m) }}</div>
            <div class="tag" :class="m.pass ? 'pass' : 'fail'">{{ m.pass ? '合格' : '不合格' }}</div>
            <div class="reach">
              门店达标 {{ m.storePassCnt }}/{{ m.storeCnt }}
              ({{ Math.round(m.storePassRate * 100) }}%)
            </div>
          </div>
        </div>

        <div class="scroll">
          <table>
            <thead>
              <tr>
                <th class="lbl">指标</th>
                <th>本周</th>
                <th>上周</th>
                <th>周环比变化</th>
                <th>合格标准</th>
                <th>判定</th>
                <th>门店达标</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="m in report.metrics" :key="'t-' + m.key">
                <td class="lbl">{{ m.name }}</td>
                <td>{{ fmtVal(m.value, m.unit) }}</td>
                <td>{{ m.prev == null ? '—' : fmtVal(m.prev, m.unit) }}</td>
                <td :class="deltaClass(m)">{{ fmtDelta(m) }}</td>
                <td>
                  {{ m.lowerBetter ? '≤' : '≥' }}{{ m.passLine }}{{ m.unit === 'min' ? 'min' : '%' }}
                </td>
                <td :class="m.pass ? 'ok' : 'bad'">{{ m.pass ? '合格' : '不合格' }}</td>
                <td>
                  {{ m.storePassCnt }}/{{ m.storeCnt }} ({{ Math.round(m.storePassRate * 100) }}%)
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p class="note">{{ report.summaryNote }}</p>
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
                  <th>本周</th>
                  <th>环比</th>
                </template>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="row in report.rowsAsc"
                :key="row.shortName"
                :class="'f' + Math.min(row.failCnt, 5)"
              >
                <td class="lbl">{{ row.name || row.shortName }}</td>
                <template v-for="m in report.metrics" :key="row.shortName + m.key">
                  <td :class="partOf(row, m.key)?.pass ? 'ok' : 'bad'">
                    {{ fmtPart(row, m.key) }}
                  </td>
                  <td :class="rowDeltaClass(row, m.key)" class="delta-cell">
                    {{ fmtRowDelta(row, m.key) }}
                  </td>
                </template>
                <td>
                  <b>{{ Math.round(row.composite) }}</b>
                </td>
                <td>
                  <span class="badge" :class="'b' + row.grade.grade">{{ row.grade.grade }}</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p class="note">
          合格标准：售罄率≤8% · 错漏拣率≤0.5% · 仓T≤5min · IM≥90% · 商责问题单率≤1.5%。绿色=合格，红色=不合格。
        </p>
        <div class="flegend">
          <span v-for="n in 6" :key="n" class="it">
            <i class="sw" :class="'sw' + (n - 1)" />不合格 {{ n - 1 }} 项
          </span>
        </div>
      </section>

      <section class="card">
        <div class="sec-head"><span class="no">3</span>门店综合评级分档</div>
        <div class="ggrid">
          <div
            v-for="g in report.gradeDist"
            :key="g.grade"
            class="gcell"
            :class="'g' + g.grade"
          >
            <div class="n">{{ g.count }}</div>
            <div class="t">{{ g.grade }} {{ g.label }} ({{ Math.round(g.share * 100) }}%)</div>
          </div>
        </div>
        <div class="grade-note">
          <p>
            <b>标杆(S)+合格(A)</b>：{{ saCnt }} 家（{{ pct(saCnt) }}%）
          </p>
          <p><b>基线(B)</b>：{{ bCnt }} 家（{{ pct(bCnt) }}%）</p>
          <p>
            <b>不合格(C)+红线(D)</b>：{{ cdCnt }} 家（{{ pct(cdCnt) }}%）— 下周重点整改
          </p>
          <p>
            <b>D 红线店</b>：{{ dCnt }} 家（{{ pct(dCnt) }}%）— 一店一策，逐店挂账
          </p>
        </div>
      </section>

      <section class="card">
        <div class="sec-head"><span class="no">4</span>商责问题单率概览</div>
        <div v-if="merchantMetric" class="merchant-hero" :class="merchantMetric.pass ? 'pass' : 'fail'">
          <div class="name">优沃森/YOWATSON 商责问题单率</div>
          <div class="val" :class="merchantMetric.pass ? 'ok' : 'bad'">
            {{ fmtVal(merchantMetric.value, '%') }}
          </div>
          <div class="prev">
            上周: {{ merchantMetric.prev == null ? '—' : fmtVal(merchantMetric.prev, '%') }}
          </div>
          <div class="chg" :class="deltaClass(merchantMetric)">{{ fmtDelta(merchantMetric) }}</div>
          <div class="tag" :class="merchantMetric.pass ? 'pass' : 'fail'">
            {{ merchantMetric.pass ? '合格' : '不合格' }} (>{{ merchantMetric.passLine }}%)
          </div>
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
              <tr v-for="(r, i) in report.merchantRank" :key="r.shortName">
                <td>{{ i + 1 }}</td>
                <td class="lbl">{{ r.name || r.shortName }}</td>
                <td :class="r.pass ? 'ok' : 'bad'">{{ r.value.toFixed(2) }}%</td>
                <td :class="r.pass ? 'ok' : 'bad'">{{ r.pass ? '合格' : '不合格' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section class="card">
        <div class="sec-head"><span class="no">5</span>改善意见与建议</div>
        <div v-if="!report.suggestions.length" class="note">本周五项指标均达标，暂无专项整改建议。</div>
        <div v-for="(s, i) in report.suggestions" :key="i" class="imp">
          <h4>▪ {{ s.title }}</h4>
          <p>{{ s.desc }}</p>
        </div>
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import {
  fetchAssessmentWeeklyReport,
  type AssessmentWeeklyReport,
  type WeeklyMetricCard,
  type WeeklyStoreRow,
} from '../../api/opsDashboard'
import { ASSESS_DEFS, type AssessKey } from '../../utils/opsAssessment'

const props = defineProps<{
  dateKey: string
  city: string
  storeId: string
}>()

const assessDefs = ASSESS_DEFS
const loading = ref(false)
const report = ref<AssessmentWeeklyReport | null>(null)

const merchantMetric = computed(
  () => report.value?.metrics.find((m) => m.key === 'merchant_issue_rate') || null,
)

function gradeCount(g: string) {
  return report.value?.gradeDist.find((x) => x.grade === g)?.count || 0
}
const saCnt = computed(() => gradeCount('S') + gradeCount('A'))
const bCnt = computed(() => gradeCount('B'))
const cdCnt = computed(() => gradeCount('C') + gradeCount('D'))
const dCnt = computed(() => gradeCount('D'))
function pct(n: number) {
  const total = report.value?.storeCnt || 0
  return total ? Math.round((n / total) * 100) : 0
}

function fmtVal(v: number, unit: '%' | 'min' | string) {
  if (unit === 'min') return v.toFixed(2)
  return `${v.toFixed(2)}%`
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
  const unit = m.unit === 'min' ? '' : 'pp'
  return `${arrow} ${sign}${m.delta}${unit}`
}

function partOf(row: WeeklyStoreRow, key: AssessKey) {
  return row.parts.find((p) => p.key === key)
}

function fmtPart(row: WeeklyStoreRow, key: AssessKey) {
  const p = partOf(row, key)
  if (!p) return '—'
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
  const unit = key === 'warehouse_t' ? '' : 'pp'
  return `${arrow} ${sign}${d}${unit}`
}

async function reload() {
  if (!props.dateKey) {
    report.value = null
    return
  }
  loading.value = true
  try {
    report.value = await fetchAssessmentWeeklyReport(props.dateKey, props.city, props.storeId)
  } finally {
    loading.value = false
  }
}

watch(
  () => [props.dateKey, props.city, props.storeId] as const,
  () => void reload(),
  { immediate: true },
)
</script>

<style scoped lang="scss">
.report {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding-bottom: 24px;
  color: var(--ops-text, #1f2937);
}
.hint {
  text-align: center;
  color: var(--ops-muted, #94a3b8);
  padding: 32px;
}
.card {
  background: var(--ops-surface, #fff);
  border-radius: var(--ops-radius, 10px);
  padding: 16px 18px;
  border: 1px solid var(--ops-border, #e8eaef);
  box-shadow: var(--ops-shadow, none);
}
.standards summary {
  cursor: pointer;
  font-weight: 700;
  color: var(--ops-text, #1f2937);
  font-size: 14px;
  list-style: none;
  &::-webkit-details-marker {
    display: none;
  }
}
.std-grid {
  margin-top: 12px;
}
.sec-head {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 16px;
  font-weight: 800;
  color: var(--ops-text, #1f2937);
  margin-bottom: 12px;
  .no {
    display: inline-flex;
    width: 24px;
    height: 24px;
    border-radius: 6px;
    background: var(--ops-primary-soft, #eff6ff);
    color: var(--ops-primary, #3b82f6);
    align-items: center;
    justify-content: center;
    font-size: 13px;
    font-family: var(--ops-font-num, Rajdhani, monospace);
    font-weight: 700;
    flex-shrink: 0;
  }
}
.banner {
  background: var(--ops-primary-soft, #eff6ff);
  color: var(--ops-primary, #3b82f6);
  border-radius: 10px;
  padding: 10px 14px;
  font-weight: 700;
  font-size: 13px;
  margin-bottom: 14px;
}
.metric-cards {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 10px;
  margin-bottom: 12px;
}
.mc {
  border: 1px solid var(--ops-border, #e8eaef);
  border-radius: 10px;
  padding: 12px 14px;
  background: var(--ops-info-bg, #eff6ff);
  &.pass {
    background: var(--ops-info-bg, #eff6ff);
  }
  &.fail {
    background: var(--ops-bad-bg, #fef2f2);
    border-color: #fecaca;
  }
  .name {
    font-size: 12px;
    color: var(--ops-muted, #94a3b8);
    font-weight: 600;
  }
  .val {
    display: block;
    font-size: 26px;
    font-weight: 800;
    font-family: var(--ops-font-num, Rajdhani, monospace);
    font-variant-numeric: tabular-nums;
    line-height: 1.15;
    margin: 6px 0 4px;
    &.ok {
      color: var(--ops-primary, #3b82f6);
    }
    &.bad {
      color: var(--ops-bad, #ef4444);
    }
  }
  .prev {
    font-size: 12px;
    color: var(--ops-muted, #94a3b8);
  }
  .chg {
    font-size: 13px;
    font-weight: 700;
    margin-top: 2px;
    font-family: var(--ops-font-num, Rajdhani, monospace);
  }
  .tag {
    display: inline-block;
    margin-top: 8px;
    font-size: 11px;
    padding: 2px 7px;
    border-radius: 4px;
    font-weight: 700;
    &.pass {
      background: #dbeafe;
      color: #2563eb;
    }
    &.fail {
      background: #fee2e2;
      color: #dc2626;
    }
  }
  .reach {
    margin-top: 6px;
    font-size: 11px;
    color: var(--ops-muted, #94a3b8);
    line-height: 1.5;
  }
}
.merchant-hero {
  display: inline-flex;
  flex-direction: column;
  gap: 2px;
  padding: 12px 14px;
  border-radius: 10px;
  margin-bottom: 12px;
  border: 1px solid var(--ops-border, #e8eaef);
  min-width: 220px;
  &.pass {
    background: var(--ops-info-bg, #eff6ff);
  }
  &.fail {
    background: var(--ops-bad-bg, #fef2f2);
    border-color: #fecaca;
  }
  .name {
    font-size: 13px;
    color: var(--ops-muted, #94a3b8);
    font-weight: 600;
  }
  .val {
    font-size: 28px;
    font-weight: 800;
    font-family: var(--ops-font-num, Rajdhani, monospace);
    line-height: 1.15;
    margin: 4px 0;
    &.ok {
      color: var(--ops-primary, #3b82f6);
    }
    &.bad {
      color: var(--ops-bad, #ef4444);
    }
  }
  .prev {
    font-size: 12px;
    color: var(--ops-muted, #94a3b8);
  }
  .chg {
    font-size: 13px;
    font-weight: 700;
    font-family: var(--ops-font-num, Rajdhani, monospace);
  }
  .tag {
    display: inline-block;
    margin-top: 8px;
    font-size: 11px;
    padding: 2px 7px;
    border-radius: 4px;
    font-weight: 700;
    width: fit-content;
    &.pass {
      background: #dbeafe;
      color: #2563eb;
    }
    &.fail {
      background: #fee2e2;
      color: #dc2626;
    }
  }
}
.scroll {
  max-height: 280px;
  overflow: auto;
  border: 1px solid var(--ops-border-soft, #f0f2f5);
  border-radius: 8px;
  thead th {
    position: sticky;
    top: 0;
    z-index: 1;
    background: #fff;
    box-shadow: 0 1px 0 var(--ops-border-soft, #f0f2f5);
  }
}
table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
  th,
  td {
    padding: 8px 10px;
    text-align: center;
    border-bottom: 1px solid var(--ops-border-soft, #f0f2f5);
    font-variant-numeric: tabular-nums;
    font-family: var(--ops-font-num, Rajdhani, monospace);
  }
  td.lbl,
  th.lbl {
    font-family: var(--ops-font, inherit);
  }
  thead th {
    background: #f8fafc;
    font-weight: 700;
    color: var(--ops-muted, #94a3b8);
    font-size: 12px;
    font-family: var(--ops-font, inherit);
  }
  .lbl {
    text-align: left;
    font-weight: 600;
    color: var(--ops-text, #1f2937);
  }
}
.detail thead th {
  white-space: nowrap;
}
.delta-cell {
  font-size: 11px;
  white-space: nowrap;
}
.ok {
  color: var(--ops-ok, #10b981);
  font-weight: 700;
}
.bad {
  color: var(--ops-bad, #ef4444);
  font-weight: 700;
}
.worse {
  color: var(--ops-bad, #ef4444);
  font-weight: 700;
}
.better {
  color: var(--ops-ok, #10b981);
  font-weight: 700;
}
.flat {
  color: var(--ops-muted, #94a3b8);
}
.note {
  font-size: 12px;
  color: var(--ops-muted, #94a3b8);
  margin-top: 10px;
  line-height: 1.7;
  .g-s {
    color: #10b981;
  }
  .g-a {
    color: #3b82f6;
  }
  .g-b {
    color: #f59e0b;
  }
  .g-c {
    color: #f97316;
  }
  .g-d {
    color: #ef4444;
  }
}
.ggrid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 10px;
}
.gcell {
  border-radius: 10px;
  padding: 14px 8px;
  text-align: center;
  border: 1px solid transparent;
  .n {
    font-size: 28px;
    font-weight: 800;
    font-family: var(--ops-font-num, Rajdhani, monospace);
    line-height: 1.1;
  }
  .t {
    font-size: 12px;
    margin-top: 4px;
    font-weight: 600;
  }
}
.gS {
  background: #ecfdf5;
  color: #10b981;
  border-color: #a7f3d0;
}
.gA {
  background: #eff6ff;
  color: #3b82f6;
  border-color: #bfdbfe;
}
.gB {
  background: #fffbeb;
  color: #d97706;
  border-color: #fde68a;
}
.gC {
  background: #fff7ed;
  color: #ea580c;
  border-color: #fed7aa;
}
.gD {
  background: #fef2f2;
  color: #ef4444;
  border-color: #fecaca;
}
.grade-note {
  margin-top: 14px;
  font-size: 13px;
  color: var(--ops-text-2, #64748b);
  line-height: 1.9;
  p {
    margin: 0;
  }
  b {
    color: var(--ops-text, #1f2937);
  }
}
.badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 4px;
  font-weight: 800;
  font-size: 12px;
  font-family: var(--ops-font-num, Rajdhani, monospace);
}
.bS {
  background: #ecfdf5;
  color: #10b981;
}
.bA {
  background: #eff6ff;
  color: #3b82f6;
}
.bB {
  background: #fffbeb;
  color: #d97706;
}
.bC {
  background: #fff7ed;
  color: #ea580c;
}
.bD {
  background: #fef2f2;
  color: #ef4444;
}
tr.f0 > td {
  background: #f8fafc;
}
tr.f1 > td {
  background: #fffbeb;
}
tr.f2 > td {
  background: #fff7ed;
}
tr.f3 > td {
  background: #ffedd5;
}
tr.f4 > td {
  background: #fee2e2;
}
tr.f5 > td {
  background: #fecaca;
}
tr.f0 > td:first-child {
  box-shadow: inset 3px 0 0 #10b981;
}
tr.f1 > td:first-child {
  box-shadow: inset 3px 0 0 #f59e0b;
}
tr.f2 > td:first-child {
  box-shadow: inset 3px 0 0 #f97316;
}
tr.f3 > td:first-child {
  box-shadow: inset 3px 0 0 #ef4444;
}
tr.f4 > td:first-child {
  box-shadow: inset 3px 0 0 #dc2626;
}
tr.f5 > td:first-child {
  box-shadow: inset 3px 0 0 #b91c1c;
}
.flegend {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 10px;
  font-size: 12px;
  color: var(--ops-text-2, #64748b);
  .it {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .sw {
    width: 22px;
    height: 14px;
    border-radius: 4px;
    border: 1px solid var(--ops-border, #e8eaef);
  }
  .sw0 {
    background: #f8fafc;
  }
  .sw1 {
    background: #fffbeb;
  }
  .sw2 {
    background: #fff7ed;
  }
  .sw3 {
    background: #ffedd5;
  }
  .sw4 {
    background: #fee2e2;
  }
  .sw5 {
    background: #fecaca;
  }
}
.imp {
  border-left: 3px solid var(--ops-primary, #3b82f6);
  background: #f8fafc;
  padding: 12px 16px;
  margin-bottom: 10px;
  border-radius: 0 8px 8px 0;
  h4 {
    color: var(--ops-text, #1f2937);
    font-size: 14px;
    margin: 0 0 6px;
  }
  p {
    margin: 0;
    font-size: 13px;
    color: var(--ops-text-2, #64748b);
    line-height: 1.55;
  }
}
@media (max-width: 1280px) {
  .metric-cards,
  .ggrid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
