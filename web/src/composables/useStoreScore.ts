/** 中文名：门店考核分数 */
import { computed, onUnmounted, ref, watch, type Ref } from 'vue'
import { storeToRefs } from 'pinia'
import type { AssessMetric } from '../components/ScoreCard.vue'
import { useFilterStore } from '../stores/filter'
import {
  fetchAssessmentBoard,
  healthFromMetrics,
  type AssessBoard,
} from '../api/opsDashboard'
import {
  fetchAssessmentCityOptions,
  fetchAssessmentStoreOptions,
  getAssessmentAvailableDates,
} from '../api/dashboard'
import {
  fetchDatabaseBoard,
  fetchDatabaseCoverage,
  fetchDatabaseOptions,
  subscribeQualityUpdates,
} from '../api/qualityDatabase'
import { GRADE_RULES, type AssessKey } from '../utils/opsAssessment'

/** 运营看板考核数据（经典版 / Tab 版共用） */
export function useStoreScore() {
  const filter = useFilterStore()
  const { selectedDate, dataKey, loadingTick } = storeToRefs(filter)

  const city = ref('全部')
  const storeId = ref('全部')
  const cityOptions = ref<string[]>(['全部'])
  const storeOptions = ref<Array<{ id: string; shortName: string; code?: string; city?: string; name?: string }>>([])

  const assessKey = computed(() => dataKey.value || selectedDate.value)
  const databaseDates = ref<string[]>([])
  const dataSource = ref<'database' | 'static' | 'unavailable'>('unavailable')
  const hasAssessData = computed(
    () => !!assessBoard.value,
  )
  const updatedHint = ref('')

  function formatUpdatedAt(value: string) {
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return value.slice(0, 16).replace('T', ' ')
    return date.toLocaleString('zh-CN', {
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
    }).replaceAll('/', '-')
  }

  const assessWeekLabel = computed(() => {
    const key = assessKey.value
    if (key.startsWith('M:')) return key.slice(2) + ' 月考核'
    if (key.startsWith('W:')) return key.slice(2).replace('_','～') + ' 考核'
    return key + ' 日考核'
  })

  const assessBoard = ref<AssessBoard | null>(null)
  const metrics = ref<AssessMetric[]>([])
  const assessRows = computed(() => assessBoard.value?.rows || [])
  const storeCntText = computed(() => (assessBoard.value ? `${assessBoard.value.storeCnt} 家门店` : ''))

  const isSingleStore = computed(() => storeId.value !== '全部' || (assessBoard.value?.storeCnt || 0) <= 1)
  const headerScore = computed(() => {
    if (!assessBoard.value) return 0
    return Math.round(isSingleStore.value ? assessBoard.value.composite : assessBoard.value.medianComposite)
  })
  const scoreLabel = computed(() => (isSingleStore.value ? '综合分' : '门店中位分'))
  const health = computed(() => healthFromMetrics(metrics.value, headerScore.value))

  const gradeDist = computed(() =>
    GRADE_RULES.map((g) => ({
      ...g,
      count: assessRows.value.filter((r) => r.grade.grade === g.grade).length,
    })),
  )

  const watchStores = computed(() => assessRows.value.filter((r) => r.composite < 60 && r.parts.some((p) => !p.missing)).slice(0, 12))

  function failTags(row: AssessBoard['rows'][number]) {
    return row.parts.filter((p) => !p.missing && !p.pass).map((p) => p.shortName)
  }
  function partPass(row: AssessBoard['rows'][number], key: AssessKey) {
    return row.parts.find((p) => p.key === key)?.pass ?? true
  }
  function fmtPart(row: AssessBoard['rows'][number], key: AssessKey) {
    const p = row.parts.find((x) => x.key === key)
    if (!p) return '—'
    if (p.unit === 'min') return p.value.toFixed(1)
    return p.value.toFixed(2) + '%'
  }

  watch(city, () => {
    storeId.value = '全部'
  })
  watch([selectedDate, dataKey], () => {
    city.value = '全部'
    storeId.value = '全部'
  })

  async function reloadFilters() {
    const key = assessKey.value
    try {
      const options = await fetchDatabaseOptions(key)
      cityOptions.value = options.cities
      storeOptions.value = options.stores
      dataSource.value = 'database'
    } catch {
      try {
        cityOptions.value = await fetchAssessmentCityOptions(key)
        storeOptions.value = await fetchAssessmentStoreOptions(key, city.value)
        dataSource.value = 'static'
      } catch {
        cityOptions.value = ['全部']
        storeOptions.value = []
        dataSource.value = 'unavailable'
      }
    }
    if (!cityOptions.value.includes(city.value)) city.value = '全部'
    if ((dataSource.value === 'database' || dataSource.value === 'static') && city.value !== '全部') {
      storeOptions.value = storeOptions.value.filter((store) => store.city === city.value)
    }
    if (storeId.value !== '全部' && !storeOptions.value.some((s) => s.id === storeId.value)) {
      storeId.value = '全部'
    }
  }

  async function reload() {
    let board: AssessBoard | null = null
    try {
      board = await fetchDatabaseBoard(assessKey.value, city.value, storeId.value)
      dataSource.value = 'database'
    } catch {
      try {
        board = await fetchAssessmentBoard(assessKey.value, city.value, storeId.value)
        dataSource.value = board ? 'static' : 'unavailable'
      } catch {
        dataSource.value = 'unavailable'
        updatedHint.value = ''
      }
    }
    assessBoard.value = board
    metrics.value = board?.metrics || []
  }

  watch([city, storeId, selectedDate, dataKey, loadingTick], async () => {
    await reloadFilters()
    void reload()
  })

  void (async () => {
    try {
      const coverage = await fetchDatabaseCoverage()
      databaseDates.value = coverage.dates.map((item) => item.date)
      if (coverage.state?.updated_at) updatedHint.value = formatUpdatedAt(coverage.state.updated_at)
    } catch {
      databaseDates.value = getAssessmentAvailableDates()
    }
    await reloadFilters()
    void reload()
  })()

  const unsubscribe = subscribeQualityUpdates(async () => {
    try {
      const coverage = await fetchDatabaseCoverage()
      databaseDates.value = coverage.dates.map((item) => item.date)
      if (coverage.state?.updated_at) updatedHint.value = formatUpdatedAt(coverage.state.updated_at)
    } catch {
      databaseDates.value = getAssessmentAvailableDates()
    } finally {
      await reloadFilters()
      await reload()
    }
  })
  onUnmounted(unsubscribe)

  return {
    city,
    storeId,
    cityOptions,
    storeOptions,
    assessKey,
    hasAssessData,
    updatedHint,
    dataSource,
    assessWeekLabel,
    storeCntText,
    assessBoard,
    metrics,
    assessRows,
    headerScore,
    scoreLabel,
    health,
    gradeDist,
    watchStores,
    failTags,
    partPass,
    fmtPart,
    reload,
  }
}

/** 考核榜自动滚动 */
export function useRankAutoScroll(rankWrapEl: Ref<HTMLElement | null>, rowCount: Ref<number>) {
  const rankPaused = ref(false)
  let rankTimer: ReturnType<typeof setInterval> | null = null

  function startRankScroll() {
    if (rankTimer) clearInterval(rankTimer)
    rankTimer = setInterval(() => {
      const el = rankWrapEl.value
      if (!el || rankPaused.value || rowCount.value <= 8) return
      const max = el.scrollHeight - el.clientHeight
      if (max <= 0) return
      const next = el.scrollTop + 40
      el.scrollTo({ top: next >= max ? 0 : next, behavior: 'smooth' })
    }, 2200)
  }

  onUnmounted(() => {
    if (rankTimer) clearInterval(rankTimer)
  })

  return { rankPaused, startRankScroll }
}
