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
        <header><div><i>01</i><b>营销投入强度</b></div><span>{{ trendCaption }}</span></header>
        <div ref="trendEl" class="chart trend" />
        <p class="note">投入强度 =（推广费 + 活动成本）/ 全店实付；用于观察费用压力，不作为广告归因 ROAS。</p>
      </section>

      <div class="grid two">
        <section class="panel">
          <header><div><i>02</i><b>活动投入产出象限</b></div><span>气泡越大，新客越多</span></header>
          <div v-if="board.activities.length" ref="activityEl" class="chart activity" />
          <div v-else class="empty-inline">当前筛选下无活动明细</div>
        </section>
        <section class="panel customer-panel">
          <header><div><i>03</i><b>新老客结构</b></div><span>本期覆盖 {{ board.summary.activeStores }}/{{ board.summary.coverageStores }} 家活动门店</span></header>
          <div ref="customerEl" class="chart customer-chart" />
          <p v-if="board.summary.activeStores === 1" class="coverage-note">
            当前日期的活动源表只有 {{ board.summary.sourceRows }} 条门店活动记录，因此这里只显示该门店；切换到按周、按月或 9 月 11 日可查看更多门店。
          </p>
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
  return `本期活动源表覆盖 ${s.activeStores}/${s.coverageStores} 家门店；活动成交 ${money(s.activityPaid)}，优先放大右上象限的高产出拉新活动。`
})
const trendCaption = computed(() => (board.value?.daily.length || 0) > 1
  ? '堆叠面积：推广费率 + 活动成本率 · 折线：总投入率'
  : '单日仪表：营销费用占全店实付比例')
function money(v: number | null | undefined) { return v == null ? '—' : `¥${formatMoney(v)}` }
function multiple(v: number | null | undefined) { return v == null ? '—' : `${v.toFixed(1)}×` }

const trendEl = ref<HTMLElement | null>(null)
const activityEl = ref<HTMLElement | null>(null)
const customerEl = ref<HTMLElement | null>(null)
const trendOpt = computed<any>(() => {
  const rows = board.value?.daily || []
  if (rows.length <= 1) {
    const row = rows[0] || { paid: 0, promotionSpend: 0, activityCost: 0 }
    const promoRate = row.paid ? row.promotionSpend / row.paid * 100 : 0
    const activityRate = row.paid ? row.activityCost / row.paid * 100 : 0
    const totalRate = promoRate + activityRate
    const gaugeMax = Math.max(100, Math.ceil(totalRate / 20) * 20)
    const gaugeColor = totalRate > 80 ? '#EF5B5B' : totalRate > 50 ? '#F59E0B' : '#14B8A6'
    return {
      tooltip: { formatter: `全店实付 ${money(row.paid)}<br/>推广费 ${money(row.promotionSpend)} · ${promoRate.toFixed(1)}%<br/>活动成本 ${money(row.activityCost)} · ${activityRate.toFixed(1)}%` },
      graphic: [
        { type: 'group', left: '17%', top: '74%', children: [
          { type: 'circle', shape: { cx: 0, cy: 0, r: 5 }, style: { fill: '#8B5CF6' } },
          { type: 'text', left: 12, top: -8, style: { text: `推广费率  ${promoRate.toFixed(1)}%\n${money(row.promotionSpend)}`, fill: '#475569', font: '600 13px sans-serif', lineHeight: 22 } },
        ] },
        { type: 'group', right: '17%', top: '74%', children: [
          { type: 'circle', shape: { cx: 0, cy: 0, r: 5 }, style: { fill: '#F59E0B' } },
          { type: 'text', left: 12, top: -8, style: { text: `活动成本率  ${activityRate.toFixed(1)}%\n${money(row.activityCost)}`, fill: '#475569', font: '600 13px sans-serif', lineHeight: 22 } },
        ] },
      ],
      series: [{
        type: 'gauge', startAngle: 210, endAngle: -30, min: 0, max: gaugeMax,
        center: ['50%', '51%'], radius: '88%', pointer: { show: false },
        progress: { show: true, roundCap: true, width: 24, itemStyle: { color: gaugeColor } },
        axisLine: { roundCap: true, lineStyle: { width: 24, color: [[1, '#EAF0F6']] } },
        axisTick: { show: false }, splitLine: { show: false }, axisLabel: { show: false },
        title: { show: true, offsetCenter: [0, '28%'], color: '#64748B', fontSize: 13 },
        detail: { valueAnimation: true, offsetCenter: [0, '-4%'], color: '#0F172A', fontSize: 36, fontWeight: 800, formatter: '{value}%' },
        data: [{ value: Number(totalRate.toFixed(1)), name: '总营销投入率' }],
      }],
    }
  }
  const ratios = rows.map((row) => ({
    day: row.day,
    promo: row.paid ? row.promotionSpend / row.paid * 100 : 0,
    activity: row.paid ? row.activityCost / row.paid * 100 : 0,
    total: row.paid ? (row.promotionSpend + row.activityCost) / row.paid * 100 : 0,
    paid: row.paid,
    promotionSpend: row.promotionSpend,
    activityCost: row.activityCost,
  }))
  return {
    grid: { left: 55, right: 26, top: 40, bottom: 34 }, legend: { top: 4, right: 8 },
    tooltip: { trigger: 'axis', formatter: (params: any[]) => { const i = params[0]?.dataIndex || 0; const row = ratios[i]; return `${row.day}<br/>全店实付 ${money(row.paid)}<br/>推广费 ${money(row.promotionSpend)} · ${row.promo.toFixed(1)}%<br/>活动成本 ${money(row.activityCost)} · ${row.activity.toFixed(1)}%<br/><b>总投入率 ${row.total.toFixed(1)}%</b>` } },
    xAxis: { type: 'category', data: ratios.map(x => x.day.slice(5)), axisTick: { show: false }, axisLine: { lineStyle: { color: '#dbe5ef' } } },
    yAxis: { type: 'value', name: '占实付比例', axisLabel: { formatter: '{value}%' }, splitLine: { lineStyle: { color: '#edf2f7' } } },
    series: [
      { name: '推广费率', type: 'line', stack: 'rate', smooth: true, symbol: 'none', data: ratios.map(x => x.promo), lineStyle: { width: 1.5, color: '#8B5CF6' }, areaStyle: { color: 'rgba(139,92,246,.42)' }, itemStyle: { color: '#8B5CF6' } },
      { name: '活动成本率', type: 'line', stack: 'rate', smooth: true, symbol: 'none', data: ratios.map(x => x.activity), lineStyle: { width: 1.5, color: '#F59E0B' }, areaStyle: { color: 'rgba(245,158,11,.36)' }, itemStyle: { color: '#F59E0B' } },
      { name: '总投入率', type: 'line', smooth: true, symbol: 'circle', symbolSize: 6, data: ratios.map(x => x.total), lineStyle: { width: 2.5, color: '#1D6BFF' }, itemStyle: { color: '#1D6BFF' } },
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
const customerOpt = computed<any>(() => ({
  color: ['#8B5CF6', '#CBD5E1'],
  tooltip: { trigger: 'item', formatter: '{b}<br/>{c} 人 · {d}%' },
  legend: { bottom: 2, left: 'center', itemWidth: 10, itemHeight: 10 },
  graphic: [{
    type: 'text', left: 'center', top: '37%',
    style: { text: `新客占比\n${newPct.value.toFixed(1)}%`, textAlign: 'center', font: '700 17px sans-serif', fill: '#0F172A', lineHeight: 24 },
  }],
  series: [{
    type: 'pie', radius: ['50%', '72%'], center: ['50%', '43%'],
    itemStyle: { borderColor: '#fff', borderWidth: 4 },
    label: { show: true, color: '#475569', fontSize: 12, formatter: '{b}\n{c}人  {d}%' },
    labelLine: { length: 10, length2: 8 },
    data: [{ name: '新客', value: totalNew.value }, { name: '老客', value: totalOld.value }],
  }],
}))
useChart(trendEl, trendOpt as any)
useChart(activityEl, activityOpt as any)
useChart(customerEl, customerOpt as any)
</script>

<style scoped lang="scss">
.page{display:flex;flex-direction:column;gap:14px;padding-bottom:26px;color:#0f172a}.empty,.empty-inline{padding:28px;text-align:center;background:#fff;border:1px dashed #dce5ef;border-radius:14px;color:#64748b}.page-lead{display:flex;justify-content:space-between;align-items:center;padding:14px 18px;border-radius:14px;background:#31275f;color:#fff}.page-lead div{display:flex;align-items:baseline;gap:12px}.page-lead b{font-size:18px}.page-lead span{font-size:12px;color:#c8c0ed}.page-lead p{margin:0;font-size:13px;color:#ebe8ff}.signal-strip{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));background:#fff;border:1px solid #e8eef6;border-radius:14px;padding:4px 0}.signal-strip div{padding:12px 16px;border-right:1px solid #edf2f7}.signal-strip div:last-child{border:0}.signal-strip span,.signal-strip em{display:block;font-size:11px;color:#94a3b8;font-style:normal}.signal-strip b{display:block;margin:5px 0 2px;font:800 20px var(--ops-font-num)}.panel{background:#fff;border:1px solid #e8eef6;border-radius:14px;padding:16px 18px;box-shadow:0 8px 24px rgba(15,23,42,.035)}header{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px}header div{display:flex;align-items:center;gap:9px}header i{font-style:normal;color:#8b5cf6;background:#f1edff;border-radius:7px;padding:5px 7px;font-size:11px;font-weight:800}header b{font-size:15px}header span{font-size:11px;color:#94a3b8}.chart{width:100%}.trend{height:300px}.activity{height:330px}.customer-chart{height:230px}.coverage-note{margin:-2px 0 10px;padding:8px 10px;border-radius:8px;background:#fff7ed;color:#b45309;font-size:11px;line-height:1.5}.note{margin:2px 0 0;color:#94a3b8;font-size:11px}.grid.two{display:grid;grid-template-columns:1.05fr .95fr;gap:14px}.activity-list{display:flex;flex-direction:column;gap:6px}.activity-list article{display:grid;grid-template-columns:24px minmax(130px,1fr) 90px 72px;align-items:center;gap:8px;padding:9px 10px;background:#f8fafc;border-radius:9px}.activity-list article>em{font-style:normal;color:#8b5cf6;font-weight:800}.activity-list article div{display:flex;flex-direction:column}.activity-list b{font-size:12px}.activity-list span,.activity-list i{font-size:10px;color:#94a3b8;font-style:normal}.activity-list strong{text-align:right;font:700 13px var(--ops-font-num)}@media(max-width:1100px){.page-lead{align-items:flex-start;flex-direction:column;gap:7px}.signal-strip{grid-template-columns:repeat(2,1fr)}.grid.two{grid-template-columns:1fr}}
</style>
