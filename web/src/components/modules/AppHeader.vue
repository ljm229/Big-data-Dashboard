<template>
  <header class="header">
    <div class="header__deco left" aria-hidden="true" />
    <div class="header__deco right" aria-hidden="true" />

    <div class="header__left">
      <div class="logo">经营驾驶舱</div>
      <div class="clock">
        <span class="clock__time">{{ clock.time }}</span>
        <span class="clock__meta">{{ clock.week }} · {{ clock.date }}</span>
      </div>
    </div>
    <h1 class="header__title">电商经营数据驾驶舱</h1>
    <div class="header__right">
      <label class="date-filter">
        数据日期
        <input
          type="date"
          :value="selectedDate"
          :min="AVAILABLE_DATES[0]"
          :max="AVAILABLE_DATES[AVAILABLE_DATES.length - 1]"
          @change="onDate"
        />
      </label>
      <p class="date-hint">仅有 {{ dateHint }} 两天 Excel 数据</p>
    </div>
  </header>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useFilterStore, AVAILABLE_DATES } from '../../stores/filter'
import { nowClock } from '../../utils/format'

const filter = useFilterStore()
const { selectedDate } = storeToRefs(filter)
const clock = ref(nowClock())
const dateHint = AVAILABLE_DATES.map((d) => d.slice(5).replace('-', '/') ).join('、')
let timer = 0

onMounted(() => {
  timer = window.setInterval(() => {
    clock.value = nowClock()
  }, 1000)
})
onUnmounted(() => clearInterval(timer))

function onDate(e: Event) {
  filter.setDate((e.target as HTMLInputElement).value)
}
</script>

<style scoped lang="scss">
.header {
  position: relative;
  height: 86px;
  flex-shrink: 0;
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 12px;
  padding: 0 8px;
}
.header__deco {
  position: absolute;
  top: 18px;
  width: min(340px, 28%);
  height: 18px;
  pointer-events: none;
  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 1px;
    background: linear-gradient(90deg, transparent, rgba(126, 208, 255, 0.85), transparent);
    box-shadow: 0 0 8px rgba(94, 200, 255, 0.55);
  }
  &::after {
    content: '';
    position: absolute;
    top: 6px;
    height: 12px;
    background: linear-gradient(180deg, rgba(126, 208, 255, 0.35), rgba(40, 110, 200, 0.08));
    clip-path: polygon(0 0, 100% 0, 92% 100%, 8% 100%);
    border-top: 1px solid rgba(158, 220, 255, 0.55);
  }
  &.left {
    left: 4%;
    &::after {
      left: 8%;
      right: 18%;
      clip-path: polygon(0 0, 100% 0, 96% 100%, 0 100%);
    }
  }
  &.right {
    right: 4%;
    &::after {
      left: 18%;
      right: 8%;
      clip-path: polygon(0 0, 100% 0, 100% 100%, 4% 100%);
    }
  }
}
.header__left {
  display: flex;
  align-items: center;
  gap: 14px;
  z-index: 1;
}
.logo {
  font-size: var(--fs-data);
  font-weight: 700;
  color: #b8dcff;
  letter-spacing: 1px;
  padding: 6px 12px;
  border: 1px solid rgba(94, 200, 255, 0.4);
  background: rgba(20, 70, 140, 0.28);
  box-shadow:
    inset 0 0 12px rgba(94, 200, 255, 0.12),
    0 0 12px rgba(40, 140, 255, 0.18);
  white-space: nowrap;
}
.clock__time {
  display: block;
  font-family: Bahnschrift, DIN, Consolas, monospace;
  font-size: 28px;
  color: #c5dcff;
  line-height: 1.1;
  text-shadow: 0 0 12px rgba(94, 200, 255, 0.35);
}
.clock__meta {
  font-size: var(--fs-axis);
  color: var(--c-muted);
}
.header__title {
  margin: 0;
  font-size: 34px;
  font-weight: 800;
  letter-spacing: 6px;
  text-align: center;
  white-space: nowrap;
  background: linear-gradient(180deg, #f2f8ff 0%, #9ad0ff 55%, #5aa8ff 100%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  position: relative;
  z-index: 1;
  filter: drop-shadow(0 0 10px rgba(94, 200, 255, 0.35));
  &::before,
  &::after {
    content: '';
    position: absolute;
    left: 8%;
    right: 8%;
    height: 1px;
    background: linear-gradient(90deg, transparent, rgba(126, 208, 255, 0.9), transparent);
  }
  &::before {
    top: -10px;
    opacity: 0.7;
  }
  &::after {
    bottom: -8px;
    box-shadow: 0 0 8px rgba(94, 200, 255, 0.55);
  }
}
.header__right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
  z-index: 1;
}
.date-filter {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: var(--fs-data);
  color: var(--c-muted);
  input {
    background: rgba(8, 24, 56, 0.9);
    border: 1px solid rgba(94, 200, 255, 0.4);
    color: #e8f3ff;
    border-radius: 2px;
    padding: 6px 10px;
    font-size: var(--fs-data);
    outline: none;
    color-scheme: dark;
  }
}
.date-hint {
  margin: 0;
  font-size: var(--fs-axis);
  color: var(--c-muted);
}
</style>
