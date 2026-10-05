<!-- 中文名：渠道门店深度分析 -->
<template>
  <div class="channel-page">
    <section class="ck-kpi-row ck-kpi-row--6">
      <ClassicKpi name="总销售额" :value="formatMoney(total.sales)" hint="按门店 × 渠道聚合" />
      <ClassicKpi name="总订单" :value="formatInt(total.orders)" />
      <ClassicKpi name="总毛利" :value="formatMoney(total.profit)" :val-tone="total.profit < 0 ? 'is-red' : 'is-green'" />
      <ClassicKpi name="综合毛利率" :value="formatPercent(total.profitRate)" />
      <ClassicKpi name="亏损渠道" :value="String(lossCells)" val-tone="is-red" hint="门店 × 渠道" />
      <ClassicKpi name="主力渠道" :value="leader?.name || '—'" :hints="leader ? [{ label: '销售占比', value: formatPercent(leader.share), tone: 'is-green' }] : []" />
    </section>

    <section class="channel-grid channel-grid--top">
      <article class="ck-card channel-card">
        <header class="ck-card__head"><h3>渠道整体表现</h3><p>规模与盈利质量</p></header>
        <div class="channel-list">
          <button v-for="row in channelRows" :key="row.name" type="button" class="channel-row" :class="{ active: selectedChannel === row.name }" @click="selectedChannel = selectedChannel === row.name ? '全部' : row.name">
            <span class="channel-badge" :class="channelTone(row.name)">{{ channelBadge(row.name) }}</span>
            <span class="channel-row__main"><b>{{ row.name }}</b><i><em :style="{ width: `${row.share * 100}%` }" /></i></span>
            <span class="channel-row__value"><strong>{{ formatMoney(row.profit) }}</strong><small>{{ formatPercent(row.profitRate) }} · {{ formatInt(row.orders) }}单</small></span>
          </button>
        </div>
      </article>
      <article class="ck-card channel-card">
        <header class="ck-card__head"><h3>渠道效率对比</h3><p>单店销售 / 单店毛利</p></header>
        <div class="efficiency-list">
          <div v-for="row in channelRows" :key="row.name" class="efficiency-row">
            <b>{{ row.name }}</b><span>{{ formatMoney(row.sales / Math.max(row.storeCount, 1)) }}</span><span>{{ formatMoney(row.profit / Math.max(row.storeCount, 1)) }}</span><strong :class="{ bad: row.profitRate < 0.08 }">{{ formatPercent(row.profitRate) }}</strong>
          </div>
          <div class="efficiency-head"><span>渠道</span><span>单店销售</span><span>单店毛利</span><span>毛利率</span></div>
        </div>
      </article>
    </section>

    <section class="ck-card matrix-card">
      <header class="ck-card__head"><h3>门店 × 渠道经营矩阵</h3><div class="matrix-tools"><button v-for="item in sortOptions" :key="item.value" type="button" :class="{ active: sortMode === item.value }" @click="sortMode = item.value">{{ item.label }}</button></div></header>
      <div class="table-scroll matrix-scroll">
        <table class="ck-table matrix-table">
          <thead><tr><th class="l">门店</th><th class="r">总毛利</th><th v-for="name in channels" :key="name" class="r">{{ name }}</th><th class="l">渠道结论</th></tr></thead>
          <tbody><tr v-for="row in matrixRows" :key="row.store" :class="{ picked: selectedStore === row.store }" @click="selectedStore = row.store">
            <td class="l"><b>{{ shortStore(row.store) }}</b><small>{{ row.city }}</small></td><td class="r num" :class="{ negative: row.totalProfit < 0 }">{{ formatMoney(row.totalProfit) }}</td>
            <td v-for="name in channels" :key="name" class="r matrix-cell" :class="cellClass(row.cells[name])" :title="cellTitle(row.cells[name])"><template v-if="row.cells[name]"><b>{{ formatMoney(row.cells[name].profit) }}</b><small>{{ formatPercent(row.cells[name].profitRate) }}</small></template><span v-else>—</span></td>
            <td class="l conclusion">{{ row.conclusion }}</td>
          </tr><tr v-if="!matrixRows.length"><td colspan="99" class="void">当前筛选下暂无渠道门店数据</td></tr></tbody>
        </table>
      </div>
    </section>

    <section class="channel-grid channel-grid--bottom">
      <article class="ck-card opportunity-card"><header class="ck-card__head"><h3>渠道增长机会</h3><p>优先关注高毛利渠道</p></header><div v-for="item in opportunities" :key="item.store" class="insight-row"><b>{{ shortStore(item.store) }}</b><span>{{ item.channel }} · 毛利率 {{ formatPercent(item.rate) }}</span><small>建议扩大高毛利渠道的商品与流量承接。</small></div><p v-if="!opportunities.length" class="void">暂无明显渠道机会</p></article>
      <article class="ck-card opportunity-card"><header class="ck-card__head"><h3>渠道风险与处理建议</h3><p>优先处理亏损组合</p></header><div v-for="item in risks" :key="item.store + item.channel" class="insight-row is-risk"><b>{{ shortStore(item.store) }} · {{ item.channel }}</b><span>毛利 {{ formatMoney(item.profit) }} · 毛利率 {{ formatPercent(item.rate) }}</span><small>建议核查配送费、活动补贴、退款与低毛利商品。</small></div><p v-if="!risks.length" class="void">暂无渠道风险</p></article>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import ClassicKpi from './ClassicKpi.vue'
import { useFilterStore } from '../../stores/filter'
import { source1ByStore, source1ByChannel, previousPeriodRange, source1StoreCity, aggregateSource1Kpi } from '../../api/source1'
import { formatInt, formatMoney, formatPercent } from '../../utils/format'

const filter = useFilterStore()
const { periodRange, cityQuery, storeQuery, channel } = storeToRefs(filter)
const selectedChannel = ref('全部')
const selectedStore = ref('')
const sortMode = ref<'profit' | 'sales' | 'risk'>('profit')
const query = computed(() => ({ from: periodRange.value.from, to: periodRange.value.to, city: cityQuery.value, store: storeQuery.value, channel: selectedChannel.value === '全部' ? channel.value : selectedChannel.value }))
type Cell = { sales: number; orders: number; profit: number; profitRate: number | null }
type MatrixRow = { store: string; city: string; totalProfit: number; cells: Record<string, Cell | undefined>; conclusion: string }
const channels = computed(() => [...new Set(source1ByChannel({ ...query.value, channel: '全部' }).map((x) => x.key))])
const channelRows = computed(() => {
  const rows = source1ByChannel({ ...query.value, channel: '全部' })
  const totalSales = rows.reduce((s, r) => s + (r.onlineRevenue ?? r.paid ?? r.turnover ?? 0), 0)
  return rows.map((r) => ({ name: r.key, sales: r.onlineRevenue ?? r.paid ?? r.turnover ?? 0, orders: r.orders ?? 0, profit: r.profit ?? 0, profitRate: r.profitRate ?? 0, storeCount: matrixRows.value.filter((x) => x.cells[r.key]).length, share: totalSales ? (r.onlineRevenue ?? r.paid ?? r.turnover ?? 0) / totalSales : 0 })).sort((a, b) => b.sales - a.sales)
})
const matrixRows = computed<MatrixRow[]>(() => {
  const rows = source1ByStore({ ...query.value, channel: '全部' })
  return rows.map((r) => ({ store: r.key, city: '', totalProfit: r.profit ?? 0, cells: {}, conclusion: '渠道结构待观察' })).map((row) => {
    const cells: Record<string, Cell | undefined> = {}
    const detail = source1ByChannel({ ...query.value, store: row.store, channel: '全部' })
    detail.forEach((r) => { cells[r.key] = { sales: r.onlineRevenue ?? r.paid ?? r.turnover ?? 0, orders: r.orders ?? 0, profit: r.profit ?? 0, profitRate: r.profitRate } })
    const available = Object.entries(cells).filter(([, v]) => v)
    const best = [...available].sort((a, b) => (b[1]?.profitRate ?? -1) - (a[1]?.profitRate ?? -1))[0]
    const bad = available.find(([, v]) => (v?.profit ?? 0) < 0)
    return { ...row, cells, conclusion: bad ? `${bad[0]}拖累利润` : best ? `最佳渠道：${best[0]}` : '渠道结构待观察' }
  }).filter((r) => selectedChannel.value === '全部' || r.cells[selectedChannel.value]).sort((a, b) => sortMode.value === 'risk' ? a.totalProfit - b.totalProfit : sortMode.value === 'sales' ? b.totalProfit - a.totalProfit : a.totalProfit - b.totalProfit).slice(0, 12)
})
const total = computed(() => channelRows.value.reduce((a, r) => ({ sales: a.sales + r.sales, orders: a.orders + r.orders, profit: a.profit + r.profit, profitRate: 0 }), { sales: 0, orders: 0, profit: 0, profitRate: 0 }))
const totalProfitBase = computed(() => total.value.sales ? total.value.profit / total.value.sales : null)
const lossCells = computed(() => matrixRows.value.reduce((n, r) => n + Object.values(r.cells).filter((x) => x && x.profit < 0).length, 0))
const leader = computed(() => channelRows.value[0] ? { ...channelRows.value[0], share: channelRows.value[0].share } : null)
const risks = computed(() => matrixRows.value.flatMap((r) => Object.entries(r.cells).filter(([, v]) => v && v.profit < 0).map(([channelName, v]) => ({ store: r.store, channel: channelName, profit: v!.profit, rate: v!.profitRate }))).slice(0, 4))
const opportunities = computed(() => matrixRows.value.flatMap((r) => Object.entries(r.cells).filter(([, v]) => v && v.profitRate != null && v.profitRate >= 0.2).map(([channelName, v]) => ({ store: r.store, channel: channelName, rate: v!.profitRate! }))).slice(0, 4))
const sortOptions = [{ value: 'profit', label: '按总毛利' }, { value: 'sales', label: '按规模' }, { value: 'risk', label: '风险优先' }] as const
function shortStore(name: string) { return name.replace(/^淘宝便利店[（(]/, '').replace(/[）)]$/, '') }
function channelBadge(name: string) { return name.includes('美团') ? '美' : name.includes('京东') ? '京' : name.includes('淘宝') ? '淘' : name.slice(0, 1) }
function channelTone(name: string) { return name.includes('美团') ? 'meituan' : name.includes('京东') ? 'jd' : name.includes('淘宝') ? 'taobao' : 'pos' }
function cellClass(cell?: Cell) { return !cell ? 'empty' : cell.profit < 0 ? 'negative' : (cell.profitRate ?? 0) >= 0.2 ? 'strong' : 'normal' }
function cellTitle(cell?: Cell) { return cell ? `销售 ${formatMoney(cell.sales)}，订单 ${formatInt(cell.orders)}，毛利 ${formatMoney(cell.profit)}` : '无数据，不按0计' }
</script>

<style scoped lang="scss">
.channel-page { display: flex; flex-direction: column; gap: 12px; min-height: 100%; }
.channel-grid { display: grid; gap: 12px; grid-template-columns: 1fr 1fr; }.channel-grid--top { min-height: 220px; }.channel-grid--bottom { min-height: 190px; }
.channel-card, .matrix-card, .opportunity-card { min-height: 0; }.channel-list, .efficiency-list { padding: 8px 12px; display: grid; gap: 7px; }.channel-row { display: grid; grid-template-columns: 24px minmax(0, 1fr) auto; gap: 8px; align-items: center; background: transparent; border: 0; padding: 5px; text-align: left; cursor: pointer; color: var(--ck-text); }.channel-row:hover, .channel-row.active { background: #f1f7ff; }.channel-badge { display: grid; place-items: center; width: 22px; height: 22px; border-radius: 5px; font-size: 11px; font-weight: 800; }.channel-badge.meituan { background: #fff2aa; color: #8c6b00; }.channel-badge.taobao { background: #ffe1ce; color: #df5b00; }.channel-badge.jd { background: #ffe0e8; color: #d21f4c; }.channel-badge.pos { background: #d9f3ff; color: #08749c; }.channel-row__main { display: grid; gap: 5px; }.channel-row__main b { font-size: 13px; }.channel-row__main i { display: block; height: 5px; border-radius: 4px; background: #e8eff6; overflow: hidden; }.channel-row__main i em { display: block; height: 100%; background: #2588e8; border-radius: 4px; }.channel-row__value { display: grid; gap: 2px; text-align: right; }.channel-row__value strong { font-size: 13px; }.channel-row__value small { color: #718096; font-size: 11px; }.efficiency-row { display: grid; grid-template-columns: 1fr repeat(3, auto); gap: 12px; align-items: center; font-size: 12px; }.efficiency-row strong { color: #16a673; }.efficiency-row strong.bad { color: #e24a4a; }.efficiency-head { order: 2; display: grid; grid-template-columns: 1fr repeat(3, auto); gap: 12px; color: #8292a5; border-top: 1px solid #edf1f5; padding-top: 6px; font-size: 11px; }.matrix-card { flex: 1; min-height: 320px; }.matrix-tools { display: flex; gap: 4px; }.matrix-tools button { border: 1px solid #dce5ee; background: #fff; color: #6d7c8d; border-radius: 4px; padding: 4px 8px; font-size: 11px; }.matrix-tools button.active { color: #1675d1; border-color: #76b7ec; background: #edf7ff; }.matrix-scroll { max-height: 380px; overflow: auto; }.matrix-table { table-layout: fixed; }.matrix-table th:first-child { width: 150px; }.matrix-table th:nth-child(2) { width: 90px; }.matrix-table th:last-child { width: 130px; }.matrix-table td { padding: 7px 6px; }.matrix-table td:first-child b { display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }.matrix-table td:first-child small { display: block; color: #9aa7b5; font-size: 10px; }.matrix-cell { border-left: 2px solid #fff; text-align: right; }.matrix-cell b, .matrix-cell small { display: block; }.matrix-cell b { font-size: 12px; }.matrix-cell small { font-size: 10px; color: #607489; }.matrix-cell.negative { background: #fff0f0; color: #d93838; }.matrix-cell.strong { background: #e9f9f2; color: #09815a; }.matrix-cell.normal { background: #f2f7fc; }.matrix-cell.empty { color: #b6c2ce; background: #fafbfd; }.negative { color: #d93838; }.conclusion { color: #607489; font-size: 11px; }.matrix-table tr.picked td { outline: 2px solid #4a9be8; outline-offset: -2px; }.insight-row { margin: 8px 12px; padding: 8px 10px; border-left: 3px solid #22ad7a; background: #f3fbf7; display: grid; gap: 3px; }.insight-row.is-risk { border-color: #e45a5a; background: #fff5f5; }.insight-row b { font-size: 12px; }.insight-row span, .insight-row small { color: #65788c; font-size: 11px; }.void { padding: 25px; text-align: center; color: #9aa7b5; font-size: 12px; }
@media (max-width: 1100px) { .channel-grid { grid-template-columns: 1fr; }.matrix-scroll { max-height: 320px; } }
</style>
