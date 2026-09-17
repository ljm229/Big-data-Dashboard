<!-- 中文名：门店上线进度 —— 首屏铺满城市行，点进度条看城市上线情况 -->
<template>
  <div class="launch-shell">
    <Panel title="门店上线进度跟踪" :empty="!summary.plan">
      <template #extra><span class="launch-note">上线台账 · 随城市/门店筛选 · 非日切</span></template>
      <div class="launch">
        <div class="kpis">
          <span>计划门店 <b>{{ summary.plan }}</b></span>
          <button type="button" class="kpi-btn" title="查看已上线门店" @click="openList('open')">
            已上线 <i class="kpi-dot ok" />
            <b class="ok">{{ summary.open }}</b>
          </button>
          <button type="button" class="kpi-btn" title="查看未上线门店" @click="openList('pending')">
            未上线 <i class="kpi-dot warn" />
            <b class="warn">{{ summary.pending }}</b>
          </button>
          <span>上线率 <b>{{ pct }}</b></span>
        </div>

        <div class="bars" aria-label="城市上线率，点击进度条查看城市上线情况">
          <div class="bars__head">
            <span>城市</span>
            <span>计划</span>
            <span>已上线</span>
            <span>上线率</span>
            <span>进度 · 下滑更多</span>
          </div>
          <div class="bars__list">
            <button
              v-for="row in rows"
              :key="row.city"
              type="button"
              class="bars__row"
              :title="`查看${row.city}上线情况`"
              @click="openCity(row.city)"
            >
              <span class="city">{{ row.city }}</span>
              <span class="num">{{ row.plan }}</span>
              <span class="num">{{ row.open }}</span>
              <strong :class="{ low: row.rate < 0.5 }">{{ (row.rate * 100).toFixed(0) }}%</strong>
              <span class="track" aria-hidden="true">
                <i :style="{ width: `${barPercent(row.rate)}%` }" />
              </span>
            </button>
          </div>
        </div>
      </div>
    </Panel>

    <CityLaunchDialog :city="cityDialog" @close="cityDialog = null" />

    <Teleport to="body">
      <div v-if="dialog" class="mask" @click.self="dialog = null">
        <section class="dialog" role="dialog" aria-modal="true">
          <header>
            <h3>{{ dialog === 'open' ? '已上线门店' : '未上线门店' }}</h3>
            <button type="button" @click="dialog = null">关闭</button>
          </header>
          <p class="hint">共 {{ dialogRows.length }} 家，点击门店可切换大屏筛选</p>
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>门店</th>
                  <th>城市</th>
                  <th>状态</th>
                  <th>毛利</th>
                  <th>订单</th>
                  <th>退款率</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in dialogRows" :key="row.name" @click="pickStore(row.name)">
                  <td>{{ row.name }}</td>
                  <td>{{ row.city || '--' }}</td>
                  <td>{{ row.status }}</td>
                  <td>{{ row.metric ? formatMoney(row.metric.profit) : '--' }}</td>
                  <td>{{ row.metric ? formatInt(row.metric.orders) : '--' }}</td>
                  <td>{{ row.metric ? formatPercent(row.metric.refundRate) : '--' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import Panel from '../Panel.vue'
import CityLaunchDialog from './CityLaunchDialog.vue'
import { useFilterStore } from '../../stores/filter'
import { source1ByStore, source1LaunchByCity, source1StoresByStatus } from '../../api/source1'
import { formatInt, formatMoney, formatPercent } from '../../utils/format'

const filter = useFilterStore()
const { cityQuery, storeQuery, periodRange, channel } = storeToRefs(filter)
const dialog = ref<'open' | 'pending' | null>(null)
const cityDialog = ref<string | null>(null)
const rows = computed(() =>
  source1LaunchByCity(cityQuery.value, storeQuery.value).filter((r) => r.city && r.city !== '未标注'),
)
const summary = computed(() =>
  rows.value.reduce(
    (a, r) => ({ plan: a.plan + r.plan, open: a.open + r.open, pending: a.pending + r.pending }),
    { plan: 0, open: 0, pending: 0 },
  ),
)
const pct = computed(() => (summary.value.plan ? `${((summary.value.open / summary.value.plan) * 100).toFixed(2)}%` : '—'))

const dialogRows = computed(() => {
  if (!dialog.value) return []
  const metrics = source1ByStore({
    from: periodRange.value.from,
    to: periodRange.value.to,
    city: cityQuery.value,
    channel: channel.value,
  })
  const map = new Map(metrics.map((m) => [m.key, m]))
  return source1StoresByStatus(dialog.value, cityQuery.value, storeQuery.value).map((s) => ({
    ...s,
    metric: map.get(s.name) || null,
  }))
})

function barPercent(rate: number) {
  return Math.min(Math.max(rate, 0), 1) * 100
}
function openList(kind: 'open' | 'pending') {
  dialog.value = kind
}
function openCity(city: string) {
  cityDialog.value = city
}
function pickStore(name: string) {
  filter.setStore(name)
  dialog.value = null
}
</script>

<style scoped lang="scss">
.launch-shell {
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
}
.launch-note {
  font-size: 11px;
  color: var(--muted, #8aa4c0);
  white-space: nowrap;
}
.launch {
  height: 100%;
  width: 100%;
  max-width: none;
  margin: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 12px;
  min-height: 0;
  padding: 4px 8px 2px;
  overflow: hidden;
  box-sizing: border-box;
}
.kpis {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
  flex-shrink: 0;
  font-size: 13px;
  color: var(--muted);
  b {
    display: block;
    margin-top: 4px;
    color: var(--c-num);
    font-size: 28px;
    font-family: var(--font-num);
    font-weight: 760;
    font-variant-numeric: tabular-nums;
    line-height: 1;
    letter-spacing: 0.04em;
  }
  .ok { color: var(--success); }
  .warn { color: var(--accent); }
}
.kpis > span,
.kpi-btn {
  min-width: 0;
  min-height: 58px;
  padding: 8px 10px;
  border: 1px solid var(--divider);
  background: var(--panel-deep);
  text-align: center;
}
.kpi-btn {
  position: relative;
  color: inherit;
  cursor: pointer;
  &:hover { border-color: var(--accent-line); }
}
.kpi-dot {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  font-style: normal;
  box-shadow: 0 0 8px currentColor;
  pointer-events: none;
  &.ok { background: var(--success); color: var(--success); }
  &.warn { background: var(--accent); color: var(--accent); }
}
.bars {
  flex: 0 1 auto;
  min-height: 0;
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 4px;
  overflow: hidden;
}
.bars__head,
.bars__row {
  display: grid;
  /* 左侧文字区略加宽，进度条仍占剩余 */
  grid-template-columns: 88px 56px 64px 68px minmax(90px, 1fr);
  gap: 10px;
  align-items: center;
  padding: 0 6px;
  justify-items: center;
}
.bars__head {
  flex-shrink: 0;
  height: 24px;
  color: #8aa3b8;
  font-size: 13px;
  font-weight: 500;
  white-space: nowrap;
  span:first-child,
  span:last-child { justify-self: start; }
}
.bars__list {
  --row-h: 34px;
  flex: none;
  height: calc(var(--row-h) * 5);
  max-height: calc(var(--row-h) * 5);
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-width: thin;
  scrollbar-color: rgba(94, 200, 255, 0.45) transparent;
}
.bars__row {
  flex: none;
  height: var(--row-h);
  min-height: var(--row-h);
  border: 0;
  background: transparent;
  color: inherit;
  text-align: center;
  cursor: pointer;
  border-radius: 3px;
  .city { justify-self: start; text-align: left; }
  .track { justify-self: stretch; width: 100%; }
  &:hover {
    background: rgba(33, 215, 255, 0.08);
    .track { outline: 1px solid rgba(94, 200, 255, 0.45); }
  }
}
.city {
  color: #ffffff;
  font-size: 16px;
  font-weight: 650;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  width: 100%;
}
.num {
  color: #d4e4f4;
  font: 650 16px/1 var(--font-num);
  font-variant-numeric: tabular-nums;
}
.bars__row strong {
  color: #2ee89a;
  font: 700 16px/1 var(--font-num);
  font-variant-numeric: tabular-nums;
  &.low { color: #ffd23f; }
}
.track {
  height: 11px;
  border-radius: 999px;
  background: #2a3038;
  overflow: hidden;
  i {
    display: block;
    height: 100%;
    min-width: 0;
    border-radius: 999px;
    background: linear-gradient(90deg, #1e78e8 0%, #2ec8ea 46%, #5aed9a 100%);
  }
}
.mask {
  position: fixed;
  inset: 0;
  z-index: 8000;
  background: rgba(2, 10, 28, 0.62);
  display: grid;
  place-items: center;
  padding: 24px;
}
.dialog {
  width: min(880px, 100%);
  max-height: min(72vh, 640px);
  display: flex;
  flex-direction: column;
  background: #071a3c;
  border: 1px solid rgba(94, 200, 255, 0.35);
  box-shadow: 0 18px 48px rgba(0, 0, 0, 0.45);
  header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 14px 16px;
    border-bottom: 1px solid rgba(94, 200, 255, 0.16);
    h3 { margin: 0; font-size: 18px; }
    button {
      cursor: pointer;
      border: 1px solid #5ec8ff;
      background: transparent;
      color: #9adfff;
      padding: 4px 10px;
    }
  }
}
.hint {
  margin: 0;
  padding: 8px 16px;
  font-size: 12px;
  color: #8FA3BF;
}
.table-wrap {
  overflow: auto;
  padding: 0 8px 12px;
}
.dialog table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}
.dialog table th,
.dialog table td {
  padding: 8px 6px;
  text-align: left;
  border-bottom: 1px solid rgba(94, 200, 255, 0.12);
}
.dialog table tr { cursor: pointer; }
.dialog table tr:hover { background: rgba(78, 200, 255, 0.1); }
</style>
