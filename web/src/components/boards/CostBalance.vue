<!-- 中文名：收支盈亏 —— 含后返毛利 / 收支盈亏双页签；同筛选；缺失不填 0 -->
<template>
  <Panel
    v-bind="$attrs"
    title="收支盈亏"
    class="margin-panel cost-panel"
    :empty="empty"
    :empty-text="emptyText"
    clickable
    @title-click="openDetail = true"
  >
    <template #extra>
      <button type="button" class="cost-detail-button" @click.stop="openDetail = true">
        详情<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M3 2h6v6M4.5 7.5L9 3" /></svg>
      </button>
    </template>

    <div class="cost-content">
      <div class="cost-tabs" role="tablist" aria-label="收支盈亏视图">
        <div>
          <button
            type="button"
            role="tab"
            :aria-selected="tab === 'margin'"
            :aria-pressed="tab === 'margin'"
            @click="setTab('margin')"
          >含后返毛利</button>
          <button
            type="button"
            role="tab"
            :aria-selected="tab === 'pl'"
            :aria-pressed="tab === 'pl'"
            @click="setTab('pl')"
          >收支盈亏</button>
        </div>
        <span>单位：元</span>
      </div>

      <!-- 默认：含后返毛利（非「毛利形成」） -->
      <template v-if="tab === 'margin'">
        <div class="margin__kpis">
          <div class="kpi">
            <em>预计毛利</em>
            <b>{{ yuan(sourceProfit) }}</b>
          </div>
          <div class="kpi rebate">
            <em>平台后返</em>
            <b>{{ yuan(rebate) }}</b>
          </div>
          <div class="kpi final">
            <em>含后返毛利</em>
            <b>{{ yuan(finalProfit) }}</b>
          </div>
          <div class="kpi rate">
            <em>毛利率（含后返）</em>
            <b>{{ pct(marginRate) }}</b>
          </div>
        </div>
        <p v-if="!summary.rebateActive" class="tab-hint">后返字段自 {{ rebateEffective }} 生效；当前区间未生效，后返相关不展示、不填 0。</p>
        <p v-if="marginFallbackFrom" class="tab-hint">
          所选日期暂无收支成本数据（最新至 {{ COST_DATA_RANGE[COST_DATA_RANGE.length - 1] }}），已展示最近可用日期 {{ marginFallbackFrom }}。
        </p>
      </template>

      <!-- 收支盈亏：总收入 − 总支出 = 净利润 -->
      <template v-else>
        <div class="margin__kpis pl-kpis">
          <div class="kpi">
            <em>总收入</em>
            <b>{{ yuan(totalIncome) }}</b>
          </div>
          <div class="kpi">
            <em>总支出</em>
            <b>{{ yuan(totalExpense) }}</b>
          </div>
          <div class="kpi" :class="{ neg: (netProfit ?? 0) < 0 }">
            <em>净利润</em>
            <b>{{ yuan(netProfit) }}</b>
          </div>
          <div class="kpi rate" :class="{ neg: (netRate ?? 0) < 0 }">
            <em>净利率</em>
            <b>{{ pct(netRate) }}</b>
          </div>
        </div>
        <p class="formula">总收入 − 总支出 = 净利润</p>
        <p v-if="pcFallbackFrom" class="tab-hint">
          所选日期暂无盈亏 PC 数据（最新至 {{ PROFIT_PC_RANGE.to }}），已展示最近可用日期 {{ pcFallbackFrom }}。
        </p>
      </template>

      <div ref="chartEl" class="wf-chart" role="img" :aria-label="tab === 'margin' ? '含后返毛利瀑布柱状图' : '收支盈亏瀑布柱状图'" />
      <p class="pl-conclusion">{{ tab === 'margin' ? marginConclusion : plConclusion }}</p>

      <footer class="margin__foot">
        <span>{{ shortRange }} · {{ pcStoreCount }} 家有数门店 · {{ filter.cityName }} · {{ filter.channel }}</span>
        <span :title="tab === 'pl' ? '盈亏分析PC · 与看板盈亏概览同源' : '翱象渠道门店周期收支；结余非财务净利润'">ⓘ {{ tab === 'pl' ? '盈亏PC' : '翱象' }}</span>
      </footer>
    </div>

    <Teleport to="body">
      <div v-if="openDetail" class="cost-popup-mask" @click.self="openDetail = false">
        <dialog class="cost-dialog" open @keydown.esc.prevent="openDetail = false">
          <header class="cost-dialog-head">
            <div>
              <small>同源筛选 · 不下钻改范围</small>
              <h2>{{ tab === 'pl' ? '收支盈亏明细' : '含后返毛利明细' }}</h2>
              <p>{{ filterHint }}</p>
            </div>
            <button type="button" aria-label="关闭" @click="openDetail = false">×</button>
          </header>
          <div class="cost-dialog-scroll">
            <p v-if="empty" class="cost-notice">{{ emptyText }}</p>
            <template v-else>
              <div class="cost-dialog-kpis">
                <div>
                  <span>{{ tab === 'pl' ? '总收入' : '预计毛利' }}</span>
                  <strong>{{ yuan(tab === 'pl' ? totalIncome : sourceProfit) }}</strong>
                </div>
                <div>
                  <span>{{ tab === 'pl' ? '总支出' : '平台后返' }}</span>
                  <strong>{{ yuan(tab === 'pl' ? totalExpense : rebate) }}</strong>
                </div>
                <div>
                  <span>{{ tab === 'pl' ? '净利润' : '含后返毛利' }}</span>
                  <strong :class="{ negative: tab === 'pl' ? (netProfit ?? 0) < 0 : (finalProfit ?? 0) < 0 }">
                    {{ yuan(tab === 'pl' ? netProfit : finalProfit) }}
                  </strong>
                </div>
              </div>

              <div class="cost-detail-columns">
                <section class="cost-detail-section">
                  <h3><i /><span>收入明细</span><small>{{ tab === 'pl' ? '与看板盈亏瀑布同口径合计' : '总收入 = 总营业额 − 营销；缺项不填 0' }}</small></h3>
                  <table>
                    <thead>
                      <tr><th>指标</th><th>指标值</th><th>占比</th><th>{{ deltaLabel }}</th></tr>
                    </thead>
                    <tbody>
                      <tr v-for="row in incomeRows" :key="row.id" :class="{ deduction: row.deduction }">
                        <th>
                          {{ row.label }}
                          <small v-if="row.note">{{ row.note }}</small>
                        </th>
                        <td>{{ yuan(row.value) }}</td>
                        <td>{{ pctShare(row.share) }}</td>
                        <td :class="growthClass(row.growth)">{{ growthText(row.growth) }}</td>
                      </tr>
                    </tbody>
                  </table>
                </section>
                <section class="cost-detail-section">
                  <h3><i /><span>支出明细</span><small>与卡片总支出同口径合计</small></h3>
                  <table>
                    <thead>
                      <tr><th>指标</th><th>指标值</th><th>占比</th><th>{{ deltaLabel }}</th></tr>
                    </thead>
                    <tbody>
                      <tr v-for="row in expenseRows" :key="row.id">
                        <th>
                          {{ row.label }}
                          <small v-if="row.note">{{ row.note }}</small>
                        </th>
                        <td>{{ yuan(row.value) }}</td>
                        <td>{{ pctShare(row.share) }}</td>
                        <td :class="growthClass(row.growth, true)">{{ growthText(row.growth) }}</td>
                      </tr>
                    </tbody>
                  </table>
                </section>
              </div>
              <p v-if="tab === 'pl'" class="cost-section-note">
                与看板 01 盈亏概览同源（盈亏分析 PC）：总收入 {{ yuan(pcAgg.incomeTotal) }} − 总支出 {{ yuan(pcAgg.expenseTotal) }}
                = 净利润 {{ yuan(pcAgg.profit) }}；净利率 = 净利润 / 总收入。
                收入/支出占比相对各自合计；营销在收入端以扣减项展示。
              </p>
              <p v-else class="cost-section-note">
                验算（未舍入）：收入 {{ rawText(summary.rawIncome) }} − 支出 {{ rawText(summary.rawExpense) }}
                = 结余 {{ rawText(summary.rawBalance) }}
                <template v-if="summary.identityOk"> · 恒等式通过</template>
                <template v-else> · 字段不完整，无法验算</template>
                。收入占比相对总营业额，支出占比相对总支出；源表未拆的合并列不再拆成空行。
              </p>
            </template>
          </div>
          <footer class="cost-dialog-foot">
            <span>{{ tab === 'pl' ? '源样本：盈亏分析 PC · 与看板盈亏概览同源' : '源样本：翱象渠道门店周期 · 后返生效' }} {{ tab === 'pl' ? '' : rebateEffective }}</span>
            <button type="button" @click="openDetail = false">关闭</button>
          </footer>
        </dialog>
      </div>
    </Teleport>
  </Panel>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import Panel from '../Panel.vue'
import { useFilterStore } from '../../stores/filter'
import { useChart } from '../../composables/useChart'
import { costSummary, latestCostDateOnOrBefore, COST_DATA_RANGE } from '../../api/costSummary'
import {
  EXPENSE_PC_LABELS,
  INCOME_PC_LABELS,
  PROFIT_PC_RANGE,
  latestProfitPcDateOnOrBefore,
  profitPcExpenseAgg,
  profitPcIncomeAgg,
  selectProfitPcFacts,
  summarizeProfitPc,
} from '../../api/profitPc'
import {
  REBATE_EFFECTIVE_DATE,
  costComparison,
  costMoney,
  detailAmount,
  detailShare,
  INCOME_DETAIL_ROWS,
  EXPENSE_DETAIL_ROWS,
  rebateComparable,
  type CostKey,
  type CostSummary,
} from '../../utils/costAnalysis'
import './cost-balance.scss'

defineOptions({ inheritAttrs: false })

const TAB_KEY = 'ck-cost-balance-tab'
type TabId = 'margin' | 'pl'

const filter = useFilterStore()
const openDetail = ref(false)
const tab = ref<TabId>(readTab())
const chartEl = ref<HTMLElement | null>(null)
const chartOpt = ref<any>(null)
useChart(chartEl, chartOpt)

function readTab(): TabId {
  try {
    const v = sessionStorage.getItem(TAB_KEY)
    return v === 'pl' || v === 'margin' ? v : 'margin'
  } catch {
    return 'margin'
  }
}
function setTab(next: TabId) {
  tab.value = next
  try {
    sessionStorage.setItem(TAB_KEY, next)
  } catch {
    /* ignore */
  }
}

const currentFilter = computed(() => ({
  ...filter.periodRange,
  city: filter.cityQuery,
  store: filter.storeQuery,
  channel: filter.channel,
}))
const previousFilter = computed(() => {
  const range = filter.compareRange
  if (!range?.from || !range?.to) return null
  return { ...currentFilter.value, from: range.from, to: range.to }
})

/** 所选日期无成本事实（含后返毛利）时，回退到最近一个有数据的日期，避免整块空白 */
const marginFallbackFrom = computed(() => {
  const { from, to } = currentFilter.value
  if (!from || !to) return ''
  if (costSummary(currentFilter.value).rows.length) return ''
  const latest = latestCostDateOnOrBefore(to)
  if (!latest || latest >= to) return ''
  const hit = costSummary({ ...currentFilter.value, from: latest, to: latest })
  return hit.rows.length ? latest : ''
})
const marginEffectiveFilter = computed(() =>
  marginFallbackFrom.value
    ? { ...currentFilter.value, from: marginFallbackFrom.value, to: marginFallbackFrom.value }
    : currentFilter.value,
)

const summary = computed(() => costSummary(marginEffectiveFilter.value))
const pcFilter = computed(() => ({
  from: currentFilter.value.from,
  to: currentFilter.value.to,
  city: currentFilter.value.city,
  store: currentFilter.value.store,
}))
const pcRows = computed(() => selectProfitPcFacts(pcFilter.value))
/** 所选日期无 PC 事实时，回退到该筛选下最近一个有数据的日期展示，避免整块空白 */
const pcFallbackFrom = computed(() => {
  if (!currentFilter.value.from || !currentFilter.value.to) return ''
  if (pcRows.value.length) return ''
  const latest = latestProfitPcDateOnOrBefore(currentFilter.value.to)
  if (!latest || latest >= currentFilter.value.to) return ''
  const rows = selectProfitPcFacts({
    ...pcFilter.value,
    from: latest,
    to: latest,
  })
  return rows.length ? latest : ''
})
const pcEffectiveRows = computed(() => {
  if (pcRows.value.length || !pcFallbackFrom.value) return pcRows.value
  return selectProfitPcFacts({ ...pcFilter.value, from: pcFallbackFrom.value, to: pcFallbackFrom.value })
})
const pcAgg = computed(() => summarizeProfitPc(pcEffectiveRows.value))
const pcIncomeAgg = computed(() => profitPcIncomeAgg(pcEffectiveRows.value))
const pcExpenseAgg = computed(() => profitPcExpenseAgg(pcEffectiveRows.value))
const previous = computed(() =>
  previousFilter.value ? costSummary(previousFilter.value) : null,
)
const compare = computed(() => {
  if (!previous.value || !previousFilter.value) {
    return costComparison(summary.value, summary.value, currentFilter.value, null)
  }
  return costComparison(summary.value, previous.value, currentFilter.value, previousFilter.value)
})

const deltaLabel = computed(() => filter.deltaLabel)
const rebateEffective = REBATE_EFFECTIVE_DATE
const emptyMargin = computed(() => !summary.value.rows.length)
const emptyPl = computed(() => !pcEffectiveRows.value.length)
const empty = computed(() => (tab.value === 'pl' ? emptyPl.value : emptyMargin.value))
const emptyText = computed(() => {
  const { from, to } = filter.periodRange
  const base = `当前筛选（${from === to ? from : `${from}~${to}`} · ${filter.cityName} · ${filter.channel}${
    filter.selectedStore !== '全部' ? ` · ${filter.selectedStore}` : ''
  }）`
  if (tab.value === 'pl' && PROFIT_PC_RANGE.to) {
    return `${base}暂无收支事实（盈亏 PC 最新至 ${PROFIT_PC_RANGE.to}），不回退旧范围、不填 0。`
  }
  const costTo = COST_DATA_RANGE[COST_DATA_RANGE.length - 1]
  if (costTo) {
    return `${base}暂无收支事实（成本数据最新至 ${costTo}），不回退旧范围、不填 0。`
  }
  return `${base}暂无收支事实，不回退旧范围、不填 0。`
})

const filterHint = computed(
  () =>
    `${shortRange.value} · ${filter.cityName} · ${filter.channel}${
      filter.selectedStore !== '全部' ? ` · ${filter.selectedStore}` : ''
    } · 与卡片/图形同一条件`,
)

const amt = (s: CostSummary, key: CostKey) =>
  s.amounts[key].complete ? s.amounts[key].value : s.amounts[key].valid ? s.amounts[key].value : null

const sourceProfit = computed(() => amt(summary.value, 'sourceProfit'))
const rebate = computed(() => (summary.value.rebateActive ? amt(summary.value, 'rebate') : null))
const finalProfit = computed(() =>
  summary.value.rebateActive ? amt(summary.value, 'sourceProfitWithRebate') : null,
)
const marginRate = computed(() => summary.value.marginRateWithRebate)

/** 收支盈亏与看板 01 盈亏概览同源：盈亏分析 PC 表（incomeTotal / expenseTotal / profit） */
const totalIncome = computed(() =>
  pcEffectiveRows.value.length ? pcAgg.value.incomeTotal : null,
)
const totalExpense = computed(() =>
  pcEffectiveRows.value.length ? pcAgg.value.expenseTotal : null,
)
const netProfit = computed(() =>
  pcEffectiveRows.value.length ? pcAgg.value.profit : null,
)
const pcStoreCount = computed(
  () => new Set(pcEffectiveRows.value.map((r) => r.store)).size,
)
const netRate = computed(() => {
  const inc = totalIncome.value
  const bal = netProfit.value
  if (inc == null || bal == null || inc === 0) return null
  return bal / inc
})

type WfBar = {
  help: number
  value: number
  color: string
  label: string
  labelPos?: 'top' | 'bottom'
  labelColor?: string
  hidden?: boolean
}

function buildWaterfallOption(cats: string[], bars: WfBar[], bridges: Array<[number, number, number]>) {
  const markData: any[] = [{ yAxis: 0 }]
  for (const [fromIdx, toIdx, y] of bridges) {
    markData.push([
      { coord: [cats[fromIdx], y], symbol: 'none' },
      { coord: [cats[toIdx], y], symbol: 'none' },
    ])
  }
  return {
    animation: false,
    grid: { left: 4, right: 4, top: 26, bottom: 24 },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (params: any[]) => {
        const p = params?.find((x) => x.seriesName === '值')
        if (!p) return ''
        const i = p.dataIndex as number
        if (bars[i]?.hidden) return `${cats[i]}<br/>—`
        return `${cats[i]}<br/>${bars[i]?.label ?? '—'}`
      },
    },
    xAxis: {
      type: 'category',
      data: cats,
      axisTick: { show: false },
      axisLine: { lineStyle: { color: 'rgba(148,190,230,0.35)' } },
      axisLabel: { color: '#9bb4cc', fontSize: 11 },
    },
    yAxis: {
      type: 'value',
      scale: true,
      splitNumber: 3,
      axisLabel: { show: false },
      splitLine: { lineStyle: { color: 'rgba(148,190,230,0.12)' } },
      axisLine: { show: false },
      axisTick: { show: false },
    },
    series: [
      {
        name: '占位',
        type: 'bar',
        stack: 'wf',
        silent: true,
        barWidth: '34%',
        data: bars.map((b) => b.help),
        itemStyle: { color: 'transparent', borderColor: 'transparent' },
        emphasis: { disabled: true },
      },
      {
        name: '值',
        type: 'bar',
        stack: 'wf',
        barWidth: '34%',
        data: bars.map((b) => ({
          value: b.hidden ? 0 : b.value,
          itemStyle: {
            color: b.hidden ? 'transparent' : b.color,
            borderRadius: b.value >= 0 ? [3, 3, 0, 0] : [0, 0, 3, 3],
          },
          label: {
            show: true,
            position: b.labelPos ?? 'top',
            formatter: b.label,
            color: b.labelColor ?? '#e8f3ff',
            fontSize: 11,
            fontWeight: 700,
          },
        })),
        markLine: {
          silent: true,
          symbol: 'none',
          lineStyle: { type: 'dashed', color: 'rgba(180,210,240,0.5)', width: 1 },
          data: markData,
          label: { show: false },
        },
      },
    ],
  }
}

function buildChart() {
  if (empty.value) {
    chartOpt.value = {
      animation: false,
      title: {
        text: '暂无数据',
        left: 'center',
        top: 'middle',
        textStyle: { color: '#6f8aa8', fontSize: 13, fontWeight: 500 },
      },
      xAxis: { show: false },
      yAxis: { show: false },
      series: [],
    }
    return
  }

  if (tab.value === 'margin') {
    const p = sourceProfit.value
    if (p == null) {
      chartOpt.value = null
      return
    }
    const r = rebate.value
    const rebateOk = summary.value.rebateActive && r != null
    const f = finalProfit.value ?? (rebateOk ? p + (r as number) : p)
    const helpRebate = Math.min(p, f)
    const cats = ['预计毛利', '平台后返', '含后返毛利']
    const bars: WfBar[] = [
      {
        help: Math.min(p, 0),
        value: Math.abs(p),
        color: '#2f8cff',
        label: yuan(p),
        labelPos: p < 0 ? 'bottom' : 'top',
        labelColor: p < 0 ? '#ff6b82' : '#e8f3ff',
      },
      {
        help: helpRebate,
        value: rebateOk ? Math.abs(r as number) : 0,
        color: '#ffe14a',
        label: rebateOk ? yuan(r) : '—',
        labelColor: rebateOk ? '#ffe14a' : '#6f8aa8',
        hidden: !rebateOk,
      },
      {
        help: Math.min(f, 0),
        value: Math.abs(f),
        color: f < 0 ? '#ff6b82' : '#00f0a8',
        label: yuan(summary.value.rebateActive ? finalProfit.value : p),
        labelPos: f < 0 ? 'bottom' : 'top',
        labelColor: f < 0 ? '#ff6b82' : '#00f0a8',
      },
    ]
    const bridges: Array<[number, number, number]> = rebateOk
      ? [
          [0, 1, Math.max(p, 0)],
          [1, 2, Math.max(f, 0)],
        ]
      : [[0, 2, Math.max(p, 0)]]
    chartOpt.value = buildWaterfallOption(cats, bars, bridges)
    return
  }

  const I = totalIncome.value
  const E = totalExpense.value
  const N = netProfit.value
  if (I == null || E == null || N == null) {
    chartOpt.value = null
    return
  }
  // 瀑布：收入 0→I；支出从 N 叠到 I（N+E=I）；净利润 min(N,0)→max(N,0)
  const cats = ['总收入', '总支出', '净利润']
  const bars: WfBar[] = [
    {
      help: 0,
      value: I,
      color: '#2f8cff',
      label: yuan(I),
    },
    {
      help: N,
      value: E,
      color: '#94a3b8',
      label: yuan(-Math.abs(E)),
      labelColor: '#cbd5e1',
    },
    {
      help: Math.min(N, 0),
      value: Math.abs(N),
      color: N < 0 ? '#ff7a45' : '#00f0a8',
      label: yuan(N),
      labelPos: N < 0 ? 'bottom' : 'top',
      labelColor: N < 0 ? '#ff7a45' : '#00f0a8',
    },
  ]
  const bridges: Array<[number, number, number]> = [
    [0, 1, I],
    [1, 2, N < 0 ? 0 : N],
  ]
  chartOpt.value = buildWaterfallOption(cats, bars, bridges)
}

watch(
  [tab, summary, sourceProfit, rebate, finalProfit, totalIncome, totalExpense, netProfit, empty],
  async () => {
    await nextTick()
    buildChart()
  },
  { immediate: true },
)

const marginConclusion = computed(() => {
  if (empty.value) return ''
  if (!summary.value.rebateActive) {
    return `当前区间后返未生效（需 ≥ ${rebateEffective}）；仅展示预计毛利，不含后返推算。`
  }
  const a = sourceProfit.value
  const b = rebate.value
  const c = finalProfit.value
  if (a == null || c == null) return '含后返毛利字段不完整，缺项不填 0。'
  if (b == null) return `预计毛利 ${yuan(a)}；平台后返缺数，含后返毛利暂不可用。`
  return `预计毛利 ${yuan(a)} + 平台后返 ${yuan(b)} → 含后返毛利 ${yuan(c)}。`
})

const plConclusion = computed(() => {
  if (emptyPl.value) return '当前筛选下暂无盈亏 PC 数据；缺项不填 0。'
  const inc = totalIncome.value
  const exp = totalExpense.value
  const bal = netProfit.value
  if (inc == null || exp == null || bal == null) return '收支字段不完整，无法生成结论；缺项不填 0。'
  const gap = Math.abs(inc - exp)
  if (bal < 0) return `结果 本期总支出比总收入多 ${costMoney(gap, 'yuan')} 元。`
  if (bal > 0) return `结果 本期总收入比总支出多 ${costMoney(gap, 'yuan')} 元。`
  return '结果 本期总收入与总支出持平。'
})

const shortRange = computed(() =>
  filter.periodRange.from === filter.periodRange.to
    ? filter.periodRange.to.slice(5)
    : `${filter.periodRange.from.slice(5)}~${filter.periodRange.to.slice(5)}`,
)

function growthOf(key: CostKey | null): number | null {
  if (!key || !compare.value.ready || !previous.value) return null
  if ((key === 'rebate' || key === 'sourceProfitWithRebate') && previousFilter.value) {
    if (
      !rebateComparable(
        currentFilter.value.from,
        currentFilter.value.to,
        previousFilter.value.from,
        previousFilter.value.to,
      )
    ) {
      return null
    }
  }
  const cur = amt(summary.value, key)
  const prev = amt(previous.value, key)
  return compare.value.growth(cur, prev)
}

/** 收支盈亏明细与看板同口径：PC 收入/支出拆解；含后返毛利明细仍沿用周期收支表 */
const incomeRows = computed(() => {
  if (tab.value === 'pl') {
    const base = totalIncome.value
    return INCOME_PC_LABELS.map((c) => ({
      id: c.key,
      label: c.label,
      key: null,
      note: c.key === 'marketing' ? '收入端扣减，不计入支出' : '',
      deduction: c.key === 'marketing',
      value: pcIncomeAgg.value[c.key] ?? null,
      share:
        base != null && base !== 0 && pcIncomeAgg.value[c.key] != null
          ? Math.abs(pcIncomeAgg.value[c.key] as number) / Math.abs(base)
          : null,
      growth: null,
    }))
  }
  return INCOME_DETAIL_ROWS.map((row) => ({
    ...row,
    value: detailAmount(summary.value, row),
    share: detailShare(summary.value, row, 'income'),
    growth: growthOf(row.key),
  }))
})
const expenseRows = computed(() => {
  if (tab.value === 'pl') {
    const base = totalExpense.value
    return EXPENSE_PC_LABELS.map((c) => ({
      id: c.key,
      label: c.label,
      key: null,
      note: '',
      value: pcExpenseAgg.value[c.key] ?? null,
      share:
        base != null && base !== 0 && pcExpenseAgg.value[c.key] != null
          ? Math.abs(pcExpenseAgg.value[c.key] as number) / Math.abs(base)
          : null,
      growth: null,
    }))
  }
  return EXPENSE_DETAIL_ROWS.map((row) => ({
    ...row,
    value: detailAmount(summary.value, row),
    share: detailShare(summary.value, row, 'expense'),
    growth: growthOf(row.key),
  }))
})

function yuan(n: number | null) {
  return costMoney(n, 'yuan')
}
function pct(n: number | null) {
  return n == null ? '—' : `${(n * 100).toFixed(2)}%`
}
function pctShare(n: number | null) {
  return n == null ? '—' : `${(n * 100).toFixed(1)}%`
}
function rawText(n: number | null) {
  return n == null ? '—' : n.toLocaleString('zh-CN', { maximumFractionDigits: 6 })
}
function growthText(g: number | null) {
  if (g == null) return '—'
  const sign = g > 0 ? '+' : ''
  return `${sign}${(g * 100).toFixed(2)}%`
}
function growthClass(g: number | null, expense = false) {
  if (g == null || g === 0) return ''
  const up = g > 0
  if (expense) return up ? 'cost-unfavorable' : 'cost-favorable'
  return up ? 'cost-favorable' : 'cost-unfavorable'
}

watch(
  () => [filter.periodRange.from, filter.periodRange.to, filter.cityQuery, filter.storeQuery, filter.channel],
  () => {
    openDetail.value = false
  },
)
</script>

<style scoped lang="scss">
.margin-panel :deep(.panel__body) {
  padding: 4px 10px 6px;
  min-width: 0;
  overflow: hidden;
}
.cost-content {
  height: 100%;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.margin__kpis {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0;
  flex-shrink: 0;
  border-bottom: 1px solid var(--divider);
  padding-bottom: 4px;
}
.kpi {
  min-width: 0;
  padding: 0 6px;
  border-right: 1px solid var(--divider);
  &:first-child { padding-left: 0; }
  &:last-child { border-right: 0; padding-right: 0; }
  em {
    display: block;
    color: var(--c-muted);
    font-size: 11px;
    font-style: normal;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  b {
    display: block;
    margin-top: 2px;
    color: var(--c-primary);
    font: 700 18px/1.1 var(--font-num);
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  &.rebate b { color: var(--accent, #ffe14a); }
  &.final b { color: var(--success, #00f0a8); }
  &.rate b { color: var(--primary-2, #3ddcff); }
  &.neg b { color: var(--danger, #ff6b82); }
}
.formula {
  margin: 0;
  font-size: 11px;
  color: var(--c-muted);
  flex-shrink: 0;
}
.tab-hint {
  margin: 0;
  font-size: 11px;
  color: var(--warn, #fbbf24);
  flex-shrink: 0;
}
.wf-chart {
  flex: 1;
  min-height: 96px;
  width: 100%;
  overflow: hidden;
}
.pl-conclusion {
  margin: 0;
  flex-shrink: 0;
  font-size: 11px;
  color: var(--c-body);
  line-height: 1.35;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.margin__foot {
  flex-shrink: 0;
  display: flex;
  justify-content: space-between;
  gap: 8px;
  padding-top: 3px;
  border-top: 1px solid var(--divider);
  color: var(--c-muted);
  font-size: 10px;
  white-space: nowrap;
  span:first-child {
    overflow: hidden;
    text-overflow: ellipsis;
  }
}
.cost-popup-mask {
  position: fixed;
  inset: 0;
  z-index: 5600;
  background: rgba(0, 16, 34, 0.72);
  display: grid;
  place-items: center;
  padding: 20px;
}
</style>
