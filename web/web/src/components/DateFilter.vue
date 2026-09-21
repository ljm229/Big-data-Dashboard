<!-- 中文名：日期筛选条 -->
<template>
  <div class="date-bar" :class="{ light: variant === 'light' }">
    <div v-if="scope === 'cockpit' || scope === 'ops'" class="seg">
      <button type="button" :class="{ active: periodMode === 'day' }" @click="filter.setPeriodMode('day')">
        按日
      </button>
      <button type="button" :class="{ active: periodMode === 'week' }" @click="filter.setPeriodMode('week')">
        按周
      </button>
      <button type="button" :class="{ active: periodMode === 'month' }" @click="filter.setPeriodMode('month')">
        按月
      </button>
    </div>

    <DatePicker
      v-if="scope === 'unified' || periodMode === 'day'"
      class="ctrl-date"
      :variant="variant"
      :model-value="selectedDate"
      :dates="pickerDates"
      @update:model-value="filter.setDate"
    />

    <SelectMenu
      v-else-if="periodMode === 'week'"
      class="ctrl-select ctrl-select--week"
      :variant="variant"
      :model-value="selectedWeekId"
      :options="weekOptions"
      @update:model-value="(v) => filter.setWeek(pickOne(v))"
    />

    <SelectMenu
      v-else
      class="ctrl-select ctrl-select--month"
      :variant="variant"
      :model-value="selectedMonthId"
      :options="monthOptions"
      @update:model-value="(v) => filter.setMonth(pickOne(v))"
    />

    <SelectMenu
      v-if="scope === 'cockpit' && showLocation"
      class="ctrl-select ctrl-select--city"
      :variant="variant"
      multiple
      all-value="全国"
      :model-value="selectedCities"
      :options="cityOptions"
      placeholder="全国"
      search-placeholder="搜索城市"
      @update:model-value="onCities"
    />

    <SelectMenu
      v-if="scope === 'cockpit' && showChannel"
      class="ctrl-select ctrl-select--channel"
      :variant="variant"
      :model-value="channel"
      :options="channelOptions"
      placeholder="全部渠道"
      @update:model-value="(v) => filter.setChannel(pickOne(v, '全部'))"
    />

    <SelectMenu
      v-if="scope === 'cockpit' && showLocation"
      class="ctrl-select ctrl-select--store"
      :variant="variant"
      multiple
      all-value="全部"
      :model-value="selectedStores"
      :options="storeOptions"
      search-placeholder="搜索淘宝便利店"
      placeholder="全部门店"
      @update:model-value="onStores"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onUnmounted } from 'vue'
import { getAssessmentAvailableDates } from '../api/dashboard'
import { getOpsPackAvailableDates } from '../api/opsPack'
import { fetchDatabaseCoverage, subscribeQualityUpdates } from '../api/qualityDatabase'
import { storeToRefs } from 'pinia'
import {
  useFilterStore,
  COCKPIT_DATES,
  COCKPIT_WEEKS,
  COCKPIT_MONTHS,
  COCKPIT_CHANNELS,
  COCKPIT_CITIES,
  COCKPIT_STORE_OPTIONS,
  OPS_DATES,
  fridayOfWeek, thursdayOfWeek, calendarWeekLabel,
} from '../stores/filter'
import SelectMenu from './SelectMenu.vue'
import DatePicker from './DatePicker.vue'
import { canonCity } from '../api/source1'
import { storeFilterLabel } from '../utils/storeName'

const props = withDefaults(
  defineProps<{
    variant?: 'dark' | 'light'
    scope?: 'cockpit' | 'ops' | 'unified'
    showLocation?: boolean
    showChannel?: boolean
  }>(),
  { variant: 'dark', scope: 'unified', showLocation: true, showChannel: true },
)

const filter = useFilterStore()
const { selectedDate, selectedWeekId, selectedMonthId, periodMode, channel, selectedCities, selectedStores } = storeToRefs(filter)
const liveDates = ref<string[]>([])
const packDates = getOpsPackAvailableDates()
let initial = true
async function loadDates() {
  if (props.scope !== 'ops') return
  try {
    const coverage = await fetchDatabaseCoverage()
    liveDates.value = [...new Set([...coverage.dates.map(d => d.date), ...packDates])].sort()
    if (initial) {
      filter.setPeriodMode('day')
      filter.setDate(coverage.latestDate || liveDates.value[liveDates.value.length - 1] || new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Shanghai'}))
      initial = false
    }
    const latest = coverage.latestDate
    if (latest) {
      if (!liveWeeks.value.some(w=>w.value===selectedWeekId.value)) filter.selectedWeekId = `${fridayOfWeek(latest)}_${thursdayOfWeek(latest)}`
      if (!liveDates.value.some(d=>d.startsWith(selectedMonthId.value))) filter.selectedMonthId = latest.slice(0,7)
    }
  } catch {
    liveDates.value = [...new Set([...getAssessmentAvailableDates(), ...packDates])].sort()
    if (initial && liveDates.value.length) {
      filter.setPeriodMode('day')
      filter.setDate(liveDates.value[liveDates.value.length - 1])
      initial = false
    }
  }
}
const weekRangeLabel = (start: string, end: string) =>
  `${calendarWeekLabel(start)} · ${start.slice(5).replace('-', '.')}～${end.slice(5).replace('-', '.')}`
const liveWeeks = computed(() => [...new Set(liveDates.value.map(fridayOfWeek))].map(start => {
  const end = thursdayOfWeek(start)
  return { value: `${start}_${end}`, label: weekRangeLabel(start, end) }
}))
const liveMonths = computed(() => [...new Set(liveDates.value.map(d=>d.slice(0,7)))].map(id=>({value:id,label:id})))
const stopUpdates = props.scope === 'ops' ? subscribeQualityUpdates(()=>{void loadDates()}) : ()=>{}
void loadDates()
onUnmounted(stopUpdates)

const pickerDates = computed(() => {
  if (props.scope === 'ops') return liveDates.value
  if (props.scope === 'cockpit') return COCKPIT_DATES
  return [...new Set([...COCKPIT_DATES, ...OPS_DATES])].sort()
})

const weekOptions = computed(() =>
  props.scope === 'ops'
    ? liveWeeks.value
    : COCKPIT_WEEKS.map((w) => ({ value: w.id, label: weekRangeLabel(w.start, w.end) })),
)
const monthOptions = computed(() => props.scope === 'ops' ? liveMonths.value : COCKPIT_MONTHS.map((m) => ({ value: m.id, label: m.label })))
const channelOptions = computed(() =>
  COCKPIT_CHANNELS.map((c) => ({ value: c, label: c === '全部' ? '全部渠道' : c })),
)
const cityOptions = computed(() => COCKPIT_CITIES.map((c) => ({ value: c, label: c })))
const storeOptions = computed(() => {
  const cities = selectedCities.value
  const inCity = COCKPIT_STORE_OPTIONS.filter((s) => {
    if (!cities.length) return true
    return cities.some((c) => canonCity(s.city) === canonCity(c))
  })
  return [{ value: '全部', label: '全部门店' }, ...inCity.map((s) => ({ value: s.name, label: storeFilterLabel(s.name) }))]
})
function onCities(value: string | string[]) {
  filter.setCities(Array.isArray(value) ? value : value ? [value] : [])
}
function onStores(value: string | string[]) {
  filter.setStores(Array.isArray(value) ? value : value ? [value] : [])
}
function pickOne(value: string | string[], fallback = '') {
  return Array.isArray(value) ? value[0] || fallback : value || fallback
}
</script>

<style scoped lang="scss">
.date-bar {
  display: flex;
  flex-direction: row;
  align-items: center;
  flex-wrap: nowrap;
  gap: 8px;
  min-width: 0;
}
.seg {
  display: flex;
  border: 1px solid var(--border);
  border-radius: 0;
  overflow: hidden;
  flex-shrink: 0;
  button {
    border: 0;
    background: var(--panel);
    color: var(--c-body);
    opacity: 1;
    padding: 6px 10px;
    font-size: 13px;
    font-weight: 600;
    line-height: 1.2;
    cursor: pointer;
    &.active {
      opacity: 1;
      color: #fff;
      background: var(--panel-head);
      font-weight: 700;
    }
  }
}
.ctrl-date {
  width: 118px;
  flex-shrink: 0;
}
.ctrl-select {
  width: 118px;
  flex-shrink: 0;
}
.ctrl-select--week {
  width: 168px;
}
.ctrl-select--month {
  width: 118px;
}
.ctrl-select--channel {
  width: 118px;
}
.ctrl-select--city {
  width: 92px;
}
.ctrl-select--store {
  width: 138px;
}

.date-bar.light {
  .seg {
    border: 1px solid #dbe4f0;
    border-radius: 6px;
    background: #f3f7fc;
    gap: 0;
    overflow: hidden;
    button {
      color: #4e5969;
      background: transparent;
      padding: 0 8px;
      height: 32px;
      font-size: 12px;
      font-weight: 600;
      border-radius: 0;
      &:hover {
        background: #e8f1ff;
        color: #1d6bff;
      }
      &.active {
        color: #fff;
        background: linear-gradient(135deg, #1d6bff, #0ea5e9);
        box-shadow: none;
        font-weight: 700;
      }
    }
  }
}
</style>
