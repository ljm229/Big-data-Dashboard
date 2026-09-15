<!-- 中文名：利润成本——对齐管理层版-v2 / 02；接 source1 + cost + 订单毛利负毛利明细 -->
<template>
  <div class="ck-page">
    <section class="ck-kpi-row ck-kpi-row--5">
      <ClassicKpi
        name="预计毛利"
        :value="fmtMoneyKpi(kpi.profit).value"
        :unit="fmtMoneyKpi(kpi.profit).unit"
        :hints="[
          { label: '日比', value: ratioText(delta.profit), tone: toneOf(delta.profit) },
          { label: '周比', value: ratioText(weekDelta.profit), tone: toneOf(weekDelta.profit) },
        ]"
      />
      <ClassicKpi
        name="毛利率"
        :value="fmtPct(kpi.profitRate)"
        :hints="[
          { label: '日比', value: ptsText(delta.profitRate), tone: toneOf(delta.profitRate) },
          { label: '周比', value: ptsText(weekDelta.profitRate), tone: toneOf(weekDelta.profitRate) },
        ]"
      />
      <ClassicKpi
        name="单均毛利"
        :value="kpi.unitProfit != null ? kpi.unitProfit.toFixed(1) : '—'"
        unit="元"
        :hints="[
          { label: '日比', value: ratioText(delta.unitProfit), tone: toneOf(delta.unitProfit) },
          { label: '周比', value: ratioText(weekDelta.unitProfit), tone: toneOf(weekDelta.unitProfit) },
        ]"
      />
      <ClassicKpi
        name="负毛利订单占比"
        :value="fmtPct(margin.negRate)"
        :hints="negHints"
      />
      <ClassicKpi
        name="成本覆盖率"
        :value="fmtPct(costCoverage)"
        hint="费用项覆盖预估 · 非账本"
      />
    </section>

    <section class="mid-row">
      <article class="ck-card">
        <header class="ck-card__head">
          <h3>收入到毛利瀑布（本期累计）</h3>
          <p>单位：{{ waterUnit }}</p>
        </header>
        <div v-show="waterfall.length" ref="waterEl" class="ck-plot ck-plot--chart plot-compact" />
        <div v-if="!waterfall.length" class="ck-empty compact"><b>暂无瀑布数据</b><span>当前筛选下无成本/收入明细</span></div>
      </article>
      <article class="ck-card struct-card">
        <header class="ck-card__head">
          <h3>负毛利订单结构</h3>
          <div class="head-right">
            <p>单位：{{ leakUnit }}</p>
            <div class="ck-pills">
              <button type="button" :class="{ active: structDim === 'reason' }" @click="structDim = 'reason'">按原因</button>
              <button type="button" :class="{ active: structDim === 'channel' }" @click="structDim = 'channel'">按渠道</button>
            </div>
          </div>
        </header>
        <template v-if="structSlices.length">
          <div class="struct-wrap">
            <div class="struct-chart">
              <div ref="donutEl" class="ck-plot ck-plot--chart plot-donut" />
              <div class="struct-center" aria-hidden="true">
                <strong>{{ fmtMoneyInUnit(structTotal, leakUnit) }}</strong>
                <span>负毛利合计</span>
              </div>
            </div>
            <ul class="struct-list">
              <li v-for="(s, i) in structSlices" :key="s.key">
                <i class="swatch" :style="{ background: sliceColor(s.key, i) }" aria-hidden="true" />
                <span>{{ s.key }}</span>
                <b>{{ fmtPct(s.share) }}</b>
              </li>
            </ul>
          </div>
        </template>
        <div v-else class="ck-empty">
          <b>暂无负毛利订单拆解</b>
          <span>当前筛选下无订单毛利明细</span>
        </div>
      </article>
    </section>

    <section class="bottom-row">
      <article class="ck-card store-board">
        <header class="ck-card__head">
          <h3>风险异常表</h3>
        </header>
        <input
          v-model.trim="riskQuery"
          class="store-search"
          type="search"
          placeholder="搜索店名"
          aria-label="风险表搜索店名"
        />
        <div class="table-scroll">
          <table v-if="riskRows.length" class="ck-table store-board-table">
            <thead>
              <tr>
                <th class="sortable" :class="sortClass('risk', 'store')" @click="toggleSort('risk', 'store')">门店</th>
                <th class="num sortable" :class="sortClass('risk', 'negRate')" @click="toggleSort('risk', 'negRate')">负毛利占比 (周比)</th>
                <th class="num sortable" :class="sortClass('risk', 'gt3Rate')" @click="toggleSort('risk', 'gt3Rate')">＞3 元占比 (周比)</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in riskRows" :key="row.store" :class="{ 'is-hot': (row.negRate || 0) > 0.3 }">
                <td class="name" :title="row.store">{{ row.shortName || row.store }}</td>
                <td class="num">
                  <span>{{ fmtPct(row.negRate) }}</span>
                  <span class="wow" :class="toneOf(row.negRateWow, true)">{{ wowParen(row.negRateWow) }}</span>
                </td>
                <td class="num" :class="{ 'is-alert': (row.gt3Rate || 0) > 0.1 }">
                  <span>{{ fmtPct(row.gt3Rate) }}</span>
                  <span class="wow" :class="toneOf(row.gt3RateWow, true)">{{ wowParen(row.gt3RateWow) }}</span>
                </td>
              </tr>
            </tbody>
          </table>
          <div v-else class="ck-empty"><b>暂无负毛利问题门店</b><span>当前筛选下无负毛利订单占比 &gt; 0 的门店</span></div>
        </div>
      </article>
      <article class="ck-card">
        <header class="ck-card__head">
          <h3>利润漏损 TOP5</h3>
          <p>单位：{{ leakUnit }}</p>
        </header>
        <table v-if="profitLeakage.length" class="ck-table">
          <thead>
            <tr><th>排名</th><th>漏损项</th><th class="num">金额</th><th>占比</th><th>周比</th></tr>
          </thead>
          <tbody>
            <tr v-for="(row, i) in profitLeakage" :key="row.name">
              <td><span class="ck-rank" :class="i < 3 ? `is-${i + 1}` : ''">{{ i + 1 }}</span></td>
              <td>{{ row.name }}</td>
              <td class="num">{{ fmtMoneyInUnit(row.amount, leakUnit) }}</td>
              <td>{{ fmtPct(row.share) }}</td>
              <td class="num" :class="toneOf(row.amountWow, true)">{{ ratioText(row.amountWow) }}</td>
            </tr>
          </tbody>
        </table>
        <div v-else class="ck-empty"><b>暂无漏损排行</b><span>需订单毛利负毛利明细</span></div>
      </article>
      <article class="ck-card store-board">
        <header class="ck-card__head">
          <h3>效能排行表</h3>
        </header>
        <input
          v-model.trim="effQuery"
          class="store-search"
          type="search"
          placeholder="搜索店名"
          aria-label="效能表搜索店名"
        />
        <div class="table-scroll">
          <table v-if="effRows.length" class="ck-table store-board-table">
            <thead>
              <tr>
                <th class="sortable" :class="sortClass('eff', 'store')" @click="toggleSort('eff', 'store')">门店</th>
                <th class="num sortable" :class="sortClass('eff', 'dailyOrders')" @click="toggleSort('eff', 'dailyOrders')">日均订单 (周比)</th>
                <th class="num sortable" :class="sortClass('eff', 'dailyProfit')" @click="toggleSort('eff', 'dailyProfit')">反后日均毛利 (周比)</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in effRows" :key="row.store">
                <td class="name" :title="row.store">
                  <i v-if="topProfitSet.has(row.store)" class="dot-good" aria-hidden="true" />
                  {{ row.shortName || row.store }}
                </td>
                <td class="num" :class="{ 'is-alert': (row.dailyOrdersWow || 0) < -0.1 }">
                  <span>{{ row.dailyOrders.toFixed(1) }}</span>
                  <span class="wow" :class="toneOf(row.dailyOrdersWow)">{{ wowParen(row.dailyOrdersWow) }}</span>
                </td>
                <td class="num">
                  <span>{{ row.dailyProfit.toFixed(1) }}</span>
                  <span class="wow" :class="toneOf(row.dailyProfitWow)">{{ wowParen(row.dailyProfitWow) }}</span>
                </td>
              </tr>
            </tbody>
          </table>
          <div v-else class="ck-empty"><b>暂无赚钱门店</b><span>当前筛选下无反后日均毛利为正的门店</span></div>
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
  aggregateSource1Kpi,
  deltaOf,
  previousDayRange,
  previousWeekRange,
} from '../../api/source1'
import { costSummary } from '../../api/costSummary'
import { COST_FIELDS, EXPENSE_KEYS } from '../../utils/costAnalysis'
import { orderMarginSummary, orderMarginWeekBoard } from '../../api/orderMarginSummary'
import { wowDelta } from '../../utils/orderMarginAnalysis'
import { useChart } from '../../composables/useChart'
import { fmtPct, fmtMoneyKpi, fmtMoneyInUnit, moneyUnitOf, toneOf } from '../../utils/classicHints'

const filter = useFilterStore()
const { periodRange, channel, cityQuery, storeQuery } = storeToRefs(filter)
const structDim = ref<'reason' | 'channel'>('reason')
const riskQuery = ref('')
const effQuery = ref('')
type SortKey = 'store' | 'negRate' | 'gt3Rate' | 'dailyOrders' | 'dailyProfit'
const riskSort = ref<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: 'negRate', dir: 'desc' })
const effSort = ref<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: 'dailyProfit', dir: 'desc' })
const waterEl = ref<HTMLElement | null>(null)
const donutEl = ref<HTMLElement | null>(null)
const waterOpt = ref<any>(null)
const donutOpt = ref<any>(null)
useChart(waterEl, waterOpt)
useChart(donutEl, donutOpt)

const q = computed(() => ({
  from: periodRange.value.from,
  to: periodRange.value.to,
  channel: channel.value,
  store: storeQuery.value,
  city: cityQuery.value,
}))
const prevQ = computed(() => ({ ...q.value, ...previousDayRange(q.value.from, q.value.to) }))
const weekQ = computed(() => ({ ...q.value, ...previousWeekRange(q.value.from, q.value.to) }))
const kpi = computed(() => aggregateSource1Kpi(q.value))
const delta = computed(() => deltaOf(kpi.value, aggregateSource1Kpi(prevQ.value)))
const weekDelta = computed(() => deltaOf(kpi.value, aggregateSource1Kpi(weekQ.value)))

const cost = computed(() =>
  costSummary({
    from: q.value.from,
    to: q.value.to,
    city: cityQuery.value,
    store: storeQuery.value,
    channel: channel.value,
  }),
)
const costCoverage = computed(() => {
  if (!cost.value.rows.length) return null
  const known = EXPENSE_KEYS.filter((k) => cost.value.amounts[k]?.complete).length
  return known / EXPENSE_KEYS.length
})

const margin = computed(() => orderMarginSummary(q.value))
const marginWeek = computed(() => orderMarginSummary(weekQ.value))
const negRateWow = computed(() => wowDelta(margin.value.negRate, marginWeek.value.negRate, 'pts'))
const impactAbs = computed(() => (margin.value.loss != null ? Math.abs(margin.value.loss) : null))
const impactUnit = computed(() => moneyUnitOf([impactAbs.value]))
const negHints = computed(() => {
  const items: { label: string; value: string; tone?: '' | 'is-red' | 'is-green' }[] = []
  if (impactAbs.value != null) {
    items.push({
      label: '影响',
      value: `${fmtMoneyInUnit(impactAbs.value, impactUnit.value)} ${impactUnit.value}`,
    })
  }
  items.push({
    label: '周比',
    value: ptsText(negRateWow.value),
    tone: toneOf(negRateWow.value, true),
  })
  return items
})

const storeRows = computed(() => orderMarginWeekBoard(q.value, weekQ.value))

function matchStore(row: { store: string; shortName?: string }, q: string) {
  if (!q) return true
  const needle = q.toLowerCase()
  return row.store.toLowerCase().includes(needle) || (row.shortName || '').toLowerCase().includes(needle)
}

function sortRows<T extends Record<string, any>>(rows: T[], key: SortKey, dir: 'asc' | 'desc') {
  const sign = dir === 'asc' ? 1 : -1
  return [...rows].sort((a, b) => {
    if (key === 'store') {
      return sign * String(a.shortName || a.store).localeCompare(String(b.shortName || b.store), 'zh-CN')
    }
    const av = a[key]
    const bv = b[key]
    const an = av == null || Number.isNaN(av) ? -Infinity : Number(av)
    const bn = bv == null || Number.isNaN(bv) ? -Infinity : Number(bv)
    if (an === bn) return String(a.store).localeCompare(String(b.store), 'zh-CN')
    return sign * (an - bn)
  })
}

function toggleSort(board: 'risk' | 'eff', key: SortKey) {
  const cur = board === 'risk' ? riskSort : effSort
  if (cur.value.key === key) cur.value = { key, dir: cur.value.dir === 'desc' ? 'asc' : 'desc' }
  else cur.value = { key, dir: key === 'store' ? 'asc' : 'desc' }
}

function sortClass(board: 'risk' | 'eff', key: SortKey) {
  const cur = board === 'risk' ? riskSort.value : effSort.value
  if (cur.key !== key) return ''
  return cur.dir === 'asc' ? 'is-asc' : 'is-desc'
}

const riskRows = computed(() => {
  const base = storeRows.value.filter((r) => r.negRate != null && r.negRate > 0)
  const filtered = base.filter((r) => matchStore(r, riskQuery.value))
  return sortRows(filtered, riskSort.value.key, riskSort.value.dir)
})

const topProfitSet = computed(() => {
  const earn = storeRows.value
    .filter((r) => r.dailyProfit > 0)
    .sort((a, b) => b.dailyProfit - a.dailyProfit)
    .slice(0, 3)
  return new Set(earn.map((r) => r.store))
})

const effRows = computed(() => {
  const base = storeRows.value.filter((r) => r.dailyProfit > 0)
  const filtered = base.filter((r) => matchStore(r, effQuery.value))
  return sortRows(filtered, effSort.value.key, effSort.value.dir)
})

const waterfall = computed(() => {
  const income = cost.value.income
  const profit = kpi.value.profit
  if (income == null && profit == null) return []
  const steps: { name: string; value: number; kind: 'base' | 'down' | 'end' }[] = []
  if (income != null) steps.push({ name: '经营收入', value: income, kind: 'base' })
  for (const key of EXPENSE_KEYS) {
    const amt = cost.value.amounts[key]?.value
    if (amt == null || amt <= 0) continue
    steps.push({ name: COST_FIELDS[key], value: -amt, kind: 'down' })
  }
  if (profit != null) steps.push({ name: '预计毛利', value: profit, kind: 'end' })
  return steps.slice(0, 10)
})

const waterUnit = computed(() => moneyUnitOf(waterfall.value.map((s) => s.value)))
const structSlices = computed(() =>
  structDim.value === 'channel' ? margin.value.channels : margin.value.reasons,
)
const structTotal = computed(() =>
  structSlices.value.reduce((n, s) => n + Math.abs(s.amount || 0), 0),
)
const profitLeakage = computed(() => {
  const prevMap = new Map(marginWeek.value.leakage.map((r) => [r.name, r.amount]))
  return margin.value.leakage.slice(0, 5).map((r) => ({
    ...r,
    amountWow: wowDelta(r.amount, prevMap.get(r.name) ?? null, 'ratio'),
  }))
})
const leakUnit = computed(() =>
  moneyUnitOf([
    ...profitLeakage.value.map((r) => r.amount),
    ...structSlices.value.map((s) => Math.abs(s.amount)),
    structTotal.value,
  ]),
)

/** 对齐流量来源结构配色：蓝 / 天蓝 / 绿 / 黄 / 紫 / 薄荷绿 */
const REASON_COLORS: Record<string, string> = {
  商品毛利为负: '#2563eb',
  营销折扣过高: '#36cfc9',
  配送成本过高: '#14b8a6',
  平台费用占比高: '#f5b83d',
  其他: '#7c6cf0',
}
const CHANNEL_COLORS = ['#2563eb', '#36cfc9', '#14b8a6', '#f5b83d', '#7c6cf0', '#95de64']
function sliceColor(key: string, index: number) {
  return REASON_COLORS[key] || CHANNEL_COLORS[index % CHANNEL_COLORS.length]!
}

watch(
  [waterfall, waterUnit],
  ([steps, unit]) => {
    if (!steps.length) {
      waterOpt.value = null
      return
    }
    let acc = 0
    const data = steps.map((s) => {
      if (s.kind === 'base' || s.kind === 'end') {
        acc = s.value
        return {
          name: s.name,
          value: s.value,
          itemStyle: {
            color: s.kind === 'end' ? '#00b86b' : '#1769ff',
            shadowColor: s.kind === 'end' ? 'rgba(0,184,107,.28)' : 'rgba(23,105,255,.25)',
            shadowBlur: 8,
          },
        }
      }
      acc += s.value
      return { name: s.name, value: s.value, itemStyle: { color: '#ff7a00', shadowColor: 'rgba(255,122,0,.25)', shadowBlur: 7 } }
    })
    waterOpt.value = {
      grid: { left: 52, right: 12, top: 28, bottom: 56 },
      tooltip: { formatter: (p: any) => `${p.name}<br/>${fmtMoneyInUnit(p.value, unit)} ${unit}` },
      xAxis: {
        type: 'category',
        data: data.map((d) => d.name),
        axisLabel: { interval: 0, rotate: 22, fontSize: 10, color: '#5e626a', fontWeight: 600 },
        axisLine: { lineStyle: { color: '#cfd1d4' } },
      },
      yAxis: {
        type: 'value',
        scale: true,
        axisLabel: { formatter: (v: number) => fmtMoneyInUnit(v, unit, 0), color: '#72767d', fontSize: 10 },
        splitLine: { lineStyle: { color: '#e5e5e2' } },
      },
      series: [
        {
          type: 'bar',
          barMaxWidth: 36,
          data: data.map((d) => ({ value: d.value, itemStyle: d.itemStyle })),
          itemStyle: { borderRadius: [4, 4, 0, 0] },
          label: {
            show: true,
            position: 'top',
            formatter: (p: any) => fmtMoneyInUnit(p.value, unit),
            fontSize: 10,
            color: '#303236',
            fontWeight: 600,
          },
        },
      ],
    }
  },
  { immediate: true },
)

watch(
  [structSlices, leakUnit, structTotal],
  ([slices]) => {
    if (!slices.length) {
      donutOpt.value = null
      return
    }
    donutOpt.value = {
      color: CHANNEL_COLORS,
      tooltip: {
        trigger: 'item',
        formatter: (p: any) => {
          const amt = Math.abs(Number(p.data?.amount ?? 0))
          return `${p.name}<br/>${fmtPct(p.percent / 100)} · ${fmtMoneyInUnit(amt, leakUnit.value)} ${leakUnit.value}`
        },
      },
      series: [
        {
          type: 'pie',
          radius: ['46%', '70%'],
          center: ['50%', '50%'],
          avoidLabelOverlap: true,
          itemStyle: { borderColor: '#fff', borderWidth: 2 },
          label: {
            show: true,
            formatter: (p: any) => `${Number(p.percent).toFixed(1)}%`,
            color: '#4b5563',
            fontSize: 12,
            fontWeight: 600,
          },
          labelLine: {
            show: true,
            length: 14,
            length2: 10,
            lineStyle: { color: '#c5daf8', width: 1 },
          },
          data: slices.map((s, i) => ({
            name: s.key,
            value: Math.abs(s.amount || 0),
            amount: s.amount,
            itemStyle: { color: sliceColor(s.key, i) },
          })),
        },
      ],
    }
  },
  { immediate: true },
)

function ratioText(d: number | null | undefined) {
  if (d == null) return '—'
  return `${d >= 0 ? '+' : ''}${(d * 100).toFixed(1)}%`
}
function ptsText(d: number | null | undefined) {
  if (d == null) return '—'
  return `${d >= 0 ? '+' : ''}${(d * 100).toFixed(1)}%`
}
function wowParen(d: number | null | undefined) {
  if (d == null || Number.isNaN(d)) return '(—)'
  if (d === 0) return '(0%)'
  const arrow = d > 0 ? '↑' : '↓'
  return `(${arrow}${Math.abs(d * 100).toFixed(1)}%)`
}
</script>

<style scoped lang="scss">
.mid-row,
.bottom-row {
  display: grid;
  gap: 12px;
  align-items: stretch;
  flex: 0 0 auto !important;
  width: 100%;
  :deep(.ck-card) {
    min-height: 0;
    min-width: 0;
  }
}
/* 中排：瀑布 | 负毛利结构（结构略放大） */
.mid-row {
  grid-template-columns: minmax(0, 1.25fr) minmax(0, 1.15fr);
}
/* 底排：风险表更宽，漏损/效能收窄 */
.bottom-row {
  grid-template-columns: minmax(0, 1.35fr) minmax(0, 0.9fr) minmax(0, 0.95fr);
}
.plot-compact {
  min-height: 168px !important;
  height: 168px;
}
.struct-wrap {
  display: grid;
  grid-template-columns: minmax(0, 1.35fr) minmax(120px, 0.85fr);
  gap: 8px 12px;
  align-items: center;
  flex: 1;
  min-height: 220px;
}
.struct-chart {
  position: relative;
  min-width: 0;
  min-height: 220px;
}
.plot-donut {
  min-height: 220px !important;
  height: 220px;
}
.struct-center {
  pointer-events: none;
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  strong {
    font-family: var(--ck-font-num);
    font-size: 22px;
    font-weight: var(--ck-fw-kpi);
    font-variant-numeric: tabular-nums;
    color: var(--ck-text);
    line-height: 1.1;
  }
  span {
    margin-top: 4px;
    font-size: var(--ck-fs-kpi-unit);
    color: var(--ck-muted);
    font-weight: var(--ck-fw-medium);
  }
}
:deep(.ck-empty.compact) {
  min-height: 88px;
  padding: 10px;
}
.table-scroll {
  max-height: 210px;
  overflow: auto;
}
.bottom-row {
  .table-scroll { max-height: 230px; }
  :deep(.ck-table) { font-size: 12px; }
}
@media (max-width: 1100px) {
  .mid-row { grid-template-columns: 1fr; }
  .bottom-row { grid-template-columns: 1fr 1fr; }
  .bottom-row > :first-child { grid-column: 1 / -1; }
}
@media (max-width: 720px) {
  .bottom-row { grid-template-columns: 1fr; }
  .bottom-row > :first-child { grid-column: auto; }
}
.head-right {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  justify-content: flex-end;
}
.struct-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 8px;
  align-content: center;
  li {
    display: grid;
    grid-template-columns: 8px 1fr auto;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    color: #475569;
    b {
      font-variant-numeric: tabular-nums;
      color: #111827;
      font-weight: 600;
    }
  }
  .swatch {
    width: 8px;
    height: 8px;
    border-radius: 50%;
  }
}
.store-search {
  display: block;
  width: 100%;
  box-sizing: border-box;
  margin: 0 0 6px;
  padding: 6px 10px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #f9fafb;
  font-size: 12px;
  color: #1f2937;
  outline: none;
  &:focus { border-color: #2563eb; background: #fff; }
}
.store-board-table {
  :deep(tbody tr:nth-child(even) td) { background: #f5f7fa; }
  :deep(tbody tr.is-hot td),
  :deep(tbody tr.is-hot:nth-child(even) td) { background: #fef0f0; }
  :deep(th.sortable) {
    cursor: pointer;
    user-select: none;
    white-space: nowrap;
    &.is-asc::after { content: ' ↑'; color: #2563eb; }
    &.is-desc::after { content: ' ↓'; color: #2563eb; }
  }
  .name {
    max-width: 8em;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .wow {
    margin-left: 4px;
    font-size: 11px;
    font-weight: 600;
  }
  .is-alert {
    color: #ef5b5b;
    font-weight: 700;
  }
  .dot-good {
    display: inline-block;
    width: 6px;
    height: 6px;
    margin-right: 6px;
    border-radius: 50%;
    background: #14b8a6;
    vertical-align: middle;
  }
}
:deep(.ck-rank.is-1) { background: #EF5B5B; }
:deep(.ck-rank.is-2) { background: #F59E0B; }
:deep(.ck-rank.is-3) { background: #EAB308; color: #422006; }
.is-red { color: #ef5b5b; }
.is-green { color: #14b8a6; }
</style>
