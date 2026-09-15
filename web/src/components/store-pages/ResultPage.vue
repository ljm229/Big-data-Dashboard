<!-- 中文名：经营结果页 -->
<template>
  <div class="biz">
    <p v-if="error" class="hint">{{ error }}</p>
    <p v-else-if="!report && loading" class="hint">加载中…</p>
    <p v-else-if="!report" class="hint">当前筛选下暂无经营数据</p>

    <template v-else>
      <p class="meta">
        分析方向：先看订单 / 实付 / 毛利谁不达标 → 再下钻流量、供给或负毛利 · {{ report.weekLabel }}
      </p>

      <section class="card">
        <div class="sec-head">
          <span class="no">1</span>
          经营概览
          <em v-if="report.prevLabel">{{ report.weekLabel }} vs {{ report.prevLabel }}</em>
          <em v-else>{{ report.weekLabel }}</em>
        </div>
        <div class="kpi-grid">
          <div v-for="k in report.kpis" :key="k.key" class="kpi" :class="kpiTone(k)">
            <div class="name">{{ k.name }}</div>
            <div class="val">{{ fmtKpiVal(k) }}</div>
            <div class="chg" :class="kpiDeltaClass(k)">{{ fmtKpiDelta(k) }}</div>
          </div>
        </div>
        <p v-if="headline" class="headline">{{ headline }}</p>
      </section>

      <div class="split">
        <section class="card">
          <div class="sec-head">
            <span class="no">2</span>
            渠道实付贡献
            <em>长度看规模 · 标注渠道份额</em>
          </div>
          <div ref="channelPieEl" class="chart chart--md" />
        </section>
        <section class="card">
          <div class="sec-head">
            <span class="no">3</span>
            每日订单趋势
            <em>实付订单 · 可看周内走势</em>
          </div>
          <div ref="dayTrendEl" class="chart chart--md" />
        </section>
      </div>

      <section class="decision-strip">
        <span class="no">4</span>
        <div><b>经营判断</b><p>{{ headline || '当前周期暂无完整对比，先看渠道贡献和门店分化。' }}</p></div>
        <div class="decision-tip"><b>下钻顺序</b><p>订单弱看流量漏斗；实付弱看客单与活动；毛利弱看商品和退款。</p></div>
      </section>

      <div class="split">
        <section class="card">
          <div class="sec-head"><span class="no">5</span>规模 Top10<em>实付金额</em></div>
          <div ref="storePaidEl" class="chart chart--md" />
        </section>
        <section class="card">
          <div class="sec-head"><span class="no">6</span>周增长榜<em>相对上周</em></div>
          <div ref="storeDeltaEl" class="chart chart--md" />
        </section>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import type { EChartsOption } from 'echarts'
import {
  fetchStoreBusinessReport,
  type BizKpi,
  type StoreBusinessReport,
} from '../../api/opsDashboard'
import { useChart } from '../../composables/useChart'

const props = defineProps<{
  dateKey: string
  city: string
  storeId: string
}>()

const loading = ref(false)
const error = ref('')
const report = ref<StoreBusinessReport | null>(null)
const headline = ref('')

const channelPieEl = ref<HTMLElement | null>(null)
const dayTrendEl = ref<HTMLElement | null>(null)
const storeDeltaEl = ref<HTMLElement | null>(null)
const storePaidEl = ref<HTMLElement | null>(null)

const channelPieOpt = ref<EChartsOption | null>(null)
const dayTrendOpt = ref<EChartsOption | null>(null)
const storeDeltaOpt = ref<EChartsOption | null>(null)
const storePaidOpt = ref<EChartsOption | null>(null)

const { ensure: ensurePie } = useChart(channelPieEl, channelPieOpt as any)
const { ensure: ensureTrend } = useChart(dayTrendEl, dayTrendOpt as any)
const { ensure: ensureDelta } = useChart(storeDeltaEl, storeDeltaOpt as any)
const { ensure: ensurePaid } = useChart(storePaidEl, storePaidOpt as any)

const TEXT = '#64748b'
const AXIS = '#94a3b8'
const PALETTE = [
  '#14b8a6',
  '#8b5cf6',
  '#f97316',
  '#eab308',
  '#3b82f6',
  '#ec4899',
  '#22c55e',
  '#06b6d4',
  '#a855f7',
  '#f43f5e',
]

function channelColor(name: string) {
  const n = name || ''
  if (/淘宝|闪购/.test(n)) return '#FF6A00'
  if (/美团/.test(n)) return '#FFC300'
  if (/京东|JD/i.test(n)) return '#E1251B'
  if (/POS|收银|线下/.test(n)) return '#3b82f6'
  return '#94a3b8'
}

function fmtMoney(v: number) {
  if (!Number.isFinite(v)) return '—'
  if (Math.abs(v) >= 10000) return `${(v / 10000).toFixed(1)}万`
  return String(Math.round(v))
}

function fmtKpiVal(k: BizKpi) {
  if (k.deltaKind === 'pp' || k.key.includes('rate') || k.key === 'neg_profit') {
    return `${(k.value * 100).toFixed(2)}%`
  }
  if (k.deltaKind === 'money' || k.key === 'aov') return `¥${k.value.toFixed(1)}`
  if (k.key === 'orders') return Math.round(k.value).toLocaleString()
  return `¥${fmtMoney(k.value)}`
}

function fmtKpiDelta(k: BizKpi) {
  if (k.delta == null) return '—'
  if (k.deltaKind === 'pct') {
    const sign = k.delta >= 0 ? '+' : ''
    return `${sign}${(k.delta * 100).toFixed(1)}%`
  }
  if (k.deltaKind === 'pp') {
    const sign = k.delta >= 0 ? '+' : ''
    return `${sign}${k.delta.toFixed(2)}%`
  }
  const sign = k.delta >= 0 ? '+' : ''
  return `${sign}${k.delta.toFixed(1)}`
}

function isWorse(k: BizKpi) {
  if (k.delta == null || k.delta === 0) return null
  return k.lowerBetter ? k.delta > 0 : k.delta < 0
}

function kpiDeltaClass(k: BizKpi) {
  const w = isWorse(k)
  if (w == null) return 'flat'
  return w ? 'worse' : 'better'
}

function kpiTone(k: BizKpi) {
  const w = isWorse(k)
  if (w === true) return 'fail'
  if (k.lowerBetter && k.value > (k.key === 'refund_rate' ? 0.1 : 0.15)) return 'fail'
  return 'pass'
}

function buildHeadline(r: StoreBusinessReport) {
  const paid = r.kpis.find((k) => k.key === 'paid')
  const orders = r.kpis.find((k) => k.key === 'orders')
  const lead = [...(r.channels || [])].sort((a, b) => b.paid - a.paid)[0]
  const trend = r.dayTrend || []
  let trendTxt = ''
  if (trend.length >= 2) {
    const first = trend[0]!.orders
    const last = trend[trend.length - 1]!.orders
    if (first > 0) {
      const rate = ((last - first) / first) * 100
      trendTxt = `周内订单${rate >= 0 ? '走高' : '走低'}${Math.abs(rate).toFixed(0)}%`
    }
  }
  const parts: string[] = []
  if (paid?.delta != null) parts.push(`实付${paid.delta >= 0 ? '+' : ''}${(paid.delta * 100).toFixed(1)}%`)
  if (orders?.delta != null)
    parts.push(`订单${orders.delta >= 0 ? '+' : ''}${(orders.delta * 100).toFixed(1)}%`)
  if (lead) parts.push(`${lead.channel}${(lead.share * 100).toFixed(0)}%`)
  if (trendTxt) parts.push(trendTxt)
  headline.value = parts.join(' · ')
}

function buildCharts(r: StoreBusinessReport) {
  buildHeadline(r)

  const channels = [...(r.channels || [])].sort((a, b) => b.paid - a.paid)
  const channelRows = [...channels].reverse()
  const maxChannel = Math.max(...channelRows.map((c) => c.paid), 1)
  channelPieOpt.value = {
    grid: { left: 86, right: 92, top: 18, bottom: 22 },
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    xAxis: { type: 'value', show: false, max: maxChannel * 1.25 },
    yAxis: { type: 'category', data: channelRows.map((c) => c.channel), axisLine: { show: false }, axisTick: { show: false } },
    series: [{
      type: 'bar', barWidth: 18,
      data: channelRows.map((c) => ({ value: c.paid, share: c.share, itemStyle: { color: channelColor(c.channel), borderRadius: [0, 9, 9, 0] } })),
      label: { show: true, position: 'right', color: TEXT, formatter: (p: any) => `¥${fmtMoney(p.value)} · ${(Number(p.data.share || 0) * 100).toFixed(0)}%` },
    }],
  }

  const days = r.dayTrend || []
  dayTrendOpt.value = {
    grid: { left: 48, right: 48, top: 36, bottom: 36 },
    legend: {
      top: 4,
      right: 8,
      textStyle: { color: TEXT, fontSize: 11 },
    },
    tooltip: { trigger: 'axis' },
    xAxis: {
      type: 'category',
      data: days.map((d) => d.label),
      axisLabel: { color: TEXT, fontSize: 11 },
      axisLine: { lineStyle: { color: '#e2e8f0' } },
      axisTick: { show: false },
    },
    yAxis: [
      {
        type: 'value',
        name: '订单',
        nameTextStyle: { color: AXIS, fontSize: 11 },
        axisLabel: { color: AXIS, fontSize: 11 },
        splitLine: { lineStyle: { color: '#f1f5f9' } },
      },
      {
        type: 'value',
        name: '实付',
        nameTextStyle: { color: AXIS, fontSize: 11 },
        axisLabel: {
          color: AXIS,
          fontSize: 11,
          formatter: (v: number) => fmtMoney(Number(v)),
        },
        splitLine: { show: false },
      },
    ],
    series: [
      {
        name: '实付订单',
        type: 'line',
        smooth: true,
        symbol: 'circle',
        symbolSize: 7,
        data: days.map((d) => Math.round(d.orders)),
        lineStyle: { width: 2.5, color: '#0d9488' },
        itemStyle: { color: '#0d9488' },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(13,148,136,0.22)' },
              { offset: 1, color: 'rgba(13,148,136,0.02)' },
            ],
          },
        },
      },
      {
        name: '实付金额',
        type: 'bar',
        yAxisIndex: 1,
        barMaxWidth: 22,
        data: days.map((d) => Math.round(d.paid)),
        itemStyle: { color: 'rgba(249,115,22,0.55)', borderRadius: [4, 4, 0, 0] },
      },
    ],
  }

  const paidTop = [...r.rows].sort((a, b) => b.paid - a.paid).slice(0, 10).reverse()
  const maxPaid = Math.max(...paidTop.map((x) => x.paid), 1)
  storePaidOpt.value = {
    grid: { left: 88, right: 72, top: 8, bottom: 16 },
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    xAxis: { type: 'value', show: false, max: maxPaid * 1.18 },
    yAxis: {
      type: 'category',
      data: paidTop.map((x) => x.name),
      axisLabel: { color: TEXT, fontSize: 11 },
      axisTick: { show: false },
      axisLine: { show: false },
    },
    series: [
      {
        type: 'bar',
        barWidth: 14,
        data: paidTop.map((x, i) => ({
          value: Math.round(x.paid),
          itemStyle: {
            color: PALETTE[(paidTop.length - 1 - i) % PALETTE.length],
            borderRadius: [0, 8, 8, 0],
          },
        })),
        label: {
          show: true,
          position: 'right',
          color: TEXT,
          fontSize: 11,
          formatter: (p: unknown) => fmtMoney((p as { value: number }).value),
        },
      },
    ],
  }

  const withDelta = [...r.rows].filter((x) => x.deltaPaid != null)
  const deltaRows = [...withDelta]
    .sort((a, b) => (b.deltaPaid || 0) - (a.deltaPaid || 0))
    .slice(0, 12)
    .reverse()

  storeDeltaOpt.value = {
    grid: { left: 88, right: 64, top: 8, bottom: 16 },
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    xAxis: {
      type: 'value',
      axisLabel: { color: AXIS, fontSize: 11, formatter: (v: number) => fmtMoney(Number(v)) },
      splitLine: { lineStyle: { color: '#f1f5f9' } },
    },
    yAxis: {
      type: 'category',
      data: deltaRows.map((x) => x.name),
      axisLabel: { color: TEXT, fontSize: 11 },
      axisTick: { show: false },
      axisLine: { show: false },
    },
    series: [
      {
        type: 'bar',
        barWidth: 12,
        data: deltaRows.map((x) => {
          const v = x.deltaPaid || 0
          return {
            value: Math.round(v),
            itemStyle: {
              color: v >= 0 ? '#14b8a6' : '#f43f5e',
              borderRadius: 6,
            },
          }
        }),
        label: {
          show: true,
          position: 'right',
          color: TEXT,
          fontSize: 11,
          formatter: (p: unknown) => {
            const d = p as { value: number }
            return `${d.value >= 0 ? '+' : ''}${fmtMoney(d.value)}`
          },
        },
      },
    ],
  }
}

async function reload() {
  if (!props.dateKey) {
    report.value = null
    error.value = ''
    return
  }
  loading.value = true
  error.value = ''
  try {
    const data = await fetchStoreBusinessReport(props.dateKey, props.city, props.storeId)
    report.value = data
    loading.value = false
    await nextTick()
    if (data) {
      buildCharts(data)
      await nextTick()
      ensurePie()
      ensureTrend()
      ensurePaid()
      ensureDelta()
    }
  } catch (e) {
    console.error(e)
    report.value = null
    error.value = '经营结果加载失败，请切换周期后重试'
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
.biz {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding-bottom: 28px;
}
.meta {
  margin: 0;
  font-size: 12px;
  color: #8b9aab;
  line-height: 1.5;
}
.hint {
  text-align: center;
  color: #94a3b8;
  padding: 32px;
}
.card {
  background: #fff;
  border-radius: 14px;
  padding: 16px 18px;
  border: 1px solid #eef1f5;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.04);
}
.sec-head {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px 10px;
  font-size: 15px;
  font-weight: 800;
  color: #0f172a;
  margin-bottom: 10px;
  .no {
    display: inline-flex;
    width: 22px;
    height: 22px;
    border-radius: 7px;
    background: #ecfeff;
    color: #0d9488;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    font-family: var(--ops-font-num, Rajdhani, monospace);
  }
  em {
    font-style: normal;
    font-size: 12px;
    font-weight: 600;
    color: #94a3b8;
  }
}
.kpi-grid {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 10px;
}
.kpi {
  border-radius: 12px;
  padding: 12px;
  background: linear-gradient(180deg, #f8fffe 0%, #f1f5f9 100%);
  border: 1px solid #e8eef5;
  &.fail {
    background: linear-gradient(180deg, #fff7f7 0%, #fff1f2 100%);
    border-color: #fecdd3;
  }
  .name {
    font-size: 12px;
    color: #94a3b8;
    font-weight: 600;
  }
  .val {
    margin-top: 6px;
    font-size: 20px;
    font-weight: 800;
    font-family: var(--ops-font-num, Rajdhani, monospace);
    color: #0f172a;
  }
  .chg {
    margin-top: 4px;
    font-size: 12px;
    font-weight: 700;
    font-family: var(--ops-font-num, Rajdhani, monospace);
  }
}
.headline {
  margin: 12px 0 0;
  padding: 10px 12px;
  border-radius: 10px;
  background: #f8fafc;
  color: #475569;
  font-size: 13px;
  line-height: 1.5;
}
.split {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}
.decision-strip {
  display: grid;
  grid-template-columns: 28px 1fr 1fr;
  align-items: center;
  gap: 12px 18px;
  padding: 15px 18px;
  border-radius: 14px;
  border: 1px solid #e8eef5;
  border-left: 4px solid #f59e0b;
  background: #fff;
  .no { color: #d97706; font: 800 12px var(--ops-font-num, monospace); }
  div { padding-right: 16px; }
  .decision-tip { border-left: 1px solid #e8eef5; padding-left: 18px; }
  b { font-size: 13px; }
  p { margin: 4px 0 0; color: #64748b; font-size: 12px; line-height: 1.5; }
}
.chart {
  width: 100%;
  &--md {
    height: 300px;
  }
}
.better {
  color: #0d9488;
}
.worse {
  color: #e11d48;
}
.flat {
  color: #94a3b8;
}
@media (max-width: 1280px) {
  .kpi-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
  .split {
    grid-template-columns: 1fr;
  }
  .decision-strip { grid-template-columns: 28px 1fr; }
  .decision-strip .decision-tip { grid-column: 2; border-left: 0; padding-left: 0; }
}
</style>
