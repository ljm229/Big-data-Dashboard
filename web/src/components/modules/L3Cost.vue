<template>
  <Panel
    class="cost-panel"
    :class="{ 'is-flash': flashing }"
    title="💰 成本&优惠结构"
    :updated-at="time"
    :loading="loading && !items.length"
    clickable
    @title-click="openMarketing = true"
  >
    <div class="wrap">
      <ul class="list">
        <li
          v-for="item in items"
          :key="item.item"
          :class="{ clickable: item.key === 'marketing' }"
          @click="onItemClick(item)"
        >
          <div class="row">
            <span class="name">{{ item.item }}</span>
            <b class="amount">{{ formatMoney(item.amount) }}</b>
            <em class="rate" :style="{ color: item.color }">{{ formatPercent(item.rate) }}</em>
          </div>
          <div class="bar">
            <i :style="{ width: barWidth(item.rate), background: item.color }" />
          </div>
        </li>
      </ul>
    </div>

    <Teleport to="body">
      <div v-if="openMarketing" class="popup-mask" @click.self="openMarketing = false">
        <div class="popup">
          <header>
            <h4>营销活动清单</h4>
            <button type="button" @click="openMarketing = false">×</button>
          </header>
          <div v-if="!activities.length" class="popup-empty">暂无活动明细</div>
          <ul v-else>
            <li v-for="(a, i) in activities" :key="`${a.name}-${i}`">
              <span class="a-name" :title="a.name">{{ a.name }}</span>
              <span class="a-store">{{ a.store }}</span>
              <b>{{ formatMoney(a.cost) }}</b>
              <em>ROI {{ a.roi.toFixed(1) }}</em>
            </li>
          </ul>
        </div>
      </div>
    </Teleport>
  </Panel>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import Panel from '../Panel.vue'
import { useFilterStore } from '../../stores/filter'
import { fetchCost, fetchMarketingActivities } from '../../api/dashboard'
import { formatMoney, formatPercent } from '../../utils/format'

type CostItem = {
  item: string
  amount: number
  rate: number
  color: string
  key: 'purchase' | 'discount' | 'marketing' | 'platform_delivery' | 'commission' | 'self_delivery'
}

const filter = useFilterStore()
const { dataKey, cityName, loadingTick, updatedAt, costFlashTick } = storeToRefs(filter)
const loading = ref(true)
const items = ref<CostItem[]>([])
const activities = ref<{ name: string; cost: number; roi: number; store: string }[]>([])
const openMarketing = ref(false)
const flashing = ref(false)
const time = computed(() => (updatedAt.value ? updatedAt.value.slice(11, 19) : ''))
let timer = 0
let flashTimer = 0

const maxRate = computed(() => Math.max(...items.value.map((i) => i.rate), 0.01))

function barWidth(rate: number) {
  return `${Math.max(2, (rate / maxRate.value) * 100)}%`
}

async function onItemClick(item: CostItem) {
  if (item.key !== 'marketing') return
  if (!activities.value.length) {
    activities.value = await fetchMarketingActivities()
  }
  openMarketing.value = true
}

async function load(showLoading = false) {
  if (showLoading) loading.value = true
  try {
    const data = await fetchCost(dataKey.value, cityName.value)
    items.value = data.items as CostItem[]
  } finally {
    loading.value = false
  }
}

watch([dataKey, cityName, loadingTick], () => load(true), { immediate: true })
watch(costFlashTick, () => {
  flashing.value = true
  window.clearTimeout(flashTimer)
  flashTimer = window.setTimeout(() => {
    flashing.value = false
  }, 1600)
})
onMounted(() => {
  timer = window.setInterval(() => load(false), 60000)
  fetchMarketingActivities().then((list) => {
    activities.value = list
  })
})
onUnmounted(() => {
  clearInterval(timer)
  window.clearTimeout(flashTimer)
})
</script>

<style scoped lang="scss">
.cost-panel {
  --panel-border: rgba(255, 255, 255, 0.06);
}
.cost-panel.is-flash {
  animation: cost-flash 0.8s ease-in-out 2;
}
@keyframes cost-flash {
  0%,
  100% {
    box-shadow:
      inset 0 0 28px rgba(40, 140, 255, 0.08),
      0 0 18px rgba(40, 140, 255, 0.12);
    border-color: rgba(94, 200, 255, 0.18);
  }
  50% {
    box-shadow:
      inset 0 0 28px rgba(255, 124, 0, 0.18),
      0 0 22px rgba(255, 124, 0, 0.55);
    border-color: #ff7c00;
  }
}
.wrap {
  height: 100%;
  min-height: 0;
}
.list {
  margin: 0;
  padding: 0;
  list-style: none;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: space-evenly;
  min-height: 0;
  li {
    height: 36px;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 4px;
    &.clickable {
      cursor: pointer;
      border-radius: 4px;
      padding: 0 4px;
      margin: 0 -4px;
      &:hover {
        background: rgba(255, 124, 0, 0.1);
      }
    }
  }
}
.row {
  display: grid;
  grid-template-columns: 1fr auto 52px;
  gap: 8px;
  align-items: center;
}
.name {
  font-size: 13px;
  color: #fff;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.amount {
  font-size: 12px;
  color: #8899aa;
  font-weight: 400;
  font-family: var(--font-num);
  font-variant-numeric: tabular-nums;
  text-align: right;
}
.rate {
  font-size: 12px;
  font-style: normal;
  font-family: var(--font-num);
  font-variant-numeric: tabular-nums;
  text-align: right;
}
.bar {
  height: 4px;
  border-radius: 2px;
  background: rgba(255, 255, 255, 0.08);
  overflow: hidden;
  i {
    display: block;
    height: 100%;
    border-radius: 2px;
    transition: width 0.6s ease;
  }
}

.popup-mask {
  position: fixed;
  inset: 0;
  z-index: 100;
  background: rgba(2, 8, 24, 0.55);
  display: grid;
  place-items: center;
}
.popup {
  width: min(480px, 90vw);
  max-height: min(420px, 70vh);
  display: flex;
  flex-direction: column;
  border-radius: 8px;
  background: rgba(0, 10, 30, 0.92);
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.45);
  overflow: hidden;
  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    h4 {
      margin: 0;
      color: #fff;
      font-size: 15px;
    }
    button {
      border: 0;
      background: transparent;
      color: #8899aa;
      font-size: 22px;
      cursor: pointer;
      line-height: 1;
    }
  }
  ul {
    margin: 0;
    padding: 8px 0;
    list-style: none;
    overflow: auto;
  }
  li {
    display: grid;
    grid-template-columns: 1.4fr 0.8fr auto 72px;
    gap: 8px;
    align-items: center;
    padding: 8px 16px;
    font-size: 12px;
    &:hover {
      background: rgba(255, 255, 255, 0.04);
    }
  }
  .a-name {
    color: #fff;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .a-store {
    color: #8899aa;
  }
  b {
    color: #feb019;
    font-family: var(--font-num);
    font-variant-numeric: tabular-nums;
  }
  em {
    font-style: normal;
    color: #00e396;
    text-align: right;
    font-family: var(--font-num);
  }
}
.popup-empty {
  padding: 32px;
  text-align: center;
  color: #8899aa;
}
</style>
