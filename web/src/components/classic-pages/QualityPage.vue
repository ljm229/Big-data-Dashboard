<!-- 中文名：运营质量 —— 门店营运考核（数据源1 翱象考核表） -->
<template>
  <div class="ck-page">
    <p v-if="!hasAssessData" class="empty-hint">当前日期暂无营运考核数据，请切换有考核包的日期（静态包已导入翱象考核表）。</p>

    <template v-else>
    <section class="ck-kpi-row">
        <ClassicKpi
          name="参评门店"
          :value="String(kpis.storeCnt)"
          :hints="[{ label: compareHintPrefix, value: countDeltaText(kpis.storeDelta), tone: hintTone(kpis.storeDelta, false) }]"
        />
        <ClassicKpi
          name="综合合格率"
          :value="kpis.passRateText"
          :hints="[{ label: compareHintPrefix, value: ppDeltaText(kpis.passRateDelta), tone: hintTone(kpis.passRateDelta, false) }]"
        />
        <ClassicKpi
          name="D红线店"
          :value="String(kpis.dCnt)"
          :hints="[{ label: compareHintPrefix, value: countDeltaText(kpis.dDelta), tone: hintTone(kpis.dDelta, true) }]"
          :val-tone="kpis.dCnt ? 'is-red' : ''"
        />
        <ClassicKpi
          name="未达标指标"
          :value="String(kpis.failParts)"
          :hints="[{ label: compareHintPrefix, value: countDeltaText(kpis.failPartsDelta), tone: hintTone(kpis.failPartsDelta, true) }]"
        />
        <ClassicKpi
          :name="improveName"
          :value="String(kpis.improved)"
          :hints="[{ label: compareHintPrefix, value: kpis.prevAvailable ? `+${kpis.improved}` : '—', tone: 'is-green' }]"
        />
        <ClassicKpi name="待整改 / 逾期" :value="`${kpis.todoCnt} / 0`" :hint="kpis.prevAvailable ? `待整改 ${kpis.todoCnt}` : '闭环台账待接入'" />
    </section>

    <section class="ck-grid-quality-top">
      <div class="ck-stack">
        <article class="ck-card">
          <header class="ck-card__head"><h3>质量状态概览</h3></header>
          <div class="split">
              <div ref="donutEl" class="donut-chart" />
              <ul>
                <li v-for="g in gradeDistView" :key="g.grade">
                  <i :style="{ background: g.color }" />
                  <span>{{ g.grade === 'N' ? g.label : `${g.grade} ${g.label}` }}</span>
                  <b>{{ g.count }}</b>
                  <em>{{ g.share }}</em>
                </li>
            </ul>
          </div>
        </article>
        <article class="ck-card">
          <header class="ck-card__head"><h3>核心指标合格率</h3></header>
          <div class="bars">
              <div v-for="m in metricPassRates" :key="m.key" class="ck-hbar" :class="m.tone">
                <span :title="m.name">{{ m.shortName }}</span>
                <i><em :style="{ width: `${m.rate}%` }" /></i>
                <b>{{ m.rate.toFixed(1) }}%</b>
            </div>
          </div>
        </article>
      </div>

        <article class="ck-card heat-card">
        <header class="ck-card__head">
          <h3>门店 × 指标热力矩阵</h3>
            <div class="ck-pills" role="tablist" aria-label="矩阵筛选">
              <button type="button" :class="{ active: heatFilter === 'all' }" @click="heatFilter = 'all'">全部</button>
              <button type="button" :class="{ active: heatFilter === 'pass' }" @click="heatFilter = 'pass'">优秀 S/A</button>
              <button type="button" :class="{ active: heatFilter === 'warn' }" @click="heatFilter = 'warn'">预警 B</button>
              <button type="button" :class="{ active: heatFilter === 'fail' }" @click="heatFilter = 'fail'">不合格 C/D</button>
          </div>
        </header>
          <div class="table-scroll">
            <table class="ck-table heat">
          <thead>
            <tr>
                  <th>#</th>
                  <th>门店</th>
                  <th v-for="d in assessDefs" :key="d.key">{{ d.shortName }}</th>
              <th>综合</th>
            </tr>
          </thead>
          <tbody>
                <tr
                  v-for="(row, i) in heatRows"
                  :key="row.shortName"
                  :class="{ active: selectedStoreId === row.shortName }"
                  @click="selectStore(row.shortName)"
                >
                  <td>{{ i + 1 }}</td>
                  <td class="name" :title="row.name">{{ short(row.shortName) }}</td>
                  <td v-for="d in assessDefs" :key="d.key">
                    <button
                      type="button"
                      class="cell"
                      :class="cellTone(row, d.key)"
                      :title="cellTitle(row, d.key)"
                      @click.stop="selectStore(row.shortName, d.key)"
                    >
                      {{ fmtPart(row, d.key) }}
                    </button>
                  </td>
                  <td><span class="ck-tag" :class="'g-' + row.grade.grade">{{ row.grade.grade }}</span></td>
                </tr>
                <tr v-if="!heatRows.length">
                  <td :colspan="3 + assessDefs.length" class="void">当前筛选下暂无门店</td>
            </tr>
          </tbody>
        </table>
          </div>
      </article>

      <article class="ck-card">
        <header class="ck-card__head">
          <h3>门店详情</h3>
            <SelectMenu
              class="store-select"
              variant="light"
              :model-value="selectedStoreId"
              :options="storeSelectOptions"
              search-placeholder="选择门店"
              @update:model-value="selectStore"
            />
        </header>
          <div v-if="selectedRow" class="detail">
            <div class="detail__title">{{ selectedRow.name || selectedRow.shortName }}</div>
            <div class="detail__meta">
              <span class="ck-tag" :class="'g-' + selectedRow.grade.grade">
                {{ selectedRow.grade.grade }} {{ selectedRow.grade.label }}
              </span>
              <span class="muted">{{ selectedRow.city || '—' }} · 综合分 {{ selectedRow.composite.toFixed(1) }}</span>
            </div>
          <table class="ck-table">
            <thead>
              <tr><th>考核指标</th><th>实际值</th><th>达标阈值</th><th>状态</th></tr>
            </thead>
            <tbody>
                <tr v-for="p in selectedRow.parts" :key="p.key" :class="{ focus: focusMetric === p.key }">
                  <td>{{ p.name }}</td>
                  <td>{{ formatAssessDisplay(p.missing ? null : p.value, p.unit) }}</td>
                  <td>{{ p.lowerBetter ? '≤' : '≥' }}{{ p.passLine }}{{ p.unit === 'min' ? ' 分钟' : '%' }}</td>
                  <td>
                    <span class="ck-tag" :class="p.missing ? '' : p.pass ? 'ok' : 'bad'">
                      {{ p.missing ? '无数据' : p.pass ? '合格' : '不合格' }}
                    </span>
                  </td>
              </tr>
            </tbody>
          </table>
            <p class="rule-note">规则版本：五项加权（售罄40% · 错漏拣20% · 仓配10% · 商责20% · 回复10%）。仓配时效单位为分钟。</p>
        </div>
          <p v-else class="void pad">请选择门店查看考核证据</p>
      </article>
    </section>

    <section class="ck-grid-quality-bot">
      <article class="ck-card">
        <header class="ck-card__head">
          <h3>问题门店排行</h3>
          <span class="ck-tag">Top 5</span>
        </header>
        <table class="ck-table">
          <thead>
              <tr><th>#</th><th>门店</th><th>城市</th><th>未达标</th><th>综合</th><th>业务影响</th><th>整改</th></tr>
          </thead>
          <tbody>
              <tr v-for="(row, i) in problemRows" :key="row.shortName" @click="selectStore(row.shortName)">
                <td><span class="ck-rank" :class="'is-' + (i + 1)">{{ i + 1 }}</span></td>
                <td class="name">{{ short(row.shortName) }}</td>
                <td>{{ row.city || '—' }}</td>
                <td>{{ failTags(row).length }}项</td>
                <td><span class="ck-tag" :class="'g-' + row.grade.grade">{{ row.grade.grade }}</span></td>
                <td>{{ impactLabel(row) }}</td>
                <td><span class="ck-tag bad">待整改</span></td>
              </tr>
              <tr v-if="!problemRows.length">
                <td colspan="7" class="void">暂无问题门店</td>
            </tr>
          </tbody>
        </table>
      </article>

      <article class="ck-card">
        <header class="ck-card__head">
          <h3>指标趋势</h3>
            <SelectMenu
              class="metric-select"
              variant="light"
              :model-value="trendMetric"
              :options="metricOptions"
              :searchable="false"
              @update:model-value="onTrendMetric"
            />
        </header>
          <div ref="trendEl" class="trend-chart" />
      </article>

      <article class="ck-card">
        <header class="ck-card__head">
            <h3>整改建议</h3>
            <p>分析后 · 共 {{ adviceRows.length }} 条</p>
        </header>
          <ul v-if="adviceRows.length" class="advice-list">
            <li v-for="(row, i) in adviceRows" :key="row.id" :class="'tone-' + (i % 5)">
              <strong>{{ row.title }}</strong>
              <span>{{ row.desc }}</span>
            </li>
          </ul>
          <p v-else class="void pad">当前筛选下五项指标均达标，暂无整改建议</p>
      </article>
    </section>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import ClassicKpi from './ClassicKpi.vue'
import SelectMenu from '../SelectMenu.vue'
import { useFilterStore } from '../../stores/filter'
import { useStoreScore } from '../../composables/useStoreScore'
import { useChart } from '../../composables/useChart'
import { fetchAssessmentBoard } from '../../api/opsDashboard'
import { getAssessmentAvailableDates, resolveAssessmentWeekId } from '../../api/dashboard'
import {
  ASSESS_DEFS,
  formatAssessDisplay,
  type AssessKey,
} from '../../utils/opsAssessment'

const filter = useFilterStore()
const { cityName, selectedStore, selectedCities, selectedStores, cityQuery, storeQuery, selectedDate, periodMode, compareKey } = storeToRefs(filter)
const {
  city,
  storeId,
  assessKey,
  hasAssessData,
  assessBoard,
  assessRows,
  gradeDist,
  failTags,
  fmtPart,
} = useStoreScore()

const heatFilter = ref<'all' | 'pass' | 'warn' | 'fail'>('all')
const selectedStoreId = ref('')
const focusMetric = ref<AssessKey | ''>('')
const trendMetric = ref<AssessKey>('sellout_rate')
const prevBoard = ref<Awaited<ReturnType<typeof fetchAssessmentBoard>> | null>(null)
const trendSeries = ref<Array<{ date: string; value: number | null; passLine: number }>>([])

const donutEl = ref<HTMLElement | null>(null)
const trendEl = ref<HTMLElement | null>(null)
const donutOpt = ref<any>(null)
const trendOpt = ref<any>(null)
useChart(donutEl, donutOpt)
useChart(trendEl, trendOpt)

const assessDefs = ASSESS_DEFS

/** 实际取到的考核键（所选日无包时会回退） */
const resolvedAssessKey = computed(
  () => assessBoard.value?.weekId || resolveAssessmentWeekId(assessKey.value) || '',
)

const compareHintPrefix = computed(() => {
  if (periodMode.value === 'week') return '周比'
  if (periodMode.value === 'month') return '月比'
  return '日比'
})

const improveName = computed(() => {
  if (periodMode.value === 'week') return '周比改善'
  if (periodMode.value === 'month') return '月比改善'
  return '日比改善'
})

const storeSelectOptions = computed(() => [
  { value: '', label: '选择门店' },
  ...assessRows.value.map((r) => ({ value: r.shortName, label: short(r.shortName) })),
])

const metricOptions = computed(() =>
  ASSESS_DEFS.map((d) => ({ value: d.key, label: d.name })),
)

const gradeDistView = computed(() => {
  const total = Math.max(1, assessRows.value.length)
  return gradeDist.value.map((g) => ({
    ...g,
    share: `${((g.count / total) * 100).toFixed(2)}%`,
  }))
})

function isMissingAssessRow(row: (typeof assessRows.value)[number]) {
  return !!row.empty || (row.parts.length > 0 && row.parts.every((p) => p.missing))
}

const metricPassRates = computed(() =>
  ASSESS_DEFS.map((d) => {
    const rows = assessRows.value.filter((r) => {
      const p = r.parts.find((x) => x.key === d.key)
      return p && !p.missing
    })
    const pass = rows.filter((r) => r.parts.find((x) => x.key === d.key)?.pass).length
    const rate = rows.length ? (pass / rows.length) * 100 : 0
    return {
      key: d.key,
      name: d.name,
      shortName: d.shortName,
      rate,
      // 与 S/A/B/C/D 色阶对齐，避免黄橙挤在一起
      tone: rate >= 80 ? 'green' : rate >= 60 ? 'amber' : rate >= 40 ? 'orange' : 'red',
    }
  }),
)

const heatRows = computed(() => {
  let rows = [...assessRows.value]
  if (heatFilter.value === 'pass') {
    rows = rows.filter((r) => !isMissingAssessRow(r) && (r.grade.grade === 'S' || r.grade.grade === 'A'))
  } else if (heatFilter.value === 'warn') {
    rows = rows.filter((r) => !isMissingAssessRow(r) && r.grade.grade === 'B')
  } else if (heatFilter.value === 'fail') {
    rows = rows.filter((r) => !isMissingAssessRow(r) && (r.grade.grade === 'C' || r.grade.grade === 'D'))
  }
  return rows.slice(0, 24)
})

const selectedRow = computed(() =>
  assessRows.value.find((r) => r.shortName === selectedStoreId.value) || null,
)

const problemRows = computed(() =>
  [...assessRows.value]
    .filter((r) => !isMissingAssessRow(r) && (failTags(r).length > 0 || r.composite < 60))
    .sort((a, b) => failTags(b).length - failTags(a).length || a.composite - b.composite)
    .slice(0, 5),
)

const adviceRows = computed(() => {
  const rows = assessRows.value
  const out: Array<{ id: string; title: string; desc: string }> = []
  for (const d of ASSESS_DEFS) {
    const withVal = rows.filter((r) => {
      const p = r.parts.find((x) => x.key === d.key)
      return p && !p.missing
    })
    if (!withVal.length) continue
    const avg =
      withVal.reduce((sum, r) => sum + (r.parts.find((p) => p.key === d.key)?.value || 0), 0) /
      withVal.length
    const overallPass = d.lowerBetter ? avg <= d.passLine : avg >= d.passLine
    if (overallPass) continue

    const worst = [...withVal]
      .sort((a, b) => {
        const av = a.parts.find((p) => p.key === d.key)!.value
        const bv = b.parts.find((p) => p.key === d.key)!.value
        return d.lowerBetter ? bv - av : av - bv
      })
      .slice(0, 3)

    const fmt = (v: number) =>
      d.unit === 'min' ? Number(v.toFixed(1)).toString() : `${Number(v.toFixed(2))}%`
    out.push({
      id: d.key,
      title: `${d.name} 未达标`,
      desc: `需重点整改门店：${worst
        .map((s) => `${short(s.shortName)}(${fmt(s.parts.find((p) => p.key === d.key)!.value)})`)
        .join('、')}。`,
    })
  }

  const dStores = rows.filter((r) => !isMissingAssessRow(r) && r.grade.grade === 'D')
  if (dStores.length) {
    const actionHint =
      periodMode.value === 'day' ? '今日内' : periodMode.value === 'month' ? '本月内' : '本周内'
    out.push({
      id: 'grade-d',
      title: `D 红线店 ${dStores.length} 家`,
      desc: `${dStores.map((s) => short(s.shortName)).join('、')}。逐店挂账跟踪，${actionHint}制定一店一策专项改善动作。`,
    })
  }
  return out
})

const kpis = computed(() => {
  const rows = assessRows.value
  const scored = rows.filter((r) => !isMissingAssessRow(r))
  const storeCnt = scored.length
  const passCnt = scored.filter((r) => r.composite >= 80).length
  const passRate = storeCnt ? passCnt / storeCnt : 0
  const dCnt = scored.filter((r) => r.grade.grade === 'D').length
  const failParts = scored.reduce((n, r) => n + r.parts.filter((p) => !p.missing && !p.pass).length, 0)
  const prev = prevBoard.value
  const prevScored = prev ? prev.rows.filter((r) => !isMissingAssessRow(r)) : []
  const prevAvailable = !!prev && prevScored.length > 0
  const prevPassRate = prevAvailable
    ? prevScored.filter((r) => r.composite >= 80).length / prevScored.length
    : null
  const prevD = prevAvailable ? prevScored.filter((r) => r.grade.grade === 'D').length : null
  const prevFail = prevAvailable
    ? prevScored.reduce((n, r) => n + r.parts.filter((p) => !p.missing && !p.pass).length, 0)
    : null
  let improved = 0
  if (prev) {
    const prevMap = new Map(
      prev.rows.filter((r) => !isMissingAssessRow(r)).map((r) => [r.shortName, r.composite]),
    )
    for (const r of scored) {
      const before = prevMap.get(r.shortName)
      if (before != null && r.composite > before + 0.5) improved += 1
    }
  }
  return {
    storeCnt,
    storeDelta: prevAvailable ? storeCnt - prevScored.length : null,
    passRateText: `${(passRate * 100).toFixed(2)}%`,
    passRateDelta: prevPassRate == null ? null : passRate - prevPassRate,
    dCnt,
    dDelta: prevD == null ? null : dCnt - prevD,
    failParts,
    failPartsDelta: prevFail == null ? null : failParts - prevFail,
    improved,
    todoCnt: problemRows.value.length,
    prevAvailable,
  }
})

function short(name: string) {
  return String(name || '').replace(/^淘宝便利店/, '').replace(/[（）()]/g, '')
}
function hintText(delta: number | null, asPp = false) {
  const prefix = compareHintPrefix.value
  if (delta == null) return `${prefix} —`
  const v = asPp ? delta * 100 : delta
  const sign = v > 0 ? '+' : ''
  return asPp ? `${prefix} ${sign}${v.toFixed(1)}%` : `${prefix} ${sign}${Math.round(v)}`
}
function countDeltaText(delta: number | null) {
  if (delta == null) return '—'
  const sign = delta > 0 ? '+' : ''
  return `${sign}${Math.round(delta)}`
}
function ppDeltaText(delta: number | null) {
  if (delta == null) return '—'
  const v = delta * 100
  const sign = v > 0 ? '+' : ''
  return `${sign}${v.toFixed(1)}%`
}
function hintTone(delta: number | null, invert: boolean): '' | 'is-red' | 'is-green' {
  if (delta == null || delta === 0) return ''
  const good = invert ? delta < 0 : delta > 0
  return good ? 'is-green' : 'is-red'
}
function cellTone(row: (typeof assessRows.value)[number], key: AssessKey) {
  const p = row.parts.find((x) => x.key === key)
  if (!p || p.missing) return 'miss'
  if (p.tier === 'excellent' || p.tier === 'pass') return 'ok'
  if (p.tier === 'warn') return 'warn'
  return 'bad'
}
function cellTitle(row: (typeof assessRows.value)[number], key: AssessKey) {
  const p = row.parts.find((x) => x.key === key)
  if (!p) return ''
  return `${p.name} ${formatAssessDisplay(p.missing ? null : p.value, p.unit)} · ${p.tierLabel}`
}
function impactLabel(row: (typeof assessRows.value)[number]) {
  if (row.grade.grade === 'D' || failTags(row).length >= 3) return '较大'
  if (failTags(row).length >= 2 || row.grade.grade === 'C') return '中等'
  return '一般'
}
function selectStore(id: string | string[], metric: AssessKey | '' = '') {
  const next = Array.isArray(id) ? id[0] || '' : id
  selectedStoreId.value = next
  focusMetric.value = metric
  if (next) filter.setStore(next)
}
function onTrendMetric(v: string | string[]) {
  const next = Array.isArray(v) ? v[0] || '' : v
  if (ASSESS_DEFS.some((d) => d.key === next)) trendMetric.value = next as AssessKey
}

function buildDonut() {
  const data = gradeDistView.value.filter((g) => g.count > 0).map((g) => ({
    name: g.grade === 'N' ? g.label : `${g.grade} ${g.label}`,
    value: g.count,
    itemStyle: { color: g.color },
  }))
  const total = data.reduce((n, d) => n + d.value, 0)
  const top = data.slice().sort((a, b) => b.value - a.value)[0]
  const topLabel = top?.name === '缺数据' ? '缺' : (top?.name.split(' ')[0] || '')
  donutOpt.value = {
    animation: false,
    tooltip: {
      trigger: 'item',
      confine: true,
      formatter: (p: any) => `${p.name}<br/>${p.value} 家（${Number(p.percent).toFixed(2)}%）`,
    },
    series: [{
      type: 'pie',
      radius: ['48%', '72%'],
      center: ['50%', '52%'],
      avoidLabelOverlap: true,
      label: { show: false },
      labelLine: { show: false },
      emphasis: {
        scale: false,
        label: { show: false },
        labelLine: { show: false },
      },
      data: data.length ? data : [{ name: '暂无', value: 1, itemStyle: { color: '#e2e8f0' } }],
    }],
    graphic: top && total
      ? [
          {
            type: 'text',
            left: 'center',
            top: '42%',
            style: {
              text: topLabel,
              fill: '#0f172a',
              fontSize: 16,
              fontWeight: 800,
              textAlign: 'center',
            },
          },
          {
            type: 'text',
            left: 'center',
            top: '56%',
            style: {
              text: `${((top.value / total) * 100).toFixed(2)}%`,
              fill: '#64748b',
              fontSize: 11,
              fontWeight: 700,
              textAlign: 'center',
            },
          },
        ]
      : [],
  }
}

function buildTrend() {
  const def = ASSESS_DEFS.find((d) => d.key === trendMetric.value)!
  const cats = trendSeries.value.map((r) => r.date.slice(5))
  const passLine = def.passLine
  const nearBand = def.unit === 'min' ? 0.8 : 3
  const finite = trendSeries.value
    .map((r) => r.value)
    .filter((v): v is number => v != null && Number.isFinite(v))
  const spanVals = finite.length ? [...finite, passLine] : [passLine]
  const lo = Math.min(...spanVals)
  const hi = Math.max(...spanVals)
  const pad = Math.max((hi - lo) * 0.55, def.unit === 'min' ? 0.8 : 4)
  let yMin = Math.max(0, lo - pad)
  let yMax = hi + pad
  // 百分比轴略放开上限，给贴线标签留空，避免挤在 100% 顶边
  if (def.unit === '%') yMax = Math.min(112, Math.max(yMax, passLine + pad))

  const pointData = trendSeries.value.map((r) => {
    if (r.value == null || !Number.isFinite(r.value)) return null
    const v = r.value
    // 贴线或压线：标到线另一侧；远离合格线则标上方
    let position: 'top' | 'bottom' = 'top'
    if (v >= passLine) position = 'top'
    else if (passLine - v <= nearBand) position = 'bottom'
    return {
      value: v,
      label: {
        show: true,
        position,
        distance: 8,
        formatter: def.unit === 'min' ? Number(v).toFixed(1) : `${Number(v).toFixed(1)}%`,
        color: '#334155',
        fontSize: 10,
        backgroundColor: 'rgba(255,255,255,0.88)',
        padding: [1, 3],
        borderRadius: 2,
      },
    }
  })

  trendOpt.value = {
    animationDuration: 200,
    grid: { left: 40, right: 14, top: 36, bottom: 24 },
    tooltip: {
      trigger: 'axis',
      confine: true,
      formatter: (params: any[]) => {
        const i = params[0]?.dataIndex ?? 0
        const row = trendSeries.value[i]
        if (!row) return ''
        const actual = row.value == null ? '—' : formatAssessDisplay(row.value, def.unit)
        const line = `${def.lowerBetter ? '≤' : '≥'}${formatAssessDisplay(passLine, def.unit)}`
        return `${row.date}<br/>实际值 ${actual}<br/>合格线 ${line}`
      },
    },
    legend: {
      top: 2,
      right: 0,
      itemWidth: 14,
      itemHeight: 8,
      textStyle: { color: '#64748b', fontSize: 11 },
    },
    xAxis: {
      type: 'category',
      data: cats,
      boundaryGap: false,
      axisTick: { show: false },
      axisLine: { lineStyle: { color: '#e2e8f0' } },
      axisLabel: { color: '#94a3b8', fontSize: 11 },
    },
    yAxis: {
      type: 'value',
      min: Number(yMin.toFixed(2)),
      max: Number(yMax.toFixed(2)),
      scale: false,
      splitNumber: 4,
      splitLine: { lineStyle: { color: '#eef2f7' } },
      axisLabel: {
        color: '#94a3b8',
        fontSize: 11,
        formatter: (v: number) => (def.unit === 'min' ? `${Number(v).toFixed(1)}` : `${Number(v).toFixed(0)}%`),
      },
    },
    series: [
      {
        name: '实际值',
        type: 'line',
        smooth: 0.2,
        symbolSize: 7,
        data: pointData,
        lineStyle: { width: 2.5, color: '#1d6bff' },
        itemStyle: { color: '#1d6bff' },
        labelLayout: { hideOverlap: true, moveOverlap: 'shiftY' },
        markLine: {
          silent: true,
          symbol: 'none',
          label: {
            show: true,
            position: 'insideEndTop',
            formatter: `合格 ${def.lowerBetter ? '≤' : '≥'}${def.unit === 'min' ? passLine : `${passLine}%`}`,
            color: '#b45309',
            fontSize: 10,
            backgroundColor: 'rgba(255,255,255,0.9)',
            padding: [1, 4],
          },
          lineStyle: { width: 1.5, type: 'dashed', color: '#d97706' },
          data: [{ yAxis: passLine, name: '合格线' }],
        },
      },
      {
        // 仅占图例，不画第二根线，避免与 markLine 双重叠
        name: '合格线',
        type: 'line',
        data: [],
        symbol: 'none',
        lineStyle: { width: 1.5, type: 'dashed', color: '#d97706' },
        itemStyle: { color: '#d97706' },
      },
    ],
  }
}

async function loadPrev() {
  let prevDate: string | null = null

  if (periodMode.value === 'week' || periodMode.value === 'month') {
    const raw = compareKey.value
    prevDate = raw ? resolveAssessmentWeekId(raw) || raw : null
  } else {
    const dates = getAssessmentAvailableDates().sort()
    const resolved =
      (assessBoard.value?.weekId && /^\d{4}-\d{2}-\d{2}$/.test(assessBoard.value.weekId)
        ? assessBoard.value.weekId
        : null) || resolveAssessmentWeekId(assessKey.value)
    if (resolved && /^\d{4}-\d{2}-\d{2}$/.test(resolved)) {
      const idx = dates.indexOf(resolved)
      prevDate = idx > 0 ? dates[idx - 1] : null
    } else if (resolved?.startsWith('M:')) {
      const first = `${resolved.slice(2)}-01`
      prevDate = [...dates].filter((d) => d < first).pop() || null
    }
  }

  if (!prevDate) {
    prevBoard.value = null
    return
  }
  try {
    prevBoard.value = await fetchAssessmentBoard(prevDate, city.value, storeId.value)
  } catch {
    prevBoard.value = null
  }
}

async function loadTrend() {
  const dates = getAssessmentAvailableDates().sort().slice(-7)
  const def = ASSESS_DEFS.find((d) => d.key === trendMetric.value)!
  const out: Array<{ date: string; value: number | null; passLine: number }> = []
  for (const date of dates) {
    try {
      const board = await fetchAssessmentBoard(date, city.value, storeId.value)
      const metric = board?.metrics.find((m) => m.key === trendMetric.value)
      out.push({ date, value: metric?.value ?? null, passLine: def.passLine })
    } catch {
      out.push({ date, value: null, passLine: def.passLine })
    }
  }
  trendSeries.value = out
  buildTrend()
}

watch(
  [cityQuery, storeQuery, selectedDate],
  () => {
    const cq = cityQuery.value
    city.value = !cq || cq === '全国' || (Array.isArray(cq) && !cq.length)
      ? '全部'
      : Array.isArray(cq)
        ? cq.join('|')
        : cq
    const sq = storeQuery.value
    if (!sq || sq === '全部' || (Array.isArray(sq) && !sq.length)) {
      storeId.value = '全部'
      return
    }
    storeId.value = Array.isArray(sq) ? sq.join('|') : sq
    if (!Array.isArray(sq) || sq.length === 1) {
      selectedStoreId.value = Array.isArray(sq) ? sq[0]! : sq
    }
  },
  { immediate: true },
)

watch(assessRows, (rows) => {
  if (!rows.length) {
    selectedStoreId.value = ''
    return
  }
  if (!rows.some((r) => r.shortName === selectedStoreId.value)) {
    selectedStoreId.value = rows[0].shortName
  }
  buildDonut()
})

watch([assessKey, city, storeId, hasAssessData, periodMode, resolvedAssessKey], async () => {
  if (!hasAssessData.value) return
  await loadPrev()
  await loadTrend()
  await nextTick()
  buildDonut()
})

watch(trendMetric, () => { void loadTrend() })
watch(gradeDistView, () => buildDonut(), { deep: true })
</script>

<style scoped lang="scss">
.empty-hint {
  margin: 0;
  padding: 12px 14px;
  background: var(--ck-card);
  border: 1px dashed var(--ck-line);
  border-radius: 10px;
  color: var(--ck-body);
  font-size: var(--ck-fs-sm);
  font-weight: var(--ck-fw-regular);
}
.split {
  display: grid;
  grid-template-columns: minmax(110px, 40%) minmax(0, 1fr);
  gap: 8px 10px;
  align-items: stretch;
  flex: 1;
  min-height: 0;
  min-width: 0;
  ul {
    margin: 0;
    padding: 0;
    list-style: none;
    display: grid;
    gap: 6px;
    align-content: center;
    min-width: 0;
  }
  li {
    display: grid;
    grid-template-columns: 8px minmax(0, 1fr) 22px 44px;
    gap: 6px;
  align-items: center;
    font-size: var(--ck-fs-xs);
    color: var(--ck-body);
    font-weight: var(--ck-fw-regular);
    min-width: 0;
  }
  i { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
  span {
    min-width: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  b {
    color: var(--ck-text-2);
    font-weight: var(--ck-fw-medium);
    font-variant-numeric: tabular-nums;
    text-align: right;
    white-space: nowrap;
  }
  em {
    color: var(--ck-muted);
    font-style: normal;
    font-weight: var(--ck-fw-regular);
    text-align: right;
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
  }
}
.donut-chart,
.trend-chart {
  width: 100%;
  min-width: 0;
  min-height: 0;
  flex: 1;
  height: auto;
}
.donut-chart { min-height: 120px; }
.trend-chart { min-height: 160px; }
.bars {
  display: grid;
  gap: 8px;
  flex: 1;
  align-content: center;
}
.bars .ck-hbar {
  grid-template-columns: 56px minmax(0, 1fr) 44px;
  span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
}
.heat-card { min-width: 0; }
.table-scroll {
  flex: 1;
  min-height: 0;
  max-height: none;
  overflow: auto;
}
.heat {
  tr { cursor: pointer; height: 36px; }
  tr.active, tr:hover { background: var(--ck-hover); }
  th, td { height: 36px; padding: 0 4px; }
  .name {
    max-width: 72px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-weight: var(--ck-fw-medium);
    color: var(--ck-text);
  }
}
.cell {
  width: 100%;
  height: 28px;
  border: 0;
  border-radius: 3px;
  padding: 0;
  font: var(--ck-fw-medium) 11px/1 var(--ck-font-num);
  cursor: pointer;
  background: var(--ck-line-soft);
  color: var(--ck-body);
  &.ok { background: var(--ck-ok-cell); color: var(--ck-ok); }
  &.warn { background: var(--ck-warn-cell); color: var(--ck-warn); }
  &.bad { background: var(--ck-bad-cell); color: var(--ck-bad); }
  &.miss { background: var(--ck-line-soft); color: var(--ck-muted); }
}
.store-select, .metric-select { width: min(148px, 100%); }
.detail {
  min-width: 0;
  flex: 1;
  overflow: auto;
  display: flex;
  flex-direction: column;
}
.detail__title {
  font-size: var(--ck-fs-md);
  font-weight: var(--ck-fw-title);
  color: var(--ck-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.detail__meta { display: flex; align-items: center; gap: 6px; margin: 6px 0 8px; flex-wrap: wrap; }
.detail tr.focus { background: var(--ck-primary-soft); }
.rule-note, .void, .muted {
  color: var(--ck-muted);
  font-size: var(--ck-fs-xs);
  font-weight: var(--ck-fw-regular);
}
.rule-note { margin: 8px 0 0; line-height: 1.4; word-break: break-word; }
.advice-list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
  flex: 1;
  overflow: auto;
  li {
    margin: 0;
    padding: 8px 10px;
    border-radius: 6px;
    border-left: 3px solid var(--ck-primary);
    background: var(--ck-primary-soft);
    min-width: 0;
  }
  strong {
    display: block;
    margin-bottom: 2px;
    color: var(--ck-primary);
    font-size: var(--ck-fs-xs);
    font-weight: var(--ck-fw-title);
  }
  span {
  display: block;
    color: var(--ck-text-2);
    font-size: var(--ck-fs-xs);
    font-weight: var(--ck-fw-regular);
    line-height: 1.45;
    word-break: break-word;
  }
  /* 仅蓝 / 橙 / 红三态，避免多余色相 */
  .tone-0 { background: var(--ck-primary-soft); border-left-color: var(--ck-primary); }
  .tone-1 { background: var(--ck-warn-soft); border-left-color: var(--ck-warn); }
  .tone-2 { background: var(--ck-bad-soft); border-left-color: var(--ck-bad); }
  .tone-3 { background: var(--ck-ok-soft); border-left-color: var(--ck-ok); }
  .tone-4 { background: var(--ck-bad-soft); border-left-color: var(--ck-bad); }
}
.void { text-align: center; padding: 12px 8px; }
.pad { padding: 16px 8px; }

@media (max-width: 640px) {
  .head-meta {
    width: 100%;
    margin-left: 0;
    flex-wrap: wrap;
    gap: 6px 10px;
  }
  .rules-panel {
    width: min(360px, calc(100vw - 40px));
  }
}
</style>
