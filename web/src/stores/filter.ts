import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import raw from '../data/dashboard.json'

function isoFromKey(key: string) {
  const [m, d] = key.split('.')
  return `2026-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
}

const sourceKeys = Object.keys(raw.storeRank || {}).sort()
export const AVAILABLE_DATES = sourceKeys.map(isoFromKey)
export const DATE_TO_KEY: Record<string, string> = Object.fromEntries(
  sourceKeys.map((key) => [isoFromKey(key), key]),
)

const sourcePrimary = raw.primaryDate ? isoFromKey(raw.primaryDate) : AVAILABLE_DATES[AVAILABLE_DATES.length - 1]
const sourceCompare = raw.compareDate ? isoFromKey(raw.compareDate) : AVAILABLE_DATES[0]

export type StoreSortBy = 'default' | 'refund_amount' | 'refund_rate' | 'refund_orders' | 'inafter_ratio'

export const useFilterStore = defineStore('filter', () => {
  const selectedDate = ref(sourcePrimary || '')
  const cityId = ref('all')
  const cityName = ref('全国')
  const abnormalOnly = ref(false)
  const drawer = ref<{ type: 'city' | 'store'; payload: Record<string, unknown> } | null>(null)
  const updatedAt = ref('')
  const loadingTick = ref(0)
  /** 成本板块边框闪烁触发计数 */
  const costFlashTick = ref(0)
  /** 商品运营分析榜高亮门店名（异常筛选联动） */
  const productFlashNames = ref<string[]>([])
  /** 底部门店明细定位高亮 */
  const focusStoreName = ref('')
  /** 底部门店明细排序口径（逆向健康度卡片联动） */
  const storeSortBy = ref<StoreSortBy>('default')

  const dataKey = computed(() => DATE_TO_KEY[selectedDate.value] || '')
  const hasData = computed(() => !!dataKey.value)
  /** 对照日：另一份 Excel 日期，用于环比，不是编造的昨日 */
  const compareDate = computed(() => {
    if (selectedDate.value === sourcePrimary) return sourceCompare
    if (selectedDate.value === sourceCompare) return sourcePrimary
    return AVAILABLE_DATES.find((date) => date !== selectedDate.value) || ''
  })
  const compareKey = computed(() => (compareDate.value ? DATE_TO_KEY[compareDate.value] : null))
  const compareLabel = computed(() =>
    compareDate.value ? compareDate.value.slice(5).replace('-', '月') + '日' : '',
  )

  let focusTimer = 0
  let flashTimer = 0

  function setDate(iso: string) {
    selectedDate.value = iso
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
    selectedDate,
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
    compareDate,
    compareKey,
    compareLabel,
    setDate,
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
