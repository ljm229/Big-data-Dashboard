<!-- 平台渠道毛利贡献：横向条形图（条内短写，完整金额见悬停） -->
<template>
  <Panel title="平台渠道毛利贡献" :empty="empty">
    <template #extra>
      <span class="unit-hint">金额：元 · ≥1万简写万</span>
    </template>
    <div class="chart" role="list" aria-label="平台渠道毛利贡献">
      <div class="head" aria-hidden="true">
        <span class="spacer" />
        <span class="col-bar">毛利</span>
        <span class="col-rate">毛利率</span>
        <span class="col-delta">日比</span>
      </div>
      <div class="body">
        <button
          v-for="row in rows"
          :key="row.key"
          type="button"
          class="item"
          role="listitem"
          :class="{ active: channel === row.key }"
          :aria-pressed="channel === row.key"
          :title="`${row.key} 毛利 ${formatMoney(row.profit)}`"
          @click="toggle(row.key)"
        >
          <span class="name">
            <i :style="{ background: colorOf(row.key) }">{{ badgeOf(row.key) }}</i>
            {{ shortName(row.key) }}
          </span>
          <div class="track">
            <div
              class="bar"
              :class="{ light: isLight(row.key), outside: barPct(row) < 22 }"
              :style="{ width: `${barPct(row)}%`, background: colorOf(row.key) }"
            >
              <em v-if="barPct(row) >= 22">{{ compactMoney(row.profit) }}</em>
            </div>
            <em v-if="barPct(row) < 22" class="bar-val">{{ compactMoney(row.profit) }}</em>
            <span class="dash" aria-hidden="true" />
          </div>
          <span class="rate">{{ formatPercent(row.profitRate) }}</span>
          <strong class="delta" :class="deltaClass(row.delta)">
            <span class="arrow" aria-hidden="true">{{ deltaArrow(row.delta) }}</span>
            {{ deltaText(row.delta) }}
          </strong>
        </button>
      </div>
    </div>
  </Panel>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import Panel from '../Panel.vue'
import { useFilterStore } from '../../stores/filter'
import { previousDayRange, source1ByChannel } from '../../api/source1'
import { formatMoney, formatPercent } from '../../utils/format'

const filter = useFilterStore()
const { periodRange, cityQuery, storeQuery, channel } = storeToRefs(filter)

type Row = {
  key: string
  profit: number | null
  profitRate: number | null
  delta: number | null
}

const rows = computed<Row[]>(() => {
  const query = {
    from: periodRange.value.from,
    to: periodRange.value.to,
    city: cityQuery.value,
    store: storeQuery.value,
    channel: '全部',
  }
  const prevRange = previousDayRange(query.from, query.to)
  const previous = new Map(source1ByChannel({ ...query, ...prevRange }).map((r) => [r.key, r.profit]))
  const list = [...source1ByChannel(query)].sort((a, b) => {
    if (a.profit == null && b.profit == null) return 0
    if (a.profit == null) return 1
    if (b.profit == null) return -1
    return b.profit - a.profit
  })
  return list.map((row) => {
    const prev = previous.get(row.key)
    return {
      key: row.key,
      profit: row.profit,
      profitRate: row.profitRate,
      delta: row.profit != null && prev != null && prev !== 0 ? (row.profit - prev) / Math.abs(prev) : null,
    }
  })
})

const maxProfit = computed(() => {
  const vals = rows.value.map((r) => Math.abs(r.profit ?? 0))
  return Math.max(...vals, 1)
})

const empty = computed(() => !rows.value.some((r) => r.profit != null))

const CHANNEL_COLORS: Record<string, string> = {
  淘: '#FF7A1F',
  美团: '#FFE14A',
  京东: '#FF3D6E',
  POS: '#3DB8FF',
}
function colorOf(name: string) {
  if (name.includes('淘')) return CHANNEL_COLORS.淘
  if (name.includes('美团')) return CHANNEL_COLORS.美团
  if (name.includes('京东')) return CHANNEL_COLORS.京东
  if (name.toUpperCase().includes('POS')) return CHANNEL_COLORS.POS
  return '#8EC8FF'
}
function badgeOf(name: string) {
  if (name.includes('淘')) return '淘'
  if (name.includes('美团')) return '美'
  if (name.includes('京东')) return '京'
  if (name.toUpperCase().includes('POS')) return 'P'
  return '其'
}
function isLight(name: string) {
  return name.includes('美团') || name.includes('淘')
}
function shortName(name: string) {
  return name.replace(/^其他/, '其他')
}
function barPct(row: Row) {
  if (row.profit == null) return 0
  const pct = (Math.abs(row.profit) / maxProfit.value) * 100
  return Math.max(pct, row.profit === 0 ? 0 : 10)
}
/** 条形图短写：≥1万用万，避免 31,887.08元 撑爆 */
function compactMoney(n: number | null) {
  if (n == null || Number.isNaN(n)) return '—'
  const v = Number(n)
  const abs = Math.abs(v)
  const sign = v < 0 ? '-' : ''
  if (abs >= 1e4) return `${sign}${(abs / 1e4).toFixed(2)}万`
  if (abs >= 100) return `${sign}${Math.round(abs)}`
  return `${sign}${abs.toFixed(2)}`
}
function deltaText(d: number | null) {
  if (d == null) return '—'
  return `${Math.abs(d * 100).toFixed(1)}%`
}
function deltaArrow(d: number | null) {
  if (d == null || d === 0) return ''
  return d > 0 ? '↑' : '↓'
}
function deltaClass(d: number | null) {
  if (d == null) return ''
  if (d > 0) return 'up'
  if (d < 0) return 'down'
  return ''
}
function toggle(name: string) {
  filter.setChannel(channel.value === name ? '全部' : name)
}
</script>

<style scoped lang="scss">
.unit-hint {
  color: #8aa3b8;
  font-size: 12px;
  white-space: nowrap;
}
.chart {
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.head,
.item {
  display: grid;
  grid-template-columns: 78px minmax(0, 1fr) 58px 56px;
  gap: 8px;
  align-items: center;
  min-width: 0;
}
.head {
  flex-shrink: 0;
  height: 22px;
  padding: 0 2px;
  color: #8aa3b8;
  font-size: 12px;
  font-weight: 500;
}
.col-rate,
.col-delta { text-align: right; }
.body {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
  overflow: auto;
}
.item {
  flex: 1 1 0;
  min-height: 38px;
  max-height: 52px;
  padding: 2px;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: inherit;
  cursor: pointer;
  text-align: left;
  &:hover,
  &.active { background: var(--panel-hover); }
}
.name {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  color: #e8f4ff;
  font-size: 13px;
  font-weight: 650;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  i {
    width: 16px;
    height: 16px;
    border-radius: 3px;
    flex-shrink: 0;
    display: grid;
    place-items: center;
    color: #03152c;
    font-size: 10px;
    font-style: normal;
    font-weight: 800;
  }
}
.track {
  display: flex;
  align-items: center;
  min-width: 0;
  height: 22px;
}
.bar {
  position: relative;
  z-index: 1;
  flex: 0 0 auto;
  height: 22px;
  max-width: 100%;
  border-radius: 0 11px 11px 0;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding: 0 9px 0 6px;
  box-shadow: 0 0 10px color-mix(in srgb, currentColor 35%, transparent), inset 0 0 0 1px rgba(255, 255, 255, 0.22);
  em {
    color: #fff;
    font: 700 12px/1 var(--font-num);
    font-style: normal;
    font-variant-numeric: tabular-nums;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.35);
    white-space: nowrap;
  }
  &.light em {
    color: #1a2a3a;
    text-shadow: none;
  }
  &.outside {
    padding: 0;
    min-width: 8px;
  }
}
.bar-val {
  flex: 0 0 auto;
  margin-left: 6px;
  color: #e8f4ff;
  font: 700 12px/1 var(--font-num);
  font-style: normal;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.dash {
  flex: 1 1 auto;
  min-width: 8px;
  height: 0;
  margin-left: 6px;
  border-top: 1px dashed rgba(138, 163, 184, 0.45);
}
.rate {
  text-align: right;
  color: #b8d0e6;
  font: 650 13px/1.2 var(--font-num);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.delta {
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  gap: 1px;
  color: #c5d8ec;
  font: 700 13px/1.2 var(--font-num);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  .arrow { font-size: 12px; }
  &.up { color: var(--success); }
  &.down { color: var(--danger); }
}
</style>
