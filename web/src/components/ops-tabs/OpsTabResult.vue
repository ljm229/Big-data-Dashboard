<template>
  <div class="biz">
    <p v-if="loading" class="hint">加载中…</p>
    <p v-else-if="!report" class="hint">当前筛选下暂无经营数据</p>

    <template v-else>
      <section class="card">
        <div class="sec-head">
          <span class="no">1</span>
          经营结果周环比
          <em v-if="report.prevLabel">{{ report.weekLabel }} vs {{ report.prevLabel }}</em>
          <em v-else>{{ report.weekLabel }}</em>
        </div>
        <div class="kpi-grid">
          <div
            v-for="k in report.kpis"
            :key="k.key"
            class="kpi"
            :class="kpiTone(k)"
          >
            <div class="name">{{ k.name }}</div>
            <div class="val">{{ fmtKpiVal(k) }}</div>
            <div class="chg" :class="kpiDeltaClass(k)">{{ fmtKpiDelta(k) }}</div>
          </div>
        </div>
        <p class="note">{{ report.summaryNote }} · 有单门店 {{ report.activeStoreCnt }}/{{ report.storeCnt }}</p>
      </section>

      <div class="split">
        <section class="card">
          <div class="sec-head"><span class="no">2</span>贡献 Top5（实付增量）</div>
          <ul class="mini-list">
            <li v-for="(r, i) in report.topGain" :key="'g-' + r.name">
              <em>{{ i + 1 }}</em>
              <span>{{ r.name }}</span>
              <b :class="(r.deltaPaid || 0) >= 0 ? 'better' : 'worse'">{{ fmtMoneyDelta(r.deltaPaid) }}</b>
            </li>
            <li v-if="!report.topGain.length" class="empty">暂无环比</li>
          </ul>
        </section>
        <section class="card">
          <div class="sec-head"><span class="no">3</span>拖累 Top5（实付减量）</div>
          <ul class="mini-list">
            <li v-for="(r, i) in report.topDrag" :key="'d-' + r.name">
              <em>{{ i + 1 }}</em>
              <span>{{ r.name }}</span>
              <b :class="(r.deltaPaid || 0) >= 0 ? 'better' : 'worse'">{{ fmtMoneyDelta(r.deltaPaid) }}</b>
            </li>
            <li v-if="!report.topDrag.length" class="empty">暂无环比</li>
          </ul>
        </section>
      </div>

      <section class="card">
        <div class="sec-head">
          <span class="no">4</span>门店经营明细
          <div class="sorts">
            <button
              v-for="s in sortOptions"
              :key="s.key"
              type="button"
              :class="{ active: sortKey === s.key }"
              @click="sortKey = s.key"
            >
              {{ s.label }}
            </button>
          </div>
        </div>
        <div class="scroll">
          <table>
            <thead>
              <tr>
                <th class="lbl">门店</th>
                <th>城市</th>
                <th>实付</th>
                <th>环比Δ</th>
                <th>订单</th>
                <th>客单</th>
                <th>毛利</th>
                <th>毛利率</th>
                <th>退款率</th>
                <th>负毛利占比</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="r in sortedRows" :key="r.name">
                <td class="lbl">{{ r.name }}</td>
                <td>{{ r.city?.replace(/市$/, '') || '—' }}</td>
                <td>{{ fmtMoney(r.paid) }}</td>
                <td :class="(r.deltaPaid || 0) >= 0 ? 'better' : 'worse'">{{ fmtMoneyDelta(r.deltaPaid) }}</td>
                <td>{{ Math.round(r.orders) }}</td>
                <td>{{ fmtMoney(r.aov) }}</td>
                <td :class="{ worse: r.profit < 0 }">{{ fmtMoney(r.profit) }}</td>
                <td :class="{ worse: r.profitRate < 0 }">{{ (r.profitRate * 100).toFixed(1) }}%</td>
                <td :class="{ worse: r.refundRate > 0.1 }">{{ (r.refundRate * 100).toFixed(1) }}%</td>
                <td :class="{ worse: r.negProfitRate > 0.15 }">{{ (r.negProfitRate * 100).toFixed(1) }}%</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p class="note">负毛利订单明细仍回翱象下钻；本页只看门店汇总占比。</p>
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import {
  fetchStoreBusinessReport,
  type BizKpi,
  type StoreBusinessReport,
} from '../../api/opsDashboard'

const props = defineProps<{
  dateKey: string
  city: string
  storeId: string
}>()

const loading = ref(false)
const report = ref<StoreBusinessReport | null>(null)
const sortKey = ref<'paid' | 'deltaPaid' | 'profit' | 'profitRate' | 'negProfitRate'>('paid')

const sortOptions = [
  { key: 'paid' as const, label: '按实付' },
  { key: 'deltaPaid' as const, label: '按增量' },
  { key: 'profit' as const, label: '按毛利' },
  { key: 'profitRate' as const, label: '按毛利率' },
  { key: 'negProfitRate' as const, label: '按负毛利' },
]

const sortedRows = computed(() => {
  const rows = [...(report.value?.rows || [])]
  const k = sortKey.value
  return rows.sort((a, b) => {
    const av = Number(a[k] ?? -Infinity)
    const bv = Number(b[k] ?? -Infinity)
    if (k === 'deltaPaid' || k === 'profitRate' || k === 'profit' || k === 'paid') return bv - av
    return bv - av
  })
})

function fmtMoney(v: number) {
  if (!Number.isFinite(v)) return '—'
  if (Math.abs(v) >= 10000) return `${(v / 10000).toFixed(1)}万`
  return v.toFixed(0)
}

function fmtMoneyDelta(v: number | null) {
  if (v == null) return '—'
  const sign = v > 0 ? '+' : ''
  return `${sign}${fmtMoney(v)}`
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
    return `${sign}${k.delta.toFixed(2)}pp`
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

async function reload() {
  if (!props.dateKey) {
    report.value = null
    return
  }
  loading.value = true
  try {
    report.value = await fetchStoreBusinessReport(props.dateKey, props.city, props.storeId)
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
  gap: 12px;
  padding-bottom: 24px;
}
.hint {
  text-align: center;
  color: var(--ops-muted, #94a3b8);
  padding: 32px;
}
.card {
  background: var(--ops-surface, #fff);
  border-radius: var(--ops-radius, 10px);
  padding: 16px 18px;
  border: 1px solid var(--ops-border, #e8eaef);
}
.sec-head {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px 10px;
  font-size: 15px;
  font-weight: 800;
  color: var(--ops-text, #1f2937);
  margin-bottom: 12px;
  .no {
    display: inline-flex;
    width: 22px;
    height: 22px;
    border-radius: 6px;
    background: var(--ops-primary-soft, #eff6ff);
    color: var(--ops-primary, #3b82f6);
    align-items: center;
    justify-content: center;
    font-size: 12px;
    font-family: var(--ops-font-num, Rajdhani, monospace);
  }
  em {
    font-style: normal;
    font-size: 12px;
    font-weight: 600;
    color: var(--ops-muted, #94a3b8);
  }
}
.kpi-grid {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 10px;
}
.kpi {
  border: 1px solid var(--ops-border, #e8eaef);
  border-radius: 10px;
  padding: 12px;
  background: var(--ops-info-bg, #eff6ff);
  &.fail {
    background: var(--ops-bad-bg, #fef2f2);
    border-color: #fecaca;
  }
  .name {
    font-size: 12px;
    color: var(--ops-muted, #94a3b8);
    font-weight: 600;
  }
  .val {
    margin-top: 6px;
    font-size: 20px;
    font-weight: 800;
    font-family: var(--ops-font-num, Rajdhani, monospace);
    color: var(--ops-num, #0f172a);
  }
  .chg {
    margin-top: 4px;
    font-size: 12px;
    font-weight: 700;
    font-family: var(--ops-font-num, Rajdhani, monospace);
  }
}
.split {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.mini-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  li {
    display: grid;
    grid-template-columns: 24px 1fr auto;
    gap: 8px;
    align-items: center;
    padding: 8px 10px;
    border-radius: 8px;
    background: #f8fafc;
    font-size: 13px;
  }
  em {
    font-style: normal;
    font-weight: 800;
    color: var(--ops-muted, #94a3b8);
    font-family: var(--ops-font-num, Rajdhani, monospace);
  }
  b {
    font-family: var(--ops-font-num, Rajdhani, monospace);
  }
  .empty {
    display: block;
    color: var(--ops-muted, #94a3b8);
    background: transparent;
  }
}
.sorts {
  margin-left: auto;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  button {
    border: 1px solid var(--ops-border, #e8eaef);
    background: #fff;
    color: var(--ops-muted, #94a3b8);
    border-radius: 6px;
    padding: 4px 8px;
    font-size: 12px;
    cursor: pointer;
    &.active {
      background: #1e293b;
      border-color: #1e293b;
      color: #fff;
      font-weight: 700;
    }
  }
}
.scroll {
  overflow-x: auto;
}
table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
  th,
  td {
    padding: 8px 10px;
    text-align: center;
    border-bottom: 1px solid var(--ops-border-soft, #f0f2f5);
    font-variant-numeric: tabular-nums;
    font-family: var(--ops-font-num, Rajdhani, monospace);
  }
  td.lbl,
  th.lbl {
    font-family: var(--ops-font, inherit);
    text-align: left;
    font-weight: 600;
  }
  thead th {
    background: #f8fafc;
    color: var(--ops-muted, #94a3b8);
    font-size: 12px;
    font-family: var(--ops-font, inherit);
  }
}
.better {
  color: var(--ops-ok, #10b981);
}
.worse {
  color: var(--ops-bad, #ef4444);
}
.flat {
  color: var(--ops-muted, #94a3b8);
}
.note {
  margin: 10px 0 0;
  font-size: 12px;
  color: var(--ops-muted, #94a3b8);
  line-height: 1.6;
}
@media (max-width: 1280px) {
  .kpi-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
  .split {
    grid-template-columns: 1fr;
  }
}
</style>
