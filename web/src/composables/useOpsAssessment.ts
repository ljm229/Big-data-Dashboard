import { computed, onUnmounted, ref, watch, type Ref } from 'vue'
import { storeToRefs } from 'pinia'
import type { AssessMetric } from '../components/AssessmentCard.vue'
import { useFilterStore, COCKPIT_WEEKS } from '../stores/filter'
import {
  fetchAssessmentCityOptions,
  fetchAssessmentStoreOptions,
  hasAssessment,
} from '../api/dashboard'
import dashRaw from '../data/dashboard.json'
import { fetchAssessmentBoard, healthFromMetrics, type AssessBoard } from '../api/opsDashboard'
import { GRADE_RULES, type AssessKey } from '../utils/opsAssessment'

/** 运营看板考核数据（经典版 / Tab 版共用） */
export function useOpsAssessment() {
  const filter = useFilterStore()
  const { selectedDate, dataKey, loadingTick } = storeToRefs(filter)

  const city = ref('全部')
  const storeId = ref('全部')
  const cityOptions = ref<string[]>(['全部'])
  const storeOptions = ref<Array<{ id: string; shortName: string }>>([])

  const assessKey = computed(() => dataKey.value || selectedDate.value)
  const hasAssessData = computed(() => hasAssessment(assessKey.value))
  const updatedHint = String((dashRaw as { updated_at?: string }).updated_at || '').slice(0, 16)

  const assessWeekLabel = computed(() => {
    const key = assessKey.value
    const weekId = key.startsWith('W:')
      ? key.slice(2)
      : COCKPIT_WEEKS.find((w) => w.days.includes(selectedDate.value))?.id
    const w = COCKPIT_WEEKS.find((x) => x.id === weekId)
    return w?.label || weekId || selectedDate.value
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

  const watchStores = computed(() => assessRows.value.filter((r) => r.composite < 60).slice(0, 12))

  function failTags(row: AssessBoard['rows'][number]) {
    return row.parts.filter((p) => !p.pass).map((p) => p.shortName)
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
    cityOptions.value = await fetchAssessmentCityOptions(key)
    if (!cityOptions.value.includes(city.value)) city.value = '全部'
    storeOptions.value = await fetchAssessmentStoreOptions(key, city.value)
    if (storeId.value !== '全部' && !storeOptions.value.some((s) => s.id === storeId.value)) {
      storeId.value = '全部'
    }
  }

  async function reload() {
    if (!hasAssessData.value) {
      assessBoard.value = null
      metrics.value = []
      return
    }
    const board = await fetchAssessmentBoard(assessKey.value, city.value, storeId.value)
    assessBoard.value = board
    metrics.value = board?.metrics || []
  }

  watch([city, storeId, selectedDate, dataKey, loadingTick], async () => {
    await reloadFilters()
    void reload()
  })

  void (async () => {
    await reloadFilters()
    void reload()
  })()

  return {
    city,
    storeId,
    cityOptions,
    storeOptions,
    assessKey,
    hasAssessData,
    updatedHint,
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
