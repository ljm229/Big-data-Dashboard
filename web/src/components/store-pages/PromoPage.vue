<!-- 中文名：推广与活动页 -->
<template>
  <div class="page">
    <p v-if="!board" class="empty">当前周期暂无推广或活动数据，请切换到 2026-08-13～2026-09-11 内的日期。</p>
    <template v-else>
      <div class="page-lead">
        <div><b>推广与活动效率</b><span>{{ board.label }}</span></div>
        <p>{{ lead }}</p>
      </div>

      <section class="signal-strip">
        <div><span>推广费</span><b>{{ money(board.summary.promotionSpend) }}</b><em>全店趋势口径</em></div>
        <div><span>全店实付 / 推广费</span><b>{{ multiple(board.summary.paidPerSpend) }}</b><em>观察投入强度</em></div>
        <div><span>活动成交</span><b>{{ money(board.summary.activityPaid) }}</b><em>{{ formatInt(board.summary.activityOrders) }} 单</em></div>
        <div><span>活动商补</span><b>{{ money(board.summary.activitySubsidy) }}</b><em>商家承担金额</em></div>
        <div><span>活动新客</span><b>{{ formatInt(board.summary.newUsers) }}</b><em>{{ newShare }}</em></div>
      </section>

      <section class="panel">
        <header><div><i>01</i><b>投入与成交趋势</b></div><span>柱：推广费 / 活动成本 · 线：全店实付</span></header>
        <div ref="trendEl" class="chart trend" />
        <p class="note">全店实付与推广费来自同日经营趋势，用于判断投入强度，不作为广告归因 ROAS。</p>
      </section>

      <div class="grid two">
        <section class="panel">
          <header><div><i>02</i><b>活动投入产出象限</b></div><span>气泡越大，新客越多</span></header>
          <div v-if="board.activities.length" ref="activityEl" class="chart activity" />
          <div v-else class="empty-inline">当前筛选下无活动明细</div>
        </section>
        <section class="panel customer-panel">
          <header><div><i>03</i><b>活动拉新结构</b></div><span>按活动成交规模排序</span></header>
          <div class="customer-total">
            <div class="new" :style="{ width: newPct + '%' }"><span>新客 {{ formatInt(totalNew) }}</span></div>
            <div class="old" :style="{ width: 100 - newPct + '%' }"><span>老客 {{ formatInt(totalOld) }}</span></div>
          </div>
          <div class="activity-list">
            <article v-for="(item, i) in board.activities.slice(0, 6)" :key="item.id + item.shortStore">
              <em>{{ i + 1 }}</em><div><b>{{ item.shortStore || item.name }}</b><span>{{ item.name }}</span></div>
              <strong>{{ money(item.paid) }}</strong><i>新客 {{ formatInt(item.newUsers) }}</i>
            </article>
          </div>
        </section>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { fetchPromoBoard } from '../../api/opsPack'
import { useChart } from '../../composables/useChart'
import { formatInt, formatMoney } from '../../utils/format'

const props = defineProps<{ dateKey: string; storeId: string; storeHint?: string }>()
const board = computed(() => fetchPromoBoard(props.dateKey, props.storeId, props.storeHint))
const totalNew = computed(() => board.value?.activities.reduce((a, x) => a + x.newUsers, 0) || 0)
const totalOld = computed(() => board.value?.activities.reduce((a, x) => a + x.oldUsers, 0) || 0)
const newPct = computed(() => totalNew.value + totalOld.value ? totalNew.value / (totalNew.value + totalOld.value) * 100 : 0)
const newShare = computed(() => totalNew.value + totalOld.value ? `新客占 ${newPct.value.toFixed(1)}%` : '暂无客群分层')
const lead = computed(() => {
  const s = board.value?.summary
  if (!s) return ''
  return `活动成交 ${money(s.activityPaid)}，商补 ${money(s.activitySubsidy)}；优先放大右上象限的高产出拉新活动。`
})
function money(v: number | null | undefined) { return v == null ? '—' : `¥${formatMoney(v)}` }
function multiple(v: number | null | undefined) { return v == null ? '—' : `${v.toFixed(1)}×` }

const trendEl = ref<HTMLElement | null>(null)
const activityEl = ref<HTMLElement | null>(null)
const trendOpt = computed<any>(() => {
  const rows = board.value?.daily || []
  return {
    grid: { left: 55, right: 65, top: 36, bottom: 34 }, legend: { top: 4, right: 8 }, tooltip: { trigger: 'axis' },
    xAxis: { type: 'category', data: rows.map(x => x.day.slice(5)), axisTick: { show: false }, axisLine: { lineStyle: { color: '#dbe5ef' } } },
    yAxis: [{ type: 'value', name: '费用', splitLine: { lineStyle: { color: '#edf2f7' } }, axisLabel: { formatter: (v: number) => v >= 10000 ? `${(v/10000).toFixed(0)}万` : v } }, { type: 'value', name: '实付', splitLine: { show: false }, axisLabel: { formatter: (v: number) => v >= 10000 ? `${(v/10000).toFixed(0)}万` : v } }],
    series: [
      { name: '推广费', type: 'bar', stack: 'cost', barMaxWidth: 22, data: rows.map(x => x.promotionSpend), itemStyle: { color: '#8B5CF6' } },
      { name: '活动成本', type: 'bar', stack: 'cost', data: rows.map(x => x.activityCost), itemStyle: { color: '#F59E0B', borderRadius: [5,5,0,0] } },
      { name: '全店实付', type: 'line', yAxisIndex: 1, smooth: true, symbolSize: 5, data: rows.map(x => x.paid), lineStyle: { width: 2.5, color: '#1D6BFF' }, itemStyle: { color: '#1D6BFF' } },
    ]
  }
})
const activityOpt = computed<any>(() => {
  const rows = board.value?.activities || []
  return {
    grid: { left: 58, right: 26, top: 26, bottom: 48 }, tooltip: { formatter: (p: any) => `${p.data.name}<br/>商补 ${money(p.value[0])}<br/>活动成交 ${money(p.value[1])}<br/>新客 ${formatInt(p.value[2])}` },
    xAxis: { name: '商家补贴', axisLabel: { formatter: (v: number) => v >= 10000 ? `${v/10000}万` : v }, splitLine: { lineStyle: { color: '#edf2f7' } } },
    yAxis: { name: '活动成交', axisLabel: { formatter: (v: number) => v >= 10000 ? `${v/10000}万` : v }, splitLine: { lineStyle: { color: '#edf2f7' } } },
    series: [{ type: 'scatter', data: rows.map(x => ({ name: `${x.shortStore} · ${x.name}`, value: [x.merchantSubsidy, x.paid, x.newUsers], itemStyle: { color: x.paid >= x.merchantSubsidy * 5 ? '#14B8A6' : '#F59E0B' } })), symbolSize: (v: number[]) => Math.max(10, Math.min(34, Math.sqrt(v[2] || 0) * 2)) }]
  }
})
useChart(trendEl, trendOpt as any)
useChart(activityEl, activityOpt as any)
</script>

<style scoped lang="scss">
.page{display:flex;flex-direction:column;gap:14px;padding-bottom:26px;color:#0f172a}.empty,.empty-inline{padding:28px;text-align:center;background:#fff;border:1px dashed #dce5ef;border-radius:14px;color:#64748b}.page-lead{display:flex;justify-content:space-between;align-items:center;padding:14px 18px;border-radius:14px;background:#31275f;color:#fff}.page-lead div{display:flex;align-items:baseline;gap:12px}.page-lead b{font-size:18px}.page-lead span{font-size:12px;color:#c8c0ed}.page-lead p{margin:0;font-size:13px;color:#ebe8ff}.signal-strip{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));background:#fff;border:1px solid #e8eef6;border-radius:14px;padding:4px 0}.signal-strip div{padding:12px 16px;border-right:1px solid #edf2f7}.signal-strip div:last-child{border:0}.signal-strip span,.signal-strip em{display:block;font-size:11px;color:#94a3b8;font-style:normal}.signal-strip b{display:block;margin:5px 0 2px;font:800 20px var(--ops-font-num)}.panel{background:#fff;border:1px solid #e8eef6;border-radius:14px;padding:16px 18px;box-shadow:0 8px 24px rgba(15,23,42,.035)}header{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px}header div{display:flex;align-items:center;gap:9px}header i{font-style:normal;color:#8b5cf6;background:#f1edff;border-radius:7px;padding:5px 7px;font-size:11px;font-weight:800}header b{font-size:15px}header span{font-size:11px;color:#94a3b8}.chart{width:100%}.trend{height:300px}.activity{height:330px}.note{margin:2px 0 0;color:#94a3b8;font-size:11px}.grid.two{display:grid;grid-template-columns:1.05fr .95fr;gap:14px}.customer-total{height:38px;display:flex;overflow:hidden;border-radius:9px;margin:18px 0}.customer-total div{display:flex;align-items:center;justify-content:center;min-width:44px;color:#fff;font-size:12px;font-weight:700}.customer-total .new{background:#8b5cf6}.customer-total .old{background:#cbd5e1;color:#475569}.activity-list{display:flex;flex-direction:column;gap:6px}.activity-list article{display:grid;grid-template-columns:24px minmax(130px,1fr) 90px 72px;align-items:center;gap:8px;padding:9px 10px;background:#f8fafc;border-radius:9px}.activity-list article>em{font-style:normal;color:#8b5cf6;font-weight:800}.activity-list article div{display:flex;flex-direction:column}.activity-list b{font-size:12px}.activity-list span,.activity-list i{font-size:10px;color:#94a3b8;font-style:normal}.activity-list strong{text-align:right;font:700 13px var(--ops-font-num)}@media(max-width:1100px){.page-lead{align-items:flex-start;flex-direction:column;gap:7px}.signal-strip{grid-template-columns:repeat(2,1fr)}.grid.two{grid-template-columns:1fr}}
</style>
