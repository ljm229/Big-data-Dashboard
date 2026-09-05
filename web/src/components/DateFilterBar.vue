<template>
  <div class="date-bar" :class="{ light: variant === 'light' }">
    <div v-if="scope === 'cockpit' || scope === 'ops'" class="seg">
      <button type="button" :class="{ active: periodMode === 'day' }" @click="filter.setPeriodMode('day')">
        按日
      </button>
      <button type="button" :class="{ active: periodMode === 'week' }" @click="filter.setPeriodMode('week')">
        按周
      </button>
    </div>

    <input
      v-if="scope === 'unified' || periodMode === 'day'"
      type="date"
      class="ctrl"
      :value="selectedDate"
      :min="pickerDates[0]"
      :max="pickerDates[pickerDates.length - 1]"
      @change="onDate"
    />

    <select v-else class="ctrl" :value="selectedWeekId" @change="onWeek">
      <option v-for="w in COCKPIT_WEEKS" :key="w.id" :value="w.id">{{ w.label }}</option>
    </select>

    <select v-if="scope === 'cockpit'" class="ctrl ctrl--channel" :value="channel" @change="onChannel">
      <option v-for="c in COCKPIT_CHANNELS" :key="c" :value="c">{{ c === '全部' ? '全部渠道' : c }}</option>
    </select>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import {
  useFilterStore,
  COCKPIT_DATES,
  COCKPIT_WEEKS,
  COCKPIT_CHANNELS,
  OPS_DATES,
} from '../stores/filter'

const props = withDefaults(
  defineProps<{
    variant?: 'dark' | 'light'
    scope?: 'cockpit' | 'ops' | 'unified'
  }>(),
  { variant: 'dark', scope: 'unified' },
)

const filter = useFilterStore()
const { selectedDate, selectedWeekId, periodMode, channel } = storeToRefs(filter)

const pickerDates = computed(() => {
  // 营运考核按周落在大屏日期内；运营明细仅个别日有
  if (props.scope === 'cockpit' || props.scope === 'ops') return COCKPIT_DATES
  return [...new Set([...COCKPIT_DATES, ...OPS_DATES])].sort()
})

function onDate(e: Event) {
  filter.setDate((e.target as HTMLInputElement).value)
}
function onWeek(e: Event) {
  filter.setWeek((e.target as HTMLSelectElement).value)
}
function onChannel(e: Event) {
  filter.setChannel((e.target as HTMLSelectElement).value)
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
  border: 1px solid rgba(94, 200, 255, 0.4);
  border-radius: 6px;
  overflow: hidden;
  flex-shrink: 0;
  button {
    border: 0;
    background: transparent;
    color: #9eb6d0;
    padding: 6px 11px;
    font-size: 12px;
    cursor: pointer;
    &.active {
      color: #04122a;
      background: linear-gradient(135deg, #9adfff, #3aa0ff);
      font-weight: 700;
    }
  }
}
.ctrl {
  background: rgba(8, 24, 56, 0.85);
  border: 1px solid rgba(94, 200, 255, 0.4);
  color: #e8f3ff;
  border-radius: 6px;
  padding: 5px 8px;
  font-size: 12px;
  outline: none;
  color-scheme: dark;
  height: 30px;
  box-sizing: border-box;
  max-width: 148px;
}
.ctrl--channel {
  max-width: 118px;
}
select.ctrl option {
  background: #0a1e3c;
  color: #e8f3ff;
}

.date-bar.light {
  .seg {
    border-color: rgba(42, 92, 130, 0.25);
    button {
      color: #5a6a7a;
      &.active {
        color: #fff;
        background: #2a5c82;
      }
    }
  }
  .ctrl {
    background: rgba(255, 255, 255, 0.95);
    border: 1px solid rgba(42, 92, 130, 0.22);
    color: #2a5c82;
    color-scheme: light;
  }
}
</style>
