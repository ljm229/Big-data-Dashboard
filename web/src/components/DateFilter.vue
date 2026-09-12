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
      @update:model-value="filter.setWeek"
    />

    <SelectMenu
      v-else
      class="ctrl-select ctrl-select--month"
      :variant="variant"
      :model-value="selectedMonthId"
      :options="monthOptions"
      @update:model-value="filter.setMonth"
    />

    <SelectMenu
      v-if="scope === 'cockpit'"
      class="ctrl-select ctrl-select--channel"
      :variant="variant"
      :model-value="channel"
      :options="channelOptions"
      @update:model-value="filter.setChannel"
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
  OPS_DATES,
  fridayOfWeek, thursdayOfWeek, calendarWeekLabel,
} from '../stores/filter'
import SelectMenu from './SelectMenu.vue'
import DatePicker from './DatePicker.vue'

const props = withDefaults(
  defineProps<{
    variant?: 'dark' | 'light'
    scope?: 'cockpit' | 'ops' | 'unified'
  }>(),
  { variant: 'dark', scope: 'unified' },
)

const filter = useFilterStore()
const { selectedDate, selectedWeekId, selectedMonthId, periodMode, channel } = storeToRefs(filter)
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
</script>

<style scoped lang="scss">
.date-bar {
  display: flex;
  flex-direction: row;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px 12px;
  min-width: 0;
}
.seg {
  display: flex;
  border: 1px solid rgba(94, 200, 255, 0.45);
  border-radius: 6px;
  overflow: hidden;
  flex-shrink: 0;
  button {
    border: 0;
    background: transparent;
    color: #ffffff;
    opacity: 0.82;
    padding: 8px 14px;
    font-size: 15px;
    font-weight: 600;
    line-height: 1.2;
    cursor: pointer;
    &.active {
      opacity: 1;
      color: #04122a;
      background: linear-gradient(135deg, #9adfff, #3aa0ff);
      font-weight: 700;
    }
  }
}
.ctrl-date {
  width: 132px;
  flex-shrink: 0;
}
.ctrl-select {
  width: 148px;
  flex-shrink: 0;
}
.ctrl-select--week {
  width: 198px;
}
.ctrl-select--month {
  width: 148px;
}
.ctrl-select--channel {
  width: 128px;
}

.date-bar.light {
  .seg {
    border: 0;
    border-radius: 6px;
    background: transparent;
    gap: 2px;
    button {
      color: #86909c;
      padding: 0 12px;
      height: 32px;
      font-size: 13px;
      font-weight: 600;
      border-radius: 6px;
      &:hover {
        background: #eff6ff;
        color: #1d6bff;
      }
      &.active {
        color: #fff;
        background: linear-gradient(135deg, #1d6bff, #0ea5e9);
        box-shadow: 0 4px 14px rgba(29, 107, 255, 0.28);
        font-weight: 700;
      }
    }
  }
}
</style>
