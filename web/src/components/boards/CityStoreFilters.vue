<template>
  <div class="map-filters" aria-label="城市和门店筛选">
    <div class="map-filter">
      <span>城市</span>
      <SelectMenu
        class="map-city-select"
        multiple
        all-value="全国"
        :model-value="selectedCities"
        :options="cityOptions"
        placeholder="全国"
        search-placeholder="搜索城市"
        @update:model-value="onCities"
      />
    </div>
    <div class="map-filter">
      <span>门店</span>
      <SelectMenu
        class="map-store-select"
        multiple
        all-value="全部"
        :model-value="selectedStores"
        :options="storeOptions"
        placeholder="全部门店"
        search-placeholder="搜索门店"
        @update:model-value="onStores"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import SelectMenu from '../SelectMenu.vue'
import { useFilterStore, COCKPIT_CITIES, COCKPIT_STORE_OPTIONS } from '../../stores/filter'
import { canonCity } from '../../api/source1'
const emit = defineEmits<{ 'city-picked': [string[]]; 'store-picked': [string[]] }>()
const filter = useFilterStore()
const { selectedCities, selectedStores } = storeToRefs(filter)
const cityOptions = COCKPIT_CITIES.map((city) => ({ value: city, label: city }))
const storeOptions = computed(() => [
  { value: '全部', label: '全部门店' },
  ...COCKPIT_STORE_OPTIONS
    .filter((store) => store.city && store.status)
    .filter((store) => {
      if (!selectedCities.value.length) return true
      return selectedCities.value.some((c) => canonCity(store.city) === canonCity(c))
    })
    .map((store) => ({ value: store.name, label: store.name })),
])
function onCities(value: string | string[]) {
  const names = Array.isArray(value) ? value : value ? [value] : []
  filter.setCities(names)
  emit('city-picked', filter.selectedCities)
}
function onStores(value: string | string[]) {
  const names = Array.isArray(value) ? value : value ? [value] : []
  filter.setStores(names)
  emit('store-picked', filter.selectedStores)
}
</script>

<style scoped>
.map-filters, .map-filter { display: flex; align-items: center; gap: 8px; }
.map-filters { gap: 14px; }
.map-filter > span { font-size: 14px; color: var(--muted); white-space: nowrap; }
.map-city-select { width: 120px; }
.map-store-select { width: 180px; }
.map-filter :deep(.dash-select__trigger) { height: 32px; background: var(--panel-deep); font-size: 15px; border-color: var(--border); }
</style>
