<!-- 中文名：成本看板 -->
<template>
  <Panel
    class="cost-panel"
    :class="{ 'is-flash': flashing }"
    title="成本&优惠结构"
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
      <div v-if="openMarketing" class="cost-popup-mask" :style="maskStyle" @click.self="openMarketing = false">
        <div class="cost-popup" :style="popupStyle">
          <header>
            <div>
              <h4>营销费用明细</h4>
              <p class="cost-popup__sub">数据源 · 经营分析{{ cityName === '全国' ? '-城市' : '-门店' }}</p>
            </div>
            <button type="button" @click="openMarketing = false">×</button>
          </header>
          <div v-if="!activities.length" class="cost-popup__empty">暂无活动明细</div>
          <ul v-else>
            <li v-for="(a, i) in activities" :key="`${a.name}-${i}`">
              <span class="a-name" :title="a.name">{{ a.name }}</span>
              <span class="a-store">{{ a.store }}</span>
              <b>{{ formatMoney(a.cost) }}</b>
              <em v-if="a.paid">实付 {{ formatMoney(a.paid) }}</em>
            </li>
          </ul>
        </div>
      </div>
    </Teleport>
  </Panel>
</template>

<script setup lang="ts">
import { computed, inject, onMounted, onUnmounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import Panel from '../Panel.vue'
import { useFilterStore } from '../../stores/filter'
import { fetchCost, fetchMarketingActivities } from '../../api/dashboard'
import { formatMoney, formatPercent } from '../../utils/format'
import { SCREEN_SCALE_KEY } from '../../composables/useScale'

type CostItem = {
  item: string
  amount: number
  rate: number
  color: string
  key: string
}

const filter = useFilterStore()
const { dataKey, cityName, cityQuery, channel, loadingTick, costFlashTick } = storeToRefs(filter)
const loading = ref(true)
const items = ref<CostItem[]>([])
const activities = ref<{ name: string; cost: number; store: string; paid?: number }[]>([])
const openMarketing = ref(false)
const flashing = ref(false)
const screenScale = inject(SCREEN_SCALE_KEY, ref(1))
let timer = 0
let flashTimer = 0

const s = computed(() => Math.max(screenScale.value || 1, 0.01))
const maskStyle = computed(() => ({ zIndex: 5600 }))
const popupStyle = computed(() => ({
  transform: `scale(${s.value})`,
  transformOrigin: 'center center',
}))

const maxRate = computed(() => Math.max(...items.value.map((i) => i.rate), 0.01))

function barWidth(rate: number) {
  return `${Math.max(2, (rate / maxRate.value) * 100)}%`
}

async function loadActivities() {
  if (!dataKey.value) {
    activities.value = []
    return
  }
  const cityParam = Array.isArray(cityQuery.value) ? cityQuery.value.join('|') : cityQuery.value
  activities.value = await fetchMarketingActivities(dataKey.value, cityParam)
}

async function onItemClick(item: CostItem) {
  if (item.key !== 'marketing') return
  if (!activities.value.length) await loadActivities()
  openMarketing.value = true
}

async function load(showLoading = false) {
  if (showLoading) loading.value = true
  try {
    const cityParam = Array.isArray(cityQuery.value) ? cityQuery.value.join('|') : cityQuery.value
    const data = await fetchCost(dataKey.value, cityParam, channel.value)
    items.value = data.items as CostItem[]
  } finally {
    loading.value = false
  }
}

watch(
  [dataKey, cityQuery, channel, loadingTick],
  () => {
    void load(true)
    void loadActivities()
  },
  { immediate: true },
)
watch(costFlashTick, () => {
  flashing.value = true
  window.clearTimeout(flashTimer)
  flashTimer = window.setTimeout(() => {
    flashing.value = false
  }, 1600)
})
onMounted(() => {
  timer = window.setInterval(() => load(false), 60000)
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
    min-height: 36px;
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
  font-weight: 600;
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
  font-weight: 600;
}
.bar {
  height: 4px;
  border-radius: 2px;
  background: rgba(255, 255, 255, 0.08);
  overflow: hidden;
  i {
    display: block;
    height: 100%;
    border-radius: 3px;
    transition: width 0.6s ease;
  }
}
</style>

<!-- Teleport 到 body，样式不能 scoped -->
<style lang="scss">
.cost-popup-mask {
  position: fixed;
  inset: 0;
  background: rgba(2, 8, 24, 0.55);
  display: grid;
  place-items: center;
}
.cost-popup {
  width: min(560px, 90vw);
  max-height: min(480px, 72vh);
  display: flex;
  flex-direction: column;
  border-radius: 10px;
  background: rgba(0, 10, 30, 0.96);
  border: 1px solid rgba(94, 200, 255, 0.35);
  box-shadow: 0 20px 56px rgba(0, 0, 0, 0.55);
  overflow: hidden;
  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 18px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    h4 {
      margin: 0;
      color: #fff;
      font-size: 16px;
      font-weight: 700;
    }
    button {
      border: 0;
      background: transparent;
      color: #8899aa;
      font-size: 24px;
      cursor: pointer;
      line-height: 1;
    }
  }
  &__sub {
    margin: 4px 0 0;
    font-size: 12px;
    color: #8899aa;
  }
  ul {
    margin: 0;
    padding: 8px 0;
    list-style: none;
    overflow: auto;
  }
  li {
    display: grid;
    grid-template-columns: 1.5fr 0.9fr auto 88px;
    gap: 10px;
    align-items: center;
    padding: 10px 18px;
    font-size: 13px;
    &:hover {
      background: rgba(255, 255, 255, 0.04);
    }
  }
  .a-name {
    color: #fff;
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .a-store {
    color: #9bb0cc;
    font-size: 12px;
  }
  b {
    color: #feb019;
    font-size: 14px;
    font-family: var(--font-num);
    font-variant-numeric: tabular-nums;
  }
  em {
    font-style: normal;
    color: #00e396;
    text-align: right;
    font-size: 12px;
    font-family: var(--font-num);
  }
  &__empty {
    padding: 36px;
    text-align: center;
    color: #8899aa;
    font-size: 14px;
  }
}
</style>
