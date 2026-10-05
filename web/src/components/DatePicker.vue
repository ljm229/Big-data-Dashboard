<!-- 中文名：日期选择 -->
<template>
  <div class="dash-date" :class="{ open, light: variant === 'light' }" ref="root">
    <button type="button" class="dash-date__trigger" @click="toggle">
      <span class="dash-date__label">{{ displayLabel }}</span>
      <span class="dash-date__icon" aria-hidden="true">
        <svg viewBox="0 0 16 16" width="14" height="14" fill="none">
          <rect x="1.5" y="2.5" width="13" height="12" rx="2" stroke="currentColor" stroke-width="1.4" />
          <path d="M1.5 6h13M5 1v3M11 1v3" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" />
        </svg>
      </span>
    </button>

    <Teleport to="body">
      <div
        v-if="open"
        ref="panelEl"
        class="dash-date__panel"
        :class="{ light: variant === 'light' }"
        :style="panelStyle"
        @mousedown.stop
      >
        <div class="dash-date__head">
          <button type="button" class="nav" :disabled="!canPrev" @click="shiftMonth(-1)">‹</button>
          <strong>{{ viewYear }}年{{ viewMonth }}月</strong>
          <button type="button" class="nav" :disabled="!canNext" @click="shiftMonth(1)">›</button>
        </div>
        <div class="dash-date__weekdays">
          <span v-for="w in weekdays" :key="w">{{ w }}</span>
        </div>
        <div class="dash-date__grid">
          <button
            v-for="cell in cells"
            :key="cell.key"
            type="button"
            class="cell"
            :class="{
              mute: !cell.inMonth,
              disabled: !cell.enabled,
              active: cell.iso === modelValue,
              today: cell.iso === todayIso,
            }"
            :disabled="!cell.enabled"
            @click="pick(cell.iso)"
          >
            {{ cell.day }}
          </button>
        </div>
        <p class="dash-date__hint">仅可选有数据日期 · 周口径：周五至周四</p>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useFloatingPanel } from '../composables/useScale'

const props = withDefaults(
  defineProps<{
    modelValue: string
    dates: string[]
    variant?: 'dark' | 'light'
  }>(),
  { variant: 'dark' },
)

const emit = defineEmits<{ 'update:modelValue': [string] }>()

const open = ref(false)
const root = ref<HTMLElement | null>(null)
const panelEl = ref<HTMLElement | null>(null)
const { panelStyle } = useFloatingPanel(root, open, 280)
const weekdays = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']

const available = computed(() => new Set(props.dates))
const sortedDates = computed(() => [...props.dates].sort())

const viewYear = ref(2026)
const viewMonth = ref(1)

function parseIso(iso: string) {
  const [y, m, d] = iso.split('-').map(Number)
  return { y, m, d }
}

function toIso(y: number, m: number, d: number) {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

function syncViewFromValue(iso: string) {
  if (!iso) return
  const { y, m } = parseIso(iso)
  viewYear.value = y
  viewMonth.value = m
}

watch(
  () => props.modelValue,
  (v) => syncViewFromValue(v),
  { immediate: true },
)

const todayIso = computed(() => {
  const n = new Date()
  return toIso(n.getFullYear(), n.getMonth() + 1, n.getDate())
})

const displayLabel = computed(() => {
  if (!props.modelValue) return '选择日期'
  const { m, d } = parseIso(props.modelValue)
  return `${m}月${d}日`
})

const minMonthKey = computed(() => {
  const first = sortedDates.value[0]
  if (!first) return 0
  const { y, m } = parseIso(first)
  return y * 12 + m
})
const maxMonthKey = computed(() => {
  const last = sortedDates.value[sortedDates.value.length - 1]
  if (!last) return 0
  const { y, m } = parseIso(last)
  return y * 12 + m
})
const viewMonthKey = computed(() => viewYear.value * 12 + viewMonth.value)
const canPrev = computed(() => viewMonthKey.value > minMonthKey.value)
const canNext = computed(() => viewMonthKey.value < maxMonthKey.value)

const cells = computed(() => {
  const y = viewYear.value
  const m = viewMonth.value
  const first = new Date(y, m - 1, 1)
  const jsDay = first.getDay()
  const mondayIndex = (jsDay + 6) % 7
  const daysInMonth = new Date(y, m, 0).getDate()
  const prevDays = new Date(y, m - 1, 0).getDate()

  const out: Array<{ key: string; day: number; iso: string; inMonth: boolean; enabled: boolean }> = []
  // 只铺当月实际周数，不固定 6 行，避免末尾整行下月日期撑高
  const weekCount = Math.ceil((mondayIndex + daysInMonth) / 7)
  const total = weekCount * 7
  for (let i = 0; i < total; i++) {
    let day: number
    let iso: string
    let inMonth = true
    if (i < mondayIndex) {
      day = prevDays - mondayIndex + i + 1
      const pm = m === 1 ? 12 : m - 1
      const py = m === 1 ? y - 1 : y
      iso = toIso(py, pm, day)
      inMonth = false
    } else if (i >= mondayIndex + daysInMonth) {
      day = i - mondayIndex - daysInMonth + 1
      const nm = m === 12 ? 1 : m + 1
      const ny = m === 12 ? y + 1 : y
      iso = toIso(ny, nm, day)
      inMonth = false
    } else {
      day = i - mondayIndex + 1
      iso = toIso(y, m, day)
    }
    out.push({
      key: `${iso}-${i}`,
      day,
      iso,
      inMonth,
      enabled: available.value.has(iso),
    })
  }
  return out
})

function shiftMonth(delta: number) {
  const d = new Date(viewYear.value, viewMonth.value - 1 + delta, 1)
  viewYear.value = d.getFullYear()
  viewMonth.value = d.getMonth() + 1
}

function toggle() {
  open.value = !open.value
  if (open.value) syncViewFromValue(props.modelValue || sortedDates.value.at(-1) || '')
}

function pick(iso: string) {
  if (!available.value.has(iso)) return
  emit('update:modelValue', iso)
  open.value = false
}

function onDoc(e: MouseEvent) {
  if (!open.value) return
  const t = e.target as Node
  if (root.value?.contains(t) || panelEl.value?.contains(t)) return
  open.value = false
}

onMounted(() => document.addEventListener('mousedown', onDoc))
onUnmounted(() => document.removeEventListener('mousedown', onDoc))
</script>

<style scoped lang="scss">
.dash-date {
  position: relative;
  flex-shrink: 0;
  width: 132px;
}
.dash-date__trigger {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  width: 100%;
  height: 36px;
  padding: 0 10px 0 12px;
  border: 1px solid var(--border);
  border-radius: 0;
  background: var(--panel-solid);
  color: #e8f3ff;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
}
.dash-date__icon {
  display: inline-flex;
  color: rgba(154, 223, 255, 0.95);
}
.dash-date.light .dash-date__trigger {
  background: transparent;
  border-color: transparent;
  color: #1d2129;
  &:hover {
    background: rgba(0, 0, 0, 0.04);
  }
}
.dash-date.light.open .dash-date__trigger {
  background: rgba(0, 0, 0, 0.04);
}
.dash-date.light .dash-date__icon {
  color: #86909c;
}
</style>

<style lang="scss">
.dash-date__panel {
  width: 280px;
  padding: 10px;
  border: 1px solid rgba(94, 200, 255, 0.5);
  border-radius: 8px;
  background: #0a1e3c;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.5);
  box-sizing: border-box;
}
.dash-date__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}
.dash-date__head strong {
  font-size: 15px;
  color: #e8f3ff;
}
.dash-date__head .nav {
  width: 28px;
  height: 28px;
  border: 1px solid rgba(94, 200, 255, 0.35);
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.06);
  color: #e8f3ff;
  font-size: 16px;
  cursor: pointer;
}
.dash-date__head .nav:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}
.dash-date__weekdays {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 2px;
  margin-bottom: 2px;
}
.dash-date__weekdays span {
  text-align: center;
  font-size: 11px;
  font-family: "Microsoft YaHei", "PingFang SC", system-ui, sans-serif;
  color: rgba(160, 190, 220, 0.75);
  padding: 2px 0;
  letter-spacing: 0;
}
.dash-date__grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 2px;
}
.dash-date__panel .cell {
  height: 30px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: #e8f3ff;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}
.dash-date__panel .cell.mute {
  color: rgba(160, 190, 220, 0.35);
}
.dash-date__panel .cell.disabled {
  opacity: 0.28;
  cursor: not-allowed;
}
.dash-date__panel .cell:not(.disabled):hover {
  background: rgba(94, 200, 255, 0.18);
}
.dash-date__panel .cell.active {
  background: linear-gradient(135deg, #9adfff, #3aa0ff);
  color: #04122a;
}
.dash-date__panel .cell.today:not(.active) {
  box-shadow: inset 0 0 0 1px rgba(154, 223, 255, 0.7);
}
.dash-date__hint {
  margin: 10px 0 0;
  font-size: 12px;
  color: rgba(160, 190, 220, 0.7);
  line-height: 1.35;
}

.dash-date__panel.light {
  background: #fff;
  border-color: #e2e8f0;
  box-shadow: 0 12px 28px rgba(15, 23, 42, 0.14);
}
.dash-date__panel.light .dash-date__head strong {
  color: #1f2937;
}
.dash-date__panel.light .dash-date__head .nav {
  border-color: #e2e8f0;
  background: #f8fafc;
  color: #1f2937;
}
.dash-date__panel.light .dash-date__weekdays span {
  color: #94a3b8;
}
.dash-date__panel.light .cell {
  color: #1f2937;
}
.dash-date__panel.light .cell.mute {
  color: #cbd5e1;
}
.dash-date__panel.light .cell:not(.disabled):hover {
  background: #e2e8f0;
}
.dash-date__panel.light .cell.active {
  background: #1e293b;
  color: #fff;
}
.dash-date__panel.light .dash-date__hint {
  color: #94a3b8;
}
</style>
