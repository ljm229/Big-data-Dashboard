import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import raw from '../data/dashboard.json'
import { getOpsAvailableDates, hasOpsData as opsHasData } from '../api/opsDashboard'

type WeekMeta = { id: string; label: string; start: string; end: string; days: string[] }

const rawDays: string[] = (raw as { days?: string[] }).days || []
const rawWeeks: WeekMeta[] = (raw as { weeks?: WeekMeta[] }).weeks || []
const rawChannels: string[] = (raw as { channels?: string[] }).channels || ['全部']

/** 大屏可选自然日（ISO） */
export const COCKPIT_DAYS = rawDays.length
  ? rawDays
  : Object.keys((raw as { storeRank?: Record<string, unknown> }).storeRank || {})
      .filter((k) => !k.startsWith('W:'))
      .sort()

export const COCKPIT_WEEKS = rawWeeks
export const COCKPIT_CHANNELS = rawChannels

/** 兼容旧引用：默认日期列表 = 日列表 */
export const COCKPIT_DATES = COCKPIT_DAYS
export const AVAILABLE_DATES = COCKPIT_DATES

/** 旧 DATE_TO_KEY：ISO 即 dataKey */
export const DATE_TO_KEY: Record<string, string> = Object.fromEntries(COCKPIT_DAYS.map((d) => [d, d]))

export const OPS_DATES = getOpsAvailableDates()
export const UNIFIED_DATES = [...new Set([...COCKPIT_DATES, ...OPS_DATES])].sort()

function shiftDay(iso: string, delta: number) {
  const d = new Date(`${iso}T12:00:00`)
  d.setDate(d.getDate() + delta)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function weekIndex(id: string) {
  return COCKPIT_WEEKS.findIndex((w) => w.id === id)
}

export type PeriodMode = 'day' | 'week'
export type StoreSortBy = 'default' | 'refund_amount' | 'refund_rate' | 'refund_orders' | 'inafter_ratio'

const defaultDay =
  (raw as { primaryDate?: string }).primaryDate || COCKPIT_DAYS[COCKPIT_DAYS.length - 1] || ''
const defaultWeek = COCKPIT_WEEKS[COCKPIT_WEEKS.length - 1]?.id || ''

export const useFilterStore = defineStore('filter', () => {
  const periodMode = ref<PeriodMode>('day')
  const selectedDate = ref(defaultDay)
  const selectedWeekId = ref(defaultWeek)
  const channel = ref('全部')
  const cityId = ref('all')
  const cityName = ref('全国')
  const abnormalOnly = ref(false)
  const drawer = ref<{ type: 'city' | 'store'; payload: Record<string, unknown> } | null>(null)
  const updatedAt = ref('')
  const loadingTick = ref(0)
  const costFlashTick = ref(0)
  const productFlashNames = ref<string[]>([])
  const focusStoreName = ref('')
  const storeSortBy = ref<StoreSortBy>('default')

  /** 当前取数键：日=ISO；周=W:weekId */
  const dataKey = computed(() => {
    if (periodMode.value === 'week') {
      return selectedWeekId.value ? `W:${selectedWeekId.value}` : ''
    }
    return selectedDate.value || ''
  })

  const hasData = computed(() => {
    const key = dataKey.value
    if (!key) return false
    const ranks = (raw as { storeRank?: Record<string, unknown[]> }).storeRank
    return !!(ranks && ranks[key])
  })

  const hasOpsData = computed(() => opsHasData(selectedDate.value))
  const hasCockpitData = computed(() => hasData.value)

  /** 环比对照键：日→昨天；周→上一周 */
  const compareKey = computed(() => {
    if (periodMode.value === 'week') {
      const i = weekIndex(selectedWeekId.value)
      if (i <= 0) return null
      return `W:${COCKPIT_WEEKS[i - 1].id}`
    }
    const prev = shiftDay(selectedDate.value, -1)
    return COCKPIT_DAYS.includes(prev) ? prev : null
  })

  /** 周同比对照键：日→上周同一天；周→上上周（有则） */
  const wowKey = computed(() => {
    if (periodMode.value === 'week') {
      const i = weekIndex(selectedWeekId.value)
      if (i <= 1) return i === 1 ? `W:${COCKPIT_WEEKS[0].id}` : null
      return `W:${COCKPIT_WEEKS[i - 2].id}`
    }
    const prev = shiftDay(selectedDate.value, -7)
    return COCKPIT_DAYS.includes(prev) ? prev : null
  })

  const compareDate = computed(() => compareKey.value || '')
  const compareLabel = computed(() => {
    if (!compareKey.value) return ''
    if (compareKey.value.startsWith('W:')) {
      const id = compareKey.value.slice(2)
      return COCKPIT_WEEKS.find((w) => w.id === id)?.label || id
    }
    return compareKey.value.slice(5).replace('-', '月') + '日'
  })

  let focusTimer = 0
  let flashTimer = 0

  function setPeriodMode(mode: PeriodMode) {
    periodMode.value = mode
    bump()
  }

  function setDate(iso: string) {
    selectedDate.value = iso
    // 若该日属于某周，同步周选择
    const w = COCKPIT_WEEKS.find((x) => x.days.includes(iso))
    if (w) selectedWeekId.value = w.id
    bump()
  }

  function setWeek(weekId: string) {
    selectedWeekId.value = weekId
    const w = COCKPIT_WEEKS.find((x) => x.id === weekId)
    if (w?.end) selectedDate.value = w.end
    bump()
  }

  function setChannel(name: string) {
    channel.value = name || '全部'
    bump()
  }

  function setCity(id: string, name: string) {
    cityId.value = id
    cityName.value = name
    bump()
  }

  function setAbnormalOnly(value: boolean) {
    abnormalOnly.value = value
  }

  function flashCostPanel() {
    costFlashTick.value++
  }

  function flashProductStores(names: string[]) {
    productFlashNames.value = names
    window.clearTimeout(flashTimer)
    flashTimer = window.setTimeout(() => {
      productFlashNames.value = []
    }, 2400)
  }

  function focusStore(name: string) {
    focusStoreName.value = name
    window.clearTimeout(focusTimer)
    focusTimer = window.setTimeout(() => {
      focusStoreName.value = ''
    }, 3200)
  }

  function setStoreSortBy(value: StoreSortBy) {
    storeSortBy.value = value
  }

  function openDrawer(type: 'city' | 'store', payload: Record<string, unknown>) {
    drawer.value = { type, payload }
  }

  function closeDrawer() {
    drawer.value = null
  }

  function bump() {
    loadingTick.value++
  }

  return {
    periodMode,
    selectedDate,
    selectedWeekId,
    channel,
    cityId,
    cityName,
    abnormalOnly,
    drawer,
    updatedAt,
    loadingTick,
    costFlashTick,
    productFlashNames,
    focusStoreName,
    storeSortBy,
    dataKey,
    hasData,
    hasOpsData,
    hasCockpitData,
    compareDate,
    compareKey,
    wowKey,
    compareLabel,
    setPeriodMode,
    setDate,
    setWeek,
    setChannel,
    setCity,
    setAbnormalOnly,
    flashCostPanel,
    flashProductStores,
    focusStore,
    setStoreSortBy,
    openDrawer,
    closeDrawer,
    bump,
  }
})
