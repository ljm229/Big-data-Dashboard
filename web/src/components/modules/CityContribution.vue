<template>
  <Panel title="城市贡献" :updated-at="time" :loading="loading && !rows.length" :empty="!loading && !rows.length">
    <ul class="list">
      <li v-for="(row, i) in rows" :key="row.name" @click="onCity(row)">
        <em :class="{ top: i < 3 }">{{ i + 1 }}</em>
        <div class="meta">
          <span class="name">{{ row.name }}</span>
          <span class="sub">{{ row.store_cnt }}店 · 毛利率 {{ formatPercent(row.profit_rate) }}</span>
        </div>
        <div class="bar"><i :style="{ width: widthOf(row.paid_amount) }" /></div>
        <b>{{ formatMoney(row.paid_amount) }}</b>
      </li>
    </ul>
  </Panel>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import Panel from '../Panel.vue'
import { useFilterStore } from '../../stores/filter'
import { fetchCityRank } from '../../api/dashboard'
import { formatMoney, formatPercent } from '../../utils/format'

const filter = useFilterStore()
const { dataKey, loadingTick, updatedAt, hasData } = storeToRefs(filter)
const loading = ref(true)
const rows = ref<
  {
    name: string
    paid_amount: number
    profit: number
    orders: number
    profit_rate: number
    store_cnt: number
  }[]
>([])
const time = computed(() => (updatedAt.value ? updatedAt.value.slice(5, 10) : ''))
const max = computed(() => Math.max(...rows.value.map((r) => r.paid_amount), 1))
let timer = 0

function widthOf(v: number) {
  return `${Math.max(6, (v / max.value) * 100)}%`
}

function onCity(row: { name: string }) {
  filter.setCity(row.name, row.name)
}

async function load(showLoading = false) {
  if (showLoading) loading.value = true
  try {
    if (!hasData.value) {
      rows.value = []
      return
    }
    rows.value = (await fetchCityRank(dataKey.value, 'paid_amount')) as typeof rows.value
  } finally {
    loading.value = false
  }
}

watch([dataKey, loadingTick], () => load(true), { immediate: true })
onMounted(() => {
  timer = window.setInterval(() => load(false), 60000)
})
onUnmounted(() => clearInterval(timer))
</script>

<style scoped lang="scss">
.list {
  list-style: none;
  margin: 0;
  padding: 2px 4px 8px;
  height: 100%;
  overflow-y: auto;
  overflow-x: hidden;
  display: flex;
  flex-direction: column;
  gap: 6px;
  scrollbar-width: thin;
  scrollbar-color: rgba(0, 180, 255, 0.35) transparent;
  &::-webkit-scrollbar {
    width: 4px;
  }
  &::-webkit-scrollbar-thumb {
    background: rgba(0, 180, 255, 0.35);
    border-radius: 2px;
  }
}
li {
  display: grid;
  grid-template-columns: 22px 1fr 72px 78px;
  gap: 8px;
  align-items: center;
  padding: 6px 4px;
  border-radius: 4px;
  cursor: pointer;
  &:hover {
    background: rgba(30, 100, 180, 0.18);
  }
  em {
    font-style: normal;
    font-size: var(--fs-axis);
    color: rgba(160, 190, 220, 0.7);
    text-align: center;
    &.top {
      color: #ffc53d;
      font-weight: 800;
    }
  }
  .meta {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .name {
    font-size: var(--fs-data);
    font-weight: 600;
    color: #e8f3ff;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .sub {
    font-size: var(--fs-tiny);
    color: rgba(150, 180, 210, 0.75);
  }
  .bar {
    height: 8px;
    border-radius: 4px;
    background: rgba(255, 255, 255, 0.06);
    overflow: hidden;
    i {
      display: block;
      height: 100%;
      background: linear-gradient(90deg, #1a6cff, #00d4ff);
    }
  }
  b {
    text-align: right;
    font-family: var(--font-num);
    font-size: var(--fs-sub);
    font-variant-numeric: tabular-nums;
    font-weight: 600;
    color: #fff;
  }
}
</style>
