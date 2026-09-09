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
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import {
  useFilterStore,
  COCKPIT_DATES,
  COCKPIT_WEEKS,
  COCKPIT_MONTHS,
  COCKPIT_CHANNELS,
  OPS_DATES,
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

const pickerDates = computed(() => {
  if (props.scope === 'cockpit' || props.scope === 'ops') return COCKPIT_DATES
  return [...new Set([...COCKPIT_DATES, ...OPS_DATES])].sort()
})

const weekOptions = computed(() =>
  COCKPIT_WEEKS.map((w) => ({ value: w.id, label: w.label })),
)
const monthOptions = computed(() => COCKPIT_MONTHS.map((m) => ({ value: m.id, label: m.label })))
const channelOptions = computed(() =>
  COCKPIT_CHANNELS.map((c) => ({ value: c, label: c === '全部' ? '全部渠道' : c })),
)
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
}
.ctrl-select {
  width: 148px;
}
.ctrl-select--week {
  width: 118px;
}
.ctrl-select--month {
  width: 148px;
}
.ctrl-select--channel {
  width: 128px;
}

.date-bar.light {
  .seg {
    border-color: #e2e8f0;
    border-radius: 6px;
    background: #fff;
    button {
      color: #94a3b8;
      padding: 0 14px;
      height: 36px;
      font-size: 15px;
      font-weight: 600;
      &.active {
        color: #fff;
        background: #1e293b;
        font-weight: 700;
      }
    }
  }
}
</style>
