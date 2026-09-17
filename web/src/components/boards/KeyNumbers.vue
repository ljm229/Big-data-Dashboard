<!-- 中文名：顶部核心指标（数据源1） -->
<template>
  <div class="kpi" aria-label="核心经营指标">
    <article v-for="card in cards" :key="card.key" class="kpi__card" :class="{ pending: !card.available }">
      <div class="kpi__icon" aria-hidden="true">
        <KpiGlyph :name="card.icon" />
      </div>
      <div class="kpi__body">
        <div class="kpi__label" :title="card.fullLabel || card.label">{{ card.label }}</div>
        <FlipNumber :value="card.main" :tone="card.tone" class="kpi__num" />

        <div v-if="card.progress != null" class="kpi__progress">
          <i aria-hidden="true"><em :style="{ width: `${Math.min(card.progress * 100, 100)}%` }" /></i>
          <span>{{ card.note }}</span>
        </div>
        <div v-else-if="!card.available" class="kpi__pending">{{ card.note }}</div>
        <div v-else class="kpi__deltas">
          <span v-if="showPrimaryDelta" class="kpi__delta" :class="toneClass(card.dod, card.invertDelta)">
            <em>{{ primaryDeltaLabel }}</em>{{ fmtDelta(card.dod, card.point) }}
          </span>
          <span v-if="showSecondaryDelta" class="kpi__delta" :class="toneClass(card.wow, card.invertDelta)">
            <em>{{ secondaryDeltaLabel }}</em>{{ fmtDelta(card.wow, card.point) }}
          </span>
        </div>
      </div>
    </article>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import FlipNumber from '../FlipNumber.vue'
import KpiGlyph from '../KpiGlyph.vue'
import { useFilterStore } from '../../stores/filter'
import {
  aggregateSource1Kpi,
  deltaOf,
  previousDayRange,
  previousPeriodRange,
  previousWeekRange,
  type KpiDelta,
  type KpiTotals,
} from '../../api/source1'
import { formatInt, formatPercent, formatYuan } from '../../utils/format'

type Card = {
  key: string
  label: string
  fullLabel?: string
  icon: string
  main: string
  tone: '' | 'danger'
  dod: number | null
  wow: number | null
  invertDelta: boolean
  point: boolean
  progress: number | null
  note: string
  available: boolean
}

const filter = useFilterStore()
const { periodRange, cityQuery, channel, storeQuery, periodMode } = storeToRefs(filter)

const primaryDeltaLabel = computed(() =>
  periodMode.value === 'week' ? '周比' : periodMode.value === 'month' ? '月比' : '日比',
)
const secondaryDeltaLabel = computed(() => '周比')
const showPrimaryDelta = computed(() => true)
const showSecondaryDelta = computed(() => periodMode.value === 'day')

function loadTotals(from: string, to: string): KpiTotals | null {
  if (!from || !to) return null
  return aggregateSource1Kpi({
    from,
    to,
    city: cityQuery.value,
    channel: channel.value,
    store: storeQuery.value,
  })
}

const snapshot = computed(() => {
  const { from, to } = periodRange.value
  const current = loadTotals(from, to)
  const emptyDelta = deltaOf(current || ({} as KpiTotals), null)
  if (!current) return { current, dod: emptyDelta, wow: emptyDelta }
  if (periodMode.value === 'day') {
    const day = previousDayRange(from, to)
    const week = previousWeekRange(from, to)
    return {
      current,
      dod: deltaOf(current, loadTotals(day.from, day.to)),
      wow: deltaOf(current, loadTotals(week.from, week.to)),
    }
  }
  if (periodMode.value === 'week') {
    const week = previousPeriodRange(from, to, 'week')
    const wow = deltaOf(current, loadTotals(week.from, week.to))
    return { current, dod: wow, wow: emptyDelta }
  }
  const month = previousPeriodRange(from, to, 'month')
  const mom = deltaOf(current, loadTotals(month.from, month.to))
  return { current, dod: mom, wow: emptyDelta }
})

function fmtDelta(v: number | null, point = false) {
  if (v == null) return '—'
  const pct = (v * 100).toFixed(2)
  return `${Number(pct) >= 0 ? '+' : ''}${pct}%`
}

function toneClass(v: number | null, invert = false) {
  if (v == null) return 'muted'
  const rising = v >= 0
  if (invert) return rising ? 'down' : 'up'
  return rising ? 'up' : 'down'
}

function makeCard(input: Partial<Card> & Pick<Card, 'key' | 'label' | 'icon' | 'main'>): Card {
  return {
    tone: '',
    dod: null,
    wow: null,
    invertDelta: false,
    point: false,
    progress: null,
    note: '',
    available: true,
    ...input,
  }
}

const cards = computed<Card[]>(() => {
  const cur = snapshot.value.current
  const dod = snapshot.value.dod as KpiDelta
  const wow = snapshot.value.wow as KpiDelta
  if (!cur) return []
  return [
    makeCard({
      key: 'gmv',
      label: '总营业',
      fullLabel: '总营业额（源表字段直接加总；默认元，≥百万自动换算万）',
      icon: 'gmv',
      main: formatYuan(cur.turnover),
      dod: dod.turnover,
      wow: wow.turnover,
    }),
    makeCard({
      key: 'paid',
      label: '实付金额',
      fullLabel: '实付金额（有效订单实付；默认元，≥百万为万）',
      icon: 'paid',
      main: formatYuan(cur.paid),
      dod: dod.paid,
      wow: wow.paid,
    }),
    makeCard({
      key: 'profit',
      label: '预计毛利',
      fullLabel: '预计毛利（含平台后返；源表字段直接加总；默认元，≥百万为万）',
      icon: 'profit',
      main: formatYuan(cur.profit),
      tone: cur.profit != null && cur.profit < 0 ? 'danger' : '',
      dod: dod.profit,
      wow: wow.profit,
    }),
    makeCard({
      key: 'rate',
      label: '毛利率（含后返）',
      fullLabel: '毛利率（含平台后返）',
      icon: 'rate',
      main: formatPercent(cur.profitRate),
      dod: dod.profitRate,
      wow: wow.profitRate,
      point: true,
    }),
    makeCard({
      key: 'orders',
      label: '有效订单量',
      icon: 'orders',
      main: cur.orders == null ? '—' : formatInt(cur.orders),
      dod: dod.orders,
      wow: wow.orders,
    }),
    makeCard({
      key: 'arpu',
      label: '客单价',
      icon: 'arpu',
      main: formatYuan(cur.arpu),
      dod: dod.arpu,
      wow: wow.arpu,
    }),
    makeCard({
      key: 'refund',
      label: '退款率',
      icon: 'refund',
      main: formatPercent(cur.refundRate),
      tone: cur.refundRate != null && cur.refundRate > 0.05 ? 'danger' : '',
      dod: dod.refundRate,
      wow: wow.refundRate,
      invertDelta: true,
      point: true,
    }),
  ]
})
</script>

<style scoped lang="scss">
.kpi {
  height: 120px;
  flex-shrink: 0;
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 10px;
}
.kpi__card {
  position: relative;
  min-width: 0;
  height: 100%;
  padding: 12px 12px 10px;
  display: flex;
  align-items: center;
  border-radius: 0;
  background: linear-gradient(115deg, var(--panel-head), var(--panel) 68%);
  border: 1px solid color-mix(in srgb, var(--accent-line) 92%, #fff);
  box-shadow:
    0 0 10px color-mix(in srgb, var(--accent-line) 28%, transparent),
    inset 0 1px 0 color-mix(in srgb, var(--line-glow) 40%, transparent);
  overflow: hidden;
  clip-path: polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 8px 100%, 0 calc(100% - 8px));
  &::before,
  &::after {
    content: '';
    position: absolute;
    height: 1.5px;
    width: 12px;
    background: var(--line-glow);
    box-shadow: 0 0 8px var(--accent-line), 0 0 12px color-mix(in srgb, var(--accent-line) 70%, transparent);
    transform: rotate(45deg);
  }
  &::before { right: -2px; top: 3px; }
  &::after { left: -2px; bottom: 3px; }
}
.kpi__card.pending .kpi__num { color: var(--muted); }
.kpi__icon {
  position: absolute;
  right: 10px;
  top: 8px;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  color: var(--primary-2);
  background: linear-gradient(135deg, #0b4976, #031b38);
  border: 1px solid var(--border);
  box-shadow: inset 0 0 8px #086297;
}
.kpi__body { width: 100%; min-width: 0; display: flex; flex-direction: column; gap: 7px; }
.kpi__label {
  max-width: calc(100% - 26px);
  font-size: 15px;
  font-weight: 650;
  color: var(--c-body);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.kpi__num {
  font-family: var(--font-num);
  font-size: var(--fs-kpi);
  font-weight: var(--fw-kpi);
  font-variant-numeric: tabular-nums;
  line-height: 1;
  color: var(--c-num);
  text-shadow: 0 0 12px #126abb;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  :deep(.flip__unit) {
    font-size: 13px;
    font-weight: 500;
    letter-spacing: 0;
    opacity: 0.78;
    text-shadow: none;
  }
}
.kpi__deltas { display: flex; justify-content: space-between; gap: 4px; min-width: 0; }
.kpi__delta {
  font-family: var(--font-num);
  font-size: 12px;
  font-weight: 700;
  white-space: nowrap;
  em { margin-right: 3px; color: var(--muted); font-style: normal; font-family: var(--font-cn); font-weight: 600; }
  &.up { color: var(--success); }
  &.down { color: var(--danger); }
  &.muted { color: var(--blue); }
}
.kpi__pending { color: var(--blue); font-size: 13px; }
.kpi__progress {
  display: grid;
  grid-template-columns: minmax(50px, 1fr) auto;
  align-items: center;
  gap: 7px;
  color: var(--success);
  font: 700 11px var(--font-num);
  i { height: 7px; background: var(--divider); overflow: hidden; }
  em { display: block; height: 100%; background: linear-gradient(90deg, var(--primary), var(--grow)); box-shadow: none; }
}
</style>
