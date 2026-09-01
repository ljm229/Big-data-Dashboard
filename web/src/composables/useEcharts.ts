import * as echarts from 'echarts'
import type { EChartsOption } from 'echarts'
import { nextTick, onMounted, onUnmounted, shallowRef, watch, type Ref } from 'vue'

const chartBase = {
  textStyle: { fontFamily: 'PingFang SC', color: '#8FA3BF', fontSize: 12 },
}

function applyAxisBase(axis: Record<string, unknown> | undefined) {
  if (!axis) return axis
  const label = (axis.axisLabel || {}) as Record<string, unknown>
  return {
    ...axis,
    axisLabel: {
      color: '#8FA3BF',
      fontSize: 12,
      fontFamily: 'PingFang SC',
      ...label,
    },
  }
}

function cloneOption(opt: EChartsOption): EChartsOption {
  // 断开 Vue 响应式，避免 ECharts 内部改 option 触发 watch 死循环
  try {
    return structuredClone(opt)
  } catch {
    return JSON.parse(JSON.stringify(opt)) as EChartsOption
  }
}

function withChartBase(opt: EChartsOption): EChartsOption {
  const raw = cloneOption(opt)
  const base = chartBase as Record<string, unknown>
  const merged = { ...raw } as Record<string, unknown>
  merged.textStyle = {
    ...(base.textStyle as Record<string, unknown>),
    ...((raw.textStyle as Record<string, unknown> | undefined) || {}),
  }

  if (raw.legend && !Array.isArray(raw.legend)) {
    const legend = { ...(raw.legend as Record<string, unknown>) }
    legend.textStyle = {
      color: '#8FA3BF',
      fontSize: 12,
      fontFamily: 'PingFang SC',
      ...((legend.textStyle as Record<string, unknown> | undefined) || {}),
    }
    merged.legend = legend
  }

  if (raw.tooltip && !Array.isArray(raw.tooltip)) {
    const tooltip = { ...(raw.tooltip as Record<string, unknown>) }
    // 白底黑字，避免浅色字在浅色浮层上看不清
    if (tooltip.backgroundColor == null) tooltip.backgroundColor = 'rgba(255, 255, 255, 0.96)'
    if (tooltip.borderColor == null) tooltip.borderColor = '#d0d7de'
    if (tooltip.borderWidth == null) tooltip.borderWidth = 1
    tooltip.textStyle = {
      fontSize: 14,
      fontFamily: 'PingFang SC',
      ...((tooltip.textStyle as Record<string, unknown> | undefined) || {}),
      color: '#1a1a1a',
    }
    merged.tooltip = tooltip
  }

  for (const key of ['xAxis', 'yAxis']) {
    const value = raw[key as keyof EChartsOption]
    if (Array.isArray(value)) {
      merged[key] = value.map((item) => applyAxisBase({ ...(item as Record<string, unknown>) }))
    } else if (value && typeof value === 'object') {
      merged[key] = applyAxisBase({ ...(value as Record<string, unknown>) })
    }
  }

  return merged as EChartsOption
}

/** 等容器有真实宽高后再 init，并用 ResizeObserver 跟随布局变化 */
export function useEcharts(elRef: Ref<HTMLElement | null>, option: Ref<any>) {
  const chart = shallowRef<echarts.ECharts | null>(null)
  let ro: ResizeObserver | null = null
  let retryTimer = 0

  function applyOption(opt: EChartsOption) {
    if (!chart.value || !opt) return
    chart.value.setOption(withChartBase(opt), { notMerge: true })
  }

  function ensure() {
    const el = elRef.value
    if (!el) return
    const { clientWidth: w, clientHeight: h } = el
    if (w < 8 || h < 8) {
      window.clearTimeout(retryTimer)
      retryTimer = window.setTimeout(ensure, 80)
      return
    }
    if (!chart.value) {
      chart.value = echarts.init(el, undefined, { renderer: 'canvas' })
    }
    if (option.value) {
      applyOption(option.value)
    }
    chart.value.resize()
  }

  function resize() {
    chart.value?.resize()
  }

  // 只监听 option 引用变化；深监听会被 ECharts 内部 mutation 打爆主线程
  watch(option, async (opt) => {
    await nextTick()
    if (!opt) return
    if (!chart.value) {
      ensure()
      return
    }
    applyOption(opt)
    chart.value.resize()
  })

  watch(elRef, async () => {
    await nextTick()
    ensure()
  })

  onMounted(async () => {
    await nextTick()
    ensure()
    // 二次校正：scale / grid 布局稳定后再 resize
    window.clearTimeout(retryTimer)
    retryTimer = window.setTimeout(ensure, 200)
    window.setTimeout(ensure, 600)
    window.addEventListener('resize', resize)
    if (elRef.value) {
      ro = new ResizeObserver(() => resize())
      ro.observe(elRef.value)
    }
  })

  onUnmounted(() => {
    window.clearTimeout(retryTimer)
    window.removeEventListener('resize', resize)
    ro?.disconnect()
    chart.value?.dispose()
    chart.value = null
  })

  return { chart, resize, ensure }
}
