<!-- 中文名：流量看板容器——门店健康 / 城市维度 / 趋势异动 -->
<template>
  <div class="ck-page traffic-board">
    <nav class="tb-tabs">
      <button v-for="t in tabs" :key="t.id" type="button" :class="{ active: view === t.id }" @click="view = t.id">{{ t.label }}</button>
      <span class="tb-period">流量数据 {{ TRAFFIC_FROM }} ~ {{ TRAFFIC_TO }}</span>
    </nav>
    <TrafficStoreHealth v-if="view === 'store'" :scope="scope" />
    <TrafficCityBoard v-else-if="view === 'city'" :scope="scope" />
    <TrafficTrendMonitor v-else :scope="scope" />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useFilterStore } from '../../stores/filter'
import { trafficDimension } from '../../api/trafficSummary'
import { TRAFFIC_FROM, TRAFFIC_TO, clampRange, normList, type TrafficScope } from '../../api/traffic'
import TrafficStoreHealth from './TrafficStoreHealth.vue'
import TrafficCityBoard from './TrafficCityBoard.vue'
import TrafficTrendMonitor from './TrafficTrendMonitor.vue'

const filter = useFilterStore()
const { periodRange, cityQuery, storeQuery } = storeToRefs(filter)

const view = ref<'store' | 'city' | 'trend'>('store')
const tabs = [
  { id: 'store' as const, label: '门店排行与健康度' },
  { id: 'city' as const, label: '城市维度' },
  { id: 'trend' as const, label: '趋势与异动监控' },
]

const scope = computed<TrafficScope>(() => {
  const [from, to] = clampRange(periodRange.value.from, periodRange.value.to)
  return {
    from,
    to,
    cities: normList(cityQuery.value),
    stores: normList(storeQuery.value),
    dims: [trafficDimension.value],
  }
})
</script>

<style scoped lang="scss">
.traffic-board { gap: 10px; }
.tb-tabs { display: flex; gap: 8px; align-items: center; }
.tb-tabs button {
  border: 1px solid #e2e8f0; background: #fff; color: #475569;
  padding: 6px 14px; border-radius: 8px; font-size: 13px; cursor: pointer;
}
.tb-tabs button.active { background: #2f8cff; border-color: #2f8cff; color: #fff; font-weight: 700; }
.tb-period { margin-left: auto; color: #94a3b8; font-size: 12px; }
</style>
