<template>
  <div class="cost-composition">
    <div v-if="summary.chartReady" class="cost-ring" :style="{ background: gradient }" role="img" :aria-label="chartLabel">
      <div><strong>{{ percent(summary.expenses[0]?.share ?? null) }}</strong><span>商品成本占支出</span></div>
    </div>
    <div v-else class="cost-ring cost-ring--empty"><div><strong>—</strong><span>{{ summary.expense === 0 ? '暂无支出' : '构成暂不可用' }}</span></div></div>
    <ul>
      <li v-for="(item, i) in visibleRows" :key="item.key">
        <i :style="{ background: colors[i] }" aria-hidden="true" />
        <span>{{ item.label }}</span><b>{{ costMoney(item.value, 'wan') }}<small v-if="!item.complete && item.value !== null">*</small></b>
        <em>{{ percent(item.share) }}</em>
      </li>
    </ul>
  </div>
</template>
<script setup lang="ts">
import { computed } from 'vue'
import { costMoney, type CostSummary } from '../../utils/costAnalysis'
const props = defineProps<{ summary: CostSummary }>()
const colors = ['#3DDCFF', '#2F8CFF', '#FFE14A', '#2AFF9A', '#FF8A1F', '#FF3D5A']
const percent = (v: number | null) => v === null ? '—' : `${(v * 100).toFixed(1)}%`
const visibleRows = computed(() => props.summary.expenses.filter(r => r.key !== 'maintenance' || r.value !== 0))
const gradient = computed(() => {
  let offset = 0
  const stops = props.summary.expenses.map((r, i) => {
    const start = offset; offset += (r.share || 0) * 100
    return `${colors[i]} ${start}% ${offset}%`
  })
  return `conic-gradient(${stops.join(',')})`
})
const chartLabel = computed(() => props.summary.expenses.map(r => `${r.label} ${percent(r.share)}`).join('；'))
</script>
<style scoped lang="scss">
.cost-composition {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 22px;
  height: 100%;
  min-height: 0;
  padding: 0 8px 0 4px;
}
.cost-ring {
  flex: 0 0 auto;
  width: 112px;
  aspect-ratio: 1;
  border-radius: 50%;
  display: grid;
  place-items: center;
  margin-right: 4px;
}
.cost-ring > div {
  background: var(--panel-solid, var(--panel));
  border-radius: 50%;
  width: 76%;
  height: 76%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
}
.cost-ring strong { font: 700 22px/1 var(--font-num); color: var(--c-primary); }
.cost-ring span { font-size: 11px; color: var(--c-muted); text-align: center; line-height: 1.2; padding: 0 8px; }
.cost-ring--empty { background: var(--divider); }
ul {
  list-style: none;
  padding: 0 0 0 4px;
  margin: 0;
  flex: 1 1 auto;
  min-width: 0;
  max-width: 300px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 5px;
  overflow: auto;
  border-left: 1px solid rgba(94, 180, 255, 0.18);
}
li {
  display: grid;
  grid-template-columns: 8px minmax(0, 1fr) auto auto;
  align-items: center;
  gap: 6px 10px;
  min-height: 26px;
  font-size: 14px;
  color: var(--c-body);
}
li > i { width: 8px; height: 8px; border-radius: 1px; flex-shrink: 0; }
li > span { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
li b, li em {
  text-align: right;
  font: 650 15px/1 var(--font-num);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
li em { color: var(--c-muted); font-weight: 500; min-width: 3.2em; }
li small { color: var(--warn); }
</style>
