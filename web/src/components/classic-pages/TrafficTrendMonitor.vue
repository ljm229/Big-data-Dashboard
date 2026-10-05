<!-- 中文名：流量-趋势与异动监控 -->
<template>
  <div class="ck-page">
    <section class="ck-kpi-row">
      <ClassicKpi name="本期曝光" :value="fmtWanLike(tot.exposure)" :hints="[{ label: '环比', value: fmtRel(rel(tot.exposure, ptot.exposure)) }]" />
      <ClassicKpi name="本期下单" :value="fmtWanLike(tot.orders)" :hints="[{ label: '环比', value: fmtRel(rel(tot.orders, ptot.orders)) }]" />
      <ClassicKpi name="周末/工作日下单比" :value="wkndRatioText" hint="周末日均 ÷ 工作日日均" />
      <ClassicKpi name="连续下降预警" :value="`${declines.length}家`" :hints="declines.slice(0, 2).map((d) => ({ label: shortStore(d.store), value: `连降${d.days}天` }))" :val-tone="declines.length ? 'is-red' as const : 'is-green' as const" />
      <ClassicKpi name="单日暴跌预警" :value="`${drops.length}家`" :hints="drops.slice(0, 2).map((d) => ({ label: shortStore(d.store), value: d.text }))" :val-tone="drops.length ? 'is-red' as const : 'is-green' as const" />
      <ClassicKpi name="爬坡中新店" :value="`${climbing.length}家`" :hints="climbing.slice(0, 2).map((d) => ({ label: shortStore(d.store), value: `第${d.age}天` }))" />
    </section>

    <section class="ck-grid-1">
      <article class="ck-card">
        <header class="ck-card__head">
          <h3>日趋势 · 曝光/进店/下单 + 整体转化率</h3>
          <p>红点=下单环比跌超30% · 点图例可开关</p>
        </header>
        <div ref="trendEl" class="ck-plot ck-plot--tall" />
      </article>
    </section>

    <section class="ck-grid-diag">
      <article class="ck-card">
        <header class="ck-card__head">
          <h3>日历热力 · 每日下单</h3>
          <p>深=下单多 · 周末描边</p>
        </header>
        <div ref="calEl" class="ck-plot" />
      </article>
      <article class="ck-card">
        <header class="ck-card__head">
          <h3>周末 vs 工作日</h3>
          <p>日均对比</p>
        </header>
        <div ref="wkEl" class="ck-plot" />
      </article>
    </section>

    <section class="ck-grid-diag">
      <article class="ck-card">
        <header class="ck-card__head">
          <h3>异动预警明细</h3>
          <p>连续下降=曝光连降≥3天 · 暴跌=单日下单较前7天均值跌超30%</p>
        </header>
        <table class="contrib-table traffic-table">
          <thead><tr><th>类型</th><th>门店</th><th>说明</th><th>日期</th></tr></thead>
          <tbody>
            <tr v-for="(w, i) in alerts" :key="i" :class="{ neg: w.sev === 'high' }">
              <td><span class="health-tag" :class="w.sev === 'high' ? 'is-warn' : 'is-bad'">{{ w.type }}</span></td>
              <td>{{ shortStore(w.store) }}</td>
              <td>{{ w.text }}</td>
              <td>{{ w.date }}</td>
            </tr>
            <tr v-if="!alerts.length"><td colspan="4" class="dim">本期无异动</td></tr>
          </tbody>
        </table>
      </article>
      <article class="ck-card">
        <header class="ck-card__head">
          <h3>新店开业监控</h3>
          <p>首现=首次有流量日期 · 爬坡=首现14天内</p>
        </header>
        <table class="contrib-table traffic-table">
          <thead><tr><th>门店</th><th>首现</th><th>本期天数</th><th>曝光</th><th>下单</th><th>转化</th><th>首周单</th><th>状态</th></tr></thead>
          <tbody>
            <tr v-for="n in newStores" :key="n.store">
              <td>{{ shortStore(n.store) }}</td>
              <td>{{ n.first }}</td>
              <td class="num">{{ n.days }}</td>
              <td class="num">{{ formatInt(n.exposure) }}</td>
              <td class="num">{{ formatInt(n.orders) }}</td>
              <td>{{ fmtPct(n.rate) }}</td>
              <td class="num">{{ formatInt(n.firstWeek) }}</td>
              <td><span class="health-tag" :class="n.age <= 14 ? 'is-mid' : 'is-good'">{{ n.age <= 14 ? `爬坡第${n.age}天` : '已稳定' }}</span></td>
            </tr>
            <tr v-if="!newStores.length"><td colspan="8" class="dim">本期无新店</td></tr>
          </tbody>
        </table>
      </article>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import ClassicKpi from './ClassicKpi.vue'
import { useChart } from '../../composables/useChart'
import { formatInt } from '../../utils/format'
import { fmtPct } from '../../utils/classicHints'
import {
  dateList, fmtRel, isWeekend, prevRangeOf, rel, scopeFacts, shortStore,
  storeFirstSeen, withRates, type TrafficScope,
} from '../../api/traffic'

const props = defineProps<{ scope: TrafficScope }>()
const s = computed(() => props.scope)
const facts = computed(() => scopeFacts(s.value))
const dates = computed(() => dateList(s.value.from, s.value.to))

function sum(list: { exposure: number | null; entry: number | null; orders: number | null }[]) {
  let e = 0, n = 0, o = 0
  for (const r of list) { e += r.exposure || 0; n += r.entry || 0; o += r.orders || 0 }
  return { exposure: e, entry: n, orders: o }
}
const tot = computed(() => sum(facts.value))
const prevFacts = computed(() => {
  const [f, t] = prevRangeOf(s.value.from, s.value.to)
  return scopeFacts({ ...s.value, from: f, to: t })
})
const ptot = computed(() => sum(prevFacts.value))

const byDay = computed(() =>
  dates.value.map((d) => {
    const t = sum(facts.value.filter((r) => r.date === d))
    return { date: d, ...withRates(t) }
  }),
)

/** 周末 vs 工作日 */
const wkSplit = computed(() => {
  const wd = facts.value.filter((r) => r.date && !isWeekend(r.date))
  const we = facts.value.filter((r) => r.date && isWeekend(r.date))
  const wdDays = new Set(wd.map((r) => r.date)).size || 1
  const weDays = new Set(we.map((r) => r.date)).size || 1
  const a = sum(wd), b = sum(we)
  const perDay = (t: { exposure: number; entry: number; orders: number }, n: number) => withRates({ exposure: t.exposure / n, entry: t.entry / n, orders: t.orders / n })
  const ra = perDay(a, wdDays), rb = perDay(b, weDays)
  return {
    wd: { ...ra, perDay: a.orders / wdDays },
    we: { ...rb, perDay: b.orders / weDays },
  }
})
const wkndRatioText = computed(() => {
  if (!wkSplit.value.wd.perDay) return '—'
  return `${(wkSplit.value.we.perDay / wkSplit.value.wd.perDay).toFixed(2)}×`
})

/** 预警：门店日下单序列 */
const storeDaily = computed(() => {
  const m = new Map<string, Map<string, number>>()
  for (const r of facts.value) {
    if (!r.date) continue
    if (!m.has(r.store)) m.set(r.store, new Map())
    const d = m.get(r.store)!
    d.set(r.date, (d.get(r.date) || 0) + (r.orders || 0))
  }
  return m
})
const declines = computed(() => {
  const out: { store: string; days: number; date: string }[] = []
  for (const [store] of storeDaily.value) {
    const expoByDate = new Map<string, number>()
    for (const r of facts.value) {
      if (r.store === store && r.date) expoByDate.set(r.date, (expoByDate.get(r.date) || 0) + (r.exposure || 0))
    }
    const seq = dates.value.map((d) => ({ d, e: expoByDate.get(d) || 0 }))
    let run = 0
    for (let i = 1; i < seq.length; i++) {
      if (seq[i].e < seq[i - 1].e && seq[i - 1].e > 0) run++
      else run = 0
    }
    if (run >= 3) out.push({ store, days: run + 1, date: seq[seq.length - 1].d })
  }
  return out
})
const drops = computed(() => {
  const out: { store: string; text: string; date: string }[] = []
  for (const [store, dm] of storeDaily.value) {
    const seq = dates.value.map((d) => dm.get(d) || 0)
    for (let i = 7; i < seq.length; i++) {
      const base = seq.slice(i - 7, i).reduce((a, b) => a + b, 0) / 7
      if (base >= 20 && seq[i] < base * 0.7) {
        out.push({ store, text: `${seq[i]}单较均值${Math.round(base)}单 -${Math.round((1 - seq[i] / base) * 100)}%`, date: dates.value[i] })
      }
    }
  }
  return out.slice(0, 20)
})
const alerts = computed(() => [
  ...declines.value.map((d) => ({ type: '连续下降', store: d.store, text: `曝光连续${d.days}天下降`, date: d.date, sev: 'high' as const })),
  ...drops.value.map((d) => ({ type: '单日暴跌', store: d.store, text: d.text, date: d.date, sev: 'mid' as const })),
])

/** 新店：首现日在本期内的店 */
const newStores = computed(() => {
  const stores = [...new Set(facts.value.map((r) => r.store))]
  return stores
    .map((store) => {
      const first = storeFirstSeen(store)
      const list = facts.value.filter((r) => r.store === store)
      const t = sum(list)
      const days = new Set(list.map((r) => r.date)).size
      const fw = list.filter((r) => r.date && first && r.date <= addDaysSafe(first, 6)).reduce((a, r) => a + (r.orders || 0), 0)
      const age = first ? Math.round((Date.parse(s.value.to) - Date.parse(first)) / 86400000) + 1 : 999
      return { store, first, days, exposure: t.exposure, orders: t.orders, rate: t.exposure ? t.orders / t.exposure : null, firstWeek: fw, age }
    })
    .filter((n) => n.first && n.first >= s.value.from && n.first <= s.value.to)
    .sort((a, b) => a.first.localeCompare(b.first))
})
const climbing = computed(() => newStores.value.filter((n) => n.age <= 14))
function addDaysSafe(d: string, n: number) {
  const t = new Date(`${d}T00:00:00Z`)
  t.setUTCDate(t.getUTCDate() + n)
  return t.toISOString().slice(0, 10)
}

function fmtWanLike(n: number) {
  if (n >= 10000) return `${(n / 10000).toFixed(1)}万`
  return formatInt(n)
}

/** 日趋势图 */
const trendEl = ref<HTMLElement | null>(null)
const trendOpt = ref<any>(null)
useChart(trendEl, trendOpt)
watch([byDay, drops], () => {
  if (!byDay.value.length) { trendOpt.value = null; return }
  const dropDates = new Set(drops.value.map((d) => d.date))
  trendOpt.value = {
    backgroundColor: '#fff',
    grid: { left: 50, right: 50, top: 34, bottom: 30 },
    tooltip: { trigger: 'axis' },
    legend: { top: 0, textStyle: { color: '#475569', fontSize: 11 } },
    xAxis: { type: 'category', data: byDay.value.map((d) => d.date.slice(5)), axisLabel: { color: '#64748b', fontSize: 10, rotate: 35 } },
    yAxis: [
      { type: 'value', splitLine: { lineStyle: { color: '#eef2f7' } }, axisLabel: { color: '#94a3b8', fontSize: 10 } },
      { type: 'value', splitLine: { show: false }, axisLabel: { formatter: '{value}%', color: '#94a3b8', fontSize: 10 } },
    ],
    series: [
      { name: '曝光', type: 'bar', data: byDay.value.map((d) => d.exposure), itemStyle: { color: '#bfdbfe', borderRadius: [4, 4, 0, 0] }, barGap: '10%' },
      { name: '进店', type: 'bar', data: byDay.value.map((d) => d.entry), itemStyle: { color: '#93c5fd', borderRadius: [4, 4, 0, 0] } },
      { name: '下单', type: 'line', data: byDay.value.map((d) => d.orders), smooth: true, symbolSize: 6, lineStyle: { width: 2.5, color: '#2f8cff' }, itemStyle: { color: '#2f8cff' }, markPoint: { symbolSize: 34, data: byDay.value.filter((d) => dropDates.has(d.date)).map((d) => ({ coord: [d.date.slice(5), d.orders], value: '跌', itemStyle: { color: '#ef4444' } })) } },
      { name: '整体转化率', type: 'line', yAxisIndex: 1, data: byDay.value.map((d) => +((d.overallRate || 0) * 100).toFixed(2)), smooth: true, lineStyle: { width: 2, type: 'dashed', color: '#00c389' }, itemStyle: { color: '#00c389' }, symbolSize: 4 },
    ],
  } as never
}, { immediate: true })

/** 日历热力 */
const calEl = ref<HTMLElement | null>(null)
const calOpt = ref<any>(null)
useChart(calEl, calOpt)
watch([byDay], () => {
  if (!byDay.value.length) { calOpt.value = null; return }
  const max = Math.max(...byDay.value.map((d) => d.orders), 1)
  calOpt.value = {
    backgroundColor: '#fff',
    tooltip: { formatter: (p: { value: (string | number)[] }) => `${p.value[0]} · 下单 ${p.value[1]}` },
    visualMap: { min: 0, max, calculable: false, orient: 'horizontal', left: 'center', bottom: 0, inRange: { color: ['#eef4ff', '#2f8cff', '#0b3d91'] }, textStyle: { color: '#64748b' } },
    calendar: { left: 40, right: 20, top: 20, cellSize: ['auto', 18], range: [s.value.from < '2026-08-15' ? '2026-08-15' : s.value.from, s.value.to], itemStyle: { borderColor: '#fff', borderWidth: 2 }, dayLabel: { firstDay: 1, nameMap: 'cn', color: '#94a3b8' }, monthLabel: { color: '#64748b' }, yearLabel: { show: false } },
    series: [{ type: 'heatmap', coordinateSystem: 'calendar', data: byDay.value.map((d) => [d.date, d.orders]) }],
  } as never
}, { immediate: true })

/** 周末工作日对比 */
const wkEl = ref<HTMLElement | null>(null)
const wkOpt = ref<any>(null)
useChart(wkEl, wkOpt)
watch([wkSplit], () => {
  wkOpt.value = {
    backgroundColor: '#fff',
    grid: { left: 8, right: 8, top: 30, bottom: 8, containLabel: true },
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    legend: { top: 0, textStyle: { color: '#475569', fontSize: 11 } },
    xAxis: { type: 'category', data: ['曝光', '进店', '下单'], axisTick: { show: false }, axisLine: { show: false }, axisLabel: { color: '#334155' } },
    yAxis: { type: 'value', splitLine: { lineStyle: { color: '#eef2f7' } }, axisLabel: { color: '#94a3b8', fontSize: 10 } },
    series: [
      { name: '工作日均', type: 'bar', barWidth: 26, data: [wkSplit.value.wd.exposure, wkSplit.value.wd.entry, wkSplit.value.wd.orders].map(Math.round), itemStyle: { color: '#2f8cff', borderRadius: [6, 6, 0, 0] } },
      { name: '周末日均', type: 'bar', barWidth: 26, data: [wkSplit.value.we.exposure, wkSplit.value.we.entry, wkSplit.value.we.orders].map(Math.round), itemStyle: { color: '#f59e0b', borderRadius: [6, 6, 0, 0] } },
    ],
  } as never
}, { immediate: true })
</script>

<style scoped lang="scss">
.traffic-table .num { font-family: var(--ck-font-num); }
.traffic-table tr.neg td { color: #b45309; }
.dim { color: #94a3b8; text-align: center; }
.health-tag { padding: 2px 8px; border-radius: 99px; font-size: 11px; white-space: nowrap; }
.health-tag.is-good { background: #dcfce7; color: #15803d; }
.health-tag.is-mid { background: #dbeafe; color: #1d4ed8; }
.health-tag.is-warn { background: #fef3c7; color: #b45309; }
.health-tag.is-bad { background: #fee2e2; color: #b91c1c; }
</style>
