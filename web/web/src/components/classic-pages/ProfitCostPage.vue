<!-- 中文名：利润成本——对齐管理层版-v2 / 02；接 source1 + cost + 订单毛利负毛利明细 -->
<template>
  <div class="ck-page">
    <p v-if="pcFallbackDate" class="pc-fallback-hint">
      所选日期暂无盈亏 PC 数据（最新至 {{ PROFIT_PC_RANGE.to }}），已展示最近可用日期 {{ pcFallbackDate }}。
    </p>
    <template v-if="profitDimension === 'profit'">
    <section class="ck-kpi-row ck-kpi-row--5">
      <ClassicKpi
        name="预计毛利"
        :value="fmtMoneyKpi(costKpi.sourceProfit).value"
        :unit="fmtMoneyKpi(costKpi.sourceProfit).unit"
        :hints="[{ label: primaryDeltaName, value: ratioText(delta.profit), tone: toneOf(delta.profit) }]"
      />
      <ClassicKpi
        name="毛利率"
        :value="fmtPct(kpi.profitRate)"
        :hints="[{ label: primaryDeltaName, value: ptsText(delta.profitRate), tone: toneOf(delta.profitRate) }]"
      />
      <ClassicKpi
        name="负毛利订单占比"
        :value="fmtPct(margin.negRate)"
        :hints="[{ label: '周比', value: ptsText(negRateWow), tone: toneOf(negRateWow, true) }]"
      />
      <ClassicKpi
        name="日均订单"
        :value="dailyOrders == null ? '—' : dailyOrders.toLocaleString('zh-CN', { maximumFractionDigits: 1 })"
        unit="单/天"
        :hints="[{ label: primaryDeltaName, value: ratioText(dailyOrdersWow), tone: toneOf(dailyOrdersWow) }]"
      />
      <ClassicKpi
        name="返后日均毛利"
        :value="fmtMoneyKpi(afterRebateDaily).value"
        :unit="`${fmtMoneyKpi(afterRebateDaily).unit}/天`"
        :hints="[{ label: primaryDeltaName, value: ratioText(afterRebateDailyWow), tone: toneOf(afterRebateDailyWow) }]"
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
      <article class="ck-card neg-cards">
        <header class="ck-card__head">
          <h3>1. 负毛利门店卡片</h3>
          <p>按负毛利占比取前 {{ negCardRows.length }} 家</p>
        </header>
        <div v-if="negCardRows.length" class="neg-card-grid">
          <div v-for="row in negCardRows" :key="row.store" class="neg-card" :class="{ 'is-hot': (row.negRate || 0) >= 0.3 }">
            <b class="neg-store" :title="row.store">{{ row.shortName || row.store }}</b>
            <div class="neg-line"><span>负毛利总额</span><b :class="toneOf(absLossWow(row), true)">{{ moneyNum(row.loss) }}元 {{ wowParen(absLossWow(row)) }}</b></div>
            <div class="neg-bar-row"><span>负毛利占比</span><i class="neg-bar"><i :style="{ width: barWidth(row.negRate, negMax) }" /></i><b>{{ fmtPct(row.negRate) }}</b></div>
            <div class="neg-bar-row"><span>&gt;3元占比</span><i class="neg-bar neg-bar--amber"><i :style="{ width: barWidth(row.gt3Rate, gt3Max) }" /></i><b>{{ fmtPct(row.gt3Rate) }}</b></div>
            <div class="neg-line"><span>返后日均毛利</span><b>{{ Number(row.dailyProfit || 0).toFixed(2) }}元 <em :class="toneOf(row.dailyProfitWow)">{{ wowParen(row.dailyProfitWow) }}</em></b></div>
            <div class="neg-advice"><span>处理建议：</span>{{ adviceOf(row) }}</div>
          </div>
        </div>
        <div v-else class="ck-empty"><b>暂无负毛利门店</b><span>当前筛选下无负毛利订单占比 &gt; 0 的门店</span></div>
      </article>
      <article class="ck-card negative-rank-card">
        <header class="ck-card__head">
          <h3>门店负毛利排行</h3>
          <div class="head-right">
            <p>条形=负毛利总额 · 颜色=负毛利占比</p>
            <div class="ck-pills">
              <button type="button" :class="{ active: negativeRankMode === 'rate' }" @click="negativeRankMode = 'rate'">按负毛利占比</button>
              <button type="button" :class="{ active: negativeRankMode === 'loss' }" @click="negativeRankMode = 'loss'">按负毛利总额</button>
            </div>
          </div>
        </header>
        <div v-show="negativeRankRows.length" ref="negativeRankEl" class="ck-plot ck-plot--chart plot-negative-rank" aria-label="门店负毛利排行横向条形图" />
        <div v-if="!negativeRankRows.length" class="ck-empty"><b>暂无负毛利门店</b><span>当前筛选下无负毛利订单明细</span></div>
      </article>
    </section>
    <section class="bottom-row">
      <article class="ck-card store-board">
        <header class="ck-card__head">
          <h3>订单维度</h3>
          <p>柱=日均订单 · 线=订单周比</p>
        </header>
        <div v-show="effDuoRows.length" ref="effOrderEl" class="ck-plot ck-plot--chart plot-eff" aria-label="日均订单与订单周比组合图" />
        <div v-if="!effDuoRows.length" class="ck-empty"><b>暂无赚钱门店</b><span>当前筛选下无反后日均毛利为正的门店</span></div>
      </article>
      <article class="ck-card store-board">
        <header class="ck-card__head">
          <h3>毛利维度</h3>
          <p>柱=返后日均毛利 · 线=毛利周比</p>
        </header>
        <div v-show="effDuoRows.length" ref="effProfitEl" class="ck-plot ck-plot--chart plot-eff" aria-label="日均毛利与毛利周比组合图" />
        <div v-if="!effDuoRows.length" class="ck-empty"><b>暂无赚钱门店</b><span>当前筛选下无反后日均毛利为正的门店</span></div>
      </article>
    </section>
    </template>

    <template v-else-if="false">
      <section class="ck-kpi-row ck-kpi-row--5">
        <ClassicKpi name="负毛利门店数" :value="String(negativeStoreCount)" hint="当前筛选周期" />
        <ClassicKpi name="负毛利金额" :value="fmtMoneyKpi(negativeSummary.loss != null ? negativeSummary.loss : null).value" :unit="fmtMoneyKpi(negativeSummary.loss != null ? negativeSummary.loss : null).unit" hint="负值为损失" />
        <ClassicKpi name="负毛利记录数" :value="negativeSummary.exportNeg != null ? String(negativeSummary.exportNeg) : '—'" hint="门店日渠道汇总记录" />
        <ClassicKpi name="负毛利占比" :value="fmtPct(negativeSummary.negRate)" :hints="[{ label: '周比', value: ptsText(negRateWow), tone: toneOf(negRateWow, true) }]" />
        <ClassicKpi name="日均负毛利" :value="fmtMoneyKpi(negativeDailyLoss).value" :unit="fmtMoneyKpi(negativeDailyLoss).unit" hint="按有数据天数" />
      </section>
      <section class="analysis-grid analysis-grid--negative">
        <article class="ck-card">
          <header class="ck-card__head"><h3>负毛利门店排行</h3><p>门店周期汇总</p></header>
          <table v-if="negativeStoreRows.length" class="ck-table"><thead><tr><th>门店</th><th class="num">负毛利占比</th><th class="num">日均订单</th><th class="num">日均毛利</th></tr></thead><tbody>
            <tr v-for="row in negativeStoreRows" :key="row.store"><td>{{ row.shortName || row.store }}</td><td class="num is-alert">{{ fmtPct(row.negRate) }}</td><td class="num">{{ Number(row.dailyOrders || 0).toFixed(2) }}</td><td class="num is-alert">{{ Number(row.dailyProfit || 0).toFixed(2) }}</td></tr>
          </tbody></table>
          <div v-else class="ck-empty"><b>暂无负毛利门店</b><span>当前筛选下没有负毛利汇总记录</span></div>
        </article>
        <article class="ck-card">
          <header class="ck-card__head"><h3>负毛利渠道分布</h3><p>门店日渠道汇总，不等同订单数</p></header>
          <ul class="metric-list"><li v-for="item in negativeSummary.channels" :key="item.key"><span>{{ item.key }}</span><b>{{ item.count }}</b><em>{{ fmtPct(item.share) }}</em></li></ul>
          <div v-if="!negativeSummary.channels.length" class="ck-empty"><b>暂无渠道分布</b><span>当前筛选下无负毛利记录</span></div>
        </article>
        <article class="ck-card">
          <header class="ck-card__head"><h3>负毛利成本构成</h3><p>成本项构成，不代表单笔归因</p></header>
          <ul class="metric-list"><li v-for="item in negativeCostItems" :key="item.label"><span>{{ item.label }}</span><b>{{ fmtMoneyInUnit(item.value, negativeCostUnit) }}</b><em>{{ fmtPct(item.share) }}</em></li></ul>
        </article>
      </section>
      <section class="ck-card">
        <header class="ck-card__head"><h3>重点负毛利门店</h3><p>数据粒度：门店 × 日期 × 渠道；当前没有订单级明细</p></header>
        <div class="data-note">本页可用于门店级和门店日渠道级分析；“负毛利记录数”不是实际订单数，订单级指标需接入订单明细。</div>
      </section>
    </template>

    <template v-else>
      <section class="ck-kpi-row ck-kpi-row--6">
        <ClassicKpi
          name="用户实付"
          :value="fmtMoneyKpi(pcSummary.paid).value"
          :unit="fmtMoneyKpi(pcSummary.paid).unit"
          :hints="[{ label: primaryDeltaName, value: ratioText(pcGrowth(pcSummary.paid, pcPrevSummary?.paid ?? null)), tone: toneOf(pcGrowth(pcSummary.paid, pcPrevSummary?.paid ?? null)) }]"
        />
        <ClassicKpi
          name="总营业额"
          :value="fmtMoneyKpi(pcSummary.turnover).value"
          :unit="fmtMoneyKpi(pcSummary.turnover).unit"
          :hints="[{ label: primaryDeltaName, value: ratioText(pcGrowth(pcSummary.turnover, pcPrevSummary?.turnover ?? null)), tone: toneOf(pcGrowth(pcSummary.turnover, pcPrevSummary?.turnover ?? null)) }]"
        />
        <ClassicKpi
          name="有效订单量"
          :value="pcSummary.orders == null ? '—' : Math.round(pcSummary.orders).toLocaleString('zh-CN')"
          :hints="[{ label: primaryDeltaName, value: ratioText(pcGrowth(pcSummary.orders, pcPrevSummary?.orders ?? null)), tone: toneOf(pcGrowth(pcSummary.orders, pcPrevSummary?.orders ?? null)) }]"
        />
        <ClassicKpi
          name="商品补贴率"
          :value="fmtPct(pcSummary.subsidyRate)"
          :hints="[{ label: primaryDeltaName, value: ptsText(pcDelta(pcSummary.subsidyRate, pcPrevSummary?.subsidyRate ?? null)), tone: toneOf(pcDelta(pcSummary.subsidyRate, pcPrevSummary?.subsidyRate ?? null)) }]"
        />
        <ClassicKpi
          name="净利润"
          :value="fmtMoneyKpi(pcSummary.profit).value"
          :unit="fmtMoneyKpi(pcSummary.profit).unit"
          :hints="[{ label: primaryDeltaName, value: ratioText(pcGrowth(pcSummary.profit, pcPrevSummary?.profit ?? null)), tone: toneOf(pcGrowth(pcSummary.profit, pcPrevSummary?.profit ?? null)) }]"
        />
        <ClassicKpi
          name="动销率"
          :value="fmtPct(activeRate)"
          :hints="[{ label: '动销', value: `${activeCount}/${totalCount}`, tone: '' }]"
        />
      </section>
      <section class="analysis-grid analysis-grid--half">
        <article class="ck-card">
          <header class="ck-card__head">
            <h3>营收 × 净利率四象限</h3>
            <div class="head-right">
              <p class="quad-sub">X=总营收 · Y=净利率 · 气泡=净利润 · 虚线=营收均值 {{ moneyNum(quadMean.x) }} / 净利率均值 {{ fmtPct(quadMean.y) }}</p>
            </div>
          </header>
          <div v-show="pcStoresActive.length" ref="quadEl" class="ck-plot ck-plot--chart plot-quad" />
          <div v-if="!pcStoresActive.length" class="ck-empty"><b>暂无四象限样本</b><span>当前筛选下无门店样本</span></div>
          <div class="metric-list quad-legend" role="group" aria-label="四象限筛选">
            <button type="button" class="quad-btn" :class="{ active: quadFilter === 'star' }" title="高营收高利率：优势门店，保持打法" @click="quadFilter = quadFilter === 'star' ? '' : 'star'"><span>右上 · 高营收高利率</span><b>{{ quadCounts.star }}</b><em>保持</em></button>
            <button type="button" class="quad-btn" :class="{ active: quadFilter === 'nice' }" title="低营收高利率：利润健康，重点提量" @click="quadFilter = quadFilter === 'nice' ? '' : 'nice'"><span>左上 · 低营收高利率</span><b>{{ quadCounts.nice }}</b><em>提量</em></button>
            <button type="button" class="quad-btn" :class="{ active: quadFilter === 'blood' }" title="高营收低利率：补贴偏高侵蚀利润，重点降补贴，点击联动下方门店明细" @click="quadFilter = quadFilter === 'blood' ? '' : 'blood'"><span>右下 · 高营收低利率</span><b>{{ quadCounts.blood }}</b><em>降补</em></button>
            <button type="button" class="quad-btn" :class="{ active: quadFilter === 'watch' }" title="低营收低利率：持续观察" @click="quadFilter = quadFilter === 'watch' ? '' : 'watch'"><span>左下 · 低营收低利率</span><b>{{ quadCounts.watch }}</b><em>观察</em></button>
          </div>
        </article>
        <article class="ck-card">
          <header class="ck-card__head"><h3>象限联动门店</h3><p>{{ bloodQuadName }} · 上条=营收 · 下条=净利润 · 标注补贴率</p></header>
          <div v-show="bloodRows.length" ref="bloodEl" class="ck-plot ck-plot--chart plot-blood" :style="{ height: bloodHeight + 'px' }" />
          <div v-if="!bloodRows.length" class="ck-empty"><b>暂无{{ bloodQuadName }}门店</b><span>{{ bloodEmptyHint }}</span></div>
        </article>
        <article class="ck-card">
          <header class="ck-card__head">
            <h3>门店盈亏排行</h3>
            <p>0 轴对称 · 左红右绿 · 滚轮/拖动纵览全部 · 单位：{{ rankUnit }}</p>
          </header>
          <div v-show="rankRows.length" ref="rankEl" class="ck-plot ck-plot--chart plot-rank" />
          <div v-if="!rankRows.length" class="ck-empty compact"><b>暂无门店盈亏数据</b><span>当前筛选下无盈亏PC门店明细</span></div>
        </article>
        <article class="ck-card">
          <header class="ck-card__head"><h3>补贴率 vs 净利率</h3><p>X轴对数 · 右上高补贴低回报区 · 含拟合线</p></header>
          <div v-show="pcStoresActive.length" ref="subEl" class="ck-plot ck-plot--chart plot-tall" />
          <div v-if="!pcStoresActive.length" class="ck-empty"><b>暂无散点样本</b><span>当前筛选下无门店样本</span></div>
        </article>
        <article class="ck-card">
          <header class="ck-card__head">
            <h3>营收到利润瀑布</h3>
            <p>商品原价 → 扣营销补贴 → 加配送包装 → 净收入 → 扣支出 → 净利润</p>
          </header>
          <div v-show="waterSteps.length" ref="incomeEl" class="ck-plot ck-plot--chart plot-medium" />
          <div v-if="!waterSteps.length" class="ck-empty"><b>暂无瀑布数据</b><span>当前筛选下无营收明细</span></div>
        </article>
        <article class="ck-card">
          <header class="ck-card__head"><h3>支出结构帕累托</h3><p>柱=金额 · 线=累计 · 80% 参考线</p></header>
          <div v-show="paretoTotal > 0" ref="paretoEl" class="ck-plot ck-plot--chart plot-medium" />
          <div v-if="paretoTotal <= 0" class="ck-empty"><b>暂无支出结构</b><span>当前筛选下无支出明细</span></div>
        </article>
      </section>
    </template>
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
  previousPeriodRange,
  previousWeekRange,
} from '../../api/source1'
import { costSummary, latestCostDateOnOrBefore } from '../../api/costSummary'
import {
  EXPENSE_PC_LABELS,
  INCOME_PC_LABELS,
  latestProfitPcDateOnOrBefore,
  PROFIT_PC_RANGE,
  profitDimension,
  profitPcByStore,
  profitPcDaily,
  profitPcExpenseAgg,
  profitPcIncomeAgg,
  selectProfitPcFacts,
  shortPcStore,
  summarizeProfitPc,
} from '../../api/profitPc'
import { COST_FIELDS, EXPENSE_KEYS } from '../../utils/costAnalysis'
import { orderMarginSummary, orderMarginWeekBoard } from '../../api/orderMarginSummary'
import { wowDelta, periodDays } from '../../utils/orderMarginAnalysis'
import { useChart } from '../../composables/useChart'
import { fmtPct, fmtMoneyKpi, fmtMoneyInUnit, moneyUnitOf, toneOf } from '../../utils/classicHints'

const filter = useFilterStore()
const { periodRange, channel, cityQuery, storeQuery, periodMode, deltaLabel } = storeToRefs(filter)
const activeTab = profitDimension
const structDim = ref<'reason' | 'channel'>('reason')
const waterEl = ref<HTMLElement | null>(null)
const donutEl = ref<HTMLElement | null>(null)
const negativeRankMode = ref<'rate' | 'loss'>('rate')
const negativeRankEl = ref<HTMLElement | null>(null)
const negativeRankOpt = ref<any>(null)
const rankEl = ref<HTMLElement | null>(null)
const quadEl = ref<HTMLElement | null>(null)
const bloodEl = ref<HTMLElement | null>(null)
const incomeEl = ref<HTMLElement | null>(null)
const subEl = ref<HTMLElement | null>(null)
const paretoEl = ref<HTMLElement | null>(null)
const waterOpt = ref<any>(null)
const donutOpt = ref<any>(null)
const rankOpt = ref<any>(null)
const quadOpt = ref<any>(null)
const bloodOpt = ref<any>(null)
const incomeOpt = ref<any>(null)
const subOpt = ref<any>(null)
const paretoOpt = ref<any>(null)
const effOrderEl = ref<HTMLElement | null>(null)
const effProfitEl = ref<HTMLElement | null>(null)
const effOrderOpt = ref<any>(null)
const effProfitOpt = ref<any>(null)
useChart(waterEl, waterOpt)
useChart(donutEl, donutOpt)
useChart(negativeRankEl, negativeRankOpt)
useChart(rankEl, rankOpt)
useChart(quadEl, quadOpt)
useChart(bloodEl, bloodOpt)
useChart(incomeEl, incomeOpt)
useChart(subEl, subOpt)
useChart(paretoEl, paretoOpt)
useChart(effOrderEl, effOrderOpt)
useChart(effProfitEl, effProfitOpt)

const q = computed(() => ({
  from: periodRange.value.from,
  to: periodRange.value.to,
  channel: channel.value,
  store: storeQuery.value,
  city: cityQuery.value,
}))
const prevQ = computed(() => ({ ...q.value, ...previousPeriodRange(q.value.from, q.value.to, periodMode.value) }))
const weekQ = computed(() => ({ ...q.value, ...previousWeekRange(q.value.from, q.value.to) }))
const kpi = computed(() => aggregateSource1Kpi(q.value))
const delta = computed(() => deltaOf(kpi.value, aggregateSource1Kpi(prevQ.value)))
const weekDelta = computed(() =>
  periodMode.value === 'day' ? deltaOf(kpi.value, aggregateSource1Kpi(weekQ.value)) : deltaOf(kpi.value, null),
)
const primaryDeltaName = computed(() => deltaLabel.value)
const showWeekDelta = computed(() => periodMode.value === 'day')

const cost = computed(() =>
  costSummary({
    from: q.value.from,
    to: q.value.to,
    city: cityQuery.value,
    store: storeQuery.value,
    channel: channel.value,
  }),
)
const previousCost = computed(() =>
  costSummary({
    from: prevQ.value.from,
    to: prevQ.value.to,
    city: cityQuery.value,
    store: storeQuery.value,
    channel: channel.value,
  }),
)

function subsidyRateOf(summary: ReturnType<typeof costSummary>) {
  const marketing = summary.amounts.marketing
  const turnover = summary.amounts.turnover
  if (!marketing.complete || !turnover.complete || marketing.value == null || turnover.value == null || turnover.value === 0) return null
  return marketing.value / turnover.value
}

function netProfitOf(summary: ReturnType<typeof costSummary>) {
  return summary.rebateActive ? summary.withRebate : summary.balance
}

function growthOf(current: number | null, previous: number | null) {
  if (current == null || previous == null || previous === 0) return null
  return (current - previous) / Math.abs(previous)
}

/** 所选日期无 PC 事实时回退到最近一个有数据的日期，避免整页空白 */
const pcFallbackDate = computed(() => {
  if (!q.value.from || !q.value.to) return ''
  if (selectProfitPcFacts({ from: q.value.from, to: q.value.to, city: cityQuery.value, store: storeQuery.value }).length) return ''
  const latest = latestProfitPcDateOnOrBefore(q.value.to)
  if (!latest || latest >= q.value.to) return ''
  const rows = selectProfitPcFacts({ from: latest, to: latest, city: cityQuery.value, store: storeQuery.value })
  return rows.length ? latest : ''
})
const pcQ = computed(() =>
  pcFallbackDate.value ? { ...q.value, from: pcFallbackDate.value, to: pcFallbackDate.value } : q.value,
)
const pcRows = computed(() => selectProfitPcFacts({ from: pcQ.value.from, to: pcQ.value.to, city: cityQuery.value, store: storeQuery.value }))
const pcPrevRows = computed(() => selectProfitPcFacts({ from: prevQ.value.from, to: prevQ.value.to, city: cityQuery.value, store: storeQuery.value }))
const pcSummary = computed(() => summarizeProfitPc(pcRows.value))
const pcPrevSummary = computed(() => (prevQ.value.from && prevQ.value.to ? summarizeProfitPc(pcPrevRows.value) : null))
const pcStores = computed(() => profitPcByStore(pcRows.value).sort((a, b) => b.profit - a.profit))
const pcStoresActive = computed(() => pcStores.value.filter((r) => r.turnover > 0))
const pcDaily = computed(() => profitPcDaily(pcRows.value))
const pcQuery = ref('')
const drillStore = ref('')
const showZero = ref(false)
const quadFilter = ref('blood')
type PcSortKey = 'date' | 'store' | 'turnover' | 'profit' | 'profitRateSrc' | 'subsidyRateSrc'
const pcSort = ref<{ key: PcSortKey; dir: 'asc' | 'desc' }>({ key: 'profit', dir: 'desc' })
function togglePcSort(key: PcSortKey) {
  if (pcSort.value.key === key) pcSort.value = { key, dir: pcSort.value.dir === 'desc' ? 'asc' : 'desc' }
  else pcSort.value = { key, dir: key === 'store' || key === 'date' ? 'asc' : 'desc' }
}
function pcSortClass(key: PcSortKey) {
  if (pcSort.value.key !== key) return ''
  return pcSort.value.dir === 'asc' ? 'is-asc' : 'is-desc'
}
const pcTableBase = computed(() => pcRows.value.filter((r) => {
  if (!pcQuery.value) return true
  const needle = pcQuery.value.toLowerCase()
  return r.store.toLowerCase().includes(needle) || shortPcStore(r.store).toLowerCase().includes(needle)
}))
const zeroRows = computed(() => pcTableBase.value.filter((r) => !((r.turnover || 0) > 0)))
const pcTable = computed(() => {
  const rows = pcTableBase.value.filter((r) => showZero.value || (r.turnover || 0) > 0)
  return rows.sort((a, b) => a.date.localeCompare(b.date) || a.store.localeCompare(b.store, 'zh-CN'))
})
const pcTableSorted = computed(() => {
  const sign = pcSort.value.dir === 'asc' ? 1 : -1
  return [...pcTable.value].sort((a, b) => {
    const k = pcSort.value.key
    if (k === 'store' || k === 'date') return sign * String(a[k]).localeCompare(String(b[k]), 'zh-CN')
    const av = (a[k] as number | null) ?? -Infinity
    const bv = (b[k] as number | null) ?? -Infinity
    if (av === bv) return a.store.localeCompare(b.store, 'zh-CN')
    return sign * (Number(av) - Number(bv))
  })
})
const rankUnit = computed(() => moneyUnitOf(pcStores.value.map((r) => r.profit)))
const activeRows = computed(() => pcRows.value.filter((r) => (r.turnover || 0) > 0))
const totalStores = computed(() => new Set(pcRows.value.map((r) => r.store)).size)
const activeStores = computed(() => new Set(activeRows.value.map((r) => r.store)).size)
const activeCount = computed(() => activeStores.value)
const totalCount = computed(() => totalStores.value)
const activeRate = computed(() => (totalCount.value ? activeCount.value / totalCount.value : null))
const rankRows = computed(() => pcStoresActive.value.filter((r) => r.profit !== 0))
function moneyNum(v: number | null | undefined) {
  if (v == null || Number.isNaN(v)) return '—'
  return Number(v).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
const quadMean = computed(() => {
  const rows = pcStoresActive.value
  if (!rows.length) return { x: 0, y: 0 }
  return {
    x: rows.reduce((s, r) => s + r.turnover, 0) / rows.length,
    y: rows.reduce((s, r) => s + (r.profitRate || 0), 0) / rows.length,
  }
})
function quadOf(r: { turnover: number; profitRate: number | null }) {
  const right = r.turnover >= quadMean.value.x
  const up = (r.profitRate || 0) >= quadMean.value.y
  if (right && up) return 'star'
  if (!right && up) return 'nice'
  if (right && !up) return 'blood'
  return 'watch'
}
const quadCounts = computed(() => {
  const c = { star: 0, nice: 0, blood: 0, watch: 0 }
  for (const r of pcStoresActive.value) c[quadOf(r)]++
  return c
})
const quadNames = computed(() => ({
  star: '右上 · 高营收高利率',
  nice: '左上 · 低营收高利率',
  blood: '右下 · 高营收低利率',
  watch: '左下 · 低营收低利率',
}))
const incomeAgg = computed(() => profitPcIncomeAgg(pcRows.value))
const incomeTotalAll = computed(() => INCOME_PC_LABELS.reduce((s, c) => s + (incomeAgg.value[c.key] || 0), 0))
const expenseAgg = computed(() => profitPcExpenseAgg(pcRows.value))
const paretoTotal = computed(() => EXPENSE_PC_LABELS.reduce((s, c) => s + (expenseAgg.value[c.key] || 0), 0))

function pcGrowth(cur: number | null, prev: number | null) {
  if (cur == null || prev == null || prev === 0) return null
  return (cur - prev) / Math.abs(prev)
}
function pcDelta(cur: number | null, prev: number | null) {
  if (cur == null || prev == null) return null
  return cur - prev
}
function profitTone(rate: number | null | undefined) {
  if (rate == null) return ''
  if (rate < 0) return 'is-bad'
  if (rate < 0.05) return 'is-warn'
  if (rate <= 0.1) return 'is-mid'
  return 'is-good'
}
function drillText(record: Record<string, number | null> | undefined) {
  if (!record) return '—'
  const items = Object.entries(record)
    .filter(([, v]) => typeof v === 'number' && v !== 0)
    .map(([k, v]) => `${k}${moneyNum(v as number)}`)
  return items.length ? items.join(' · ') : '—'
}
const waterSteps = computed(() => {
  const w = pcSummary.value.waterfall
  if (!w || w.goodsOriginal <= 0) return []
  const base = w.goodsOriginal
  const pct = (v: number) => `${((v / base) * 100).toFixed(2)}%`
  return [
    { name: '商品原价收入', display: w.goodsOriginal, shareText: '100.00%', raw: w.goodsOriginal, kind: 'base' },
    { name: '−营销补贴', display: -w.marketing, shareText: `−${pct(w.marketing)}`, raw: -w.marketing, kind: 'down' },
    { name: '+配送/包装/其他', display: w.deliveryPack, shareText: `+${pct(w.deliveryPack)}`, raw: w.deliveryPack, kind: 'up' },
    { name: '=净收入', display: w.incomeTotal, shareText: pct(w.incomeTotal), raw: w.incomeTotal, kind: 'subtotal' },
    { name: '−商品成本', display: -w.coreExpense, shareText: `−${pct(w.coreExpense)}`, raw: -w.coreExpense, kind: 'down' },
    { name: '−配送/佣金/推广', display: -w.deliveryExpense, shareText: `−${pct(w.deliveryExpense)}`, raw: -w.deliveryExpense, kind: 'down' },
    { name: '−其他支出差额', display: -w.residualExpense, shareText: `${w.residualExpense >= 0 ? '−' : '+'}${pct(Math.abs(w.residualExpense))}`, raw: -w.residualExpense, kind: 'down' },
    { name: '=净利润', display: w.profit, shareText: pct(w.profit), raw: w.profit, kind: 'end' },
  ]
})
const bloodRows = computed(() => {
  const valid = ['star', 'nice', 'blood', 'watch'] as const
  const active = valid.includes(quadFilter.value as (typeof valid)[number])
    ? (quadFilter.value as (typeof valid)[number])
    : 'blood'
  const rows = pcStoresActive.value.filter((r) => quadOf(r) === active)
  if (!rows.length) return []
  if (active !== 'blood') return [...rows].sort((a, b) => b.turnover - a.turnover).slice(0, 8)
  const turnovers = [...rows].map((r) => r.turnover).sort((a, b) => a - b)
  const hi = turnovers[Math.floor(turnovers.length * 0.7)] ?? 0
  const pick = rows
    .filter((r) => r.turnover >= hi && ((r.profitRate ?? 0) <= 0.02 || r.profit <= 300))
    .sort((a, b) => b.turnover - a.turnover)
    .slice(0, 8)
  return pick.length ? pick : rows.slice(0, 8)
})
const bloodQuadName = computed(() => {
  if (quadFilter.value === 'star') return '右上象限'
  if (quadFilter.value === 'nice') return '左上象限'
  if (quadFilter.value === 'watch') return '左下象限'
  return '右下象限'
})
const bloodHeight = computed(() => {
  const n = bloodRows.value.length
  if (n <= 1) return 190
  if (n <= 3) return 240
  return 300
})
const bloodEmptyHint = computed(() => {
  if (quadFilter.value && quadFilter.value !== 'blood') return '该象限暂无门店样本'
  return '当前筛选下无右下象限样本'
})

const balanceKpi = computed(() => ({
  subsidyRate: pcSummary.value.subsidyRate,
  netProfit: pcSummary.value.profit,
}))
const balanceKpiDelta = computed(() => ({
  turnover: pcGrowth(pcSummary.value.turnover, pcPrevSummary.value?.turnover ?? null),
  subsidyRate: pcDelta(pcSummary.value.subsidyRate, pcPrevSummary.value?.subsidyRate ?? null),
  netProfit: pcGrowth(pcSummary.value.profit, pcPrevSummary.value?.profit ?? null),
}))
const costKpi = computed(() => ({
  sourceProfit: cost.value.amounts.sourceProfit?.complete ? cost.value.amounts.sourceProfit.value : null,
  rebate: cost.value.amounts.rebate?.complete ? cost.value.amounts.rebate.value : null,
  sourceProfitWithRebate: cost.value.amounts.sourceProfitWithRebate?.complete ? cost.value.amounts.sourceProfitWithRebate.value : null,
  onlineIncome: cost.value.amounts.onlineIncome?.complete ? cost.value.amounts.onlineIncome.value : null,
  onlineExpense: cost.value.amounts.onlineExpense?.complete ? cost.value.amounts.onlineExpense.value : null,
}))

const margin = computed(() => orderMarginSummary(q.value))
const prevMargin = computed(() => orderMarginSummary(prevQ.value))
const negRateWow = computed(() => {
  const prev = orderMarginSummary(weekQ.value)
  return wowDelta(margin.value.negRate, prev.negRate, 'pts')
})
/** 日均订单：订单毛利明细全量订单 / 本期天数 */
const dailyOrders = computed(() => {
  const days = Math.max(1, periodDays(q.value.from, q.value.to))
  return margin.value.exportOrders > 0 ? margin.value.exportOrders / days : null
})
const prevDailyOrders = computed(() => {
  const days = Math.max(1, periodDays(prevQ.value.from, prevQ.value.to))
  return prevMargin.value.exportOrders > 0 ? prevMargin.value.exportOrders / days : null
})
const dailyOrdersWow = computed(() => {
  if (dailyOrders.value == null || prevDailyOrders.value == null || prevDailyOrders.value === 0) return null
  return (dailyOrders.value - prevDailyOrders.value) / Math.abs(prevDailyOrders.value)
})
/** 返后日均毛利：含后返毛利优先，回退到预计毛利 / 本期天数 */
const afterRebateDaily = computed(() => {
  const days = Math.max(1, periodDays(q.value.from, q.value.to))
  const total = costKpi.value.sourceProfitWithRebate ?? costKpi.value.sourceProfit
  return total != null ? total / days : null
})
const prevAfterRebateDaily = computed(() => {
  const days = Math.max(1, periodDays(prevQ.value.from, prevQ.value.to))
  const prevTotal = previousCost.value.amounts.sourceProfitWithRebate?.complete
    ? previousCost.value.amounts.sourceProfitWithRebate.value
    : previousCost.value.amounts.sourceProfit?.complete
      ? previousCost.value.amounts.sourceProfit.value
      : null
  return prevTotal != null ? prevTotal / days : null
})
const afterRebateDailyWow = computed(() => {
  if (afterRebateDaily.value == null || prevAfterRebateDaily.value == null || prevAfterRebateDaily.value === 0) return null
  return (afterRebateDaily.value - prevAfterRebateDaily.value) / Math.abs(prevAfterRebateDaily.value)
})
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
const negativeSummary = computed(() => margin.value)
const negativeStoreCount = computed(() => storeRows.value.filter((r) => r.negRate != null && r.negRate > 0).length)
const negativeStoreRows = computed(() => storeRows.value.filter((r) => r.negRate != null && r.negRate > 0).sort((a, b) => (b.negRate || 0) - (a.negRate || 0)).slice(0, 10))
const negativeDailyLoss = computed(() => {
  const days = Math.max(1, negativeSummary.value.cycleOrders ? periodDays(q.value.from, q.value.to) : 1)
  return negativeSummary.value.loss != null ? negativeSummary.value.loss / days : null
})
const negativeCostItems = computed(() => {
  const items = cost.value.expenses.filter((item) => item.value != null).map((item) => ({ label: item.label, value: Math.abs(item.value || 0), share: item.share }))
  return items.sort((a, b) => b.value - a.value).slice(0, 6)
})
const negativeCostUnit = computed(() => moneyUnitOf(negativeCostItems.value.map((item) => item.value)))
const balanceItems = computed(() => [
  { label: '总营业额', value: cost.value.amounts.turnover?.value ?? null, kind: 'base' },
  { label: '营销活动费用', value: cost.value.amounts.marketing?.value != null ? -Math.abs(cost.value.amounts.marketing.value) : null, kind: 'down' },
  { label: '经营收入', value: cost.value.income, kind: 'subtotal' },
  { label: '经营支出', value: cost.value.expense != null ? -cost.value.expense : null, kind: 'down' },
  { label: '经营结余', value: cost.value.balance, kind: 'end' },
])
const balanceUnit = computed(() => moneyUnitOf(balanceItems.value.map((item) => item.value)))
const expenseItems = computed(() => cost.value.expenses.filter((item) => item.value != null).sort((a, b) => (b.value || 0) - (a.value || 0)).map((item) => ({ label: item.label, value: item.value, share: item.share })))

/** 效能双轴组合：两张图共用同一批门店（按返后日均毛利取前 10） */
const effDuoRows = computed(() =>
  storeRows.value
    .filter((r) => r.dailyProfit > 0)
    .sort((a, b) => b.dailyProfit - a.dailyProfit)
    .slice(0, 10),
)

const waterfall = computed(() => {
  const income = cost.value.income
  const profit = costKpi.value.sourceProfit
  const profitWithRebate = costKpi.value.sourceProfitWithRebate
  if (income == null && profit == null && profitWithRebate == null) return []
  const steps: { name: string; value: number; kind: 'base' | 'down' | 'end' }[] = []
  if (income != null) steps.push({ name: '预计线上收入', value: income, kind: 'base' })
  for (const key of EXPENSE_KEYS) {
    const amt = cost.value.amounts[key]?.value
    if (amt == null || amt <= 0) continue
    steps.push({ name: COST_FIELDS[key], value: -amt, kind: 'down' })
  }
  if (profit != null) steps.push({ name: '预计毛利', value: profit, kind: 'end' })
  if (costKpi.value.rebate != null) steps.push({ name: '平台后返', value: costKpi.value.rebate, kind: 'base' })
  if (profitWithRebate != null) steps.push({ name: '含后返毛利', value: profitWithRebate, kind: 'end' })
  return steps.slice(0, 12)
})

const waterUnit = computed(() => moneyUnitOf(waterfall.value.map((s) => s.value)))
const structSlices = computed(() =>
  structDim.value === 'channel' ? margin.value.channels : margin.value.reasons,
)
const structTotal = computed(() =>
  structSlices.value.reduce((n, s) => n + Math.abs(s.amount || 0), 0),
)
const leakUnit = computed(() =>
  moneyUnitOf(structSlices.value.map((s) => Math.abs(s.amount))),
)

/** 门店负毛利排行：按负毛利占比或负毛利总额排序取前 N */
const negativeRankRows = computed(() => {
  const base = storeRows.value.filter(
    (r) => (r.negRate != null && r.negRate > 0) || Math.abs(r.loss || 0) > 0,
  )
  const rows = [...base].sort((a, b) => {
    if (negativeRankMode.value === 'loss') return Math.abs(b.loss || 0) - Math.abs(a.loss || 0)
    return (b.negRate || 0) - (a.negRate || 0)
  })
  return rows.slice(0, 10)
})

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
  [pcStoresActive, rankUnit, rankRows],
  ([stores, unit, rows]) => {
    if (!rows.length) {
      rankOpt.value = null
      return
    }
    const sorted = [...rows].sort((a, b) => b.profit - a.profit)
    const top = sorted.filter((r) => r.profit > 0)
    const bottom = sorted.filter((r) => r.profit < 0)
    const list = [...top, ...bottom]
    const maxAbs = Math.max(...sorted.map((r) => Math.abs(r.profit)), 1)
    rankOpt.value = {
      grid: { left: 100, right: 170, top: 22, bottom: 54, containLabel: false },
      dataZoom: [
        {
          type: 'slider',
          yAxisIndex: 0,
          right: 8,
          width: 14,
          start: 0,
          end: 100,
          brushSelect: false,
        },
        {
          type: 'inside',
          yAxisIndex: 0,
          zoomOnMouseWheel: false,
          moveOnMouseWheel: true,
          moveOnMouseMove: true,
        },
      ],
      tooltip: {
        trigger: 'item',
        formatter: (p: any) => {
          const row = p.data?.row
          if (!row) return p.name
          return `${row.store}<br/>净利润 ${moneyNum(row.profit)} 元<br/>净利率 ${fmtPct(row.profitRate)} · 补贴率 ${fmtPct(row.subsidyRate)}`
        },
      },
      xAxis: {
        type: 'value',
        min: -maxAbs * 1.45,
        max: maxAbs * 1.45,
        axisLabel: { show: false },
        splitLine: { lineStyle: { color: '#eef2f7' } },
      },
      yAxis: {
        type: 'category',
        data: list.map((r) => r.shortName),
        axisLabel: { fontSize: 13, color: '#1f2937' },
        axisTick: { show: false },
        axisLine: { show: false },
      },
      series: [
        {
          name: '亏损',
          type: 'bar',
          barMaxWidth: 20,
          barCategoryGap: '28%',
          data: list.map((r) => ({
            value: r.profit < 0 ? r.profit : null,
            row: r,
            itemStyle: { color: '#FCA5A5', borderRadius: [4, 0, 0, 4] },
          })),
          label: {
            show: true,
            distance: 8,
            fontSize: 12,
            fontWeight: 700,
            formatter: (p: any) => `${moneyNum(p.data.row.profit)}`,
            color: '#991B1B',
            position: 'right',
            align: 'left',
          },
          markLine: {
            symbol: 'none',
            lineStyle: { color: '#94a3b8', type: 'solid' },
            label: { show: false },
            data: [{ xAxis: 0 }],
          },
        },
        {
          name: '盈利',
          type: 'bar',
          barMaxWidth: 20,
          barGap: '-100%',
          data: list.map((r) => ({
            value: r.profit >= 0 ? r.profit : null,
            row: r,
            itemStyle: { color: '#86EFAC', borderRadius: [0, 4, 4, 0] },
          })),
          label: {
            show: true,
            distance: 8,
            fontSize: 12,
            fontWeight: 700,
            formatter: (p: any) => `${moneyNum(p.data.row.profit)}`,
            color: '#166534',
            position: 'left',
            align: 'right',
          },
        },
      ],
      graphic: [{ type: 'text', left: 'center', bottom: 28, style: { text: `左 · 亏损 ${bottom.length}    0    右 · 盈利 ${top.length}`, fontSize: 12, fill: '#475569' } }],
    }
  },
  { immediate: true },
)

watch(
  [pcStoresActive, quadFilter],
  ([stores]) => {
    if (!stores.length) {
      quadOpt.value = null
      return
    }
    const avgX = stores.reduce((s, r) => s + r.turnover, 0) / stores.length
    const rates = stores.map((r) => r.profitRate || 0)
    const avgY = rates.reduce((s, v) => s + v, 0) / (rates.length || 1)
    const profits = stores.map((r) => Math.abs(r.profit))
    const maxP = Math.max(...profits, 1)
    const minX = Math.min(...stores.map((r) => r.turnover))
    const maxX = Math.max(...stores.map((r) => r.turnover))
    const minY = Math.min(...rates)
    const maxY = Math.max(...rates)
    const colorOf = (r: { turnover: number; profitRate: number | null }) => {
      const q = quadOf(r)
      if (q === 'star') return '#22C55E'
      if (q === 'blood') return '#EF4444'
      if (q === 'nice') return '#3B82F6'
      return '#FB923C'
    }
    const dimmed = (r: { turnover: number; profitRate: number | null }) =>
      quadFilter.value && quadOf(r) !== quadFilter.value ? 0.15 : 0.85
    quadOpt.value = {
      backgroundColor: '#F0FDF4',
      grid: { left: 56, right: 96, top: 12, bottom: 48 },
      tooltip: {
        formatter: (p: any) => {
          const r = p.data?.row
          return `${r?.store || p.name}<br/>${quadNames.value[quadOf(r)]}<br/>营收 ${moneyNum(p.value[0])} 元<br/>净利率 ${fmtPct(p.value[1])}<br/>净利润 ${moneyNum(r?.profit)} 元`
        },
      },
      xAxis: {
        type: 'value',
        name: '总营收(元)',
        nameLocation: 'middle',
        nameGap: 30,
        nameTextStyle: { fontSize: 11, color: '#475569' },
        min: minX,
        max: maxX,
        axisLabel: { fontSize: 10, color: '#475569' },
        splitLine: { lineStyle: { color: '#eef2f7' } },
      },
      yAxis: {
        type: 'value',
        name: '净利率',
        nameTextStyle: { fontSize: 11, color: '#475569' },
        min: minY,
        max: maxY,
        axisLabel: { formatter: (v: number) => `${(v * 100).toFixed(2)}%`, fontSize: 10, color: '#475569' },
        splitLine: { lineStyle: { color: '#eef2f7' } },
      },
      series: [{
        type: 'scatter',
        data: stores.map((r) => ({
          name: r.shortName,
          row: r,
          value: [r.turnover, r.profitRate || 0, r.profit],
          symbolSize: 14 + (Math.abs(r.profit) / maxP) * 14,
          itemStyle: { color: colorOf(r), opacity: dimmed(r) },
        })),
        markLine: {
          symbol: 'none',
          silent: true,
          lineStyle: { color: '#94a3b8', type: 'dashed' },
          label: { show: false },
          data: [{ xAxis: avgX }, { yAxis: avgY }, { yAxis: 0, lineStyle: { color: '#94a3b8', type: 'solid' } }],
        },
      }],
    }
  },
  { immediate: true },
)

watch(
  [bloodRows, rankUnit],
  ([rows, unit]) => {
    if (!rows.length) {
      bloodOpt.value = null
      return
    }
    const maxV = Math.max(...rows.map((r) => r.turnover), ...rows.map((r) => Math.abs(r.profit)), 1)
    bloodOpt.value = {
      grid: { left: 10, right: 118, top: 12, bottom: 24, containLabel: true },
      tooltip: {
        trigger: 'item',
        formatter: (p: any) => {
          const r = p.data?.row
          return `${r.store}<br/>总营收 ${moneyNum(r.turnover)} 元<br/>净利润 ${moneyNum(r.profit)} 元<br/>净利率 ${fmtPct(r.profitRate)} · 补贴率 ${fmtPct(r.subsidyRate)}`
        },
      },
      xAxis: { type: 'value', max: maxV * 1.05, axisLabel: { show: false }, splitLine: { lineStyle: { color: '#eef2f7' } } },
      yAxis: { type: 'category', data: [...rows].reverse().map((r) => r.shortName), axisLabel: { fontSize: 11, color: '#334155' } },
      series: [
        {
          name: '总营收',
          type: 'bar',
          barGap: '18%',
          barMaxWidth: 12,
          data: [...rows].reverse().map((r) => ({ value: r.turnover, row: r, itemStyle: { color: '#60A5FA', borderRadius: 4 } })),
          label: { show: true, position: 'right', fontSize: 10, color: '#334155', formatter: (p: any) => moneyNum(p.data.row.turnover) },
        },
        {
          name: '净利润',
          type: 'bar',
          barMaxWidth: 12,
          data: [...rows].reverse().map((r) => ({ value: Math.abs(r.profit), row: r, itemStyle: { color: r.profit < 0 ? '#ef4444' : '#f59e0b', borderRadius: 4 } })),
          label: { show: true, position: 'right', fontSize: 10, color: '#7f1d1d', formatter: (p: any) => `${moneyNum(p.data.row.profit)} · ${fmtPct(p.data.row.subsidyRate)}` },
        },
      ],
    }
  },
  { immediate: true },
)

watch(
  [waterSteps],
  ([steps]) => {
    if (!steps.length) {
      incomeOpt.value = null
      return
    }
    let acc = 0
    const assist: number[] = []
    const mains: any[] = []
    steps.forEach((s: any) => {
      let color = '#f59e0b'
      if (s.kind === 'base') {
        assist.push(0)
        mains.push({ value: s.raw, display: s.display, shareText: s.shareText, itemStyle: { color: '#2563eb', borderRadius: [4, 4, 0, 0] } })
        acc = s.raw
      } else if (s.kind === 'subtotal') {
        assist.push(0)
        mains.push({ value: s.raw, display: s.display, shareText: s.shareText, itemStyle: { color: '#0ea5e9', borderRadius: [4, 4, 0, 0] } })
        acc = s.raw
      } else if (s.kind === 'end') {
        assist.push(0)
        mains.push({ value: s.raw, display: s.display, shareText: s.shareText, itemStyle: { color: s.raw >= 0 ? '#00b86b' : '#ef4444', borderRadius: [4, 4, 0, 0] } })
        acc = s.raw
      } else {
        const before = acc
        const after = acc + s.raw
        assist.push(Math.min(before, after))
        color = s.kind === 'up' ? '#00b86b' : '#ef4444'
        mains.push({ value: Math.abs(s.raw), display: s.display, shareText: s.shareText, raw: s.raw, itemStyle: { color, borderRadius: [4, 4, 0, 0] } })
        acc = after
      }
    })
    incomeOpt.value = {
      grid: { left: 64, right: 16, top: 16, bottom: 64 },
      tooltip: {
        trigger: 'item',
        formatter: (p: any) => {
          if (p.seriesName === '辅助') return ''
          return `${p.name}<br/>${moneyNum(p.data?.display ?? p.value)} 元 · ${p.data?.shareText || ''}`
        },
      },
      xAxis: {
        type: 'category',
        data: steps.map((s: any) => s.name),
        axisLabel: { interval: 0, rotate: 24, fontSize: 10, color: '#475569' },
        axisLine: { lineStyle: { color: '#cbd5e1' } },
      },
      yAxis: {
        type: 'value',
        name: '金额(元)',
        nameTextStyle: { fontSize: 11, color: '#475569' },
        axisLabel: { fontSize: 10, color: '#475569' },
        splitLine: { lineStyle: { color: '#eef2f7' } },
      },
      series: [
        { name: '辅助', type: 'bar', stack: 'water', data: assist, itemStyle: { color: 'transparent', borderColor: 'transparent' }, silent: true },
        {
          name: '瀑布',
          type: 'bar',
          stack: 'water',
          barMaxWidth: 34,
          data: mains,
          label: {
            show: true,
            position: 'top',
            distance: 6,
            fontSize: 9,
            lineHeight: 13,
            color: '#334155',
            formatter: (p: any) => `${moneyNum(p.data.display)}\n${p.data.shareText}`,
          },
        },
      ],
    }
  },
  { immediate: true },
)

watch(
  [pcStoresActive],
  ([stores]) => {
    if (!stores.length) {
      subOpt.value = null
      return
    }
    const xs = stores.map((r) => r.subsidyRate || 0)
    const ys = stores.map((r) => r.profitRate || 0)
    const n = stores.length
    const mx = xs.reduce((s, v) => s + v, 0) / n
    const my = ys.reduce((s, v) => s + v, 0) / n
    const cov = xs.reduce((s, x, i) => s + (x - mx) * ((ys[i] ?? 0) - my), 0)
    const varX = xs.reduce((s, x) => s + (x - mx) * (x - mx), 0) || 1
    const slope = cov / varX
    const intercept = my - slope * mx
    const minX = Math.min(...xs)
    const maxX = Math.max(...xs)
    /** 对数轴要求 min > 0：取最小正值向下取整到数量级，避免 0 值导致轴失效 */
    const minPos = Math.min(...xs.filter((v) => v > 0), 0.005)
    const logMin = Math.pow(10, Math.floor(Math.log10(Math.max(minPos, 1e-4))))
    subOpt.value = {
      backgroundColor: '#FFFFFF',
      grid: { left: 52, right: 16, top: 24, bottom: 44 },
      tooltip: {
        formatter: (p: any) => {
          if (p.seriesName === '拟合线') return `拟合：净利率 ≈ ${(slope * 100).toFixed(2)}%×补贴率 ${fmtPct(intercept)}`
          const r = p.data?.row
          return `${r?.store}<br/>补贴率 ${fmtPct(r?.subsidyRate ?? p.value[0])}<br/>净利率 ${fmtPct(p.value[1])}`
        },
      },
      xAxis: { type: 'log', logBase: 10, min: logMin, name: '补贴率(对数轴)', nameTextStyle: { fontSize: 11, color: '#475569' }, axisLabel: { formatter: (v: number) => `${(v * 100).toFixed(v < 0.1 ? 1 : 0)}%`, fontSize: 10, color: '#72767d' } },
      yAxis: { type: 'value', name: '净利率', nameTextStyle: { fontSize: 11, color: '#475569' }, axisLabel: { formatter: (v: number) => `${(v * 100).toFixed(2)}%`, fontSize: 10, color: '#72767d' } },
      series: [
        {
          type: 'scatter',
          data: stores.map((r) => ({
            name: r.shortName,
            row: r,
            value: [Math.max(r.subsidyRate || 0, logMin), r.profitRate || 0],
            symbolSize: 12,
            itemStyle: { color: (r.profitRate || 0) < 0 ? '#ef4444' : (r.profitRate || 0) > 0.1 ? '#00b86b' : '#2563eb', opacity: 0.85 },
          })),
          markArea: {
            silent: true,
            itemStyle: { color: '#FEF2F2' },
            data: [[{ coord: [0.25, -0.3], symbol: 'none' }, { coord: [0.45, 0], symbol: 'none' }]],
            label: { show: true, position: 'inside', formatter: '高补贴低回报', color: '#b91c1c', fontSize: 11 },
          },
        },
        {
          name: '拟合线',
          type: 'line',
          showSymbol: false,
          lineStyle: { color: '#D1D5DB', type: 'dashed', width: 1.5 },
          data: [[minX, slope * minX + intercept], [maxX, slope * maxX + intercept]],
        },
      ],
    }
  },
  { immediate: true },
)

watch(
  [expenseAgg, paretoTotal],
  ([agg, total]) => {
    if (!total) {
      paretoOpt.value = null
      return
    }
    const rows = EXPENSE_PC_LABELS
      .map((c) => ({ label: c.label, value: agg[c.key] || 0 }))
      .sort((a, b) => b.value - a.value)
    let acc = 0
    const cum = rows.map((r) => {
      acc += r.value
      return total ? acc / total : 0
    })
    paretoOpt.value = {
      grid: { left: 56, right: 44, top: 24, bottom: 70 },
      tooltip: {
        trigger: 'axis',
        formatter: (params: any) => {
          const list = Array.isArray(params) ? params : [params]
          const idx = list[0]?.dataIndex ?? 0
          const row = rows[idx]
          if (!row) return ''
          const rate = cum[idx] ?? 0
          return `${row.label}<br/>金额 ${moneyNum(row.value)} 元<br/>累计 ${(rate * 100).toFixed(2)}%`
        },
      },
      xAxis: { type: 'category', data: rows.map((r) => r.label), axisLabel: { interval: 0, rotate: 26, fontSize: 10, color: '#475569' } },
      yAxis: [
        { type: 'value', name: '金额(元)', nameTextStyle: { fontSize: 11, color: '#475569' }, axisLabel: { formatter: (v: number) => Number(v).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), fontSize: 10, color: '#72767d' } },
        { type: 'value', max: 1, axisLabel: { formatter: (v: number) => `${(v * 100).toFixed(2)}%`, fontSize: 10, color: '#72767d' } },
      ],
      series: [
        { type: 'bar', barMaxWidth: 26, data: rows.map((r) => Math.round(r.value * 100) / 100), itemStyle: { color: '#7DD3FC', borderRadius: [6, 6, 0, 0] } },
        { type: 'line', yAxisIndex: 1, smooth: true, data: cum.map((v) => Math.round(v * 10000) / 10000), itemStyle: { color: '#4B5563' }, lineStyle: { color: '#4B5563', width: 2 }, symbolSize: 6 },
        { type: 'line', yAxisIndex: 1, showSymbol: false, lineStyle: { color: '#FDBA74', type: 'dashed', width: 1.5 }, markLine: { symbol: 'none', lineStyle: { color: '#FDBA74', type: 'dashed', width: 1.5 }, data: [{ yAxis: 0.8, label: { formatter: '80%', color: '#C2410C', fontSize: 10 } }] }, data: [] },
      ],
    }
  },
  { immediate: true },
)

/** 条形长度 = 负毛利总额绝对值；颜色 = 负毛利占比（浅橙→深橙） */
function negOrange(rate: number | null) {
  const t = Math.min(1, Math.max(0, (rate || 0) / 0.8))
  const from = [254, 215, 170]
  const to = [234, 88, 12]
  const rgb = from.map((c, i) => Math.round(c + ((to[i] ?? c) - c) * t))
  return `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`
}

watch([negativeRankRows], ([rows]) => {
    if (!rows.length) {
      negativeRankOpt.value = null
      return
    }
    const plotRows = [...rows].reverse()
    const maxAbs = Math.max(...rows.map((r) => Math.abs(Number(r.loss || 0))), 1)
    negativeRankOpt.value = {
      grid: { left: 92, right: 96, top: 14, bottom: 12, containLabel: false },
      tooltip: {
        trigger: 'item',
        formatter: (p: any) => {
          const r = p.data?.row
          if (!r) return p.name
          return `${r.store}<br/>负毛利总额 ${r.loss == null ? '—' : `${moneyNum(r.loss)} 元`}<br/>负毛利占比 ${fmtPct(r.negRate)}`
        },
      },
      xAxis: {
        type: 'value',
        min: 0,
        max: maxAbs * 1.32,
        axisLabel: { show: false },
        splitLine: { lineStyle: { color: '#eef2f7' } },
      },
      yAxis: {
        type: 'category',
        data: plotRows.map((r) => r.shortName || r.store),
        axisLabel: { fontSize: 11, color: '#334155', interval: 0 },
        axisTick: { show: false },
        axisLine: { show: false },
      },
      series: [
        {
          name: '负毛利总额',
          type: 'bar',
          barMaxWidth: 14,
          barCategoryGap: '42%',
          data: plotRows.map((r) => ({
            value: Math.round(Math.abs(Number(r.loss || 0)) * 100) / 100,
            row: r,
            itemStyle: { color: negOrange(r.negRate), borderRadius: [0, 4, 4, 0] },
          })),
          label: {
            show: true,
            distance: 8,
            fontSize: 10,
            fontWeight: 600,
            color: '#7c2d12',
            position: 'right',
            formatter: (p: any) => (p.data?.row?.loss == null ? '—' : `${moneyNum(p.data.row.loss)}元`),
          },
        },
      ],
    }
  },
  { immediate: true },
)

/** 负毛利门店卡片：按负毛利占比取前 8 家，进度条按卡片内最大值归一 */
const negCardRows = computed(() =>
  storeRows.value
    .filter((r) => r.negRate != null && r.negRate > 0)
    .sort((a, b) => (b.negRate || 0) - (a.negRate || 0))
    .slice(0, 8),
)
const negMax = computed(() => Math.max(...negCardRows.value.map((r) => r.negRate || 0), 0.01))
const gt3Max = computed(() => Math.max(...negCardRows.value.map((r) => r.gt3Rate || 0), 0.01))
function barWidth(v: number | null, max: number) {
  if (v == null || max <= 0) return '0%'
  return `${Math.min(100, Math.max(2, ((v / max) * 100)))}%`
}
/** 亏损绝对值的周比：扩大为 ↑ 红色，收窄为 ↓ 绿色 */
function absLossWow(row: { loss: number | null; lossWow: number | null }) {
  if (row.lossWow == null) return null
  return (row.loss || 0) < 0 ? -row.lossWow : row.lossWow
}
function adviceOf(row: { negRate: number | null; gt3Rate: number | null; dailyProfit: number; dailyProfitWow: number | null }) {
  const tips: string[] = []
  if ((row.negRate || 0) >= 0.3) tips.push('占比超30%立即核查定价与补贴')
  else if ((row.negRate || 0) >= 0.1) tips.push('占比超10%警戒线重点跟进')
  if ((row.gt3Rate || 0) >= 0.05) tips.push('大额亏损单偏多')
  if (row.dailyProfit < 0) tips.push('整体仍亏损')
  else if ((row.dailyProfitWow || 0) < -0.1) tips.push('日均毛利下滑明显')
  if (!tips.length) tips.push('保持监控')
  return tips.join('；')
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
        axisLabel: { formatter: (v: number) => fmtMoneyInUnit(v, unit, 2), color: '#72767d', fontSize: 10 },
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
            formatter: (p: any) => `${Number(p.percent).toFixed(2)}%`,
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
  return `${d >= 0 ? '+' : ''}${(d * 100).toFixed(2)}%`
}

/** 效能双轴组合：柱=绝对值（左轴），线=周比（右轴百分比） */
function effDuoOption(input: {
  rows: { store: string; shortName: string }[]
  barName: string
  lineName: string
  barValues: (number | null)[]
  lineValues: (number | null)[]
  barColor: string
  lineColor: string
  barTip: (i: number) => string
  lineTip: (i: number) => string
}) {
  const { rows, barName, lineName, barValues, lineValues, barColor, lineColor, barTip, lineTip } = input
  return {
    grid: { left: 44, right: 44, top: 34, bottom: 64, containLabel: true },
    legend: {
      top: 2,
      left: 'center',
      data: [barName, lineName],
      textStyle: { color: '#475569', fontSize: 11 },
    },
    tooltip: {
      trigger: 'axis',
      formatter: (ps: any) => {
        const list = Array.isArray(ps) ? ps : [ps]
        const i = list[0]?.dataIndex ?? 0
        const r = rows[i]
        if (!r) return ''
        return `${r.store}<br/>${barTip(i)}<br/>${lineTip(i)}`
      },
    },
    xAxis: {
      type: 'category',
      data: rows.map((r) => r.shortName || r.store),
      axisLabel: { interval: 0, rotate: 0, fontSize: 10, color: '#475569', overflow: 'truncate', width: 64 },
      axisTick: { show: false },
      axisLine: { lineStyle: { color: '#cbd5e1' } },
    },
    yAxis: [
      {
        type: 'value',
        axisLabel: { fontSize: 10, color: '#72767d' },
        splitLine: { lineStyle: { color: '#eef2f7' } },
      },
      {
        type: 'value',
        axisLabel: { formatter: (v: number) => `${(v * 100).toFixed(0)}%`, fontSize: 10, color: '#72767d' },
        splitLine: { show: false },
      },
    ],
    series: [
      {
        name: barName,
        type: 'bar',
        barMaxWidth: 18,
        data: barValues.map((v) => (v == null ? null : Math.round(v * 100) / 100)),
        itemStyle: { color: barColor, borderRadius: [6, 6, 0, 0] },
      },
      {
        name: lineName,
        type: 'line',
        yAxisIndex: 1,
        smooth: true,
        symbol: 'circle',
        symbolSize: 6,
        data: lineValues.map((v) => (v == null ? null : Math.round(v * 10000) / 10000)),
        lineStyle: { width: 2, color: lineColor },
        itemStyle: { color: lineColor },
      },
    ],
  }
}

watch(
  [effDuoRows],
  ([rows]) => {
    if (!rows.length) {
      effOrderOpt.value = null
      effProfitOpt.value = null
      return
    }
    effOrderOpt.value = effDuoOption({
      rows,
      barName: '日均订单',
      lineName: '订单周比',
      barValues: rows.map((r) => r.dailyOrders),
      lineValues: rows.map((r) => r.dailyOrdersWow),
      barColor: '#60A5FA',
      lineColor: '#F59E0B',
      barTip: (i) => `日均订单 ${Number(rows[i]?.dailyOrders || 0).toFixed(2)}`,
      lineTip: (i) => `订单周比 ${wowParen(rows[i]?.dailyOrdersWow)}`,
    })
    effProfitOpt.value = effDuoOption({
      rows,
      barName: '返后日均毛利',
      lineName: '毛利周比',
      barValues: rows.map((r) => r.dailyProfit),
      lineValues: rows.map((r) => r.dailyProfitWow),
      barColor: '#34D399',
      lineColor: '#7C6CF0',
      barTip: (i) => `返后日均毛利 ${Number(rows[i]?.dailyProfit || 0).toFixed(2)} 元`,
      lineTip: (i) => `毛利周比 ${wowParen(rows[i]?.dailyProfitWow)}`,
    })
  },
  { immediate: true },
)

function ptsText(d: number | null | undefined) {
  if (d == null) return '—'
  return `${d >= 0 ? '+' : ''}${(d * 100).toFixed(2)}%`
}
function wowParen(d: number | null | undefined) {
  if (d == null || Number.isNaN(d)) return '(—)'
  if (d === 0) return '(0%)'
  const arrow = d > 0 ? '↑' : '↓'
  return `(${arrow}${Math.abs(d * 100).toFixed(2)}%)`
}
</script>

<style scoped lang="scss">
.pc-fallback-hint {
  margin: 0 0 12px;
  padding: 8px 12px;
  border-radius: 8px;
  background: rgba(255, 185, 0, 0.12);
  border: 1px solid rgba(255, 185, 0, 0.35);
  color: #8a5a00;
  font-size: 13px;
}
.profit-tabs {
  position: relative;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  margin: 0 0 12px;
  padding: 0;
  border: 0;
  border-radius: 0;
  background: transparent;
  box-shadow: none;

  button {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    min-width: 0;
    min-height: 58px;
    padding: 8px 18px;
    border: 1px solid #eef2f7;
    border-radius: 12px;
    background: #fff;
    color: #64748b;
    cursor: pointer;
    box-shadow: 0 1px 2px rgba(15, 23, 42, .04);
    transition: color .18s ease, background-color .18s ease, box-shadow .18s ease, border-color .18s ease;

    & + button::before {
      display: none;
    }

    &:hover:not(.active) {
      color: #334155;
      background: rgba(255, 255, 255, .62);
    }

    &:focus-visible {
      outline: 2px solid #f59e0b;
      outline-offset: -2px;
    }

    &.active {
      z-index: 1;
      color: #92400e;
      background: #fff;
      border-color: #fde9c8;
      box-shadow: 0 2px 10px rgba(15, 23, 42, .08), inset 0 -3px 0 #f59e0b;

      &::before { display: none; }
      & + button::before { display: none; }

      .tab-index {
        color: #fff;
        border-color: #f59e0b;
        background: #f59e0b;
      }

      .tab-copy small { color: #a16207; }
    }
  }
}
.tab-index {
  display: grid;
  flex: 0 0 30px;
  width: 30px;
  height: 30px;
  place-items: center;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  color: #94a3b8;
  background: #fff;
  font-family: var(--ck-font-num);
  font-size: 11px;
  font-weight: 800;
  line-height: 1;
  transition: inherit;
}
.tab-copy {
  display: grid;
  min-width: 0;
  gap: 3px;
  text-align: left;

  b {
    overflow: hidden;
    font-size: 14px;
    font-weight: 800;
    line-height: 1.2;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  small {
    overflow: hidden;
    color: #94a3b8;
    font-size: 11px;
    font-weight: 500;
    line-height: 1.2;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}
@media (max-width: 720px) {
  .profit-tabs {
    button { min-height: 48px; padding: 7px 8px; gap: 7px; }
  }
  .tab-index { display: none; }
  .tab-copy {
    text-align: center;
    small { display: none; }
  }
}
.analysis-grid {
  display: grid;
  grid-template-columns: 1.25fr .9fr .9fr;
  gap: 12px;
  align-items: stretch;
  margin-top: 12px;
  .ck-card { min-width: 0; }
}
.analysis-grid--balance { grid-template-columns: 1.15fr 1fr .85fr; }
.metric-list, .waterfall-list { list-style: none; margin: 0; padding: 8px 0; display: grid; gap: 9px; }
.metric-list li, .waterfall-list li { display: grid; grid-template-columns: minmax(0, 1fr) auto auto; gap: 10px; align-items: center; padding: 8px 10px; border-bottom: 1px solid #eef2f7; color: #475569; font-size: 12px; }
.metric-list b, .waterfall-list b { color: #1f2937; font-family: var(--ck-font-num); font-variant-numeric: tabular-nums; }
.metric-list em { min-width: 48px; color: #64748b; font-style: normal; text-align: right; }
.waterfall-list li.base, .waterfall-list li.end { font-weight: 800; background: #f8fbff; }
.waterfall-list li.down b { color: #ef4444; }
.waterfall-list li.subtotal b { color: #2563eb; }
.data-note { padding: 12px; border: 1px solid #dbeafe; border-radius: 8px; background: #f8fbff; color: #64748b; font-size: 12px; line-height: 1.7; }
@media (max-width: 1100px) {
  .analysis-grid, .analysis-grid--balance { grid-template-columns: 1fr; }
}
.mid-row,
.bottom-row {
  display: grid;
  gap: 12px;
  align-items: stretch;
  flex: 0 0 auto !important;
  width: 100%;
  margin-top: 12px;
  :deep(.ck-card) {
    min-height: 0;
    min-width: 0;
  }
}
/* 中排：瀑布 | 负毛利结构（结构略放大） */
.mid-row {
  grid-template-columns: minmax(0, 1.25fr) minmax(0, 1.15fr);
}
/* 底排：一行两个模块，顶部对齐 */
.bottom-row {
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  column-gap: 12px;
  align-items: start;
}
.plot-compact {
  min-height: 168px !important;
  height: 168px;
}
.plot-medium {
  min-height: 240px !important;
  height: 240px;
}
.plot-tall {
  min-height: 250px !important;
  height: 250px;
}
/* 四象限图：第一行略压矮，与右侧联动图对齐 */
.plot-quad {
  min-height: 220px !important;
  height: 220px;
}
.plot-negative-rank {
  min-height: 340px !important;
  height: 340px;
  overflow: visible;
}
.plot-eff {
  min-height: 260px !important;
  height: 260px;
}
.negative-rank-card {
  overflow: visible;
}
.negative-rank-card .ck-plot {
  overflow: visible;
}
.negative-rank-list {
  list-style: none;
  margin: 4px 0 0;
  padding: 8px 2px 2px;
  display: grid;
  gap: 6px;
  border-top: 1px solid #eef2f7;
  li {
    display: grid;
    grid-template-columns: minmax(0, 86px) minmax(0, 1fr);
    gap: 8px;
    align-items: baseline;
    font-size: 11px;
    line-height: 1.5;
    color: #475569;
  }
  .rank-store {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: #1f2937;
    font-weight: 600;
  }
  .rank-meta {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
    color: #065f46;
  }
}
.neg-card-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  max-height: 420px;
  overflow: auto;
  padding-right: 2px;
}
.neg-card {
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  background: #fff;
  padding: 10px 12px;
  display: grid;
  gap: 7px;
  align-content: start;
  &.is-hot {
    border-color: #fecaca;
    background: #fff7f7;
  }
}
.neg-store {
  overflow: hidden;
  font-size: 13px;
  font-weight: 800;
  color: #1f2937;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.neg-line {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  font-size: 11px;
  color: #64748b;
  b {
    font-variant-numeric: tabular-nums;
    color: #1f2937;
    em { font-style: normal; }
  }
}
.neg-bar-row {
  display: grid;
  grid-template-columns: 64px minmax(0, 1fr) 52px;
  gap: 8px;
  align-items: center;
  font-size: 11px;
  color: #64748b;
  b {
    text-align: right;
    font-variant-numeric: tabular-nums;
    color: #1f2937;
  }
}
.neg-bar {
  display: block;
  height: 8px;
  border-radius: 999px;
  background: #f1f5f9;
  overflow: hidden;
  i {
    display: block;
    height: 100%;
    border-radius: 999px;
    background: #f87171;
  }
  &.neg-bar--amber i { background: #fbbf24; }
}
.neg-advice {
  border-top: 1px dashed #e5e7eb;
  padding-top: 6px;
  font-size: 11px;
  line-height: 1.6;
  color: #b91c1c;
  span { color: #64748b; }
}
@media (max-width: 720px) {
  .neg-card-grid { grid-template-columns: 1fr; }
}
.table-scroll--tall { max-height: 250px; }
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
.store-search--inline { width: 180px; margin: 0; }
.drill-row td {
  background: #f8fbff;
  font-size: 12px;
  color: #475569;
  line-height: 1.8;
  b { display: block; color: #1f2937; }
  span { display: block; }
}
.store-board-table tbody tr.is-bad td { background: #fef0f0; }
.store-board-table tbody tr.is-warn td { background: #fff8e6; }
.store-board-table tbody tr.is-mid td { background: #f8fafc; }
.store-board-table tbody tr.is-good td { background: #ecfdf3; }
.store-board-table tbody tr.is-zero td { color: #94a3b8; background: #f8fafc; }
.analysis-grid--half { grid-template-columns: 1fr 1fr; }
.analysis-grid--trio { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.analysis-grid--trend { grid-template-columns: 1.2fr .8fr .8fr; }
.plot-rank {
  min-height: 420px !important;
  height: 420px;
}
.plot-blood {
  min-height: 190px;
}
.quad-legend { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.quad-btn {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  gap: 10px;
  align-items: center;
  padding: 8px 10px;
  border: 1px solid transparent;
  border-bottom: 1px solid #eef2f7;
  border-radius: 8px;
  background: transparent;
  color: #475569;
  font-size: 12px;
  cursor: pointer;
  text-align: left;
  b { color: #1f2937; font-family: var(--ck-font-num); font-variant-numeric: tabular-nums; }
  em { min-width: 56px; color: #64748b; font-style: normal; text-align: right; }
  &:hover { background: #f8fbff; }
  &.active {
    border-color: #f59e0b;
    background: #fffbeb;
    box-shadow: inset 0 -2px 0 #f59e0b;
    em { color: #92400e; font-weight: 700; }
  }
}
.mini-btn { padding: 4px 10px; border: 1px solid #e2e8f0; border-radius: 999px; background: #fff; color: #475569; font-size: 12px; cursor: pointer; }
@media (max-width: 1100px) { .analysis-grid--half { grid-template-columns: 1fr; } }
@media (max-width: 1500px) { .analysis-grid--trio { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 1100px) { .analysis-grid--trio { grid-template-columns: 1fr; } }
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
