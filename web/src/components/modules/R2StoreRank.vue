<template>
  <Panel :title="title" :updated-at="time" :loading="loading && !rows.length">
    <template #extra>
      <span v-if="isNational && rows.length > 10" class="page-ind">{{ page + 1 }}/{{ pages }}</span>
    </template>
    <ul class="list">
      <li v-for="(row, i) in pageRows" :key="`${pageStart + i}-${row.name}-${row.city}`" @click="filter.openDrawer('store', row)">
        <em :class="{ top: i < 3 }">{{ pageStart + i + 1 }}</em>
        <div class="meta">
          <span class="name" :title="row.fullName || row.name">{{ row.name }}</span>
          <span class="city">{{ row.city }}</span>
        </div>
        <div class="bar">
          <i :style="{ width: widthOf(row.paid_amount), background: row.profit_rate < 0 ? '#ff4d4f' : undefined }" />
        </div>
        <b>{{ formatMoney(row.paid_amount) }}</b>
        <small :class="{ danger: row.profit_rate < 0 }">{{ formatPercent(row.profit_rate) }}</small>
      </li>
    </ul>
  </Panel>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import Panel from '../Panel.vue'
import { useFilterStore } from '../../stores/filter'
import { fetchStoreRank } from '../../api/dashboard'
import { formatMoney, formatPercent } from '../../utils/format'

const filter = useFilterStore()
const { dataKey, loadingTick, updatedAt, cityName } = storeToRefs(filter)
const loading = ref(true)
const rows = ref<
  {
    name: string
    fullName?: string
    city: string
    paid_amount: number
    profit_rate: number
    paid_orders: number
    avg_item_price: number
    active_sku_cnt: number
    refund_amount: number
    self_delivery_cost: number
  }[]
>([])
const page = ref(0)
const time = computed(() => (updatedAt.value ? updatedAt.value.slice(11, 19) : ''))
const cityFilter = computed(() => (cityName.value === '全国' ? '全国' : cityName.value))
const title = computed(() => (cityFilter.value === '全国' ? '门店 TOP10' : `门店榜 · ${cityFilter.value}`))
const max = computed(() => Math.max(...rows.value.map((r) => r.paid_amount), 1))
const isNational = computed(() => cityFilter.value === '全国')
const pageStart = computed(() => (isNational.value ? page.value * 10 : 0))
const pageRows = computed(() => {
  if (!isNational.value) return rows.value.slice(0, 10)
  return rows.value.slice(pageStart.value, pageStart.value + 10)
})
const pages = computed(() => Math.ceil(Math.min(rows.value.length, 30) / 10))

function widthOf(v: number) {
  return `${Math.max(6, (v / max.value) * 100)}%`
}

let timer = 0
let pageTimer = 0

async function load(showLoading = false) {
  if (showLoading) loading.value = true
  try {
    rows.value = (await fetchStoreRank(dataKey.value, cityFilter.value)) as typeof rows.value
    page.value = 0
  } finally {
    loading.value = false
  }
}

watch([dataKey, loadingTick, cityFilter], () => load(true), { immediate: true })
onMounted(() => {
  timer = window.setInterval(() => load(false), 60000)
  pageTimer = window.setInterval(() => {
    if (!isNational.value || rows.value.length <= 10) return
    const pages = Math.ceil(Math.min(rows.value.length, 30) / 10)
    page.value = (page.value + 1) % pages
  }, 15000)
})
onUnmounted(() => {
  clearInterval(timer)
  clearInterval(pageTimer)
})
</script>

<style scoped lang="scss">
.list {
  margin: 0;
  padding: 0;
  list-style: none;
  height: 100%;
  overflow: hidden;
  li {
    display: grid;
    grid-template-columns: 32px 96px 1fr 82px 56px;
    gap: 8px;
    align-items: center;
    height: 38px;
    cursor: pointer;
    font-size: var(--fs-data);
    &:hover {
      background: rgba(0, 140, 255, 0.12);
    }
  }
  em {
    font-style: normal;
    text-align: center;
    color: #8aa0bf;
    &.top {
      color: #ffc53d;
      font-weight: 700;
    }
  }
  .name {
    display: block;
    color: var(--c-normal);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .city {
    color: var(--c-muted);
    font-size: var(--fs-axis);
  }
  .bar {
    height: 12px;
    background: rgba(255, 255, 255, 0.06);
    border-radius: 4px;
    overflow: hidden;
    i {
      display: block;
      height: 100%;
      background: linear-gradient(90deg, #1c28c8, #0fb6fc);
      border-radius: 4px;
      transition: width 0.8s;
    }
  }
  b {
    color: #f3f120;
    font-size: var(--fs-data);
    font-family: var(--font-num);
    font-variant-numeric: tabular-nums;
    text-align: right;
  }
  small {
    color: #3bfe91;
    font-size: var(--fs-data);
    text-align: right;
    &.danger {
      color: #ff4d4f;
    }
  }
}
.page-ind {
  color: var(--c-muted);
  font-size: var(--fs-axis);
  font-family: var(--font-num);
  font-variant-numeric: tabular-nums;
}
</style>
