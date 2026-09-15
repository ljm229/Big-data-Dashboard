<template>
  <section class="ck-page traffic-page" aria-label="流量转化分析">
    <div class="tf-toolbar">
      <button
        v-if="selectedSource"
        class="tf-chip"
        @click="selectedSource = ''"
        :aria-label="`清除来源筛选：${selectedSource}`"
      >{{ selectedSource }} ×</button>
      <button class="tf-text-btn" type="button" @click="showBasis">口径 ↗</button>
    </div>

    <section class="ck-kpi-row">
      <ClassicKpi
        v-for="card in kpiCards"
        :key="card.key"
        :name="card.label"
        :value="card.value"
        :unit="card.unit"
        :hints="[
          { label: '日比', value: `${card.dayArrow}${card.dayText}`, tone: card.dayTone },
          { label: '周比', value: `${card.weekArrow}${card.weekText}`, tone: card.weekTone },
        ]"
      />
    </section>

    <div v-if="!baseRows.length" class="tf-no-data" role="status">
      <b>当前筛选没有流量记录</b>
      <span>未使用其他日期或其他数据包补齐，也不会将缺失人数显示为 0。</span>
      <button class="tf-primary" @click="resetLocation">查看全部有数据门店</button>
    </div>

    <div class="ck-grid-traffic tf-row">
      <article class="ck-card tf-card">
        <header class="ck-card__head">
          <h3>流量转化漏斗</h3>
          <p>{{ rangeLabel }}</p>
        </header>
        <div v-if="rows.length" class="tf-funnel-wrap">
          <div class="tf-funnel">
            <div v-for="(step, i) in funnel" :key="step.label" :class="`step-${i}`">
              <span>{{ step.label }}</span><strong>{{ compactOrDash(step.value) }}</strong>
            </div>
          </div>
          <div class="tf-funnel-rates">
            <div v-for="rate in funnelRates" :key="rate.label">
              <span>{{ rate.label }}</span>
              <strong>{{ rate.value }}</strong>
              <small :class="rate.tone">日比 {{ rate.arrow }}{{ rate.delta }}</small>
            </div>
          </div>
        </div>
        <div v-else class="ck-empty"><b>暂无匹配的流量数据</b></div>
      </article>

      <article class="ck-card tf-card">
        <header class="ck-card__head">
          <h3>流量与转化趋势</h3>
          <div class="tf-segments tf-small" role="group" aria-label="趋势范围">
            <button :aria-pressed="trendSpan === 'range'" @click="trendSpan = 'range'">当前筛选</button>
            <button :aria-pressed="trendSpan === '7'" @click="trendSpan = '7'">近7日</button>
            <button :aria-pressed="trendSpan === '30'" @click="trendSpan = '30'">近30日</button>
          </div>
        </header>
        <div v-show="trendPoints.length" ref="trendEl" class="tf-trend-plot" role="img" aria-label="按日流量与转化趋势图" />
        <div v-if="!trendPoints.length" class="ck-empty"><b>当前范围暂无按日趋势</b></div>
      </article>

      <article class="ck-card tf-card">
        <header class="ck-card__head">
          <h3>流量来源结构</h3>
          <label class="tf-select">
            <span class="tf-sr-only">来源结构指标</span>
            <select v-model="shareMetric">
              <option v-for="m in TRAFFIC_METRICS.slice(0, 3)" :value="m.key" :key="m.key">按{{ m.label }}</option>
            </select>
          </label>
        </header>
        <div v-if="shareTotal !== null && shareTotal > 0" class="tf-structure">
          <div class="tf-ring" :style="{ background: ringBackground }" role="img" :aria-label="`来源结构：${shareLabel}累计 ${trafficNumber(shareTotal)}`">
            <div><strong>{{ compact(shareTotal) }}</strong><span>{{ shareLabel }}合计</span></div>
          </div>
          <div class="tf-legend">
            <button v-for="source in sources" :key="source.id" :aria-pressed="selectedSource === source.name" @click="toggleSource(source.name)">
              <i :style="{ background: sourceColor(source.name) }"/><span>{{ source.name }}</span>
              <b>{{ trafficPercent(trafficRatio(source[shareMetric], shareTotal)) }}</b>
            </button>
          </div>
        </div>
        <div v-else class="ck-empty"><b>{{ shareTotal === 0 ? '人数合计为 0，暂无来源占比' : '暂无完整的来源结构数据' }}</b></div>
      </article>
    </div>

    <div class="ck-grid-3 tf-row">
      <article class="ck-card tf-card">
        <header class="ck-card__head">
          <h3>来源转化效果</h3>
          <button v-if="selectedSource" class="tf-text-btn" @click="selectedSource = ''">清除来源筛选</button>
        </header>
        <div class="tf-table-wrap tf-board-scroll" tabindex="0" aria-label="来源转化效果表，可横向滚动">
          <table class="tf-board-table">
            <thead>
              <tr>
                <th scope="col">排名</th>
                <th scope="col">流量来源</th>
                <th scope="col">曝光人数</th>
                <th scope="col">进店人数</th>
                <th scope="col">下单人数</th>
                <th scope="col">P1转化率</th>
                <th scope="col">P2转化率</th>
                <th scope="col">整体转化率</th>
                <th scope="col">趋势</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(source, i) in sortedSourcesWithDelta"
                :key="source.id"
                :class="{ selected: selectedSource === source.name }"
              >
                <td><span class="tf-rank" :class="rankTone(i)">{{ i + 1 }}</span></td>
                <th scope="row">
                  <button class="tf-row-link" :aria-pressed="selectedSource === source.name" @click="toggleSource(source.name)">{{ source.name }}</button>
                </th>
                <td>{{ compactOrDash(source.exposure) }}</td>
                <td>{{ compactOrDash(source.entry) }}</td>
                <td>{{ compactOrDash(source.orders) }}</td>
                <td>{{ trafficPercent(source.p1) }}</td>
                <td>{{ trafficPercent(source.p2) }}</td>
                <td>{{ trafficPercent(source.overall) }}</td>
                <td class="tf-trend-cell" :class="source.dodTone" :title="`日比 ${source.dodText}`">{{ source.dodArrow || '—' }}</td>
              </tr>
              <tr v-if="!sortedSourcesWithDelta.length"><td colspan="9" class="tf-table-empty">暂无来源记录</td></tr>
            </tbody>
          </table>
        </div>
      </article>

      <article class="ck-card tf-card">
        <header class="ck-card__head">
          <h3>城市 / 门店转化表现</h3>
          <div class="tf-segments tf-small" role="group" aria-label="排行榜维度">
            <button :aria-pressed="rankMode === 'city'" @click="rankMode = 'city'">城市榜</button>
            <button :aria-pressed="rankMode === 'store'" @click="rankMode = 'store'">门店榜</button>
          </div>
        </header>
        <div class="tf-table-wrap tf-board-scroll" tabindex="0" aria-label="城市门店排行榜，可滚动">
          <table class="tf-board-table">
            <thead>
              <tr>
                <th scope="col">排名</th>
                <th scope="col">{{ rankMode === 'city' ? '城市' : '门店' }}</th>
                <th scope="col">曝光人数</th>
                <th scope="col">进店人数</th>
                <th scope="col">下单人数</th>
                <th scope="col">P1转化率</th>
                <th scope="col">P2转化率</th>
                <th scope="col">整体转化率</th>
                <th scope="col">日比</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(item, i) in ranking" :key="item.id">
                <td><span class="tf-rank" :class="rankTone(i)">{{ i + 1 }}</span></td>
                <th scope="row">
                  <button class="tf-row-link" @click="openDetail(item)">{{ shortStore(item.name) }}</button>
                  <small v-if="rankMode === 'store'" class="tf-city-name">{{ item.city }}</small>
                </th>
                <td>{{ compactOrDash(item.exposure) }}</td>
                <td>{{ compactOrDash(item.entry) }}</td>
                <td>{{ compactOrDash(item.orders) }}</td>
                <td>{{ trafficPercent(item.p1) }}</td>
                <td>{{ trafficPercent(item.p2) }}</td>
                <td>{{ trafficPercent(item.overall) }}</td>
                <td><span :class="item.dodTone">{{ item.dodArrow }}{{ item.dodText }}</span></td>
              </tr>
              <tr v-if="!ranking.length"><td colspan="9" class="tf-table-empty">暂无匹配城市 / 门店</td></tr>
            </tbody>
          </table>
        </div>
      </article>

      <article class="ck-card tf-card">
        <header class="ck-card__head">
          <h3>异常来源 / 门店 TOP5</h3>
          <div class="tf-segments tf-small" role="group" aria-label="异常维度">
            <button type="button" aria-pressed="true" disabled>异常来源</button>
            <button type="button" aria-pressed="false" disabled>异常门店</button>
          </div>
        </header>
        <div class="ck-empty">
          <b>待接入异常规则</b>
          <span>第二步再做，暂不编造问题类型与建议动作</span>
        </div>
      </article>
    </div>

    <dialog ref="detailDialog" class="tf-dialog" aria-labelledby="tf-detail-title" @click="dismissBackdrop($event, detailDialog)" @close="detail = null">
      <template v-if="detail">
        <header>
          <div>
            <span class="tf-caption">{{ rangeLabel }} · {{ dimension === 'app' ? 'APP 内页面' : '平台渠道' }}</span>
            <h2 id="tf-detail-title">{{ detail.name }} · 来源明细</h2>
          </div>
          <button aria-label="关闭来源明细" @click="detailDialog?.close()">×</button>
        </header>
        <p>{{ selectedSource ? `已筛选来源：${selectedSource}` : '当前视角全部来源' }} · {{ detail.storeCount }} 家门店 · {{ detail.recordCount }} 条记录</p>
        <div class="tf-table-wrap" tabindex="0" aria-label="明细表，可横向滚动">
          <table>
            <thead><tr><th>来源</th><th v-for="m in TRAFFIC_METRICS" :key="m.key">{{ shortLabel(m.key) }}</th></tr></thead>
            <tbody>
              <tr v-for="item in detailSources" :key="item.id">
                <th>{{ item.name }}</th>
                <td v-for="m in TRAFFIC_METRICS" :key="m.key">{{ trafficValue(item[m.key], m.key) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <details>
          <summary>核对原始记录（{{ detail.facts.length }} 条）</summary>
          <p class="tf-filename">{{ trafficData.source.file }}</p>
          <div class="tf-table-wrap tf-record-scroll" tabindex="0">
            <table>
              <thead><tr><th>Excel 行</th><th>日期</th><th>门店 / 来源</th><th>曝光</th><th>进店</th><th>下单</th></tr></thead>
              <tbody>
                <tr v-for="row in detail.facts" :key="`${row.row}-${row.date || ''}`">
                  <td>data!{{ row.row }}</td>
                  <td>{{ row.date || '—' }}</td>
                  <th>{{ row.store }}<small class="tf-city-name">{{ row.source }}</small></th>
                  <td>{{ trafficNumber(row.exposure) }}</td>
                  <td>{{ trafficNumber(row.entry) }}</td>
                  <td>{{ trafficNumber(row.orders) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </details>
      </template>
    </dialog>

    <dialog ref="basisDialog" class="tf-dialog tf-basis-dialog" aria-labelledby="tf-basis-title" @click="dismissBackdrop($event, basisDialog)">
      <header><h2 id="tf-basis-title">数据口径与来源</h2><button aria-label="关闭数据说明" @click="basisDialog?.close()">×</button></header>
      <dl>
        <dt>本次来源</dt>
        <dd class="tf-filename">{{ trafficData.source.file }}<br/>{{ trafficData.source.sheet }}!{{ trafficData.source.range }} · 导出 {{ trafficData.source.exportedAt }} · grain={{ trafficData.period.grain }}</dd>
        <dt>可展示</dt>
        <dd>{{ trafficPeriodLabel }} 按日明细；顶栏日期可切片；漏斗、来源结构、来源效果、城市/门店榜、日趋势、日比与周比。</dd>
        <dt>统计边界</dt>
        <dd>平台渠道和 APP 内页面分开统计，不叠加。人数为记录加总，来源/门店间是否去重未提供。日比=同跨度上一段；周比=整体平移 7 天。</dd>
        <dt>转化率</dt>
        <dd>单条沿用 Excel 原值；多条为人数合计比值（不平均百分比）。缺字段或分母为 0 显示「—」。</dd>
        <dt>暂不展示</dt>
        <dd>小时趋势、异常 TOP 规则（第二步）、实时状态、投放成本与 ROI。无数据时空态，不补样例。</dd>
      </dl>
    </dialog>
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import ClassicKpi from './ClassicKpi.vue'
import { useFilterStore } from '../../stores/filter'
import { previousDayRange, previousWeekRange } from '../../api/source1'
import { trafficData, trafficPeriodLabel, trafficDimension } from '../../api/trafficSummary'
import { shiftDay } from '../../utils/bizWeek'
import { ratioValue, toneOf } from '../../utils/classicHints'
import { useChart } from '../../composables/useChart'
import {
  TRAFFIC_METRICS,
  selectTraffic,
  summarizeTraffic,
  groupTraffic,
  trafficDailySeries,
  trafficMetricDelta,
  trafficNumber,
  trafficPercent,
  trafficRatio,
  trafficValue,
} from '../../utils/trafficAnalysis'
import type { TrafficMetric } from '../../utils/trafficAnalysis'

const filter = useFilterStore()
const { cityName, selectedStore, cityQuery, storeQuery, periodRange } = storeToRefs(filter)

const dimension = trafficDimension
const selectedSource = ref('')
const shareMetric = ref<'exposure' | 'entry' | 'orders'>('exposure')
const rankMode = ref<'city' | 'store'>('city')
const sourceSort = ref<{ key: TrafficMetric; desc: boolean }>({ key: 'exposure', desc: true })
const trendSpan = ref<'range' | '7' | '30'>('7')

const q = computed(() => ({
  from: periodRange.value.from,
  to: periodRange.value.to,
  dimension: dimension.value,
  city: cityQuery.value,
  store: storeQuery.value,
}))
const dayQ = computed(() => ({ ...q.value, ...previousDayRange(q.value.from, q.value.to) }))
const weekQ = computed(() => ({ ...q.value, ...previousWeekRange(q.value.from, q.value.to) }))

const baseRows = computed(() => selectTraffic(trafficData, q.value))
const rows = computed(() => baseRows.value.filter((r) => !selectedSource.value || r.source === selectedSource.value))
const dayRows = computed(() => selectTraffic(trafficData, { ...dayQ.value, source: selectedSource.value || undefined }))
const weekRows = computed(() => selectTraffic(trafficData, { ...weekQ.value, source: selectedSource.value || undefined }))
const dayBaseRows = computed(() => selectTraffic(trafficData, dayQ.value))

const baseSummary = computed(() => summarizeTraffic(baseRows.value))
const summary = computed(() => summarizeTraffic(rows.value))
const daySummary = computed(() => summarizeTraffic(dayRows.value))
const weekSummary = computed(() => summarizeTraffic(weekRows.value))

const rangeLabel = computed(() => {
  const { from, to } = periodRange.value
  if (!from) return '未选日期'
  return from === to ? from : `${from} 至 ${to}`
})

type Group = ReturnType<typeof groupTraffic>[number]
function sorted(items: Group[], key: TrafficMetric, desc = true) {
  return [...items].sort((a, b) => {
    if (a[key] === null) return b[key] === null ? a.name.localeCompare(b.name, 'zh-CN') : 1
    if (b[key] === null) return -1
    return (a[key]! - b[key]!) * (desc ? -1 : 1) || a.name.localeCompare(b.name, 'zh-CN')
  })
}
function deltaArrow(d: number | null) {
  if (d == null || d === 0) return ''
  return d > 0 ? '↑' : '↓'
}

const sources = computed(() => groupTraffic(baseRows.value, 'source'))
const daySourceMap = computed(() => {
  const map = new Map<string, Group>()
  for (const item of groupTraffic(dayBaseRows.value, 'source')) map.set(item.id, item)
  return map
})
const sortedSourcesWithDelta = computed(() =>
  sorted(sources.value, sourceSort.value.key, sourceSort.value.desc).map((source) => {
    const prev = daySourceMap.value.get(source.id)
    const dod = trafficMetricDelta(source, prev || summarizeTraffic([]), 'exposure')
    return { ...source, dodText: ratioValue(dod), dodTone: toneOf(dod), dodArrow: deltaArrow(dod) }
  }),
)

const dayRankMap = computed(() => {
  const map = new Map<string, Group>()
  for (const item of groupTraffic(
    dayBaseRows.value.filter((r) => !selectedSource.value || r.source === selectedSource.value),
    rankMode.value,
  )) map.set(item.id, item)
  return map
})

const ranking = computed(() =>
  sorted(groupTraffic(rows.value, rankMode.value), 'exposure').map((item) => {
    const prev = dayRankMap.value.get(item.id)
    const dod = trafficMetricDelta(item, prev || summarizeTraffic([]), 'exposure')
    return {
      ...item,
      dodText: ratioValue(dod),
      dodTone: toneOf(dod),
      dodArrow: deltaArrow(dod),
    }
  }),
)

const funnel = computed(() => [
  { label: '曝光人数', value: summary.value.exposure },
  { label: '进店人数', value: summary.value.entry },
  { label: '下单人数', value: summary.value.orders },
])

const funnelRates = computed(() =>
  (['p1', 'p2', 'overall'] as const).map((key) => {
    const label = key === 'p1' ? 'P1 进店转化率' : key === 'p2' ? 'P2 下单转化率' : '整体转化率'
    const d = trafficMetricDelta(summary.value, daySummary.value, key)
    return {
      label,
      value: trafficPercent(summary.value[key]),
      delta: ratioValue(d),
      tone: toneOf(d),
      arrow: deltaArrow(d),
    }
  }),
)
const shareTotal = computed(() => baseSummary.value[shareMetric.value])
const shareLabel = computed(() => TRAFFIC_METRICS.find((m) => m.key === shareMetric.value)!.label)
const palette = Array.from({ length: 6 }, (_, i) => `var(--tf-series-${i + 1})`)
const allNames = computed(() => [...new Set(trafficData.facts.filter((r) => r.dimension === dimension.value).map((r) => r.source))])
const sourceColor = (name: string) => palette[allNames.value.indexOf(name) % palette.length] || palette[0]
const ringBackground = computed(() => {
  let offset = 0
  const stops = sources.value.map((r) => {
    const start = offset
    offset += (trafficRatio(r[shareMetric.value], shareTotal.value) || 0) * 100
    return `${sourceColor(r.name)} ${start}% ${offset}%`
  })
  return `conic-gradient(${stops.join(',') || '#e5e7eb 0% 100%'})`
})

function kpiParts(value: number | null, metric: TrafficMetric) {
  if (value === null) return { value: '—', unit: '', title: '—' }
  if (['p1', 'p2', 'overall'].includes(metric)) {
    const text = trafficPercent(value)
    return { value: text.replace('%', ''), unit: '%', title: text }
  }
  if (value >= 10000) return { value: (value / 10000).toFixed(2), unit: '万', title: trafficNumber(value) }
  return { value: trafficNumber(value), unit: '', title: trafficNumber(value) }
}

const kpiCards = computed(() =>
  TRAFFIC_METRICS.map((m) => {
    const parts = kpiParts(summary.value[m.key], m.key)
    const day = trafficMetricDelta(summary.value, daySummary.value, m.key)
    const week = trafficMetricDelta(summary.value, weekSummary.value, m.key)
    return {
      key: m.key,
      label: m.label,
      ...parts,
      dayText: ratioValue(day),
      weekText: ratioValue(week),
      dayTone: toneOf(day),
      weekTone: toneOf(week),
      dayArrow: deltaArrow(day),
      weekArrow: deltaArrow(week),
    }
  }),
)

const trendRange = computed(() => {
  const end = periodRange.value.to || trafficData.period.to
  if (trendSpan.value === '7') return { from: shiftDay(end, -6), to: end }
  if (trendSpan.value === '30') return { from: shiftDay(end, -29), to: end }
  return { from: periodRange.value.from, to: periodRange.value.to }
})
const trendRows = computed(() =>
  selectTraffic(trafficData, {
    ...trendRange.value,
    dimension: dimension.value,
    city: cityQuery.value,
    store: storeQuery.value,
    source: selectedSource.value || undefined,
  }),
)
const trendPoints = computed(() => trafficDailySeries(trendRows.value))

const trendEl = ref<HTMLElement | null>(null)
const trendOpt = ref<Record<string, unknown> | null>(null)
useChart(trendEl, trendOpt)

watch(
  trendPoints,
  (points) => {
    if (!points.length) {
      trendOpt.value = null
      return
    }
    const dates = points.map((p) => p.date.slice(5))
    trendOpt.value = {
      color: ['#3b82f6', '#14b8a6', '#f59e0b', '#8b5cf6'],
      grid: { left: 48, right: 48, top: 36, bottom: 28 },
      legend: { top: 0, textStyle: { color: '#6b7280', fontSize: 11 } },
      tooltip: {
        trigger: 'axis',
        formatter: (params: unknown) => {
          const rows = Array.isArray(params) ? params : [params]
          if (!rows.length) return ''
          const head = String((rows[0] as { axisValueLabel?: string; axisValue?: string }).axisValueLabel
            ?? (rows[0] as { axisValue?: string }).axisValue
            ?? '')
          const lines = rows.map((raw) => {
            const p = raw as { marker?: string; seriesName?: string; value?: number | null }
            const name = p.seriesName || ''
            const val = p.value
            let text = '—'
            if (typeof val === 'number' && Number.isFinite(val)) {
              text = name.includes('转化') ? `${(val * 100).toFixed(2)}%` : trafficNumber(val)
            }
            return `${p.marker || ''}${name}<span style="float:right;margin-left:18px;font-weight:600">${text}</span>`
          })
          return `<div style="font-size:12px;line-height:1.7">${head}<br/>${lines.join('<br/>')}</div>`
        },
      },
      xAxis: { type: 'category', data: dates, axisLabel: { color: '#6b7280', fontSize: 11 } },
      yAxis: [
        { type: 'value', name: '人数', axisLabel: { color: '#6b7280', fontSize: 10 }, splitLine: { lineStyle: { color: '#eef0f3' } } },
        {
          type: 'value',
          name: '转化率',
          axisLabel: { color: '#6b7280', fontSize: 10, formatter: (v: number) => `${(v * 100).toFixed(2)}%` },
          splitLine: { show: false },
        },
      ],
      series: [
        { name: '曝光人数', type: 'line', smooth: true, showSymbol: false, data: points.map((p) => p.exposure) },
        { name: '进店人数', type: 'line', smooth: true, showSymbol: false, data: points.map((p) => p.entry) },
        { name: '下单人数', type: 'line', smooth: true, showSymbol: false, data: points.map((p) => p.orders) },
        {
          name: '整体转化率',
          type: 'line',
          yAxisIndex: 1,
          smooth: true,
          showSymbol: false,
          lineStyle: { type: 'dashed' },
          data: points.map((p) => p.overall),
        },
      ],
    }
  },
  { immediate: true },
)

function compact(value: number) {
  return value >= 10000 ? `${(value / 10000).toFixed(2)}万` : trafficNumber(value)
}
function compactOrDash(value: number | null) {
  return value == null ? '—' : compact(value)
}
function shortLabel(key: TrafficMetric) {
  return ({ exposure: '曝光人数', entry: '进店人数', orders: '下单人数', p1: 'P1 转化', p2: 'P2 转化', overall: '整体转化' })[key]
}
function shortStore(name: string) {
  return name.replace(/^淘宝便利店[（(](.*)[）)]$/, '$1')
}
function rankTone(i: number) {
  if (i === 0) return 'is-1'
  if (i === 1) return 'is-2'
  if (i === 2) return 'is-3'
  return ''
}
function toggleSource(name: string) {
  selectedSource.value = selectedSource.value === name ? '' : name
}
function resetLocation() {
  filter.setCity('all', '全国')
  filter.setStore('全部')
  selectedSource.value = ''
}

const detailDialog = ref<HTMLDialogElement | null>(null)
const basisDialog = ref<HTMLDialogElement | null>(null)
const detail = ref<Group | null>(null)
const detailSources = computed(() => groupTraffic(detail.value?.facts || [], 'source'))
async function openDetail(item: Group) {
  detail.value = item
  await nextTick()
  detailDialog.value?.showModal()
}
function showBasis() {
  basisDialog.value?.showModal()
}
function dismissBackdrop(event: MouseEvent, dialog: HTMLDialogElement | null) {
  if (event.target !== dialog || !dialog) return
  const rect = dialog.getBoundingClientRect()
  if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close()
}

watch([dimension, cityName, selectedStore, periodRange], () => {
  selectedSource.value = ''
  detailDialog.value?.close()
})
</script>

<style scoped lang="scss">
@use './traffic-analysis.scss';
</style>
