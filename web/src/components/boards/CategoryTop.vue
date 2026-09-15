<!-- 品类销售贡献 TOP5：紧凑双行，避免五层信息挤爆高度 -->
<template>
  <Panel title="品类销售贡献 TOP5" :empty="!rows.length" empty-text="当前筛选下暂无淘宝闪购品类数据">
    <template #extra>
      <span class="unit">{{ metaTip }}</span>
    </template>
    <ol class="cat">
      <li v-for="(row, i) in rows" :key="row.name">
        <em :class="['rank', `r${Math.min(i, 3)}`]">{{ i + 1 }}</em>
        <div class="main">
          <div class="line">
            <b class="name" :title="row.name">{{ row.name }}</b>
            <div class="track" aria-hidden="true">
              <i :style="{ width: `${Math.max(row.share * 100, 6)}%`, background: colorOf(i) }" />
            </div>
            <span class="share">{{ shareText(row.share) }}</span>
          </div>
          <div class="meta">
            <span>缺货 {{ formatMoney(row.stockoutLoss) }}</span>
            <span>订单 {{ formatInt(row.orders) }}</span>
          </div>
        </div>
        <div class="sales">
          <strong>{{ formatMoney(row.sales) }}</strong>
        </div>
      </li>
    </ol>
  </Panel>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import Panel from '../Panel.vue'
import { useFilterStore } from '../../stores/filter'
import { source1ByCategory, source1CategoryMeta } from '../../api/source1'
import { formatInt, formatMoney } from '../../utils/format'

const COLORS = ['#3DDCFF', '#FFE14A', '#2AFF9A', '#2F8CFF', '#FF8A1F']
const filter = useFilterStore()
const { periodRange, cityQuery, storeQuery, channel } = storeToRefs(filter)
const meta = computed(() => source1CategoryMeta())
const metaTip = computed(() => {
  if (!meta.value) return '淘宝闪购 · 销售额'
  return `淘宝闪购 · 销售额 · ${meta.value.from.slice(5)}~${meta.value.to.slice(5)}`
})
const rows = computed(() => {
  const list = source1ByCategory({
    from: periodRange.value.from,
    to: periodRange.value.to,
    city: cityQuery.value,
    store: storeQuery.value,
    channel: channel.value,
  })
  const total = list.reduce((s, r) => s + (r.sales || 0), 0)
  return list.slice(0, 5).map((r) => ({ ...r, share: total ? r.sales / total : 0 }))
})
function shareText(share: number) {
  return `${(share * 100).toFixed(1)}%`
}
function colorOf(i: number) {
  return COLORS[i % COLORS.length]
}
</script>

<style scoped lang="scss">
.unit {
  color: var(--muted);
  font-size: 12px;
  white-space: nowrap;
}
.cat {
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  margin: 0;
  padding: 0;
  list-style: none;
  gap: 0;
}
li {
  flex: 1 1 0;
  min-height: 0;
  display: grid;
  grid-template-columns: 24px minmax(0, 1fr) 52px;
  gap: 8px;
  align-items: center;
  border-bottom: 1px solid var(--divider);
  padding: 4px 0;
  &:last-child { border-bottom: 0; }
}
.rank {
  width: 22px;
  height: 22px;
  display: grid;
  place-items: center;
  font: 700 12px/1 var(--font-num);
  color: var(--muted);
  background: rgba(33, 215, 255, 0.08);
  border: 1px solid var(--border);
}
.rank.r0 { color: #02162e; background: var(--accent-line); border-color: var(--accent-line); }
.rank.r1 { color: #fff; background: rgba(255, 210, 63, 0.28); border-color: #ffd23f; }
.rank.r2 { color: #fff; background: rgba(54, 226, 122, 0.22); border-color: #36e27a; }
.main {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.line {
  display: grid;
  grid-template-columns: 64px minmax(0, 1fr) 46px;
  gap: 6px;
  align-items: center;
  min-width: 0;
}
.name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #fff;
  font-size: 14px;
  font-weight: 700;
}
.track {
  min-width: 0;
  height: 8px;
  background: rgba(8, 40, 72, 0.9);
  border: 1px solid var(--border);
  i { display: block; height: 100%; }
}
.share {
  text-align: right;
  color: var(--primary-2);
  font: 650 13px/1 var(--font-num);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.meta {
  display: flex;
  gap: 10px;
  min-width: 0;
  color: #8aa3b8;
  font-size: 12px;
  line-height: 1.2;
  span {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}
.sales {
  text-align: right;
  strong {
    color: #fff;
    font: 700 17px/1 var(--font-num);
    font-variant-numeric: tabular-nums;
  }
}
</style>
