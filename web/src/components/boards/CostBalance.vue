<!-- 中文名：含后返毛利分析（替换原成本收支）—— KPI + 瀑布 + 影响因素，仅用 cost 源表 -->
<template>
  <Panel v-bind="$attrs" title="含后返毛利分析" class="margin-panel" :empty="empty">
    <div class="margin">
      <div class="margin__kpis">
        <div class="kpi">
          <em>预计毛利</em>
          <b>{{ wan(sourceProfit) }}</b>
        </div>
        <div class="kpi rebate">
          <em>平台后返</em>
          <b>{{ wan(rebate) }}</b>
        </div>
        <div class="kpi final">
          <em>含后返毛利</em>
          <b>{{ wan(finalProfit) }}</b>
        </div>
        <div class="kpi rate">
          <em>毛利率</em>
          <b>{{ pct(marginRate) }}</b>
        </div>
      </div>

      <div class="margin__mid">
        <div class="water" aria-label="毛利瀑布">
          <div
            v-for="(step, i) in waterfall"
            :key="step.id"
            class="water__step"
            :class="step.kind"
          >
            <span>{{ step.label }}</span>
            <b>{{ money(step.value) }}</b>
            <i v-if="i < waterfall.length - 1" aria-hidden="true">↓</i>
          </div>
        </div>

        <div class="factors">
          <header>
            <h4>影响因素 TOP</h4>
            <small>{{ deltaLabel }}成本率变化</small>
          </header>
          <template v-if="factorRows.length">
            <p class="factors__title">毛利变动原因</p>
            <ol>
              <li v-for="(f, i) in factorRows" :key="f.id">
                <em>{{ i + 1 }}.</em>
                <span>{{ f.label }}</span>
                <b :class="f.tone">{{ f.text }}</b>
              </li>
            </ol>
          </template>
          <p v-else class="factors__empty">{{ factorEmpty }}</p>

          <p class="factors__title">影响门店</p>
          <ul v-if="impactStores.length" class="stores">
            <li v-for="s in impactStores" :key="s.name">
              <span>{{ shortStore(s.name) }}</span>
              <b class="bad">{{ s.text }}</b>
            </li>
          </ul>
          <p v-else class="factors__empty">{{ storeEmpty }}</p>
        </div>
      </div>

      <footer class="margin__foot">
        <span>{{ shortRange }} · {{ summary.storeCount }} 家有数门店</span>
        <span>数据源1 · 翱象收支</span>
      </footer>
    </div>
  </Panel>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import Panel from '../Panel.vue'
import { useFilterStore } from '../../stores/filter'
import { costSummary } from '../../api/costSummary'
import { costMoney, type CostKey, type CostSummary } from '../../utils/costAnalysis'

defineOptions({ inheritAttrs: false })

const filter = useFilterStore()
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

const summary = computed(() => costSummary(currentFilter.value))
const previous = computed(() =>
  previousFilter.value ? costSummary(previousFilter.value) : null,
)
const deltaLabel = computed(() => filter.deltaLabel)
const empty = computed(() => !summary.value.rows.length)

const amt = (s: CostSummary, key: CostKey) => s.amounts[key].value

const onlineIncome = computed(() => amt(summary.value, 'onlineIncome'))
const sourceProfit = computed(() => amt(summary.value, 'sourceProfit'))
const rebate = computed(() => amt(summary.value, 'rebate'))
const finalProfit = computed(() => amt(summary.value, 'sourceProfitWithRebate'))
const delivery = computed(() => {
  const a = amt(summary.value, 'platformDelivery')
  const b = amt(summary.value, 'selfDelivery')
  if (a == null && b == null) return null
  return (a || 0) + (b || 0)
})
const marginRate = computed(() => {
  const profit = finalProfit.value
  const base = onlineIncome.value
  if (profit == null || base == null || base <= 0) return null
  return profit / base
})

type WaterStep = { id: string; label: string; value: number | null; kind: 'base' | 'down' | 'mid' | 'up' | 'final' }
const waterfall = computed<WaterStep[]>(() => [
  { id: 'online', label: '线上收入', value: onlineIncome.value, kind: 'base' },
  { id: 'goods', label: '商品成本', value: amt(summary.value, 'goodsCost'), kind: 'down' },
  { id: 'delivery', label: '配送费用', value: delivery.value, kind: 'down' },
  { id: 'commission', label: '佣金', value: amt(summary.value, 'commission'), kind: 'down' },
  { id: 'promo', label: '推广费用', value: amt(summary.value, 'promotion'), kind: 'down' },
  { id: 'profit', label: '预计毛利', value: sourceProfit.value, kind: 'mid' },
  { id: 'rebate', label: '平台后返', value: rebate.value, kind: 'up' },
  { id: 'final', label: '最终毛利', value: finalProfit.value, kind: 'final' },
])

function rateOf(s: CostSummary, num: number | null, denKey: 'onlineIncome' = 'onlineIncome') {
  const den = amt(s, denKey)
  if (num == null || den == null || den <= 0) return null
  return num / den
}

function deliveryOf(s: CostSummary) {
  const a = amt(s, 'platformDelivery')
  const b = amt(s, 'selfDelivery')
  if (a == null && b == null) return null
  return (a || 0) + (b || 0)
}

const factorRows = computed(() => {
  const cur = summary.value
  const prev = previous.value
  if (!prev || !prev.rows.length || !cur.rows.length) return []

  const defs: Array<{ id: string; label: string; cur: number | null; prev: number | null }> = [
    {
      id: 'goods',
      label: '商品成本率',
      cur: rateOf(cur, amt(cur, 'goodsCost')),
      prev: rateOf(prev, amt(prev, 'goodsCost')),
    },
    {
      id: 'delivery',
      label: '配送费用',
      cur: rateOf(cur, deliveryOf(cur)),
      prev: rateOf(prev, deliveryOf(prev)),
    },
    {
      id: 'commission',
      label: '佣金',
      cur: rateOf(cur, amt(cur, 'commission')),
      prev: rateOf(prev, amt(prev, 'commission')),
    },
    {
      id: 'promo',
      label: '推广费用',
      cur: rateOf(cur, amt(cur, 'promotion')),
      prev: rateOf(prev, amt(prev, 'promotion')),
    },
    {
      id: 'marketing',
      label: '活动费用',
      cur: rateOf(cur, amt(cur, 'marketing')),
      prev: rateOf(prev, amt(prev, 'marketing')),
    },
  ]

  return defs
    .map((d) => {
      if (d.cur == null || d.prev == null) return null
      const delta = d.cur - d.prev
      if (Math.abs(delta) < 0.0005) return null
      const pts = delta * 100
      const up = pts > 0
      return {
        id: d.id,
        label: d.label,
        delta: pts,
        text: `${up ? '↑' : '↓'}${Math.abs(pts).toFixed(2)}%`,
        tone: up ? 'bad' : 'good',
      }
    })
    .filter((x): x is NonNullable<typeof x> => !!x)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, 5)
})

const factorEmpty = computed(() =>
  !previous.value || !previous.value.rows.length
    ? `暂无${deltaLabel.value}对照，无法计算影响因素`
    : '本期成本率相对上期无明显变化',
)

const impactStores = computed(() => {
  const cur = summary.value
  const prev = previous.value
  if (!prev || !prev.rows.length || !cur.rows.length) return []

  const sumByStore = (rows: typeof cur.rows) => {
    const map = new Map<string, number>()
    for (const r of rows) {
      const v = r.sourceProfitWithRebate
      if (v == null || !Number.isFinite(v)) continue
      map.set(r.store, (map.get(r.store) || 0) + v)
    }
    return map
  }
  const curMap = sumByStore(cur.rows)
  const prevMap = sumByStore(prev.rows)
  const names = new Set([...curMap.keys(), ...prevMap.keys()])
  const list: Array<{ name: string; delta: number; text: string }> = []
  for (const name of names) {
    const a = curMap.get(name)
    const b = prevMap.get(name)
    if (a == null || b == null || !b) continue
    const delta = (a - b) / Math.abs(b)
    if (delta >= -0.01) continue
    list.push({
      name,
      delta,
      text: `${(delta * 100).toFixed(2)}%`,
    })
  }
  return list.sort((a, b) => a.delta - b.delta).slice(0, 5)
})

const storeEmpty = computed(() =>
  !previous.value || !previous.value.rows.length
    ? `暂无${deltaLabel.value}对照`
    : '未发现含后返毛利明显下滑门店',
)

const shortRange = computed(() =>
  filter.periodRange.from === filter.periodRange.to
    ? filter.periodRange.to.slice(5)
    : `${filter.periodRange.from.slice(5)}~${filter.periodRange.to.slice(5)}`,
)

function wan(n: number | null) {
  return n == null ? '—' : costMoney(n, 'wan') + '万'
}
function money(n: number | null) {
  return costMoney(n, 'yuan')
}
function pct(n: number | null) {
  return n == null ? '—' : `${(n * 100).toFixed(2)}%`
}
function shortStore(name: string) {
  return name.replace(/^淘宝便利店/, '').replace(/[（()）]/g, '')
}
</script>

<style scoped lang="scss">
.margin-panel :deep(.panel__body) {
  padding: 6px 10px 8px;
  min-width: 0;
  overflow: hidden;
}
.margin {
  height: 100%;
  min-height: 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
  overflow: hidden;
}
.margin__kpis {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0;
  flex-shrink: 0;
  border-bottom: 1px solid var(--divider);
  padding-bottom: 6px;
}
.kpi {
  min-width: 0;
  padding: 0 8px;
  border-right: 1px solid var(--divider);
  &:first-child { padding-left: 0; }
  &:last-child { border-right: 0; padding-right: 0; }
  em {
    display: block;
    color: var(--c-muted);
    font-size: 12px;
    font-style: normal;
  }
  b {
    display: block;
    margin-top: 3px;
    color: var(--c-primary);
    font: 700 20px/1.1 var(--font-num);
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  &.rebate b { color: var(--accent, #ffe14a); }
  &.final b { color: var(--success, #00f0a8); }
  &.rate b { color: var(--primary-2, #3ddcff); }
}
.margin__mid {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: 1.15fr 1fr;
  gap: 10px;
}
.water {
  min-width: 0;
  min-height: 0;
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding-right: 4px;
}
.water__step {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 4px 8px;
  border-radius: 4px;
  background: rgba(7, 40, 72, 0.55);
  span {
    color: var(--c-body);
    font-size: 12px;
  }
  b {
    color: #e8f3ff;
    font: 700 13px/1 var(--font-num);
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
  i {
    position: absolute;
    left: 50%;
    bottom: -9px;
    transform: translateX(-50%);
    color: rgba(148, 190, 230, 0.55);
    font-style: normal;
    font-size: 10px;
    line-height: 1;
    z-index: 1;
  }
  &.down {
    span { color: #ffb0a0; }
    b { color: #ff8a6a; }
  }
  &.up {
    span { color: #ffe08a; }
    b { color: #ffe14a; }
  }
  &.mid, &.final {
    background: rgba(0, 120, 140, 0.22);
    b { color: #6ef0c8; }
  }
  &.final {
    border: 1px solid rgba(0, 240, 168, 0.35);
  }
}
.factors {
  min-width: 0;
  min-height: 0;
  overflow: auto;
  padding-left: 8px;
  border-left: 1px solid var(--divider);
  header {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 6px;
    margin-bottom: 4px;
    h4 {
      margin: 0;
      color: var(--c-primary);
      font-size: 13px;
      font-weight: 750;
    }
    small {
      color: var(--c-muted);
      font-size: 10px;
    }
  }
}
.factors__title {
  margin: 6px 0 4px;
  color: #9bb4cc;
  font-size: 11px;
}
.factors__empty {
  margin: 4px 0 8px;
  color: #6f8aa8;
  font-size: 11px;
  line-height: 1.4;
}
ol {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 3px;
  li {
    display: grid;
    grid-template-columns: 16px 1fr auto;
    gap: 4px;
    align-items: center;
    font-size: 12px;
    color: #d7e8f8;
  }
  em {
    font-style: normal;
    color: #8aa4c0;
  }
  b {
    font: 700 12px/1 var(--font-num);
    &.bad { color: #ff6b82; }
    &.good { color: #6ef0c8; }
  }
}
.stores {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 3px;
  li {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    font-size: 12px;
    color: #d7e8f8;
  }
  b.bad {
    color: #ff6b82;
    font: 700 12px/1 var(--font-num);
  }
}
.margin__foot {
  flex-shrink: 0;
  display: flex;
  justify-content: space-between;
  gap: 8px;
  padding-top: 4px;
  border-top: 1px solid var(--divider);
  color: var(--c-muted);
  font-size: 11px;
  white-space: nowrap;
  span:first-child {
    overflow: hidden;
    text-overflow: ellipsis;
  }
}
</style>
