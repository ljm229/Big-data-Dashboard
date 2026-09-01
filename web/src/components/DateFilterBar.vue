<template>
  <div class="date-bar" :class="{ light: variant === 'light' }">
    <label class="date-bar__field">
      <span>数据日期</span>
      <input
        type="date"
        :value="selectedDate"
        :min="UNIFIED_DATES[0]"
        :max="UNIFIED_DATES[UNIFIED_DATES.length - 1]"
        @change="onDate"
      />
    </label>
    <div class="date-bar__tags">
      <span v-if="hasCockpitData" class="tag tag--cockpit">大屏</span>
      <span v-if="hasOpsData" class="tag tag--ops">看板</span>
      <span v-if="!hasCockpitData && !hasOpsData" class="tag tag--empty">无数据</span>
    </div>
    <p class="date-bar__hint">{{ hint }}</p>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import {
  useFilterStore,
  COCKPIT_DATES,
  OPS_DATES,
  UNIFIED_DATES,
} from '../stores/filter'

withDefaults(
  defineProps<{
    variant?: 'dark' | 'light'
  }>(),
  { variant: 'dark' },
)

const filter = useFilterStore()
const { selectedDate, hasCockpitData, hasOpsData } = storeToRefs(filter)

const fmt = (iso: string) => iso.slice(5).replace('-', '/')

const hint = computed(() => {
  const cockpit = COCKPIT_DATES.map(fmt).join('、')
  const ops = OPS_DATES.map(fmt).join('、')
  return `大屏 ${cockpit} · 看板 ${ops || '暂无'} · 切换视图日期联动`
})

function onDate(e: Event) {
  filter.setDate((e.target as HTMLInputElement).value)
}
</script>

<style scoped lang="scss">
.date-bar {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
  min-width: 0;
}
.date-bar__field {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: var(--fs-data, 13px);
  color: var(--c-muted, #9eb6d0);
  span {
    white-space: nowrap;
  }
  input {
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(94, 200, 255, 0.45);
    color: #e8f3ff;
    border-radius: 6px;
    padding: 6px 10px;
    font-size: var(--fs-data, 13px);
    outline: none;
    color-scheme: dark;
  }
}
.date-bar__tags {
  display: flex;
  gap: 6px;
}
.tag {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 999px;
  font-weight: 700;
  &--cockpit {
    color: #04122a;
    background: linear-gradient(135deg, #9adfff, #3aa0ff);
  }
  &--ops {
    color: #fff;
    background: rgba(42, 92, 130, 0.85);
    border: 1px solid rgba(255, 255, 255, 0.25);
  }
  &--empty {
    color: #ffc53d;
    background: rgba(255, 197, 61, 0.12);
    border: 1px solid rgba(255, 197, 61, 0.35);
  }
}
.date-bar__hint {
  margin: 0;
  font-size: 11px;
  color: var(--c-muted, #9eb6d0);
  text-align: right;
  max-width: 280px;
  line-height: 1.35;
}
.date-bar.light {
  .date-bar__field {
    color: #2a5c82;
    input {
      background: rgba(255, 255, 255, 0.95);
      border: 1px solid rgba(42, 92, 130, 0.22);
      color: #2a5c82;
      color-scheme: light;
    }
  }
  .date-bar__hint {
    color: #8c8c8c;
  }
  .tag--ops {
    color: #fff;
    background: #2a5c82;
    border-color: transparent;
  }
}
</style>
