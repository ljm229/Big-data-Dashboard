<template>
  <Panel title="📦 商品运营分析" :updated-at="time" :loading="loading && !rows.length">
    <div class="wrap">
      <div class="head">
        <span>排名</span>
        <span>门店名称</span>
        <span>销量</span>
        <span>退货率</span>
      </div>
      <ul class="list">
        <li
          v-for="(row, i) in rows"
          :key="row.code || row.name"
          :class="{ flash: isFlash(row), focus: isFocus(row) }"
          @click="onClick(row)"
        >
          <em class="rank" :class="{ medal: i < 3 }">{{ rankIcon(i) }}</em>
          <span class="name" :title="row.fullName || row.name">{{ row.name }}</span>
          <b>{{ formatInt(row.sku_sales) }}</b>
          <span class="rate" :class="rateTone(row.return_rate)">{{ formatPercent(row.return_rate) }}</span>
        </li>
      </ul>
      <div class="foot">
        <span>销量合计 {{ formatInt(skuSales) }}单</span>
        <i />
        <span>退货数量 {{ formatInt(returnQty) }}单</span>
        <i />
        <span>退货率 {{ formatPercent(returnRate) }}</span>
      </div>
    </div>
  </Panel>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import Panel from '../Panel.vue'
import { useFilterStore } from '../../stores/filter'
import { fetchProducts } from '../../api/dashboard'
import { formatInt, formatPercent } from '../../utils/format'

type Row = {
  name: string
  fullName?: string
  city?: string
  code?: string
  sku_sales: number
  return_rate: number
  abnormal?: boolean
  paid_orders?: number
  refund_orders?: number
  profit_rate?: number
}

const MEDALS = ['🏆', '🥈', '🥉']
const filter = useFilterStore()
const { dataKey, cityName, loadingTick, updatedAt, productFlashNames, focusStoreName, abnormalOnly } =
  storeToRefs(filter)
const loading = ref(true)
const skuSales = ref(0)
const returnQty = ref(0)
const returnRate = ref(0)
const rows = ref<Row[]>([])
const time = computed(() => (updatedAt.value ? updatedAt.value.slice(11, 19) : ''))
let timer = 0

function rankIcon(i: number) {
  return i < 3 ? MEDALS[i] : String(i + 1)
}

function rateTone(rate: number) {
  const p = Math.abs(rate) <= 1 ? rate * 100 : rate
  if (p <= 3) return 'good'
  if (p <= 5) return 'warn'
  return 'bad'
}

function matchName(row: Row, name: string) {
  return row.name === name || row.fullName === name || (row.fullName || '').includes(name)
}

function isFlash(row: Row) {
  if (productFlashNames.value.some((n) => matchName(row, n))) return true
  return abnormalOnly.value && !!row.abnormal
}

function isFocus(row: Row) {
  return !!focusStoreName.value && matchName(row, focusStoreName.value)
}

function onClick(row: Row) {
  filter.focusStore(row.name)
  filter.openDrawer('store', row as Record<string, unknown>)
}

async function load(showLoading = false) {
  if (showLoading) loading.value = true
  try {
    const data = await fetchProducts(dataKey.value, cityName.value)
    skuSales.value = data.sku_sales
    returnQty.value = data.return_qty
    returnRate.value = data.return_rate
    rows.value = data.rows as Row[]
  } finally {
    loading.value = false
  }
}

watch([dataKey, cityName, loadingTick], () => load(true), { immediate: true })
onMounted(() => {
  timer = window.setInterval(() => load(false), 60000)
})
onUnmounted(() => clearInterval(timer))
</script>

<style scoped lang="scss">
.wrap {
  height: 100%;
  display: flex;
  flex-direction: column;
  min-height: 0;
}
.head {
  display: grid;
  grid-template-columns: 40px 1fr 72px 56px;
  gap: 6px;
  color: #8899aa;
  font-size: 12px;
  padding-bottom: 6px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  flex-shrink: 0;
  span:nth-child(3),
  span:nth-child(4) {
    text-align: right;
  }
}
.list {
  list-style: none;
  margin: 4px 0 0;
  padding: 0;
  flex: 1;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  li {
    display: grid;
    grid-template-columns: 40px 1fr 72px 56px;
    gap: 6px;
    align-items: center;
    flex: 1;
    min-height: 28px;
    font-size: 13px;
    border-radius: 4px;
    cursor: pointer;
    padding: 0 4px;
    margin: 0 -4px;
    &:hover {
      background: rgba(0, 140, 255, 0.12);
    }
    &.flash {
      animation: store-flash 0.6s ease-in-out 3;
    }
    &.focus {
      background: rgba(0, 143, 251, 0.18);
      outline: 1px solid rgba(0, 143, 251, 0.55);
    }
  }
}
@keyframes store-flash {
  0%,
  100% {
    background: transparent;
  }
  50% {
    background: rgba(255, 69, 96, 0.28);
  }
}
.rank {
  font-style: normal;
  text-align: center;
  color: #8899aa;
  font-family: var(--font-num);
  &.medal {
    font-size: 16px;
  }
}
.name {
  color: #fff;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
b {
  color: #fff;
  font-weight: 700;
  font-family: var(--font-num);
  font-variant-numeric: tabular-nums;
  text-align: right;
  font-size: 13px;
}
.rate {
  font-size: 12px;
  text-align: right;
  font-family: var(--font-num);
  font-variant-numeric: tabular-nums;
  &.good {
    color: #00e396;
  }
  &.warn {
    color: #feb019;
  }
  &.bad {
    color: #ff4560;
  }
}
.foot {
  flex-shrink: 0;
  margin-top: 6px;
  padding-top: 8px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  font-size: 12px;
  color: #8899aa;
  i {
    width: 1px;
    height: 12px;
    background: rgba(255, 255, 255, 0.16);
  }
}
</style>
