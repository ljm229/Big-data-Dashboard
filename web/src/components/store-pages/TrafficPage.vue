<!-- 中文名：流量与转化页 -->
<template>
  <div class="page">
    <p v-if="!board" class="empty">当前周期暂无流量数据，请切换到 2026-08-13～2026-09-11 内的日期。</p>
    <template v-else>
      <div class="page-lead">
        <div><b>流量诊断</b><span>{{ board.label }} · {{ board.stores.length }} 家门店</span></div>
        <p>{{ leadText }}</p>
      </div>

      <section class="panel funnel-panel">
        <header><div><i>01</i><b>流量漏斗</b></div><span>人数口径 · 转化率用汇总人数重算</span></header>
        <div class="funnel-wrap">
          <div class="funnel-visual">
            <div class="funnel-stage exposure">
              <span>流量基数</span><b>曝光 {{ formatInt(board.funnel.expose) }}</b><em>{{ deltaText(board.funnel.expose, board.prevFunnel?.expose) }}</em>
            </div>
            <div class="loss"><span>曝光后未进店 {{ formatInt(exposureLoss) }}</span><i>↓ 进入门店</i></div>
            <div class="funnel-stage enter">
              <span>进店转化 P1</span><b>{{ formatPercent(board.funnel.enterRate) }}</b><em>进店 {{ formatInt(board.funnel.enter) }} · {{ deltaText(board.funnel.enterRate, board.prevFunnel?.enterRate) }}</em>
            </div>
            <div class="loss"><span>进店后未下单 {{ formatInt(enterLoss) }}</span><i>↓ 形成订单</i></div>
            <div class="funnel-stage order">
              <span>下单转化 P2</span><b>{{ formatPercent(board.funnel.orderRate) }}</b><em>下单 {{ formatInt(board.funnel.orderUsers) }} · 整体 {{ formatPercent(board.funnel.overallRate) }}</em>
            </div>
          </div>
          <aside class="funnel-read">
            <strong>{{ breakPoint.title }}</strong>
            <p>{{ breakPoint.detail }}</p>
            <div class="health-row"><span>P1 健康线 ≥ 8%</span><b :class="tone(board.funnel.enterRate, .08)">{{ formatPercent(board.funnel.enterRate) }}</b></div>
            <div class="health-row"><span>P2 健康线 ≥ 22%</span><b :class="tone(board.funnel.orderRate, .22)">{{ formatPercent(board.funnel.orderRate) }}</b></div>
          </aside>
        </div>
      </section>

      <div class="grid two">
        <section class="panel">
          <header><div><i>02</i><b>来源规模与效率</b></div><span>曝光量排序 · 颜色代表整体转化</span></header>
          <div v-if="board.sources.length" ref="sourceEl" class="chart source-chart" />
          <div v-else class="empty-inline">单店口径暂无来源拆分</div>
        </section>
        <section class="panel">
          <header><div><i>03</i><b>门店 P1 × P2 象限</b></div><span>气泡越大，下单人数越多</span></header>
          <div ref="storeEl" class="chart store-chart" />
        </section>
      </div>

      <section class="action-panel">
        <div class="action-title"><i>04</i><div><b>今天先处理</b><span>按漏斗断点自动排序</span></div></div>
        <div v-if="board.anomalies.length" class="actions">
          <article v-for="(item, i) in board.anomalies.slice(0, 4)" :key="item.store + i">
            <em>{{ String(i + 1).padStart(2, '0') }}</em>
            <div><b>{{ item.store }}</b><span>{{ item.city }} · {{ item.type }} · {{ item.value }}</span></div>
            <p>{{ item.tip }}</p>
          </article>
        </div>
        <p v-else class="good">当前筛选下没有明显尾部门店，继续观察来源效率与环比变化。</p>
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { fetchTrafficBoard } from '../../api/opsPack'
import { useChart } from '../../composables/useChart'
import { formatInt, formatPercent } from '../../utils/format'

const props = defineProps<{ dateKey: string; city: string; storeId: string; storeHint?: string }>()
const board = computed(() => fetchTrafficBoard(props.dateKey, props.city, props.storeId, props.storeHint))
const exposureLoss = computed(() => Math.max(0, (board.value?.funnel.expose || 0) - (board.value?.funnel.enter || 0)))
const enterLoss = computed(() => Math.max(0, (board.value?.funnel.enter || 0) - (board.value?.funnel.orderUsers || 0)))
const breakPoint = computed(() => {
  const f = board.value?.funnel
  if (!f) return { title: '', detail: '' }
  if ((f.enterRate || 0) < .08) return { title: '主断点：曝光 → 进店', detail: '先检查搜索图、门店头图、起送价和入口权益，再决定是否继续加流量。' }
  if ((f.orderRate || 0) < .22) return { title: '主断点：进店 → 下单', detail: '流量已进入门店，优先检查核心商品库存、价格带与活动承接。' }
  return { title: '漏斗处于健康带', detail: '优先优化低效来源，并复制高转化门店的商品与活动组合。' }
})
const leadText = computed(() => `${breakPoint.value.title}；${board.value?.tips[0] || '关注门店效率尾部。'}`)

function deltaText(cur: number | null | undefined, prev: number | null | undefined) {
  if (cur == null || prev == null || !prev) return '上期无完整对照'
  const d = (cur - prev) / Math.abs(prev)
  return `较上期 ${d >= 0 ? '+' : ''}${(d * 100).toFixed(1)}%`
}
function tone(v: number | null | undefined, line: number) { return (v || 0) >= line ? 'ok' : 'bad' }

const sourceEl = ref<HTMLElement | null>(null)
const storeEl = ref<HTMLElement | null>(null)
const sourceOpt = computed<any>(() => {
  const rows = [...(board.value?.sources || [])].slice(0, 8).reverse()
  return {
    grid: { left: 110, right: 58, top: 18, bottom: 28 }, tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    xAxis: { type: 'value', axisLabel: { formatter: (v: number) => v >= 10000 ? `${(v / 10000).toFixed(0)}万` : v }, splitLine: { lineStyle: { color: '#edf2f7' } } },
    yAxis: { type: 'category', data: rows.map(x => x.name), axisLine: { show: false }, axisTick: { show: false }, axisLabel: { width: 96, overflow: 'truncate' } },
    series: [{ type: 'bar', barWidth: 15, data: rows.map(x => ({ value: x.expose, itemStyle: { color: (x.overallRate || 0) >= .02 ? '#1D6BFF' : '#F59E0B', borderRadius: [0, 8, 8, 0] } })), label: { show: true, position: 'right', color: '#64748B', formatter: (p: any) => formatInt(Number(p.value)) } }],
  }
})
const storeOpt = computed<any>(() => {
  const rows = board.value?.stores || []
  return {
    grid: { left: 50, right: 24, top: 28, bottom: 46 }, tooltip: { formatter: (p: any) => { const d = p.data; return `${d.name}<br/>P1 ${d.value[0].toFixed(1)}%<br/>P2 ${d.value[1].toFixed(1)}%<br/>下单 ${formatInt(d.value[2])}` } },
    xAxis: { name: 'P1 进店率', min: 0, max: (v: any) => Math.max(12, Math.ceil(v.max * 1.15)), axisLabel: { formatter: '{value}%' }, splitLine: { lineStyle: { color: '#edf2f7' } } },
    yAxis: { name: 'P2 下单率', min: 0, max: (v: any) => Math.max(30, Math.ceil(v.max * 1.12)), axisLabel: { formatter: '{value}%' }, splitLine: { lineStyle: { color: '#edf2f7' } } },
    series: [{ type: 'scatter', data: rows.map(x => { const p1 = (x.enterRate || 0) * 100; const p2 = (x.orderRate || 0) * 100; return { name: x.shortName, value: [p1, p2, x.orderUsers], itemStyle: { color: p1 < 8 || p2 < 22 ? '#EF5B5B' : '#14B8A6' } } }), symbolSize: (v: number[]) => Math.max(10, Math.min(32, Math.sqrt(v[2] || 0) * 1.5)), markLine: { silent: true, symbol: 'none', label: { color: '#94A3B8', fontSize: 10 }, lineStyle: { type: 'dashed', color: '#CBD5E1' }, data: [{ xAxis: 8, name: 'P1健康线' }, { yAxis: 22, name: 'P2健康线' }] } }],
  }
})
useChart(sourceEl, sourceOpt as any)
useChart(storeEl, storeOpt as any)
</script>

<style scoped lang="scss">
.page{display:flex;flex-direction:column;gap:14px;padding-bottom:26px;color:#0f172a}.empty,.empty-inline{padding:28px;text-align:center;background:#fff;border:1px dashed #dce5ef;border-radius:14px;color:#64748b}.page-lead{display:flex;align-items:center;justify-content:space-between;gap:18px;padding:14px 18px;border-radius:14px;background:#0f2748;color:#fff}.page-lead div{display:flex;align-items:baseline;gap:12px}.page-lead b{font-size:18px}.page-lead span{font-size:12px;color:#a9bdd8}.page-lead p{margin:0;max-width:62%;font-size:13px;color:#d9e7f7}.panel,.action-panel{background:#fff;border:1px solid #e8eef6;border-radius:14px;padding:16px 18px;box-shadow:0 8px 24px rgba(15,23,42,.035)}header{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px}header div{display:flex;align-items:center;gap:9px}header i,.action-title>i{font-style:normal;color:#1d6bff;background:#eaf2ff;border-radius:7px;padding:5px 7px;font-size:11px;font-weight:800}header b{font-size:15px}header span{font-size:11px;color:#94a3b8}.funnel-wrap{display:grid;grid-template-columns:minmax(500px,1.4fr) minmax(240px,.6fr);gap:32px;align-items:center}.funnel-visual{display:flex;flex-direction:column;align-items:center}.funnel-stage{height:62px;color:#fff;display:grid;grid-template-columns:1fr auto 1fr;align-items:center;padding:0 9%;box-sizing:border-box;clip-path:polygon(5% 0,95% 0,88% 100%,12% 100%)}.funnel-stage span{font-size:13px;font-weight:700}.funnel-stage b{font:800 24px var(--ops-font-num)}.funnel-stage em{text-align:right;font-size:11px;font-style:normal;opacity:.82}.exposure{width:100%;background:#1d6bff}.enter{width:76%;background:#0ea5e9}.order{width:53%;background:#14b8a6}.loss{height:28px;display:flex;align-items:center;gap:18px;color:#94a3b8;font-size:11px}.loss i{font-style:normal;font-weight:800;color:#475569}.funnel-read{padding:18px;border-radius:12px;background:#f7faff;border-left:4px solid #1d6bff}.funnel-read strong{font-size:17px}.funnel-read p{margin:7px 0 15px;color:#64748b;font-size:13px;line-height:1.65}.health-row{display:flex;justify-content:space-between;padding:9px 0;border-top:1px solid #e5edf6;font-size:12px}.health-row b{font:800 16px var(--ops-font-num)}.ok{color:#0f9f8f}.bad{color:#e34d59}.grid.two{display:grid;grid-template-columns:1fr 1fr;gap:14px}.chart{width:100%}.source-chart,.store-chart{height:310px}.action-panel{display:grid;grid-template-columns:165px 1fr;gap:18px;border-left:4px solid #f59e0b}.action-title{display:flex;gap:10px;align-items:flex-start}.action-title div{display:flex;flex-direction:column;gap:4px}.action-title b{font-size:15px}.action-title span{font-size:11px;color:#94a3b8}.actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.actions article{display:grid;grid-template-columns:28px 150px 1fr;gap:8px;align-items:center;padding:9px 10px;border-radius:10px;background:#f8fafc}.actions em{font-style:normal;font:800 15px var(--ops-font-num);color:#f59e0b}.actions div{display:flex;flex-direction:column}.actions b{font-size:12px}.actions span,.actions p{font-size:11px;color:#64748b}.actions p{margin:0}.good{margin:8px 0;color:#0f9f8f;font-size:13px}@media(max-width:1100px){.funnel-wrap,.grid.two{grid-template-columns:1fr}.page-lead{align-items:flex-start;flex-direction:column}.page-lead p{max-width:none}.actions{grid-template-columns:1fr}.action-panel{grid-template-columns:1fr}}
.funnel-stage b{font-size:29px}
</style>
