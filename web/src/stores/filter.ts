import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import raw from '../data/dashboard.json'
import { getOpsAvailableDates, hasOpsData as opsHasData } from '../api/opsDashboard'

type WeekMeta = { id: string; label: string; start: string; end: string; days: string[] }
type MonthMeta = { id: string; label: string; start: string; end: string; days: string[] }

const rawDays: string[] = (raw as { days?: string[] }).days || []
const rawWeeks: WeekMeta[] = (raw as { weeks?: WeekMeta[] }).weeks || []
const rawMonths: MonthMeta[] = (raw as { months?: MonthMeta[] }).months || []
const rawChannels: string[] = (raw as { channels?: string[] }).channels || ['全部']

/** 大屏可选自然日（ISO） */
export const COCKPIT_DAYS = rawDays.length
  ? rawDays
  : Object.keys((raw as { storeRank?: Record<string, unknown> }).storeRank || {})
      .filter((k) => !k.startsWith('W:') && !k.startsWith('M:'))
      .sort()

export const COCKPIT_CHANNELS = rawChannels

/** 周五=周起点，周四=周终点（上周五 → 下周四） */
function pad2(n: number) {
  return String(n).padStart(2, '0')
}
function toIsoFromDate(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}
export function fridayOfWeek(iso: string) {
  const d = new Date(`${iso}T12:00:00`)
  // Fri=0 … Thu=6
  const sinceFri = (d.getDay() + 2) % 7
  d.setDate(d.getDate() - sinceFri)
  return toIsoFromDate(d)
}
export function thursdayOfWeek(iso: string) {
  const d = new Date(`${fridayOfWeek(iso)}T12:00:00`)
  d.setDate(d.getDate() + 6)
  return toIsoFromDate(d)
}
/**
 * 日历周标签：归属周五所在月，该月内第几个周五 →「8月第3周」
 * 周窗口仍为周五→周四。
 */
export function calendarWeekLabel(friIso: string) {
  const fri = new Date(`${friIso}T12:00:00`)
  if (Number.isNaN(fri.getTime())) return friIso
  const y = fri.getFullYear()
  const m = fri.getMonth()
  let ordinal = 0
  for (let day = 1; day <= fri.getDate(); day++) {
    const dt = new Date(y, m, day, 12)
    if (dt.getDay() === 5) ordinal++
  }
  return `${m + 1}月第${ordinal}周`
}

function friThuWeekLabel(start: string, _end?: string) {
  const fri = fridayOfWeek(start || '')
  return calendarWeekLabel(fri)
}

/** 数据最新日：未结束的周（周四晚于此日）不进入可选列表 */
const latestDataDay = COCKPIT_DAYS[COCKPIT_DAYS.length - 1] || ''

/** 周列表：标签为「M月第N周」；仅展示已结束的周五→周四周 */
export const COCKPIT_WEEKS: WeekMeta[] = rawWeeks
  .map((w) => {
    const fri = fridayOfWeek(w.start || w.days?.[0] || '')
    const thu = thursdayOfWeek(fri)
    return {
      fri,
      thu,
      week: {
        ...w,
        start: fri || w.start,
        end: w.end || thu,
        label: friThuWeekLabel(w.start || w.days?.[0] || '', w.end || ''),
      } satisfies WeekMeta,
    }
  })
  .filter((x) => !!x.thu && !!latestDataDay && x.thu <= latestDataDay)
  .map((x) => x.week)

/** 按自然月（无 months 元数据时从日列表推导） */
export const COCKPIT_MONTHS: MonthMeta[] = rawMonths.length
  ? rawMonths
  : (() => {
      const map: Record<string, string[]> = {}
      COCKPIT_DAYS.forEach((d) => {
        const ym = d.slice(0, 7)
        if (!map[ym]) map[ym] = []
        map[ym].push(d)
      })
      return Object.keys(map)
        .sort()
        .map((ym) => {
          const days = map[ym].sort()
          const [y, mo] = ym.split('-')
          return {
            id: ym,
            label: `${Number(y)}年${Number(mo)}月`,
            start: days[0],
            end: days[days.length - 1],
            days,
          }
        })
    })()

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

function monthIndex(id: string) {
  return COCKPIT_MONTHS.findIndex((m) => m.id === id)
}

export type PeriodMode = 'day' | 'week' | 'month'
export type StoreSortBy = 'default' | 'refund_amount' | 'refund_rate' | 'refund_orders' | 'inafter_ratio'

const defaultDay =
  (raw as { primaryDate?: string }).primaryDate || COCKPIT_DAYS[COCKPIT_DAYS.length - 1] || ''
const defaultWeek = COCKPIT_WEEKS[COCKPIT_WEEKS.length - 1]?.id || ''
const defaultMonth =
  COCKPIT_MONTHS.find((m) => m.days.includes(defaultDay))?.id ||
  COCKPIT_MONTHS[COCKPIT_MONTHS.length - 1]?.id ||
  ''

export const useFilterStore = defineStore('filter', () => {
  const periodMode = ref<PeriodMode>('day')
  const selectedDate = ref(defaultDay)
  const selectedWeekId = ref(defaultWeek)
  const selectedMonthId = ref(defaultMonth)
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

  /** 当前取数键：日=ISO；周=W:weekId；月=M:YYYY-MM */
  const dataKey = computed(() => {
    if (periodMode.value === 'week') {
      return selectedWeekId.value ? `W:${selectedWeekId.value}` : ''
    }
    if (periodMode.value === 'month') {
      return selectedMonthId.value ? `M:${selectedMonthId.value}` : ''
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

  /** 环比对照键：日→昨天；周→上一周；月→上一月 */
  const compareKey = computed(() => {
    if (periodMode.value === 'week') {
      const i = weekIndex(selectedWeekId.value)
      if (i <= 0) return null
      return `W:${COCKPIT_WEEKS[i - 1].id}`
    }
    if (periodMode.value === 'month') {
      const i = monthIndex(selectedMonthId.value)
      if (i <= 0) return null
      return `M:${COCKPIT_MONTHS[i - 1].id}`
    }
    const prev = shiftDay(selectedDate.value, -1)
    return COCKPIT_DAYS.includes(prev) ? prev : null
  })

  /** 周同比对照键：日→上周同一天；周→上上周；月→上上月（有则） */
  const wowKey = computed(() => {
    if (periodMode.value === 'week') {
      const i = weekIndex(selectedWeekId.value)
      if (i <= 1) return i === 1 ? `W:${COCKPIT_WEEKS[0].id}` : null
      return `W:${COCKPIT_WEEKS[i - 2].id}`
    }
    if (periodMode.value === 'month') {
      const i = monthIndex(selectedMonthId.value)
      if (i <= 1) return i === 1 ? `M:${COCKPIT_MONTHS[0].id}` : null
      return `M:${COCKPIT_MONTHS[i - 2].id}`
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
    if (compareKey.value.startsWith('M:')) {
      const id = compareKey.value.slice(2)
      return COCKPIT_MONTHS.find((m) => m.id === id)?.label || id
    }
    return compareKey.value.slice(5).replace('-', '月') + '日'
  })

  let focusTimer = 0
  let flashTimer = 0

  function clearCityFilter() {
    if (cityName.value && cityName.value !== '全国') {
      cityId.value = 'all'
      cityName.value = '全国'
    }
  }

  function setPeriodMode(mode: PeriodMode) {
    periodMode.value = mode
    // 切换日/周/月时回到全国，避免仍停在无成交城市导致 KPI/图表全 0
    clearCityFilter()
    bump()
  }

  function setDate(iso: string) {
    selectedDate.value = iso
    const w = COCKPIT_WEEKS.find((x) => x.days.includes(iso))
    if (w) selectedWeekId.value = w.id
    const m = COCKPIT_MONTHS.find((x) => x.days.includes(iso))
    if (m) selectedMonthId.value = m.id
    clearCityFilter()
    bump()
  }

  function setWeek(weekId: string) {
    selectedWeekId.value = weekId
    const w = COCKPIT_WEEKS.find((x) => x.id === weekId)
    if (w?.end) {
      selectedDate.value = w.end
      const m = COCKPIT_MONTHS.find((x) => x.days.includes(w.end))
      if (m) selectedMonthId.value = m.id
    }
    clearCityFilter()
    bump()
  }

  function setMonth(monthId: string) {
    selectedMonthId.value = monthId
    const m = COCKPIT_MONTHS.find((x) => x.id === monthId)
    if (m?.end) {
      selectedDate.value = m.end
      const w = COCKPIT_WEEKS.find((x) => x.days.includes(m.end))
      if (w) selectedWeekId.value = w.id
    }
    clearCityFilter()
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
    selectedMonthId,
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
    setMonth,
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
