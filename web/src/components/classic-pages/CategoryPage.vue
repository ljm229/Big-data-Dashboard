<!-- 中文名：商品品类——对齐管理层版-v2 / 04；接 source1 品类/缺货；库存周转/矩阵增长留空 -->
<template>
  <div class="ck-page">
    <div class="ck-filterbar">
      <b>分析筛选</b>
      <span>{{ periodLabel }}</span>
      <span>{{ cityName }}</span>
      <span>{{ channel === '全部' ? '全部平台' : channel }}</span>
      <span>{{ selectedStore === '全部' ? '全部门店' : selectedStore }}</span>
      <span>{{ catMeta ? `${catMeta.from}～${catMeta.to}` : '全部品类' }}</span>
    </div>

    <section class="ck-kpi-row">
      <ClassicKpi
        name="品类销售额"
        :value="fmtMoneyKpi(salesTotal).value"
        :unit="fmtMoneyKpi(salesTotal).unit"
        :hint="catMeta ? `品类包 ${catMeta.from}～${catMeta.to}` : '暂无品类包'"
      />
      <ClassicKpi name="贡献利润率" value="—" hint="品类无毛利字段" />
      <ClassicKpi name="负贡献品类" value="—" hint="暂无品类毛利" />
      <ClassicKpi
        name="核心缺货影响门店"
        :value="stockStores.length ? String(stockStores.length) : '—'"
        :hints="[{ label: '缺货损失', value: stockStores.length ? fmtWan(stockLoss) : '—' }]"
      />
      <ClassicKpi name="库存周转天数" value="—" hint="暂无库存快照" />
      <ClassicKpi name="核心商品可售率" value="—" hint="无核心商品标识与可售分母" />
    </section>

    <section class="ck-grid-3">
      <article class="ck-card">
        <header class="ck-card__head">
          <h3>品类增长 × 利润矩阵</h3>
          <p>气泡大小 = 销售额</p>
        </header>
        <div class="ck-empty">
          <b>暂无增长×利润矩阵</b>
          <span>品类包无日比与毛利率字段，不造点</span>
        </div>
      </article>
      <article class="ck-card">
        <header class="ck-card__head">
          <h3>品类销售贡献 TOP10</h3>
          <p>暂无利润率</p>
        </header>
        <table v-if="topCats.length" class="ck-table">
          <thead>
            <tr>
              <th>排名</th>
              <th>品类</th>
              <th class="num">销售额（{{ catMoneyUnit }}）</th>
              <th class="num">订单</th>
              <th class="num">缺货损失（{{ catMoneyUnit }}）</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, i) in topCats" :key="row.name">
              <td><span class="ck-rank" :class="i < 3 ? `is-${i + 1}` : ''">{{ i + 1 }}</span></td>
              <td>{{ row.name }}</td>
              <td class="num">
                <div class="profit-cell">
                  <b>{{ fmtMoneyInUnit(row.sales, catMoneyUnit) }}</b>
                  <span class="bar-track" aria-hidden="true"><i :style="{ width: `${row.bar}%` }" /></span>
                </div>
              </td>
              <td class="num">{{ formatInt(row.orders) }}</td>
              <td class="num">{{ fmtMoneyInUnit(row.stockoutLoss, catMoneyUnit) }}</td>
            </tr>
          </tbody>
        </table>
        <div v-else class="ck-empty"><b>暂无品类销售</b><span>筛选期需与品类包区间有交集</span></div>
      </article>
      <article class="ck-card">
        <header class="ck-card__head"><h3>核心缺货影响</h3></header>
        <table v-if="stockByCat.length" class="ck-table">
          <thead>
            <tr><th>排名</th><th>品类</th><th>缺货次数</th><th class="num">预计影响（{{ catMoneyUnit }}）</th><th>记录状态</th></tr>
          </thead>
          <tbody>
            <tr v-for="(row, i) in stockByCat" :key="row.name">
              <td>{{ i + 1 }}</td>
              <td>{{ row.name }}</td>
              <td>{{ formatInt(row.stockoutTimes) }}</td>
              <td class="num">{{ fmtMoneyInUnit(row.stockoutLoss, catMoneyUnit) }}</td>
              <td><span class="ck-tag is-blue">有缺货记录</span></td>
            </tr>
          </tbody>
        </table>
        <div v-else class="ck-empty"><b>暂无品类缺货影响</b></div>
      </article>
    </section>

    <section class="ck-grid-3">
      <article class="ck-card">
        <header class="ck-card__head"><h3>库存效率趋势</h3></header>
        <div class="ck-empty"><b>暂无库存趋势</b><span>无库存金额/周转天数时间序列</span></div>
      </article>
      <article class="ck-card">
        <header class="ck-card__head">
          <h3>品类经营结构</h3>
          <p>单位：{{ catMoneyUnit }}</p>
        </header>
        <table v-if="topCats.length" class="ck-table">
          <thead>
            <tr><th>排名</th><th>品类</th><th>销量</th><th class="num">销售额（{{ catMoneyUnit }}）</th><th class="num">退款额（{{ catMoneyUnit }}）</th><th>同比</th></tr>
          </thead>
          <tbody>
            <tr v-for="(row, i) in topCats.slice(0, 8)" :key="`s-${row.name}`">
              <td>{{ i + 1 }}</td>
              <td>{{ row.name }}</td>
              <td>{{ formatInt(row.qty) }}</td>
              <td class="num">{{ fmtMoneyInUnit(row.sales, catMoneyUnit) }}</td>
              <td class="num">{{ fmtMoneyInUnit(row.refundAmt, catMoneyUnit) }}</td>
              <td class="muted">—</td>
            </tr>
          </tbody>
        </table>
        <div v-else class="ck-empty"><b>暂无结构表</b></div>
      </article>
      <article class="ck-card">
        <header class="ck-card__head"><h3>缺货分布 / 库存健康度</h3></header>
        <div v-if="stockStores.length" class="stock-panel">
          <ul>
            <li v-for="row in stockStores.slice(0, 6)" :key="row.store">
              <span>{{ shortStore(row.store) }}</span>
              <b>{{ fmtPct(row.attendance) }}</b>
              <em>{{ fmtWan(row.absentLoss) }}</em>
            </li>
          </ul>
          <div class="health">
            <span>受影响门店出勤均值<b>{{ fmtPct(attendance) }}</b></span>
            <em>仅展示原始供给指标</em>
          </div>
        </div>
        <div v-else class="ck-empty"><b>暂无缺货分布</b></div>
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
  source1ByCategory,
  source1CategoryMeta,
  source1StockoutStores,
} from '../../api/source1'
import { formatInt } from '../../utils/format'
import { fmtPct, fmtWan, fmtMoneyKpi, fmtMoneyInUnit, moneyUnitOf } from '../../utils/classicHints'

const filter = useFilterStore()
const { periodRange, channel, cityQuery, storeQuery, cityName, selectedStore } = storeToRefs(filter)

const q = computed(() => ({
  from: periodRange.value.from,
  to: periodRange.value.to,
  channel: channel.value,
  store: storeQuery.value,
  city: cityQuery.value,
}))

const catMeta = computed(() => source1CategoryMeta())
const cats = computed(() => source1ByCategory(q.value))
const salesTotal = computed(() => {
  if (!cats.value.length) return null
  return cats.value.reduce((a, r) => a + (r.sales || 0), 0)
})
const topCats = computed(() => {
  const max = Math.max(...cats.value.map((r) => r.sales || 0), 1)
  return cats.value.slice(0, 10).map((r) => ({
    ...r,
    bar: Math.max(8, Math.round(((r.sales || 0) / max) * 100)),
  }))
})
const catMoneyUnit = computed(() =>
  moneyUnitOf(topCats.value.flatMap((r) => [r.sales, r.refundAmt])),
)
const stockByCat = computed(() =>
  [...cats.value]
    .filter((r) => (r.stockoutLoss || 0) > 0 || (r.stockoutTimes || 0) > 0)
    .sort((a, b) => (b.stockoutLoss || 0) - (a.stockoutLoss || 0))
    .slice(0, 8)
    .map((r) => ({ ...r })),
)

const stockStores = computed(() => source1StockoutStores(q.value).filter((r) => r.stockout > 0 || r.absentLoss > 0))
const stockLoss = computed(() => stockStores.value.reduce((a, r) => a + (r.absentLoss || 0), 0))
const attendance = computed(() => {
  const vals = stockStores.value.map((r) => r.attendance).filter((v): v is number => v != null)
  if (!vals.length) return null
  return vals.reduce((a, b) => a + b, 0) / vals.length
})

const periodLabel = computed(() =>
  periodRange.value.from === periodRange.value.to
    ? periodRange.value.to
    : `${periodRange.value.from}～${periodRange.value.to}`,
)

function shortStore(name: string) {
  return String(name || '').replace(/^淘宝闪购-?/, '').slice(0, 12)
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
  background: #e8eef5;
  overflow: hidden;
  i {
    display: block;
    height: 100%;
    border-radius: 999px;
    background: #93c5fd;
  }
}
.muted { color: #94a3b8; }
.stock-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
  flex: 1;
  ul {
    margin: 0;
    padding: 0;
    list-style: none;
    display: grid;
    gap: 8px;
  }
  li {
    display: grid;
    grid-template-columns: 1fr auto auto;
    gap: 10px;
    font-size: 12px;
    color: #64748b;
    b { color: var(--ck-text); font-weight: var(--ck-fw-title); font-family: var(--ck-font-num); font-variant-numeric: tabular-nums; }
    em { font-style: normal; color: #f59e0b; min-width: 56px; text-align: right; }
  }
}
.health {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  font-size: 13px;
  color: #334155;
  font-weight: 700;
  b { margin-left: 6px; color: var(--ck-text); font-size: var(--ck-fs-kpi); font-weight: var(--ck-fw-kpi); font-family: var(--ck-font-num); }
  em { font-style: normal; color: var(--ck-muted); font-size: var(--ck-fs-kpi-delta); font-weight: var(--ck-fw-medium); }
}
</style>
