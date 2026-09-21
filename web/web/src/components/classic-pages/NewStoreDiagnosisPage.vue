<!-- 中文名：新店诊断——门店×渠道 / 02 -->
<template>
  <div class="ck-page diag-page">
    <section class="ck-kpi-row">
      <ClassicKpi name="本期毛利" :value="fmtMoneyKpi(totalProfit).value" :unit="fmtMoneyKpi(totalProfit).unit" :val-tone="totalProfit < 0 ? 'is-red' : 'is-green'" :hints="[{ label: '环比', value: qoq(totalProfit, prevProfit) }]" />
      <ClassicKpi name="本期订单" :value="formatInt(totalOrders)" :hints="[{ label: '环比', value: qoq(totalOrders, prevOrders) }, { label: '新店占比', value: newOrderShareAbs }]" />
      <ClassicKpi name="客单价" :value="aovText" unit="元" :hints="[{ label: '环比', value: qoq(aov, prevAov) }]" />
      <ClassicKpi name="新店订单" :value="formatInt(newOrders)" :hints="[{ label: '环比', value: qoq(newOrders, prevNewOrders) }, { label: '占全部', value: newOrderShareAbs }]" />
      <ClassicKpi name="新店毛利" :value="fmtMoneyKpi(newProfit).value" :unit="fmtMoneyKpi(newProfit).unit" :hints="[{ label: '环比', value: qoq(newProfit, prevNewProfit) }, { label: '占全部', value: newProfitShareAbs }]" />
      <ClassicKpi name="缺货损失" :value="fmtMoneyKpi(stockLoss).value" :unit="fmtMoneyKpi(stockLoss).unit" :hints="[{ label: '环比', value: qoq(stockLoss, prevStockLoss) }, { label: '最高', value: stockTop }]" />
    </section>

    <section class="ck-grid-diag">
      <article class="ck-card diag-bubble">
        <header class="ck-card__head">
          <h3>门店排行榜</h3>
          <p>蓝=新店 · 绿=老店 · 点击看右侧诊断</p>
        </header>
        <div class="ck-pills">
          <button type="button" :class="{ active: rankMetric === 'profit' }" @click="rankMetric = 'profit'">毛利</button>
          <button type="button" :class="{ active: rankMetric === 'orders' }" @click="rankMetric = 'orders'">订单</button>
          <button type="button" :class="{ active: rankMetric === 'aov' }" @click="rankMetric = 'aov'">客单价</button>
        </div>
        <div v-show="rankRows.length" ref="rankEl" class="ck-plot ck-plot--chart ck-plot--tall" />
        <div v-if="!rankRows.length" class="ck-empty"><b>暂无排行数据</b></div>
      </article>
      <article class="ck-card contrib-card">
        <header class="ck-card__head">
          <h3>新店 vs 老店</h3>
          <p>本期绝对值占比 · {{ unmarkedNote }}</p>
        </header>门店排行
        <div v-for="r in cohortShareRows" :key="r.label" class="share-row">
          <div class="share-top">
            <span>{{ r.label }}</span>
            <span class="share-sub">环比 {{ r.qoq }}</span>
          </div>
          <div class="contrib-bar">
            <em class="is-new" :style="{ width: `${r.wNew}%` }" />
            <em class="is-old" :style="{ width: `${r.wOld}%` }" />
          </div>
          <div class="contrib-legend">
            <span><b>{{ r.newText }}</b>新店 {{ r.pctNew }}</span>
            <span><b>{{ r.oldText }}</b>老店 {{ r.pctOld }}</span>
          </div>
        </div>
      </article>
    </section>

    <section class="ck-grid-diag-bot">
      <article class="ck-card">
        <header class="ck-card__head">
          <h3>诊断明细</h3>
          <p>{{ sel ? `${shortStore(sel.store)} · ${cohortTag}` : '点击左侧气泡查看' }}</p>
        </header>
        <div v-if="selDetail" class="diag-detail">
          <div class="diag-kv">
            <div><span>本期毛利</span><b :class="{ neg: selDetail.profit < 0 }">{{ fmtWan(selDetail.profit) }}</b><em>环比 {{ selDetail.qoqProfit }}</em></div>
            <div><span>毛利率</span><b>{{ fmtPct(selDetail.profitRate) }}</b><em>环比 {{ selDetail.qoqRate }}</em></div>
            <div><span>订单</span><b>{{ formatInt(selDetail.orders) }}</b><em>环比 {{ selDetail.qoqOrders }}</em></div>
            <div><span>客单价</span><b>{{ selDetail.aovText }}元</b><em>环比 {{ selDetail.qoqAov }}</em></div>
            <div><span>退款率</span><b :class="{ neg: (selDetail.refundRate || 0) >= 0.05 }">{{ fmtPct(selDetail.refundRate) }}</b></div>
            <div><span>缺货损失</span><b :class="{ neg: selDetail.stockLoss > 0 }">{{ fmtWan(selDetail.stockLoss) }}</b></div>
          </div>
          <table class="diag-table">
            <thead><tr><th>渠道</th><th>订单</th><th>毛利</th><th>毛利率</th></tr></thead>
            <tbody>
              <tr v-for="r in selDetail.channels" :key="r.channel" :class="{ neg: (r.profit || 0) < 0 }">
                <td><i :style="{ background: chColor(r.channel) }" />{{ shortCh(r.channel) }}</td>
                <td>{{ formatInt(r.orders) }}</td>
                <td>{{ fmtWan(r.profit) }}</td>
                <td>{{ fmtPct(r.profitRate) }}</td>
              </tr>
            </tbody>
          </table>
          <p class="age-note">{{ verdict }}</p>
        </div>
        <div v-else class="ck-empty"><b>暂未选择</b><span>点击气泡选择一家门店</span></div>
      </article>
      <article class="ck-card">
        <header class="ck-card__head"><h3>风险与机会</h3><p>按门店汇总 · 点击跳转诊断</p></header>
        <div class="insight-row">
          <div class="insight risk">
            <b>待诊断门店 · {{ riskStores.length }}</b>
            <button v-for="r in riskStores.slice(0, 5)" :key="r.store" type="button" @click="pickStore(r.store)">{{ shortStore(r.store) }} 赚{{ fmtWan(r.profit) }} · 利率{{ fmtPct(r.profitRate) }}</button>
            <p v-if="!riskStores.length">暂无</p>
          </div>
          <div class="insight chance">
            <b>高利门店 · {{ chanceStores.length }}</b>
            <button v-for="r in chanceStores.slice(0, 5)" :key="r.store" type="button" @click="pickStore(r.store)">{{ shortStore(r.store) }} 利率{{ fmtPct(r.profitRate) }} · 赚{{ fmtWan(r.profit) }}</button>
            <p v-if="!chanceStores.length">暂无</p>
          </div>
        </div>
      </article>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import ClassicKpi from './ClassicKpi.vue'
import { useFilterStore } from '../../stores/filter'
import {
  CHANNEL_COLOR,
  previousPeriodRange,
  source1ByStore,
  source1ByStoreChannel,
  source1StockoutStores,
  storeCohortLabel,
  storeCohortOf,
} from '../../api/source1'
import { useChart } from '../../composables/useChart'
import { formatInt } from '../../utils/format'
import { fmtPct, fmtWan, fmtMoneyKpi } from '../../utils/classicHints'

const filter = useFilterStore()
const { periodRange, channel, cityQuery, storeQuery, periodMode } = storeToRefs(filter)
const q = computed(() => ({ from: periodRange.value.from, to: periodRange.value.to, channel: channel.value, store: storeQuery.value, city: cityQuery.value }))
const qAll = computed(() => ({ from: periodRange.value.from, to: periodRange.value.to, channel: '全部', store: storeQuery.value, city: cityQuery.value }))

/** KPI：全部取本期绝对值，保证有数 */
const storeRows = computed(() => source1ByStore(qAll.value).filter((r) => r.profit != null))
const totalProfit = computed(() => storeRows.value.reduce((a, r) => a + (r.profit || 0), 0))
const totalOrders = computed(() => storeRows.value.reduce((a, r) => a + (r.orders || 0), 0))
const totalPaid = computed(() => storeRows.value.reduce((a, r) => a + (r.paid || 0), 0))
const newRows = computed(() => storeRows.value.filter((r) => storeCohortOf(r.key) === 'new'))
const newOrders = computed(() => newRows.value.reduce((a, r) => a + (r.orders || 0), 0))
const newProfit = computed(() => newRows.value.reduce((a, r) => a + (r.profit || 0), 0))
const newOrderShareAbs = computed(() => {
  const t = totalOrders.value || 1
  return `${((newOrders.value / t) * 100).toFixed(0)}%`
})
const newProfitShareAbs = computed(() => {
  const t = Math.abs(totalProfit.value) || 1
  return `${((newProfit.value / t) * 100).toFixed(0)}%`
})
const cohortCounts = computed(() => {
  const n = storeRows.value.filter((r) => storeCohortOf(r.key) === 'new').length
  return { n, o: storeRows.value.length - n }
})
const stockRows = computed(() => source1StockoutStores(qAll.value))
const stockLoss = computed(() => stockRows.value.reduce((a, r) => a + (r.absentLoss || 0), 0))
const stockTop = computed(() => {
  const top = [...stockRows.value].sort((a, b) => (b.absentLoss || 0) - (a.absentLoss || 0))[0]
  return top ? `${shortStore(top.store)} ${fmtWan(top.absentLoss)}` : '—'
})
/** 环比 */
function qoq(cur: number | null, prev: number | null | undefined) {
  if (cur == null || prev == null || prev === 0) return '—'
  const v = ((cur - prev) / Math.abs(prev)) * 100
  return `${v > 0 ? '+' : ''}${v.toFixed(1)}%`
}
function qoqPp(cur: number | null, prev: number | null | undefined) {
  if (cur == null || prev == null) return '—'
  const v = (cur - prev) * 100
  return `${v > 0 ? '+' : ''}${v.toFixed(1)}pp`
}
const prevQ = computed(() => {
  const p = previousPeriodRange(periodRange.value.from, periodRange.value.to, periodMode.value)
  return { from: p.from, to: p.to, channel: '全部', store: storeQuery.value, city: cityQuery.value }
})
const prevStoreRows = computed(() => source1ByStore(prevQ.value).filter((r) => r.profit != null))
const prevProfit = computed(() => prevStoreRows.value.reduce((a, r) => a + (r.profit || 0), 0))
const prevOrders = computed(() => prevStoreRows.value.reduce((a, r) => a + (r.orders || 0), 0))
const prevPaid = computed(() => prevStoreRows.value.reduce((a, r) => a + (r.paid || 0), 0))
const prevNewOrders = computed(() => prevStoreRows.value.filter((r) => storeCohortOf(r.key) === 'new').reduce((a, r) => a + (r.orders || 0), 0))
const prevNewProfit = computed(() => prevStoreRows.value.filter((r) => storeCohortOf(r.key) === 'new').reduce((a, r) => a + (r.profit || 0), 0))
const prevStockLoss = computed(() => source1StockoutStores(prevQ.value).reduce((a, r) => a + (r.absentLoss || 0), 0))
const aov = computed(() => (totalOrders.value ? totalPaid.value / totalOrders.value : null))
const prevAov = computed(() => (prevOrders.value ? prevPaid.value / prevOrders.value : null))
const aovText = computed(() => (aov.value == null ? '—' : aov.value.toFixed(2)))

/** 新老占比条：本期绝对值 */
function sumByCohort(field: 'orders' | 'paid' | 'profit') {
  let n = 0, o = 0
  for (const r of storeRows.value) {
    if (storeCohortOf(r.key) === 'new') n += r[field] || 0
    else o += r[field] || 0
  }
  return { n, o }
}
function sumPrevByCohort(field: 'orders' | 'paid' | 'profit') {
  let n = 0, o = 0
  for (const r of prevStoreRows.value) {
    if (storeCohortOf(r.key) === 'new') n += r[field] || 0
    else o += r[field] || 0
  }
  return { n, o }
}
const cohortShareRows = computed(() => {
  const defs = [
    { label: '订单量', field: 'orders' as const, fmt: (v: number) => formatInt(Math.round(v)) },
    { label: '实付金额', field: 'paid' as const, fmt: (v: number) => fmtWan(v) },
    { label: '含后返毛利', field: 'profit' as const, fmt: (v: number) => fmtWan(v) },
  ]
  return defs.map((d) => {
    const cur = sumByCohort(d.field)
    const prev = sumPrevByCohort(d.field)
    const tot = cur.n + cur.o || 1
    const pNew = (cur.n / tot) * 100
    return {
      label: d.label,
      newText: d.fmt(cur.n),
      oldText: d.fmt(cur.o),
      pctNew: `${pNew.toFixed(0)}%`,
      pctOld: `${(100 - pNew).toFixed(0)}%`,
      wNew: pNew,
      wOld: 100 - pNew,
      qoq: qoq(cur.n + cur.o, prev.n + prev.o),
    }
  })
})
const unmarkedNote = computed(() => `否=老店其余=新店 · 新店${cohortCounts.value.n}家·老店${cohortCounts.value.o}家`)

/** 门店排行榜：横向条形，一眼看谁赚谁亏 */
const rankMetric = ref<'profit' | 'orders' | 'aov'>('profit')
const rankRows = computed(() => {
  const list = storeRows.value.map((r) => {
    const v = rankMetric.value === 'orders'
      ? r.orders || 0
      : rankMetric.value === 'aov'
        ? (r.orders ? (r.paid || 0) / r.orders : 0)
        : r.profit || 0
    return {
      store: r.key as string,
      value: v,
      isNew: storeCohortOf(r.key) === 'new',
      text: rankMetric.value === 'orders' ? formatInt(Math.round(v)) : rankMetric.value === 'aov' ? v.toFixed(1) : fmtWan(v),
    }
  })
  return list.sort((a, b) => b.value - a.value).slice(0, 15)
})
const rankEl = ref<HTMLElement | null>(null)
const rankOption = ref<any>(null)
const { chart: rankChart } = useChart(rankEl, rankOption)
const sel = ref<{ store: string } | null>(null)

/** 默认选中毛利最低的店，诊断卡不落空 */
watch([rankRows], () => {
  const rows = rankRows.value
  if (!rows.length) return
  if (!sel.value || !rows.some((r) => r.store === sel.value!.store)) {
    sel.value = { store: [...rows].sort((a, b) => a.value - b.value)[0].store }
  }
}, { immediate: true })

watch([rankRows, rankMetric], () => {
  if (!rankRows.value.length) {
    rankOption.value = null
    return
  }
  const rows = [...rankRows.value].reverse()
  rankOption.value = {
    backgroundColor: '#ffffff',
    grid: { left: 8, right: 64, top: 8, bottom: 8, containLabel: true },
    tooltip: {
      trigger: 'item',
      formatter: (p: Record<string, unknown>) => {
        const d = p.data as Record<string, unknown>
        return `<b>${d.label}</b><br/>${rankMetric.value === 'profit' ? '毛利' : rankMetric.value === 'orders' ? '订单' : '客单价'} ${d.text}${d.isNew ? '<br/>新店' : '<br/>老店'}`
      },
    },
    xAxis: { type: 'value', splitLine: { lineStyle: { color: '#eef2f7' } }, axisLabel: { color: '#94a3b8', fontSize: 10 } },
    yAxis: {
      type: 'category',
      data: rows.map((r) => shortStore(r.store)),
      axisTick: { show: false },
      axisLine: { show: false },
      axisLabel: { color: '#334155', fontSize: 11 },
    },
    series: [{
      type: 'bar',
      barWidth: 12,
      data: rows.map((r) => ({
        value: Math.round(r.value * 100) / 100,
        label: r.store,
        text: r.text,
        isNew: r.isNew,
        itemStyle: {
          color: r.store === sel.value?.store ? '#f59e0b' : r.isNew ? '#2f8cff' : '#00c389',
          borderRadius: [0, 6, 6, 0],
        },
      })),
      label: { show: true, position: 'right', color: '#475569', fontSize: 11, fontWeight: 700, formatter: (p: { data: Record<string, unknown> }) => String(p.data.text) },
      emphasis: { focus: 'series' },
    }],
  } as never
}, { immediate: true })

watch(rankChart, (c) => {
  if (!c) return
  c.off('click')
  c.on('click', (p: any) => {
    if (p.data?.label) sel.value = { store: p.data.label }
  })
})

/** 诊断明细：整店四渠道拆解 */
const selDetail = computed(() => {
  if (!sel.value) return null
  const row = storeRows.value.find((r) => r.key === sel.value!.store)
  const channels = source1ByStoreChannel(qAll.value)
    .filter((r) => r.store === sel.value!.store)
    .map((r) => ({ channel: r.channel as string, orders: r.orders, profit: r.profit, profitRate: r.profitRate }))
    .sort((a, b) => (a.profit || 0) - (b.profit || 0))
  const stock = stockRows.value.find((r) => r.store === sel.value!.store)
  const prow = prevStoreRows.value.find((r) => r.key === sel.value!.store)
  const aovCur = row?.orders ? (row.paid || 0) / row.orders : null
  const aovPrev = prow?.orders ? (prow.paid || 0) / prow.orders : null
  return {
    store: sel.value.store,
    profit: row?.profit || 0,
    profitRate: row?.profitRate ?? null,
    orders: row?.orders || 0,
    refundRate: row?.refundRate ?? null,
    stockLoss: stock?.absentLoss || 0,
    channels,
    aovText: aovCur == null ? '—' : aovCur.toFixed(2),
    qoqProfit: qoq(row?.profit ?? null, prow?.profit),
    qoqRate: qoqPp(row?.profitRate ?? null, prow?.profitRate),
    qoqOrders: qoq(row?.orders ?? null, prow?.orders),
    qoqAov: qoq(aovCur, aovPrev),
  }
})
const cohortTag = computed(() => (sel.value ? storeCohortLabel(storeCohortOf(sel.value.store)) : ''))
const verdict = computed(() => {
  const d = selDetail.value
  if (!d) return ''
  const parts: string[] = []
  const worst = d.channels[0]
  if (worst && (worst.profit || 0) < 0) parts.push(`${shortCh(worst.channel)}亏${fmtWan(worst.profit)}是主因`)
  else parts.push('四渠道全部盈利')
  if ((d.refundRate || 0) >= 0.05) parts.push(`退款率${fmtPct(d.refundRate)}偏高先查逆向单`)
  if (d.stockLoss > 500) parts.push(`缺货损失${fmtWan(d.stockLoss)}补货`)
  const best = [...d.channels].sort((a, b) => (b.profit || 0) - (a.profit || 0))[0]
  if (best && (best.profit || 0) > 0 && worst && (worst.profit || 0) < 0) parts.push(`同店${shortCh(best.channel)}赚钱可倾斜`)
  return `${shortStore(d.store)}：${parts.join('，')}。`
})

/** 风险与机会：门店级（全盈利时，待诊断=毛利最低的5家） */
const riskStores = computed(() => {
  const neg = storeRows.value.filter((r) => (r.profit || 0) < 0).sort((a, b) => (a.profit || 0) - (b.profit || 0))
  const base = neg.length ? neg : [...storeRows.value].sort((a, b) => (a.profit || 0) - (b.profit || 0)).slice(0, 5)
  return base.map((r) => ({ store: r.key as string, profit: r.profit, profitRate: r.profitRate }))
})
const chanceStores = computed(() =>
  storeRows.value
    .filter((r) => (r.profit || 0) > 0 && (r.profitRate || 0) >= 0.25)
    .sort((a, b) => (b.profitRate || 0) - (a.profitRate || 0))
    .map((r) => ({ store: r.key as string, profit: r.profit, profitRate: r.profitRate })),
)
function pickStore(store: string) {
  sel.value = { store }
}

function shortStore(n: string) { return String(n || '').replace(/^淘宝便利店/, '').replace(/[()]/g, '') }
function shortCh(n: string) { return String(n || '').replace('淘宝闪购', '淘闪') }
function chColor(n: string) { return CHANNEL_COLOR[n] || '#94a3b8' }
</script>

<style scoped lang="scss">
.diag-page { gap: 10px; }
.ck-grid-diag { display: grid; grid-template-columns: 1.4fr 0.9fr; gap: 10px; }
.ck-grid-diag-bot { display: grid; grid-template-columns: 1.2fr 1fr; gap: 10px; }
.ck-plot--tall { height: 300px; min-height: 300px; }
.contrib-total { text-align: center; font: 800 30px var(--ck-font-num); color: #1e293b; }
.contrib-sub { text-align: center; color: #64748b; font-size: 12px; margin: 2px 0 10px; }
.contrib-bar { display: flex; gap: 4px; height: 18px; }
.contrib-bar em { display: block; border-radius: 5px; min-width: 2px; }
.contrib-bar .is-new { background: #2f8cff; }
.contrib-bar .is-old { background: #00c389; }
.contrib-bar .is-exit { background: #ff5b5b; }
.contrib-legend { display: flex; justify-content: space-between; margin: 6px 0 12px; color: #64748b; font-size: 12px; }
.contrib-legend b { display: block; color: #1e293b; font: 800 15px var(--ck-font-num); }
.contrib-legend span:last-child { text-align: right; }
.contrib-legend span:last-child b { text-align: right; }
.share-row:last-child .contrib-legend { margin-bottom: 0; }
.share-top { display: flex; justify-content: space-between; align-items: baseline; font-size: 12px; color: #334155; font-weight: 700; margin-bottom: 6px; }
.share-sub { color: #94a3b8; font-weight: 400; }
.contrib-table { width: 100%; border-collapse: collapse; font-size: 12px; }
.contrib-table th, .contrib-table td { padding: 7px 6px; border-top: 1px solid #eef2f7; text-align: right; }
.contrib-table th:first-child, .contrib-table td:first-child { text-align: left; color: #64748b; }
.contrib-table thead th { border-top: 0; color: #0ea5e9; font-weight: 700; }
.contrib-table .pos { color: #00a868; font-weight: 700; }
.contrib-table .neg { color: #ef2d55; font-weight: 700; }
.diag-detail { display: grid; gap: 10px; padding: 6px 2px; }
.diag-kv { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 8px; }
.diag-kv div { background: #f8fafc; border-radius: 8px; padding: 8px 6px; text-align: center; }
.diag-kv span { display: block; color: #94a3b8; font-size: 11px; }
.diag-kv b { font: 800 15px var(--ck-font-num); color: #0f766e; }
.diag-kv b.neg { color: #dc2626; }
.diag-kv em { display: block; font-style: normal; color: #94a3b8; font-size: 11px; margin-top: 2px; }
.diag-table { width: 100%; border-collapse: collapse; font-size: 12px; }
.diag-table th, .diag-table td { padding: 6px; border-top: 1px solid #eef2f7; text-align: right; }
.diag-table th:first-child, .diag-table td:first-child { text-align: left; }
.diag-table thead th { border-top: 0; color: #94a3b8; font-weight: 600; }
.diag-table i { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 5px; }
.diag-table tr.neg td { color: #b91c1c; }
.age-note { border-left: 3px solid #1d6bff; background: #f2f7ff; padding: 8px 10px; border-radius: 0 8px 8px 0; color: #475569; font-size: 12px; }
.insight-row { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.insight { border-radius: 8px; padding: 10px; font-size: 12px; display: grid; gap: 4px; align-content: start; }
.insight b { display: block; margin-bottom: 2px; }
.insight button { border: 0; background: none; padding: 2px 0; text-align: left; color: #475569; font-size: 12px; cursor: pointer; }
.insight button:hover { color: #1d6bff; }
.insight p { margin: 2px 0; color: #475569; }
.insight.risk { background: #fff7f7; border: 1px solid #fecaca; }
.insight.chance { background: #f0fdf4; border: 1px solid #bbf7d0; }
@media (max-width: 1280px) { .ck-grid-diag, .ck-grid-diag-bot { grid-template-columns: 1fr; } }
</style>
