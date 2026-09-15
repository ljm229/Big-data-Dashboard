import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { getOpsAvailableDates, hasOpsData as opsHasData } from '../api/opsDashboard'
import { SOURCE1_CHANNELS, SOURCE1_CITIES, SOURCE1_DAYS, SOURCE1_STORES, canonCity, source1StoreCity } from '../api/source1'
import { calendarWeekLabel, fridayOfWeek, shiftDay, thursdayOfWeek } from '../utils/bizWeek'

export { calendarWeekLabel, fridayOfWeek, thursdayOfWeek } from '../utils/bizWeek'

type WeekMeta = { id: string; label: string; start: string; end: string; days: string[]; complete?: boolean }
type MonthMeta = { id: string; label: string; start: string; end: string; days: string[]; complete?: boolean }

/** 大屏可选自然日：仅数据源1 */
export const COCKPIT_DAYS = SOURCE1_DAYS
export const COCKPIT_CHANNELS = SOURCE1_CHANNELS.length ? SOURCE1_CHANNELS : ['全部']
export const COCKPIT_CITIES = SOURCE1_CITIES
export const COCKPIT_STORE_OPTIONS = SOURCE1_STORES

/** 数据最新日：未结束的周（周四晚于此日）不进入可选列表 */
const latestDataDay = COCKPIT_DAYS[COCKPIT_DAYS.length - 1] || ''

function weekId(fri: string) {
  return `${fri}_${thursdayOfWeek(fri)}`
}

/** 周列表：周五→周四；仅展示周四已落到数据范围内的周 */
export const COCKPIT_WEEKS: WeekMeta[] = (() => {
  const map = new Map<string, string[]>()
  COCKPIT_DAYS.forEach((d) => {
    const fri = fridayOfWeek(d)
    const list = map.get(fri) || []
    list.push(d)
    map.set(fri, list)
  })
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([fri, days]) => {
      const thu = thursdayOfWeek(fri)
      const sorted = days.sort()
      return {
        id: weekId(fri),
        label: calendarWeekLabel(fri),
        start: fri,
        end: thu,
        days: sorted,
        complete: sorted.length === 7 && thu <= latestDataDay,
      }
    })
    .filter((w) => !!latestDataDay && w.complete && w.end <= latestDataDay)
})()

/** 按自然月从数据源1日列表推导 */
export const COCKPIT_MONTHS: MonthMeta[] = (() => {
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

function lastDayOfMonth(ym: string) {
  const [y, mo] = ym.split('-').map(Number)
  const last = new Date(y, mo, 0, 12)
  return `${y}-${String(mo).padStart(2, '0')}-${String(last.getDate()).padStart(2, '0')}`
}

function isCompleteWeek(w: WeekMeta) {
  if (typeof w.complete === 'boolean') return w.complete
  return (w.days?.length || 0) === 7
}

function isCompleteMonth(m: MonthMeta) {
  if (typeof m.complete === 'boolean') return m.complete
  const days = m.days || []
  return days[0] === `${m.id}-01` && days[days.length - 1] === lastDayOfMonth(m.id)
}

function weekIndex(id: string) {
  return COCKPIT_WEEKS.findIndex((w) => w.id === id)
}

function monthIndex(id: string) {
  return COCKPIT_MONTHS.findIndex((m) => m.id === id)
}

export type PeriodMode = 'day' | 'week' | 'month'
export type StoreSortBy = 'default' | 'refund_amount' | 'refund_rate' | 'refund_orders' | 'inafter_ratio'

const defaultDay = COCKPIT_DAYS[COCKPIT_DAYS.length - 1] || ''
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
  const selectedCities = ref<string[]>([])
  const selectedStores = ref<string[]>([])
  const cityId = ref('all')
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
    if (periodMode.value === 'week') return COCKPIT_WEEKS.some((w) => w.id === selectedWeekId.value)
    if (periodMode.value === 'month') return COCKPIT_MONTHS.some((m) => m.id === selectedMonthId.value)
    return COCKPIT_DAYS.includes(selectedDate.value)
  })

  const periodRange = computed(() => {
    if (periodMode.value === 'week') {
      const w = COCKPIT_WEEKS.find((x) => x.id === selectedWeekId.value)
      return { from: w?.start || '', to: w?.end || '' }
    }
    if (periodMode.value === 'month') {
      const m = COCKPIT_MONTHS.find((x) => x.id === selectedMonthId.value)
      return { from: m?.start || '', to: m?.end || '' }
    }
    return { from: selectedDate.value, to: selectedDate.value }
  })

  const cityName = computed(() => {
    if (!selectedCities.value.length) return '全国'
    if (selectedCities.value.length === 1) return selectedCities.value[0]!
    if (selectedCities.value.length === 2) return selectedCities.value.join('、')
    return `已选${selectedCities.value.length}城`
  })
  const selectedStore = computed(() => {
    if (!selectedStores.value.length) return '全部'
    if (selectedStores.value.length === 1) return selectedStores.value[0]!
    return `已选${selectedStores.value.length}店`
  })
  const cityQuery = computed(() => (selectedCities.value.length ? selectedCities.value : '全国'))
  const storeQuery = computed(() => (selectedStores.value.length ? selectedStores.value : '全部'))
  const hasOpsData = computed(() => opsHasData(selectedDate.value))
  const hasCockpitData = computed(() => hasData.value)

  function pruneStoresToCities() {
    if (!selectedCities.value.length || !selectedStores.value.length) return
    selectedStores.value = selectedStores.value.filter((name) => {
      const city = source1StoreCity(name)
      return city && selectedCities.value.some((c) => canonCity(c) === canonCity(city))
    })
  }

  function setCities(names: string[]) {
    const last = names[names.length - 1]
    if (!names.length || names.includes('全国') && last === '全国') {
      selectedCities.value = []
    } else {
      selectedCities.value = [...new Set(names.filter((n) => n && n !== '全国').map((n) => canonCity(n)))]
    }
    cityId.value = selectedCities.value.length === 1 ? selectedCities.value[0]! : selectedCities.value.length ? 'multi' : 'all'
    pruneStoresToCities()
    bump()
  }

  function setStores(names: string[]) {
    const last = names[names.length - 1]
    if (!names.length || names.includes('全部') && last === '全部') {
      selectedStores.value = []
    } else {
      selectedStores.value = [...new Set(names.filter((n) => n && n !== '全部'))]
    }
    bump()
  }

  /** 日比对照键：日→昨天；周→上一完整周；月→上一完整月。残周/未结束月不比。 */
  const compareKey = computed(() => {
    if (periodMode.value === 'week') {
      const i = weekIndex(selectedWeekId.value)
      if (i <= 0) return null
      const cur = COCKPIT_WEEKS[i]
      const prev = COCKPIT_WEEKS[i - 1]
      if (!isCompleteWeek(cur) || !isCompleteWeek(prev)) return null
      return `W:${prev.id}`
    }
    if (periodMode.value === 'month') {
      const i = monthIndex(selectedMonthId.value)
      if (i <= 0) return null
      const cur = COCKPIT_MONTHS[i]
      const prev = COCKPIT_MONTHS[i - 1]
      if (!isCompleteMonth(cur) || !isCompleteMonth(prev)) return null
      return `M:${prev.id}`
    }
    const prev = shiftDay(selectedDate.value, -1)
    return COCKPIT_DAYS.includes(prev) ? prev : null
  })

  /** 周比（按日）：上周同一天。周/月模式不再另给同比。 */
  const wowKey = computed(() => {
    if (periodMode.value !== 'day') return null
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

  function setPeriodMode(mode: PeriodMode) {
    periodMode.value = mode
    bump()
  }

  function setDate(iso: string) {
    selectedDate.value = iso
    const w = COCKPIT_WEEKS.find((x) => x.days.includes(iso))
    if (w) selectedWeekId.value = w.id
    const m = COCKPIT_MONTHS.find((x) => x.days.includes(iso))
    if (m) selectedMonthId.value = m.id
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
    bump()
  }

  function setChannel(name: string) {
    channel.value = name || '全部'
    bump()
  }

  function setCity(id: string, name: string) {
    const label = !name || name === '全国' ? '全国' : canonCity(name)
    setCities(label === '全国' ? [] : [label])
  }

  function setStore(name: string) {
    if (!name || name === '全部') {
      setStores([])
      return
    }
    setStores([name])
    const city = source1StoreCity(name)
    if (city && selectedCities.value.length && !selectedCities.value.some((c) => canonCity(c) === canonCity(city))) {
      selectedCities.value = [...selectedCities.value, canonCity(city)]
      cityId.value = selectedCities.value.length === 1 ? selectedCities.value[0]! : 'multi'
    }
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
    selectedStore,
    selectedCities,
    selectedStores,
    cityQuery,
    storeQuery,
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
    periodRange,
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
    setStore,
    setCities,
    setStores,
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
