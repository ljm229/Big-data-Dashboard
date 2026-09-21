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
          { label: card.cmpLabel, value: `${card.cmpArrow}${card.cmpText}`, tone: card.cmpTone },
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
              <em :class="shareWow(source.id).tone">{{ shareWow(source.id).arrow }} {{ shareWow(source.id).text }}</em>
            </button>
          </div>
        </div>
        <div v-else class="ck-empty"><b>{{ shareTotal === 0 ? '人数合计为 0，暂无来源占比' : '暂无完整的来源结构数据' }}</b></div>
      </article>
    </div>

    <div class="ck-grid-3 tf-row conv-grid">
            <article class="ck-card tf-card conv-left">
        <header class="ck-card__head">
          <h3>城市流量对比</h3>
          <p>曝光人数与整体转化率</p>
        </header>
        <div v-show="cityCompare.length" ref="cityEl" class="tf-city-plot" role="img" aria-label="城市曝光与转化对比图" />
        <div v-if="!cityCompare.length" class="ck-empty"><b>暂无城市对比数据</b></div>

      </article>

      <article class="ck-card tf-card conv-mid">
        <header class="ck-card__head">
          <h3>门店排行</h3>
          <p>按下单排序 · 附日环比</p>
        </header>
        <div class="tf-table-wrap conv-rank-scroll" tabindex="0" aria-label="城市门店排行榜，前10名">
          <table class="tf-board-table conv-rank-table">
            <thead>
              <tr>
                <th scope="col">排名</th>
                <th scope="col">门店</th>
                <th scope="col">曝光</th>
                <th scope="col">进店</th>
                <th scope="col">下单</th>
                <th scope="col">进店率</th>
                <th scope="col">下单率</th>
                <th scope="col">整体转化</th>
                <th scope="col">下单环比</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(item, i) in ranking.slice(0, 15)" :key="item.id">
                <td><span class="tf-rank" :class="rankTone(i)">{{ i + 1 }}</span></td>
                <th scope="row">
                  <button class="tf-row-link" @click="openDetail(item)">{{ shortStore(item.name) }}</button>
                </th>
                <td>{{ fmtWan1(item.exposure) }}</td>
                <td>{{ fmtWan2(item.entry) }}</td>
                <td>{{ fmtWan2(item.orders) }}</td>
                <td>{{ trafficPercent(item.p1) }}</td>
                <td>{{ trafficPercent(item.p2) }}</td>
                <td>{{ trafficPercent(item.overall) }}</td>
                <td><span :class="item.odTone">{{ item.odArrow }}{{ item.odText }}</span></td>
              </tr>
              <tr v-if="!ranking.length"><td colspan="9" class="tf-table-empty">暂无匹配门店</td></tr>
            </tbody>
          </table>
        </div>
      </article>

      <article class="ck-card tf-card conv-right">
        <header class="ck-card__head"><h3>异常预警与机会点</h3><p>基于近30天数据自动检测</p></header>
        <div v-if="alerts.length" class="alert-list">
          <div v-for="(a, i) in alerts" :key="i" class="alert-card" :class="a.tone">
            <div class="alert-main">
              <b>{{ a.title }}</b>
              <p>{{ a.desc }}</p>
              <small>{{ a.date }}</small>
            </div>
          </div>
        </div>
        <div v-else class="ck-empty"><b>本期无异常，流量表现平稳</b></div>
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
import { previousDayRange, previousPeriodRange, previousWeekRange } from '../../api/source1'
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
const { cityName, selectedStore, cityQuery, storeQuery, periodRange, periodMode, deltaLabel } = storeToRefs(filter)

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
const monthQ = computed(() => ({ ...q.value, ...previousPeriodRange(q.value.from, q.value.to, 'month') }))

const baseRows = computed(() => selectTraffic(trafficData, q.value))
const rows = computed(() => baseRows.value.filter((r) => !selectedSource.value || r.source === selectedSource.value))
const alertRange = computed(() => {
  const end = periodRange.value.to && periodRange.value.to <= trafficData.period.to ? periodRange.value.to : trafficData.period.to
  return { from: shiftDay(end, -29), to: end }
})
const alertRows = computed(() =>
  selectTraffic(trafficData, {
    ...alertRange.value,
    dimension: dimension.value,
    city: cityQuery.value,
    store: storeQuery.value,
    source: selectedSource.value || undefined,
  }),
)
const dayRows = computed(() => selectTraffic(trafficData, { ...dayQ.value, source: selectedSource.value || undefined }))
const weekRows = computed(() => selectTraffic(trafficData, { ...weekQ.value, source: selectedSource.value || undefined }))
const monthRows = computed(() => selectTraffic(trafficData, { ...monthQ.value, source: selectedSource.value || undefined }))
const dayBaseRows = computed(() => selectTraffic(trafficData, dayQ.value))

const baseSummary = computed(() => summarizeTraffic(baseRows.value))
const summary = computed(() => summarizeTraffic(rows.value))
const daySummary = computed(() => summarizeTraffic(dayRows.value))
const weekSummary = computed(() => summarizeTraffic(weekRows.value))
const monthSummary = computed(() => summarizeTraffic(monthRows.value))
/** 跟随顶部按日/按周/按月只取一个对比口径，避免双环比并排 */
const cmpSummary = computed(() =>
  periodMode.value === 'month' ? monthSummary.value : periodMode.value === 'week' ? weekSummary.value : daySummary.value,
)

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

const cityCompare = computed(() => sorted(groupTraffic(rows.value, 'city'), 'exposure'))
const cityEl = ref<HTMLElement | null>(null)
const cityOpt = ref<Record<string, unknown> | null>(null)
useChart(cityEl, cityOpt)

watch(
  cityCompare,
  (cities) => {
    if (!cities.length) {
      cityOpt.value = null
      return
    }
    const n = cities.length
    const names = cities.map((c) => c.name.replace(/市$/, ''))
    const expoW = cities.map((c) => (c.exposure == null ? 0 : +(((c.exposure as number) || 0) / 10000).toFixed(1)))
    const conv = cities.map((c) => (c.overall == null ? 0 : +(((c.overall as number) || 0) * 100).toFixed(2)))
    const lo = Math.min(...conv)
    const hi = Math.max(...conv)
    const pad = Math.max(0.1, (hi - lo) * 0.2)
    const dotColor = (v: number) => {
      const ratio = hi === lo ? 0.5 : (v - lo) / (hi - lo)
      return ratio >= 0.66 ? '#22c55e' : ratio >= 0.33 ? '#f59e0b' : '#ef4444'
    }
    cityOpt.value = {
      grid: { left: 8, right: 52, top: 8, bottom: 8, containLabel: true },
      tooltip: {
        trigger: 'item',
        backgroundColor: '#fff',
        borderColor: '#e2e8f0',
        textStyle: { color: '#1e293b', fontSize: 12 },
        formatter: (params: unknown) => {
          const q = params as { dataIndex?: number }
          const c = cities[n - 1 - (q.dataIndex ?? 0)]
          if (!c) return ''
          const ek = c.exposure == null ? '—' : `${(((c.exposure as number) || 0) / 10000).toFixed(1)} 万`
          const cv = c.overall == null ? '—' : `${(((c.overall as number) || 0) * 100).toFixed(2)}%`
          return `<div style="font-weight:700;margin-bottom:6px">${c.name}</div>`
            + `<div style="line-height:1.9">曝光人数：<b>${ek}</b><br/>整体转化率：<b>${cv}</b></div>`
        },
      },
      xAxis: [
        {
          type: 'value',
          name: '曝光（万）',
          nameTextStyle: { color: '#94a3b8', fontSize: 11 },
          axisLabel: { color: '#94a3b8', fontSize: 10 },
          splitLine: { lineStyle: { color: '#eef0f3', type: 'dashed' } },
        },
        { type: 'value', min: lo - pad, max: hi + pad, show: false },
      ],
      yAxis: {
        type: 'category',
        inverse: true,
        data: names,
        axisTick: { show: false },
        axisLine: { show: false },
        axisLabel: { color: '#475569', fontSize: 12 },
      },
      series: [
        {
          name: '曝光人数',
          type: 'bar',
          barWidth: 14,
          data: [...expoW].reverse(),
          label: {
            show: true, position: 'right', color: '#2f7bff', fontSize: 12, fontWeight: 700,
            formatter: '{c}万',
          },
          itemStyle: {
            borderRadius: [0, 7, 7, 0],
            color: {
              type: 'linear', x: 0, y: 0, x2: 1, y2: 0,
              colorStops: [
                { offset: 0, color: 'rgba(47,123,255,0.15)' },
                { offset: 1, color: '#2f7bff' },
              ],
            },
          },
        },
        {
          name: '整体转化率',
          type: 'scatter',
          xAxisIndex: 1,
          symbolSize: 9,
          data: conv.map((v, i) => ({
            value: [v, n - 1 - i],
            itemStyle: { color: dotColor(v), borderColor: '#fff', borderWidth: 2 },
          })),
        },
      ],
    }
  },
  { immediate: true },
)
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
    'store',
  )) map.set(item.id, item)
  return map
})

function healthOf(overall: number | null) {
  if (overall == null) return { health: '缺数', healthCls: 'is-bad' }
  if (overall >= 0.03) return { health: '优秀', healthCls: 'is-good' }
  if (overall >= 0.026) return { health: '良好', healthCls: 'is-mid' }
  return { health: '关注', healthCls: 'is-warn' }
}
function fmtWan1(v: number | null) {
  if (v == null) return '—'
  return v >= 10000 ? `${(v / 10000).toFixed(1)}万` : trafficNumber(v)
}
function fmtWan2(v: number | null) {
  if (v == null) return '—'
  return v >= 10000 ? `${(v / 10000).toFixed(2)}万` : trafficNumber(v)
}

const ranking = computed(() =>
  sorted(groupTraffic(rows.value, 'store'), 'orders').map((item) => {
    const prev = dayRankMap.value.get(item.id)
    const dod = trafficMetricDelta(item, prev || summarizeTraffic([]), 'exposure')
    const od = trafficMetricDelta(item, prev || summarizeTraffic([]), 'orders')
    return {
      ...item,
      dodText: ratioValue(dod),
      dodTone: toneOf(dod),
      dodArrow: deltaArrow(dod),
      odText: ratioValue(od),
      odTone: toneOf(od),
      odArrow: deltaArrow(od),
      ...healthOf(item.overall),
    }
  }),
)

/** 异常预警与机会点：多维度自动检测 */
const alerts = computed(() => {
  const list: { icon: string; title: string; desc: string; date: string; tone: string; rank: number }[] = []
  const facts = alertRows.value.filter((r) => r.date)
  if (!facts.length) return list
  const totE = facts.reduce((a, r) => a + (r.exposure || 0), 0)
  const totO = facts.reduce((a, r) => a + (r.orders || 0), 0)
  const board = totE ? totO / totE : 0
  const dates = [...new Set(facts.map((r) => r.date!))].sort()
  const to = dates[dates.length - 1]
  const dayDiff = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000)
  const cityOf = (store: string) => facts.find((r) => r.store === store)?.city || ''

  // 1. 下单转化率异常（>100%）：疑似口径或去重问题
  const merged = new Map<string, { store: string; source: string; date: string; entry: number; orders: number }>()
  for (const r of facts) {
    if (r.entry == null || r.orders == null || r.entry < 20) continue
    const k = `${r.store}|${r.source}|${r.date}`
    const c = merged.get(k) || { store: r.store, source: r.source, date: r.date!, entry: 0, orders: 0 }
    c.entry += r.entry
    c.orders += r.orders
    merged.set(k, c)
  }
  ;[...merged.values()]
    .filter((c) => c.orders > c.entry)
    .sort((a, b) => b.orders / b.entry - a.orders / a.entry)
    .slice(0, 2)
    .forEach((c) => list.push({
      icon: '⚠️', tone: 'is-bad', rank: 0,
      title: '下单转化异常 > 100%',
      desc: `${cityOf(c.store)}·${shortStore(c.store)} ${c.date} ${c.source}下单${c.orders}超进店${c.entry}，转化${((c.orders / c.entry) * 100).toFixed(1)}%，疑似口径或去重问题，建议核对埋点。`,
      date: c.date,
    }))

  // 2. 门店单日暴跌：下单较前7天均值跌超30%
  const dayOrders = new Map<string, Map<string, number>>()
  for (const r of facts) {
    if (!dayOrders.has(r.store)) dayOrders.set(r.store, new Map())
    const d = dayOrders.get(r.store)!
    d.set(r.date!, (d.get(r.date!) || 0) + (r.orders || 0))
  }
  const drops: { store: string; date: string; cur: number; base: number }[] = []
  for (const [store, dm] of dayOrders) {
    for (let i = 7; i < dates.length; i++) {
      const base = dates.slice(i - 7, i).reduce((a, d) => a + (dm.get(d) || 0), 0) / 7
      const cur = dm.get(dates[i]) || 0
      if (base >= 20 && cur < base * 0.7) drops.push({ store, date: dates[i], cur, base })
    }
  }
  drops.slice(0, 2).forEach((d) => list.push({
    icon: '📉', tone: 'is-bad', rank: 1,
    title: `单日下单暴跌 ${Math.round((1 - d.cur / d.base) * 100)}%`,
    desc: `${cityOf(d.store)}·${shortStore(d.store)} ${d.date}下单${d.cur}，较前7天均值${Math.round(d.base)}下滑${Math.round((1 - d.cur / d.base) * 100)}%，先查营业状态与排名曝光。`,
    date: d.date,
  }))

  // 3. 曝光连续下降≥3天（看期末一段）
  const dayExpo = new Map<string, Map<string, number>>()
  for (const r of facts) {
    if (!dayExpo.has(r.store)) dayExpo.set(r.store, new Map())
    const d = dayExpo.get(r.store)!
    d.set(r.date!, (d.get(r.date!) || 0) + (r.exposure || 0))
  }
  const decs: { store: string; days: number; date: string }[] = []
  for (const [store, dm] of dayExpo) {
    let run = 0
    let best = 0
    let bestEnd = ''
    for (let i = 1; i < dates.length; i++) {
      const prev = dm.get(dates[i - 1]) || 0
      const cur = dm.get(dates[i]) || 0
      if (prev > 0 && cur < prev) {
        run++
        if (run >= best) {
          best = run
          bestEnd = dates[i]
        }
      } else run = 0
    }
    if (best >= 2) decs.push({ store, days: best + 1, date: bestEnd })
  }
  decs
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 2)
    .forEach((d) => list.push({
      icon: '🔻', tone: 'is-warn', rank: 2,
      title: `曝光连续下降${d.days}天`,
      desc: `${cityOf(d.store)}·${shortStore(d.store)}${d.date}前曝光连降${d.days}天，检查排名、头图与营业时长。`,
      date: d.date,
    }))

  // 3b. 转化垫底店：有一定曝光但转化最低
  const storeRate: { store: string; e: number; o: number }[] = []
  {
    const m = new Map<string, { e: number; o: number }>()
    for (const r of facts) {
      const c = m.get(r.store) || { e: 0, o: 0 }
      c.e += r.exposure || 0
      c.o += r.orders || 0
      m.set(r.store, c)
    }
    for (const [store, v] of m) {
      if (v.e >= 5000 && v.o > 0) storeRate.push({ store, e: v.e, o: v.o })
    }
  }
  storeRate.sort((a, b) => a.o / a.e - b.o / b.e)
  if (storeRate.length >= 3) {
    const w = storeRate[0]
    const rate = ((w.o / w.e) * 100).toFixed(2)
    list.push({
      icon: '🔻', tone: 'is-warn', rank: 2,
      title: `${shortStore(w.store)}转化垫底 ${rate}%`,
      desc: `${cityOf(w.store)}·${shortStore(w.store)}近30天曝光${w.e}但转化仅${rate}%，低于大盘${(board * 100).toFixed(2)}%，优先查进店后链路（价格、品类、券）。`,
      date: to,
    })
  }

  // 4/5. 来源维度：转化偏低 vs 高效机会
  const bySrc = new Map<string, { e: number; o: number }>()
  for (const r of facts) {
    const c = bySrc.get(r.source) || { e: 0, o: 0 }
    c.e += r.exposure || 0
    c.o += r.orders || 0
    bySrc.set(r.source, c)
  }
  ;[...bySrc.entries()]
    .filter(([, v]) => totE > 0 && v.e / totE >= 0.05 && v.e > 0 && board > 0 && v.o / v.e < board * 0.6)
    .sort((a, b) => b[1].e - a[1].e)
    .slice(0, 2)
    .forEach(([name, v]) => {
      const rate = (v.o / v.e) * 100
      list.push({
        icon: '🔍', tone: 'is-warn', rank: 3,
        title: `${name}转化偏低`,
        desc: `该入口曝光占比约${((v.e / totE) * 100).toFixed(0)}%，整体转化仅${rate.toFixed(2)}%，明显低于大盘${(board * 100).toFixed(2)}%，建议优化卡片吸引力与排序权重。`,
        date: to,
      })
    })
  ;[...bySrc.entries()]
    .filter(([, v]) => totE > 0 && v.e / totE < 0.15 && v.e > 0 && board > 0 && v.o / v.e > board * 1.3)
    .sort((a, b) => b[1].o / b[1].e - a[1].o / a[1].e)
    .slice(0, 2)
    .forEach(([name, v]) => {
      const rate = (v.o / v.e) * 100
      list.push({
        icon: '💡', tone: 'is-good', rank: 4,
        title: `${name}转化效率最高`,
        desc: `${name}整体转化约${rate.toFixed(2)}%，为大盘${(v.o / v.e / board).toFixed(1)}倍，但曝光占比仅${((v.e / totE) * 100).toFixed(0)}%，建议加大该侧曝光资源倾斜。`,
        date: to,
      })
    })

  // 6. 新店爬坡：范围内首现且距期末14天内
  const first = new Map<string, string>()
  for (const r of facts) {
    const d = r.date!
    if (!first.has(r.store) || d < first.get(r.store)!) first.set(r.store, d)
  }
  ;[...first.entries()]
    .filter(([, d]) => dates.length >= 3 && d > dates[0] && dayDiff(d, to) <= 14)
    .sort((a, b) => b[1].localeCompare(a[1]))
    .slice(0, 2)
    .forEach(([store, d]) => {
      const expoD = (dayExpo.get(store)?.get(d) || 0)
      const expoT = (dayExpo.get(store)?.get(to) || 0)
      const grow = expoD > 0 ? Math.round(((expoT - expoD) / expoD) * 100) : 0
      const growText = expoD === expoT ? '持平' : `${grow >= 0 ? '+' : ''}${grow}%`
      const pace = grow >= 50 ? '快速爬坡' : grow >= 0 ? '持续观察' : '热度回落'
      list.push({
        icon: '📈', tone: 'is-good', rank: 5,
        title: `新店${shortStore(store)}${pace}`,
        desc: `${cityOf(store)}·${shortStore(store)} ${d}首现，曝光由${expoD}变为${expoT}（${growText}），建议持续观察进店转化率是否稳定。`,
        date: `${d} ~ ${to}`,
      })
    })

  return list.sort((a, b) => a.rank - b.rank).slice(0, 6)
})

/** 来源结构图例的日环比：当前指标值相对昨日的变化 */
const sourceShareWow = computed(() => {
  const map = new Map<string, { arrow: string; text: string; tone: string }>()
  for (const s of sources.value) {
    const prev = daySourceMap.value.get(s.id)
    const d = trafficMetricDelta(s, prev || summarizeTraffic([]), shareMetric.value)
    map.set(s.id, { arrow: deltaArrow(d), text: ratioValue(d), tone: toneOf(d) })
  }
  return map
})
function shareWow(id: string) {
  return sourceShareWow.value.get(id) || { arrow: '', text: '—', tone: '' }
}

const funnel = computed(() => [  { label: '曝光人数', value: summary.value.exposure },
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
    const d = trafficMetricDelta(summary.value, cmpSummary.value, m.key)
    return {
      key: m.key,
      label: m.label,
      ...parts,
      cmpLabel: deltaLabel.value,
      cmpText: ratioValue(d),
      cmpTone: toneOf(d),
      cmpArrow: deltaArrow(d),
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
      grid: { left: 44, right: 44, top: 44, bottom: 28 },
      legend: {
        top: 0, right: 0, itemWidth: 16, itemHeight: 9,
        textStyle: { color: '#64748b', fontSize: 12 },
      },
      tooltip: {
        trigger: 'axis',
        backgroundColor: '#fff',
        borderColor: '#e2e8f0',
        textStyle: { color: '#1e293b', fontSize: 12 },
        formatter: (params: unknown) => {
          const rows = Array.isArray(params) ? params : [params]
          if (!rows.length) return ''
          const first = rows[0] as { axisValueLabel?: string; axisValue?: string; dataIndex?: number }
          const head = String(first.axisValueLabel ?? first.axisValue ?? '')
          const i = first.dataIndex ?? 0
          const cur = points[i]
          const ek = cur?.exposure == null ? '—' : `${(cur.exposure / 1000).toFixed(1)} 千人`
          const cv = cur?.overall == null ? '—' : `${(cur.overall * 100).toFixed(2)}%`
          return `<div style="font-weight:700;margin-bottom:6px">${head}</div>`
            + `<div style="line-height:1.9"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#2f7bff;margin-right:6px"></span>曝光人数：<b>${ek}</b><br/>`
            + `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#f59e0b;margin-right:6px"></span>整体转化率：<b>${cv}</b></div>`
        },
      },
      xAxis: {
        type: 'category', data: dates,
        axisTick: { show: false },
        axisLine: { lineStyle: { color: '#e2e8f0' } },
        axisLabel: { color: '#64748b', fontSize: 11 },
      },
      yAxis: [
        {
          type: 'value', name: '曝光（千人）',
          nameTextStyle: { color: '#94a3b8', fontSize: 11 },
          axisLabel: { color: '#94a3b8', fontSize: 10 },
          splitLine: { lineStyle: { color: '#eef0f3', type: 'dashed' } },
        },
        {
          type: 'value',
          axisLabel: { color: '#94a3b8', fontSize: 10, formatter: (v: number) => `${v}%` },
          splitLine: { show: false },
        },
      ],
      series: [
        {
          name: '曝光人数',
          type: 'bar',
          barWidth: '55%',
          data: points.map((q) => (q.exposure == null ? null : +((q.exposure as number) / 1000).toFixed(1))),
          itemStyle: {
            borderRadius: [5, 5, 0, 0],
            color: {
              type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: '#2f7bff' },
                { offset: 1, color: 'rgba(47,123,255,0.12)' },
              ],
            },
          },
        },
        {
          name: '整体转化率',
          type: 'line',
          yAxisIndex: 1,
          smooth: true,
          symbol: 'circle',
          symbolSize: 7,
          showSymbol: true,
          lineStyle: { width: 2.5, color: '#f59e0b' },
          itemStyle: { color: '#f59e0b', borderColor: '#ffffff', borderWidth: 2 },
          data: points.map((q) => (q.overall == null ? null : +(((q.overall as number) || 0) * 100).toFixed(2))),
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

const attr = computed(() => {
  const s = summary.value
  const exposeLoss = s.p1 == null ? null : 1 - s.p1
  const enterLoss = s.p2 == null ? null : 1 - s.p2
  const bottleneck = (enterLoss ?? 0) >= (exposeLoss ?? 0) ? '进店未下单' : '曝光未进店'
  const advice =
    bottleneck === '进店未下单'
      ? '进店未下单占比过高，说明商品价格或详情页有问题，优先核查券补与爆品承接。'
      : '曝光未进店占比过高，优先检查排名、头图与营业状态。'
  return { exposeLoss, enterLoss, bottleneck, advice }
})
const maxSrcOrders = computed(() =>
  Math.max(1, ...sortedSourcesWithDelta.value.slice(0, 3).map((s) => s.orders || 0)),
)
function srcBarWidth(n: number | null) {
  return `${Math.min(100, ((n || 0) / maxSrcOrders.value) * 100).toFixed(1)}%`
}
function attrWidth(r: number | null) {
  if (r == null || !Number.isFinite(r)) return '0%'
  return `${Math.min(100, Math.max(0, r * 100)).toFixed(1)}%`
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
