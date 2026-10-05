<!-- 中文名：流量-门店排行与健康度 -->
<template>
  <div class="ck-page">
    <section class="ck-kpi-row">
      <ClassicKpi name="门店曝光" :value="fmtWanLike(tot.exposure)" :hints="[{ label: '环比', value: fmtRel(rel(tot.exposure, ptot.exposure)) }]" />
      <ClassicKpi name="进店" :value="fmtWanLike(tot.entry)" :hints="[{ label: '环比', value: fmtRel(rel(tot.entry, ptot.entry)) }]" />
      <ClassicKpi name="下单" :value="fmtWanLike(tot.orders)" :hints="[{ label: '环比', value: fmtRel(rel(tot.orders, ptot.orders)) }]" />
      <ClassicKpi name="整体转化率" :value="fmtPct(rates.overallRate)" :hints="[{ label: '环比', value: qoqPp(rates.overallRate, prates.overallRate) }]" />
      <ClassicKpi name="高流量低转化" :value="`${quadHL.length}家`" :hints="quadHL.slice(0, 2).map((s) => ({ label: shortStore(s.name), value: fmtPct(s.overallRate) }))" val-tone="is-red" />
      <ClassicKpi name="低流量高转化" :value="`${quadLH.length}家`" :hints="quadLH.slice(0, 2).map((s) => ({ label: shortStore(s.name), value: fmtPct(s.overallRate) }))" val-tone="is-green" />
    </section>

    <section class="ck-grid-diag">
      <article class="ck-card">
        <header class="ck-card__head">
          <h3>门店排行榜 TOP15</h3>
          <p>按{{ metricLabel }} · 蓝=新店倾向店 · 点击看明细</p>
        </header>
        <div class="ck-pills">
          <button type="button" :class="{ active: metric === 'orders' }" @click="metric = 'orders'">下单</button>
          <button type="button" :class="{ active: metric === 'exposure' }" @click="metric = 'exposure'">曝光</button>
          <button type="button" :class="{ active: metric === 'overallRate' }" @click="metric = 'overallRate'">转化率</button>
        </div>
        <div ref="rankEl" class="ck-plot ck-plot--tall" />
      </article>
      <article class="ck-card">
        <header class="ck-card__head">
          <h3>曝光 × 转化率四象限</h3>
          <p>虚线=均值 · 大小=下单 · 点击看明细</p>
        </header>
        <div ref="quadEl" class="ck-plot ck-plot--tall" />
        <div class="quad-legend">
          <span><i style="background:#00c389" />高流量高转化 {{ quadHH.length }}</span>
          <span><i style="background:#ef4444" />高流量低转化 {{ quadHL.length }}</span>
          <span><i style="background:#2f8cff" />低流量高转化 {{ quadLH.length }}</span>
          <span><i style="background:#94a3b8" />双低 {{ quadLL.length }}</span>
        </div>
      </article>
    </section>

    <section class="ck-grid-1">
      <article class="ck-card">
        <header class="ck-card__head">
          <h3>日期 × 门店转化率热力</h3>
          <p>下单 TOP12 门店 · 深=转化高</p>
        </header>
        <div ref="heatEl" class="ck-plot" />
      </article>
    </section>

    <section class="ck-grid-1">
      <article class="ck-card">
        <header class="ck-card__head">
          <h3>门店明细 · 支持下钻到来源</h3>
          <p>对比=与城市均值差 · 排名变化=按下单较上期</p>
        </header>
        <table class="contrib-table traffic-table">
          <thead><tr><th>门店</th><th>城市</th><th>曝光</th><th>进店</th><th>下单</th><th>整体转化</th><th>进店转化</th><th>对比城市均值</th><th>排名变化</th><th>健康</th></tr></thead>
          <tbody>
            <template v-for="r in detailRows" :key="r.name">
              <tr class="clickable" :class="{ active: drill === r.name }" @click="drill = drill === r.name ? '' : r.name">
                <td>{{ shortStore(r.name) }}</td>
                <td>{{ r.city }}</td>
                <td class="num">{{ formatInt(r.exposure) }}</td>
                <td class="num">{{ formatInt(r.entry) }}</td>
                <td class="num">{{ formatInt(r.orders) }}</td>
                <td>{{ fmtPct(r.overallRate) }}</td>
                <td>{{ fmtPct(r.enterRate) }}</td>
                <td :class="r.gapPP >= 0 ? 'pos' : 'neg'">{{ gapText(r.gapPP) }}</td>
                <td>{{ rankText(r.rankMove) }}</td>
                <td><span class="health-tag" :class="r.healthCls">{{ r.health }}</span></td>
              </tr>
              <tr v-if="drill === r.name" class="drill-row">
                <td colspan="10">
                  <div class="drill-src">
                    <span v-for="s in drillSources" :key="s.name" class="drill-chip">
                      <b>{{ s.name }}</b>曝{{ formatInt(s.exposure) }} · 进{{ formatInt(s.entry) }} · 单{{ formatInt(s.orders) }} · 转{{ fmtPct(s.overallRate) }}
                    </span>
                  </div>
                </td>
              </tr>
            </template>
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
  fmtRel, groupSum, prevRangeOf, rankMap, rel, scopeFacts, shortStore,
  withRates, type TrafficScope,
} from '../../api/traffic'

const props = defineProps<{ scope: TrafficScope }>()
const s = computed(() => props.scope)
const facts = computed(() => scopeFacts(s.value))
const tot = computed(() => {
  let e = 0, n = 0, o = 0
  for (const r of facts.value) { e += r.exposure || 0; n += r.entry || 0; o += r.orders || 0 }
  return { exposure: e, entry: n, orders: o }
})
const rates = computed(() => withRates(tot.value))
const prevFacts = computed(() => {
  const [f, t] = prevRangeOf(s.value.from, s.value.to)
  return scopeFacts({ ...s.value, from: f, to: t })
})
const ptot = computed(() => {
  let e = 0, n = 0, o = 0
  for (const r of prevFacts.value) { e += r.exposure || 0; n += r.entry || 0; o += r.orders || 0 }
  return { exposure: e, entry: n, orders: o }
})
const prates = computed(() => withRates(ptot.value))
function qoqPp(cur: number | null, prev: number | null) {
  if (cur == null || prev == null) return '—'
  const v = (cur - prev) * 100
  return `${v >= 0 ? '+' : ''}${v.toFixed(2)}pp`
}
function fmtWanLike(n: number) {
  if (n >= 10000) return `${(n / 10000).toFixed(1)}万`
  return formatInt(n)
}

const byStore = computed(() => [...groupSum(facts.value, (r) => r.store).entries()].map(([, v]) => v))
const cityMean = computed(() => {
  const m = groupSum(facts.value, (r) => r.city)
  const out = new Map<string, number | null>()
  for (const [c, v] of m) out.set(c, v.overallRate)
  return out
})
const storeCity = computed(() => {
  const m = new Map<string, string>()
  for (const r of facts.value) if (!m.has(r.store)) m.set(r.store, r.city)
  return m
})
const avgExpo = computed(() => (byStore.value.reduce((a, r) => a + r.exposure, 0) / Math.max(1, byStore.value.length)))
const avgRate = computed(() => {
  const rs = byStore.value.map((r) => r.overallRate || 0)
  return rs.reduce((a, b) => a + b, 0) / Math.max(1, rs.length)
})
function quadOf(r: { exposure: number; overallRate: number | null }) {
  const hi = r.exposure >= avgExpo.value
  const hc = (r.overallRate || 0) >= avgRate.value
  return hi && hc ? 'HH' : hi ? 'HL' : hc ? 'LH' : 'LL'
}
const quadHH = computed(() => byStore.value.filter((r) => quadOf(r) === 'HH'))
const quadHL = computed(() => byStore.value.filter((r) => quadOf(r) === 'HL'))
const quadLH = computed(() => byStore.value.filter((r) => quadOf(r) === 'LH'))
const quadLL = computed(() => byStore.value.filter((r) => quadOf(r) === 'LL'))

const metric = ref<'orders' | 'exposure' | 'overallRate'>('orders')
const metricLabel = computed(() => (metric.value === 'orders' ? '下单' : metric.value === 'exposure' ? '曝光' : '转化率'))
const drill = ref('')
const selStore = ref('')

const rankEl = ref<HTMLElement | null>(null)
const rankOpt = ref<any>(null)
useChart(rankEl, rankOpt)
watch([byStore, metric], () => {
  const rows = [...byStore.value]
    .sort((a, b) => (b[metric.value] || 0) - (a[metric.value] || 0))
    .slice(0, 15)
    .reverse()
  if (!rows.length) { rankOpt.value = null; return }
  rankOpt.value = {
    backgroundColor: '#fff',
    grid: { left: 8, right: 70, top: 8, bottom: 8, containLabel: true },
    tooltip: { trigger: 'item', formatter: (p: Record<string, unknown>) => `<b>${p.name}</b><br/>${metricLabel.value} ${p.value}` },
    xAxis: { type: 'value', splitLine: { lineStyle: { color: '#eef2f7' } }, axisLabel: { color: '#94a3b8', fontSize: 10 } },
    yAxis: { type: 'category', data: rows.map((r) => shortStore(r.name)), axisTick: { show: false }, axisLine: { show: false }, axisLabel: { color: '#334155', fontSize: 11 } },
    series: [{
      type: 'bar', barWidth: 12,
      data: rows.map((r) => ({ value: metric.value === 'overallRate' ? +(r.overallRate! * 100).toFixed(2) : r[metric.value], name: shortStore(r.name), full: r.name, itemStyle: { color: r.name === selStore.value ? '#f59e0b' : '#2f8cff', borderRadius: [0, 6, 6, 0] } })),
      label: { show: true, position: 'right', color: '#475569', fontSize: 11, fontWeight: 700, formatter: (p: { value: number }) => (metric.value === 'overallRate' ? `${p.value}%` : formatInt(p.value)) },
    }],
  } as never
}, { immediate: true })

const quadEl = ref<HTMLElement | null>(null)
const quadOpt = ref<any>(null)
const { chart: quadChart } = useChart(quadEl, quadOpt)
watch([byStore, avgExpo, avgRate], () => {
  if (!byStore.value.length) { quadOpt.value = null; return }
  const maxO = Math.max(...byStore.value.map((r) => r.orders), 1)
  quadOpt.value = {
    backgroundColor: '#fff',
    grid: { left: 52, right: 20, top: 30, bottom: 30 },
    tooltip: {
      trigger: 'item',
      formatter: (p: Record<string, unknown>) => {
        const d = p.data as Record<string, unknown>
        return `<b>${d.label}</b><br/>曝光 ${formatInt(d.ex as number)} · 转化 ${fmtPct(d.rt as number)} · 下单 ${formatInt(d.od as number)}`
      },
    },
    xAxis: { name: '曝光', splitLine: { lineStyle: { color: '#eef2f7' } }, axisLabel: { color: '#64748b' }, axisLine: { show: true, lineStyle: { color: '#cbd5e1' } } },
    yAxis: { name: '整体转化率', axisLabel: { formatter: (v: number) => `${(v * 100).toFixed(0)}%`, color: '#64748b' }, splitLine: { lineStyle: { color: '#eef2f7' } }, axisLine: { show: true, lineStyle: { color: '#cbd5e1' } } },
    series: [{
      type: 'scatter',
      data: byStore.value.map((r) => ({
        value: [r.exposure, r.overallRate || 0], label: shortStore(r.name), full: r.name,
        ex: r.exposure, rt: r.overallRate || 0, od: r.orders,
        itemStyle: { color: { HH: '#00c389', HL: '#ef4444', LH: '#2f8cff', LL: '#94a3b8' }[quadOf(r)], opacity: 0.85, borderColor: '#fff', borderWidth: 2 },
      })),
      symbolSize: (_v: number[], p: { data: Record<string, unknown> }) =>
        10 + (Math.sqrt((p.data.od as number) || 0) / Math.sqrt(maxO || 1)) * 34,
      markLine: {
        silent: true, symbol: 'none', lineStyle: { color: '#cbd5e1', type: 'dashed' },
        data: [{ xAxis: avgExpo.value, label: { formatter: '曝光均值' } }, { yAxis: avgRate.value, label: { formatter: '转化均值' } }],
      },
      label: { show: true, formatter: (p: { data: Record<string, unknown> }) => String(p.data.label), color: '#334155', fontSize: 10, position: 'top' },
    }],
  } as never
}, { immediate: true })
watch(quadChart, (c) => {
  if (!c) return
  c.off('click')
  c.on('click', (p: any) => {
    if (p.data?.full) { selStore.value = p.data.full; drill.value = p.data.full }
  })
})

/** 热力：日期 × TOP12门店转化率 */
const heatEl = ref<HTMLElement | null>(null)
const heatOpt = ref<any>(null)
useChart(heatEl, heatOpt)
watch([facts, byStore], () => {
  const top = [...byStore.value].sort((a, b) => b.orders - a.orders).slice(0, 12).map((r) => r.name)
  const dates = [...new Set(facts.value.map((r) => r.date).filter(Boolean))].sort() as string[]
  if (!top.length || !dates.length) { heatOpt.value = null; return }
  const cell = new Map<string, { o: number; e: number }>()
  for (const r of facts.value) {
    if (!r.date || !top.includes(r.store)) continue
    const k = `${r.date}|${r.store}`
    const c = cell.get(k) || { o: 0, e: 0 }
    c.o += r.orders || 0; c.e += r.exposure || 0
    cell.set(k, c)
  }
  const data = []
  for (let i = 0; i < dates.length; i++) {
    for (let j = 0; j < top.length; j++) {
      const c = cell.get(`${dates[i]}|${top[j]}`)
      data.push([i, j, c && c.e ? +((c.o / c.e) * 100).toFixed(2) : 0])
    }
  }
  heatOpt.value = {
    backgroundColor: '#fff',
    grid: { left: 90, right: 20, top: 10, bottom: 60 },
    tooltip: { formatter: (p: { value: number[] }) => `${dates[p.value[0]]} · ${shortStore(top[p.value[1]])}<br/>转化 ${p.value[2]}%` },
    xAxis: { type: 'category', data: dates.map((d) => d.slice(5)), axisLabel: { color: '#64748b', fontSize: 10, rotate: 40 } },
    yAxis: { type: 'category', data: top.map(shortStore), axisLabel: { color: '#334155', fontSize: 11 } },
    visualMap: { min: 0, max: Math.max(5, ...data.map((d) => d[2] as number)), calculable: false, orient: 'horizontal', left: 'center', bottom: 0, inRange: { color: ['#eef4ff', '#2f8cff', '#0b3d91'] }, textStyle: { color: '#64748b' } },
    series: [{ type: 'heatmap', data, label: { show: false }, emphasis: { itemStyle: { borderColor: '#fff', borderWidth: 1 } } }],
  } as never
}, { immediate: true })

const prevRank = computed(() => rankMap(prevFacts.value, (r) => r.store))
const curRank = computed(() => rankMap(facts.value, (r) => r.store))
const detailRows = computed(() =>
  [...byStore.value]
    .sort((a, b) => b.orders - a.orders)
    .map((r) => {
      const mean = cityMean.value.get(storeCity.value.get(r.name) || '')
      const gapPP = r.overallRate != null && mean != null ? (r.overallRate - mean) * 100 : 0
      const cr = curRank.value.get(r.name) || 0
      const pr = prevRank.value.get(r.name)
      const health = (r.overallRate || 0) >= avgRate.value && r.exposure >= avgExpo.value
        ? ['明星', 'is-good'] : (r.overallRate || 0) >= avgRate.value ? ['潜力', 'is-mid'] : r.exposure >= avgExpo.value ? ['待转化', 'is-warn'] : ['待观察', 'is-bad']
      return { ...r, city: storeCity.value.get(r.name) || '', gapPP, rankMove: pr == null ? null : pr - cr, health: health[0], healthCls: health[1] }
    }),
)
const drillSources = computed(() => {
  if (!drill.value) return []
  return [...groupSum(facts.value.filter((r) => r.store === drill.value), (r) => r.source).entries()]
    .map(([, v]) => v)
    .sort((a, b) => b.exposure - a.exposure)
})
function gapText(v: number) { return `${v >= 0 ? '+' : ''}${v.toFixed(2)}pp` }
function rankText(v: number | null) {
  if (v == null) return '新上榜'
  if (v === 0) return '—'
  return v > 0 ? `↑${v}` : `↓${-v}`
}
</script>

<style scoped lang="scss">
.quad-legend { display: flex; gap: 14px; flex-wrap: wrap; color: #64748b; font-size: 12px; padding: 4px 2px 0; }
.quad-legend i { display: inline-block; width: 9px; height: 9px; border-radius: 50%; margin-right: 4px; }
.traffic-table .num { font-family: var(--ck-font-num); }
.traffic-table tr.clickable { cursor: pointer; }
.traffic-table tr.active td { background: #fff7ed; }
.drill-row td { background: #f8fafc; }
.drill-src { display: flex; flex-wrap: wrap; gap: 8px; padding: 6px 2px; }
.drill-chip { background: #fff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 6px 10px; font-size: 12px; color: #475569; }
.drill-chip b { color: #1e293b; margin-right: 6px; }
.health-tag { padding: 2px 8px; border-radius: 99px; font-size: 11px; }
.health-tag.is-good { background: #dcfce7; color: #15803d; }
.health-tag.is-mid { background: #dbeafe; color: #1d4ed8; }
.health-tag.is-warn { background: #fef3c7; color: #b45309; }
.health-tag.is-bad { background: #f1f5f9; color: #64748b; }
.pos { color: #16a34a; } .neg { color: #dc2626; }
</style>
