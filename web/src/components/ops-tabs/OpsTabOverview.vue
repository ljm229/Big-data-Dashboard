<template>
  <div class="report">
    <p v-if="loading" class="hint">加载周报中…</p>
    <p v-else-if="!report" class="hint">当前筛选下暂无周报数据</p>

    <template v-else>
      <!-- 0 考核标准（可折叠） -->
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
                <td class="ok">{{ d.lowerBetter ? '≤' : '≥' }}{{ d.passLine }}{{ d.unit === 'min' ? '分钟' : '%' }}</td>
                <td class="bad">{{ d.lowerBetter ? '>' : '<' }}{{ d.passLine }}{{ d.unit === 'min' ? '分钟' : '%' }}</td>
              </tr>
            </tbody>
          </table>
          <p class="note">
            满分 100 = 售罄×40% + 错漏拣×20% + 仓T×10% + 商责×20% + IM×10% ·
            <b style="color: #2f9e44">S 90–100</b> ·
            <b style="color: #4dabf7">A 80–90</b> ·
            <b style="color: #fab005">B 60–80</b> ·
            <b style="color: #ff922b">C 40–60</b> ·
            <b style="color: #e03131">D 0–40</b>
          </p>
        </div>
      </details>

      <!-- 1 服务商维度周环比 -->
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
                <td>{{ m.lowerBetter ? '≤' : '≥' }}{{ m.passLine }}{{ m.unit === 'min' ? 'min' : '%' }}</td>
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

      <!-- 2 门店明细升序 -->
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
                <td><b>{{ Math.round(row.composite) }}</b></td>
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
          <span class="it" v-for="n in 6" :key="n">
            <i class="sw" :class="'sw' + (n - 1)" />不合格 {{ n - 1 }} 项
          </span>
        </div>
      </section>

      <!-- 3 评级分档 -->
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

      <!-- 4 商责排行 -->
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

      <!-- 5 改善意见 -->
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
  gap: 14px;
  padding-bottom: 24px;
}
.hint {
  text-align: center;
  color: #8c8c8c;
  padding: 32px;
}
.card {
  background: #fff;
  border-radius: 12px;
  padding: 18px 20px;
  border: 1px solid rgba(42, 92, 130, 0.08);
  box-shadow: 0 2px 10px rgba(30, 58, 95, 0.04);
}
.standards summary {
  cursor: pointer;
  font-weight: 700;
  color: #1e3a5f;
  font-size: 14px;
}
.std-grid {
  margin-top: 12px;
}
.sec-head {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 17px;
  font-weight: 800;
  color: #1e3a5f;
  margin-bottom: 14px;
  .no {
    display: inline-flex;
    width: 26px;
    height: 26px;
    border-radius: 7px;
    background: #2f6fb0;
    color: #fff;
    align-items: center;
    justify-content: center;
    font-size: 14px;
  }
}
.banner {
  background: #eef4fb;
  color: #1e3a5f;
  border-radius: 10px;
  padding: 10px 14px;
  font-weight: 700;
  font-size: 14px;
  margin-bottom: 14px;
}
.metric-cards {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 14px;
}
.mc {
  border: 1px solid #e9ecef;
  border-radius: 10px;
  padding: 14px;
  border-top: 4px solid #ccc;
  &.pass {
    border-top-color: #2f9e44;
  }
  &.fail {
    border-top-color: #e03131;
  }
  .name {
    font-size: 12px;
    color: #868e96;
    font-weight: 600;
  }
  .val {
    font-size: 24px;
    font-weight: 800;
    margin: 6px 0;
    font-variant-numeric: tabular-nums;
  }
  .prev {
    font-size: 12px;
    color: #adb5bd;
  }
  .chg {
    font-size: 12px;
    margin-top: 4px;
  }
  .tag {
    display: inline-block;
    margin-top: 8px;
    font-size: 12px;
    padding: 2px 8px;
    border-radius: 5px;
    &.pass {
      background: #ebfbee;
      color: #2f9e44;
    }
    &.fail {
      background: #fff5f5;
      color: #e03131;
    }
  }
  .reach {
    font-size: 11px;
    color: #868e96;
    margin-top: 6px;
    line-height: 1.6;
  }
}
.merchant-hero {
  display: inline-block;
  min-width: 240px;
  border: 1px solid #e9ecef;
  border-radius: 10px;
  padding: 14px 16px;
  border-top: 4px solid #ccc;
  margin-bottom: 12px;
  &.pass {
    border-top-color: #2f9e44;
  }
  &.fail {
    border-top-color: #e03131;
  }
  .name {
    font-size: 13px;
    color: #868e96;
    font-weight: 600;
  }
  .val {
    font-size: 26px;
    font-weight: 800;
    margin: 6px 0;
  }
  .prev {
    font-size: 12px;
    color: #adb5bd;
  }
  .chg {
    font-size: 12px;
  }
  .tag {
    display: inline-block;
    margin-top: 8px;
    font-size: 12px;
    padding: 2px 8px;
    border-radius: 5px;
    &.pass {
      background: #ebfbee;
      color: #2f9e44;
    }
    &.fail {
      background: #fff5f5;
      color: #e03131;
    }
  }
}
.scroll {
  overflow-x: auto;
}
table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
  th,
  td {
    padding: 9px 10px;
    text-align: center;
    border-bottom: 1px solid #eef0f2;
    font-variant-numeric: tabular-nums;
  }
  thead th {
    background: #f7f8fa;
    font-weight: 700;
    color: #495057;
  }
  .lbl {
    text-align: left;
    font-weight: 600;
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
  color: #2f9e44;
  font-weight: 700;
}
.bad {
  color: #e03131;
  font-weight: 700;
}
.worse {
  color: #e03131;
  font-weight: 700;
}
.better {
  color: #2f9e44;
  font-weight: 700;
}
.flat {
  color: #868e96;
}
.note {
  font-size: 12px;
  color: #868e96;
  margin-top: 10px;
  line-height: 1.7;
}
.ggrid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 10px;
}
.gcell {
  border-radius: 10px;
  padding: 14px;
  text-align: center;
  color: #fff;
  .n {
    font-size: 28px;
    font-weight: 800;
  }
  .t {
    font-size: 12px;
    opacity: 0.92;
    margin-top: 2px;
  }
}
.gS {
  background: #2f9e44;
}
.gA {
  background: #4dabf7;
}
.gB {
  background: #fab005;
}
.gC {
  background: #ff922b;
}
.gD {
  background: #e03131;
}
.grade-note {
  margin-top: 14px;
  font-size: 13px;
  color: #495057;
  line-height: 1.9;
  p {
    margin: 0;
  }
}
.badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 5px;
  font-weight: 700;
  font-size: 12px;
  color: #fff;
}
.bS {
  background: #2f9e44;
}
.bA {
  background: #4dabf7;
}
.bB {
  background: #fab005;
}
.bC {
  background: #ff922b;
}
.bD {
  background: #e03131;
}
tr.f0 > td {
  background: #ebfbee;
}
tr.f1 > td {
  background: #f4fce3;
}
tr.f2 > td {
  background: #fff9db;
}
tr.f3 > td {
  background: #fff4e6;
}
tr.f4 > td {
  background: #ffe8e8;
}
tr.f5 > td {
  background: #ffd9d9;
}
tr.f0 > td:first-child {
  box-shadow: inset 4px 0 0 #2f9e44;
}
tr.f1 > td:first-child {
  box-shadow: inset 4px 0 0 #82c91e;
}
tr.f2 > td:first-child {
  box-shadow: inset 4px 0 0 #fab005;
}
tr.f3 > td:first-child {
  box-shadow: inset 4px 0 0 #ff922b;
}
tr.f4 > td:first-child {
  box-shadow: inset 4px 0 0 #e03131;
}
tr.f5 > td:first-child {
  box-shadow: inset 4px 0 0 #a61e1e;
}
.flegend {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 10px;
  font-size: 12px;
  color: #495057;
  .it {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .sw {
    width: 22px;
    height: 14px;
    border-radius: 4px;
    border: 1px solid #dee2e6;
  }
  .sw0 {
    background: #ebfbee;
  }
  .sw1 {
    background: #f4fce3;
  }
  .sw2 {
    background: #fff9db;
  }
  .sw3 {
    background: #fff4e6;
  }
  .sw4 {
    background: #ffe8e8;
  }
  .sw5 {
    background: #ffd9d9;
  }
}
.imp {
  border-left: 4px solid #2f6fb0;
  background: #f8f9fb;
  padding: 12px 16px;
  margin-bottom: 10px;
  border-radius: 0 8px 8px 0;
  h4 {
    color: #1e3a5f;
    font-size: 14px;
    margin: 0 0 6px;
  }
  p {
    margin: 0;
    font-size: 13px;
    color: #495057;
  }
}
@media (max-width: 1280px) {
  .metric-cards,
  .ggrid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
