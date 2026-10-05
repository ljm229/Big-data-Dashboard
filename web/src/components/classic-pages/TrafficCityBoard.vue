<!-- 中文名：流量-城市维度看板 -->
<template>
  <div class="ck-page">
    <section class="city-cards">
      <article v-for="c in cityCards" :key="c.name" class="ck-card city-card" :class="{ active: focusCity === c.name }" @click="focusCity = c.name">
        <b>{{ c.name }}</b>
        <div class="city-nums">
          <span>曝 <em>{{ fmtWanLike(c.exposure) }}</em></span>
          <span>单 <em>{{ fmtWanLike(c.orders) }}</em></span>
          <span>转 <em>{{ fmtPct(c.overallRate) }}</em></span>
        </div>
        <div class="city-sub">{{ c.stores }}家店 · 单店{{ fmtWanLike(c.perStore) }}单 · 环比{{ fmtRel(c.qoq) }}</div>
      </article>
    </section>

    <section class="ck-grid-diag">
      <article class="ck-card">
        <header class="ck-card__head">
          <h3>城市转化率对比</h3>
          <p>虚线=全部均值</p>
        </header>
        <div ref="cityEl" class="ck-plot ck-plot--tall" />
      </article>
      <article class="ck-card">
        <header class="ck-card__head">
          <h3>{{ focusCity }} · 市内门店下单堆叠</h3>
          <p>按来源拆 · 点击城市卡切换</p>
        </header>
        <div ref="stackEl" class="ck-plot ck-plot--tall" />
      </article>
    </section>

    <section class="ck-grid-1">
      <article class="ck-card">
        <header class="ck-card__head">
          <h3>{{ focusCity }} · 市内门店贡献排名</h3>
          <p>占比=占城市下单 · 累计看头部集中度</p>
        </header>
        <table class="contrib-table traffic-table">
          <thead><tr><th>#</th><th>门店</th><th>曝光</th><th>下单</th><th>整体转化</th><th>占城市</th><th>累计</th></tr></thead>
          <tbody>
            <tr v-for="(r, i) in contribRows" :key="r.name">
              <td><span class="ck-rank" :class="i < 3 ? `is-${i + 1}` : ''">{{ i + 1 }}</span></td>
              <td>{{ shortStore(r.name) }}</td>
              <td class="num">{{ formatInt(r.exposure) }}</td>
              <td class="num">{{ formatInt(r.orders) }}</td>
              <td>{{ fmtPct(r.overallRate) }}</td>
              <td>{{ (r.share * 100).toFixed(1) }}%</td>
              <td>{{ (r.cum * 100).toFixed(1) }}%</td>
            </tr>
          </tbody>
        </table>
      </article>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useChart } from '../../composables/useChart'
import { formatInt } from '../../utils/format'
import { fmtPct } from '../../utils/classicHints'
import {
  fmtRel, groupSum, prevRangeOf, rel, scopeFacts, shortStore, sumFacts,
  type TrafficScope,
} from '../../api/traffic'

const props = defineProps<{ scope: TrafficScope }>()
const s = computed(() => props.scope)
const facts = computed(() => scopeFacts(s.value))
const prevFacts = computed(() => {
  const [f, t] = prevRangeOf(s.value.from, s.value.to)
  return scopeFacts({ ...s.value, from: f, to: t })
})

const byCity = computed(() => [...groupSum(facts.value, (r) => r.city).entries()].map(([, v]) => v))
const prevByCity = computed(() => groupSum(prevFacts.value, (r) => r.city))
const cityStores = computed(() => {
  const m = new Map<string, Set<string>>()
  for (const r of facts.value) {
    if (!m.has(r.city)) m.set(r.city, new Set())
    m.get(r.city)!.add(r.store)
  }
  return m
})
const cityCards = computed(() =>
  byCity.value
    .map((c) => {
      const n = cityStores.value.get(c.name)?.size || 0
      const p = prevByCity.value.get(c.name)
      return { ...c, stores: n, perStore: n ? c.orders / n : 0, qoq: rel(c.orders, p?.orders) }
    })
    .sort((a, b) => b.orders - a.orders),
)
const focusCity = ref('')
watch(cityCards, (list) => {
  if (!list.length) return
  if (!list.some((c) => c.name === focusCity.value)) focusCity.value = list[0].name
}, { immediate: true })

function fmtWanLike(n: number) {
  if (n >= 10000) return `${(n / 10000).toFixed(1)}万`
  return formatInt(n)
}

const cityEl = ref<HTMLElement | null>(null)
const cityOpt = ref<any>(null)
useChart(cityEl, cityOpt)
watch(cityCards, (list) => {
  if (!list.length) { cityOpt.value = null; return }
  const tot = sumFacts(facts.value)
  const mean = tot.exposure ? (tot.orders / tot.exposure) * 100 : 0
  const rows = [...list].sort((a, b) => (b.overallRate || 0) - (a.overallRate || 0))
  cityOpt.value = {
    backgroundColor: '#fff',
    grid: { left: 8, right: 60, top: 8, bottom: 8, containLabel: true },
    tooltip: { trigger: 'item', formatter: (p: Record<string, unknown>) => `<b>${p.name}</b><br/>转化 ${p.value}%` },
    xAxis: { type: 'value', axisLabel: { formatter: '{value}%', color: '#94a3b8', fontSize: 10 }, splitLine: { lineStyle: { color: '#eef2f7' } } },
    yAxis: { type: 'category', data: rows.map((r) => r.name), axisTick: { show: false }, axisLine: { show: false }, axisLabel: { color: '#334155', fontSize: 12 } },
    series: [{
      type: 'bar', barWidth: 14,
      data: rows.map((r) => ({ value: +((r.overallRate || 0) * 100).toFixed(2), name: r.name, itemStyle: { color: r.name === focusCity.value ? '#f59e0b' : '#2f8cff', borderRadius: [0, 6, 6, 0] } })),
      label: { show: true, position: 'right', color: '#475569', fontSize: 11, fontWeight: 700, formatter: '{c}%' },
      markLine: { silent: true, symbol: 'none', lineStyle: { color: '#94a3b8', type: 'dashed' }, data: [{ xAxis: +mean.toFixed(2), label: { formatter: `均值${mean.toFixed(2)}%` } }] },
    }],
  } as never
}, { immediate: true })

/** 市内门店下单按来源堆叠 */
const stackEl = ref<HTMLElement | null>(null)
const stackOpt = ref<any>(null)
useChart(stackEl, stackOpt)
const palette = ['#2f8cff', '#00c389', '#f59e0b', '#a78bfa', '#ef4444', '#64748b']
watch([facts, focusCity], () => {
  const list = facts.value.filter((r) => r.city === focusCity.value)
  const stores = [...groupSum(list, (r) => r.store).entries()].sort((a, b) => b[1].orders - a[1].orders).slice(0, 10).map(([k]) => k)
  const srcs = [...groupSum(list, (r) => r.source).entries()].sort((a, b) => b[1].orders - a[1].orders).map(([k]) => k)
  if (!stores.length) { stackOpt.value = null; return }
  const topSrc = srcs.slice(0, 5)
  const cell = new Map<string, number>()
  for (const r of list) {
    if (!stores.includes(r.store)) continue
    const sk = topSrc.includes(r.source) ? r.source : '其他来源'
    const k = `${r.store}|${sk}`
    cell.set(k, (cell.get(k) || 0) + (r.orders || 0))
  }
  const cats = [...new Set([...topSrc, ...(srcs.length > 5 ? ['其他来源'] : [])])]
  stackOpt.value = {
    backgroundColor: '#fff',
    grid: { left: 8, right: 8, top: 34, bottom: 8, containLabel: true },
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    legend: { top: 0, textStyle: { color: '#475569', fontSize: 11 }, itemWidth: 12, itemHeight: 8 },
    xAxis: { type: 'value', splitLine: { lineStyle: { color: '#eef2f7' } }, axisLabel: { color: '#94a3b8', fontSize: 10 } },
    yAxis: { type: 'category', data: [...stores].reverse().map(shortStore), axisTick: { show: false }, axisLine: { show: false }, axisLabel: { color: '#334155', fontSize: 11 } },
    series: cats.map((c, i) => ({
      name: c, type: 'bar', stack: 't', barWidth: 14,
      data: [...stores].reverse().map((st) => cell.get(`${st}|${c}`) || 0),
      itemStyle: { color: palette[i % palette.length] },
    })),
  } as never
}, { immediate: true })

const contribRows = computed(() => {
  const list = facts.value.filter((r) => r.city === focusCity.value)
  const rows = [...groupSum(list, (r) => r.store).entries()].map(([, v]) => v).sort((a, b) => b.orders - a.orders)
  const tot = rows.reduce((a, r) => a + r.orders, 0) || 1
  let cum = 0
  return rows.map((r) => {
    const share = r.orders / tot
    cum += share
    return { ...r, share, cum }
  })
})
</script>

<style scoped lang="scss">
.city-cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 10px; }
.city-card { cursor: pointer; padding: 12px 14px; }
.city-card.active { outline: 2px solid #f59e0b; }
.city-card b { font-size: 15px; }
.city-nums { display: flex; gap: 12px; margin-top: 6px; color: #64748b; font-size: 12px; }
.city-nums em { font-style: normal; color: #1e293b; font-weight: 800; font-family: var(--ck-font-num); }
.city-sub { margin-top: 4px; color: #94a3b8; font-size: 11px; }
.traffic-table .num { font-family: var(--ck-font-num); }
</style>
