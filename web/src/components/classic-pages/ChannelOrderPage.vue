<!-- 中文名：渠道订单——对齐管理层版-v2 / 03；接 source1 渠道；小时/生命周期/异常原因留空 -->
<template>
  <div class="ck-page">
    <section class="ck-kpi-row">
      <ClassicKpi
        name="渠道贡献利润"
        :value="profitKpi.value"
        :unit="profitKpi.unit"
        :hints="kpiRatioHint(delta.profit)"
      />
      <ClassicKpi
        name="渠道利润率"
        :value="fmtPct(kpi.profitRate)"
        :hints="kpiPtsHint(delta.profitRate)"
      />
      <ClassicKpi
        name="有效订单"
        :value="kpi.orders != null ? formatInt(kpi.orders) : '—'"
        :hints="kpiRatioHint(delta.orders)"
      />
      <ClassicKpi
        name="单均贡献利润"
        :value="kpi.unitProfit != null ? kpi.unitProfit.toFixed(1) : '—'"
        unit="元"
        :hints="kpiRatioHint(delta.unitProfit)"
      />
      <ClassicKpi name="履约完成率" value="—" hint="数据未接入" />
      <ClassicKpi
        name="退款取消损失"
        value="—"
        :hints="[{ label: '退款率', value: fmtPct(kpi.refundRate) }]"
      />
    </section>

    <section class="ck-grid-midwide channel-grid">
      <article class="ck-card">
        <header class="ck-card__head">
          <h3>渠道贡献与质量对比</h3>
        </header>
        <div v-if="channelRows.length" class="ck-table-wrap">
          <table class="ck-table">
            <thead>
              <tr>
                <th>排名</th>
                <th>渠道</th>
                <th class="num">贡献利润（{{ profitUnit }}）</th>
                <th class="num">利润率</th>
                <th class="num">订单占比</th>
                <th class="num">单均贡献（元）</th>
                <th class="num">日比</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(row, i) in channelRows" :key="row.key">
                <td><span class="ck-rank" :class="i < 3 ? `is-${i + 1}` : ''">{{ i + 1 }}</span></td>
                <td class="name">{{ row.key }}</td>
                <td class="num">
                  <div class="profit-cell">
                    <b>{{ fmtMoneyInUnit(row.profit, profitUnit) }}</b>
                    <span class="bar-track" aria-hidden="true"><i :style="{ width: `${row.bar}%` }" /></span>
                  </div>
                </td>
                <td class="num">{{ fmtPct(row.profitRate) }}</td>
                <td class="num">{{ fmtPct(row.orderShare) }}</td>
                <td class="num">{{ row.unitProfit != null ? row.unitProfit.toFixed(1) : '—' }}</td>
                <td class="num" :class="toneOf(row.growth)">{{ ratioText(row.growth) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-else class="ck-empty"><b>暂无渠道数据</b></div>
      </article>
      <article class="ck-card">
        <header class="ck-card__head">
          <h3>小时订单趋势</h3>
          <p>今日</p>
        </header>
        <div class="ck-empty">
          <b>暂无小时订单</b>
          <span>当前数据源无小时粒度，模块留空</span>
        </div>
      </article>
      <article class="ck-card">
        <header class="ck-card__head"><h3>渠道订单质量</h3></header>
        <div v-if="channelRows.length" class="ck-table-wrap">
          <table class="ck-table">
            <thead>
              <tr>
                <th>渠道</th>
                <th class="num">履约完成率</th>
                <th class="num">取消率</th>
                <th class="num">退款率</th>
                <th class="num">客单价（元）</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in channelRows" :key="row.key">
                <td class="name">{{ row.key }}</td>
                <td class="num muted">—</td>
                <td class="num muted">—</td>
                <td class="num">{{ fmtPct(row.refundRate) }}</td>
                <td class="num">{{ row.arpu != null ? row.arpu.toFixed(1) : '—' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-else class="ck-empty"><b>暂无质量数据</b></div>
      </article>
    </section>

    <section class="ck-grid-midwide">
      <article class="ck-card">
        <header class="ck-card__head"><h3>订单生命周期</h3></header>
        <div class="ck-empty">
          <b>暂无生命周期漏斗</b>
          <span>下单→支付→接单→配送→完成 事件链未接入</span>
        </div>
      </article>
      <article class="ck-card">
        <header class="ck-card__head">
          <h3>异常城市 / 门店分布</h3>
        </header>
        <div class="ck-empty"><b>暂无履约异常分布</b><span>需要配送异常订单明细</span></div>
      </article>
      <article class="ck-card">
        <header class="ck-card__head">
          <h3>异常原因 TOP5</h3>
        </header>
        <div class="ck-empty">
          <b>暂无履约异常原因</b>
          <span>配送异常原因字段未接入</span>
        </div>
      </article>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import ClassicKpi from './ClassicKpi.vue'
import { useFilterStore } from '../../stores/filter'
import {
  aggregateSource1Kpi,
  deltaOf,
  previousDayRange,
  source1ByChannel,
} from '../../api/source1'
import { formatInt } from '../../utils/format'
import { fmtPct, fmtMoneyKpi, fmtMoneyInUnit, moneyUnitOf, toneOf, kpiRatioHint, kpiPtsHint } from '../../utils/classicHints'

const filter = useFilterStore()
const { periodRange, channel, cityQuery, storeQuery } = storeToRefs(filter)

const q = computed(() => ({
  from: periodRange.value.from,
  to: periodRange.value.to,
  channel: channel.value,
  store: storeQuery.value,
  city: cityQuery.value,
}))
const prevQ = computed(() => ({ ...q.value, ...previousDayRange(q.value.from, q.value.to) }))
const kpi = computed(() => aggregateSource1Kpi(q.value))
const delta = computed(() => deltaOf(kpi.value, aggregateSource1Kpi(prevQ.value)))
const profitKpi = computed(() => fmtMoneyKpi(kpi.value.profit))
const prevChannel = computed(() => new Map(source1ByChannel(prevQ.value).map((r) => [r.key, r])))
const channelRows = computed(() => {
  const rows = source1ByChannel(q.value).sort((a, b) => (b.profit || 0) - (a.profit || 0))
  const orderTotal = rows.reduce((a, r) => a + (r.orders || 0), 0) || 1
  const maxP = Math.max(...rows.map((r) => Math.abs(r.profit || 0)), 1)
  return rows.map((r) => {
    const prev = prevChannel.value.get(r.key)
    const growth =
      r.profit != null && prev?.profit != null && prev.profit !== 0
        ? (r.profit - prev.profit) / Math.abs(prev.profit)
        : null
    return {
      ...r,
      orderShare: (r.orders || 0) / orderTotal,
      growth,
      bar: Math.max(6, Math.round((Math.abs(r.profit || 0) / maxP) * 100)),
    }
  })
})
const profitUnit = computed(() => moneyUnitOf(channelRows.value.map((r) => r.profit)))

function ratioText(d: number | null | undefined) {
  if (d == null) return '—'
  return `${d >= 0 ? '+' : ''}${(d * 100).toFixed(1)}%`
}
function ptsText(d: number | null | undefined) {
  if (d == null) return '—'
  return `${d >= 0 ? '+' : ''}${(d * 100).toFixed(1)}%`
}
</script>

<style scoped lang="scss">
.profit-cell {
  display: grid;
  gap: 4px;
  justify-items: end;
  min-width: 72px;
  b {
    font-family: var(--ck-font-num);
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }
}
.bar-track {
  display: block;
  width: 72px;
  height: 4px;
  border-radius: 999px;
  background: #e5e7eb;
  overflow: hidden;
  i {
    display: block;
    height: 100%;
    border-radius: 999px;
    background: #93c5fd;
  }
}
.muted { color: #94a3b8; }
.is-green { color: #059669; }
.is-red { color: #dc2626; }
</style>
