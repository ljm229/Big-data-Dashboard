<template>
  <Panel
    :title="panelTitle"
    :updated-at="time"
    :loading="loading && !orders.length"
    :alert="abnormalOnly || storeSortBy !== 'default'"
  >
    <template v-if="storeSortBy !== 'default'" #extra>
      <button type="button" class="reset" @click="filter.setStoreSortBy('default')">恢复默认排序</button>
    </template>
    <div class="box">
      <div class="head">
        <span>门店</span><span>城市</span><span>实付</span><span>订单</span><span>{{ sortHead }}</span>
      </div>
      <div class="board">
        <ScrollBoard :list="displayOrders" :row-height="40" :speed="0.25">
          <template #default="{ row }">
            <div
              class="row"
              :class="{ abnormal: isAbnormalStore(row), focus: isFocus(row) }"
              @click="filter.openDrawer('store', row)"
            >
              <span>{{ row.name }}</span>
              <span>{{ row.city }}</span>
              <b>{{ formatMoney(row.paid_amount) }}</b>
              <span>{{ row.paid_orders }}</span>
              <em :class="metricClass(row)">{{ metricText(row) }}</em>
            </div>
          </template>
        </ScrollBoard>
      </div>
    </div>
  </Panel>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import Panel from '../Panel.vue'
import ScrollBoard from '../ScrollBoard.vue'
import { useFilterStore } from '../../stores/filter'
import { fetchStoreRank } from '../../api/dashboard'
import { formatMoney, formatPercent, formatInt } from '../../utils/format'
import { isAbnormalStore } from '../../utils/health'

type StoreRow = {
  name: string
  city: string
  paid_amount: number
  paid_orders: number
  refund_orders: number
  refund_amount: number
  profit_rate: number
  avg_item_price: number
  active_sku_cnt: number
  self_delivery_cost: number
}

const filter = useFilterStore()
const { dataKey, cityName, loadingTick, updatedAt, abnormalOnly, storeSortBy, focusStoreName } =
  storeToRefs(filter)
const loading = ref(true)
const orders = ref<StoreRow[]>([])
const time = computed(() => (updatedAt.value ? updatedAt.value.slice(5, 10) : ''))

const panelTitle = computed(() => {
  if (abnormalOnly.value) return '门店经营明细 · 异常门店'
  if (storeSortBy.value === 'refund_amount') return '门店经营明细 · 按退款金额'
  if (storeSortBy.value === 'refund_rate') return '门店经营明细 · 按退款率'
  if (storeSortBy.value === 'refund_orders') return '门店经营明细 · 按退款订单'
  if (storeSortBy.value === 'inafter_ratio') return '门店经营明细 · 按退款率(代理售中售后)'
  return '门店经营明细'
})

const sortHead = computed(() => {
  if (storeSortBy.value === 'refund_amount') return '退款额'
  if (storeSortBy.value === 'refund_rate' || storeSortBy.value === 'inafter_ratio') return '退款率'
  if (storeSortBy.value === 'refund_orders') return '退款单'
  return '毛利率'
})

function refundRate(row: StoreRow) {
  return row.paid_orders ? row.refund_orders / row.paid_orders : 0
}

const displayOrders = computed(() => {
  let list = [...orders.value]
  if (abnormalOnly.value) list = list.filter((row) => isAbnormalStore(row))

  const sort = storeSortBy.value
  if (sort === 'refund_amount') list.sort((a, b) => b.refund_amount - a.refund_amount)
  else if (sort === 'refund_orders') list.sort((a, b) => b.refund_orders - a.refund_orders)
  else if (sort === 'refund_rate' || sort === 'inafter_ratio')
    list.sort((a, b) => refundRate(b) - refundRate(a))
  else list.sort((a, b) => b.paid_amount - a.paid_amount)

  const focus = focusStoreName.value
  if (focus) {
    const idx = list.findIndex((r) => r.name === focus || r.name.includes(focus) || focus.includes(r.name))
    if (idx > 0) {
      const [hit] = list.splice(idx, 1)
      list.unshift(hit)
    }
  }
  return list
})

function isFocus(row: StoreRow) {
  const focus = focusStoreName.value
  if (!focus) return false
  return row.name === focus || row.name.includes(focus) || focus.includes(row.name)
}

function metricText(row: StoreRow) {
  if (storeSortBy.value === 'refund_amount') return formatMoney(row.refund_amount)
  if (storeSortBy.value === 'refund_orders') return formatInt(row.refund_orders)
  if (storeSortBy.value === 'refund_rate' || storeSortBy.value === 'inafter_ratio')
    return formatPercent(refundRate(row))
  return formatPercent(row.profit_rate)
}

function metricClass(row: StoreRow) {
  if (storeSortBy.value === 'default') return { danger: row.profit_rate < 0 }
  const rate = refundRate(row)
  return { danger: rate > 0.05 }
}

async function load() {
  loading.value = true
  try {
    orders.value = (await fetchStoreRank(dataKey.value, cityName.value)) as StoreRow[]
  } finally {
    loading.value = false
  }
}

watch([dataKey, cityName, loadingTick], load, { immediate: true })
</script>

<style scoped lang="scss">
.box {
  height: 100%;
  display: flex;
  flex-direction: column;
  min-height: 0;
}
.board {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}
.head,
.row {
  display: grid;
  grid-template-columns: 1.2fr 0.8fr 1fr 0.6fr 0.8fr;
  gap: 4px;
  width: 100%;
  font-size: var(--fs-data);
  align-items: center;
}
.head {
  color: var(--c-muted);
  font-size: var(--fs-axis);
  padding-bottom: 4px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  margin-bottom: 2px;
  flex-shrink: 0;
}
.row {
  color: var(--c-normal);
  height: 40px;
  cursor: pointer;
  span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  b {
    color: #ffc53d;
    font-family: Bahnschrift, DIN, monospace;
    font-size: var(--fs-data);
    font-variant-numeric: tabular-nums;
  }
  em {
    font-style: normal;
    color: #3bfe91;
    &.danger {
      color: #ff4d4f;
    }
  }
  &.abnormal {
    background: rgba(255, 77, 79, 0.14);
    outline: 1px solid rgba(255, 77, 79, 0.35);
  }
  &.focus {
    background: rgba(0, 143, 251, 0.22);
    outline: 1px solid rgba(0, 143, 251, 0.6);
    animation: focus-pulse 0.7s ease-in-out 2;
  }
}
@keyframes focus-pulse {
  0%,
  100% {
    background: rgba(0, 143, 251, 0.12);
  }
  50% {
    background: rgba(0, 143, 251, 0.35);
  }
}
.reset {
  border: 0;
  background: rgba(0, 143, 251, 0.15);
  color: #9adfff;
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 4px;
  cursor: pointer;
}
</style>
