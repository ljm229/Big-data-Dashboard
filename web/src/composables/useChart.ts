/** 中文名：图表工具 */
import * as echarts from 'echarts'
import type { EChartsOption } from 'echarts'
import { nextTick, onMounted, onUnmounted, shallowRef, watch, type Ref } from 'vue'

const chartBase = {
  textStyle: { fontFamily: 'PingFang SC, Noto Sans SC, sans-serif', color: '#D8E8FF', fontSize: 14 },
}

function applyAxisBase(axis: Record<string, unknown> | undefined) {
  if (!axis) return axis
  const label = (axis.axisLabel || {}) as Record<string, unknown>
  return {
    ...axis,
    axisLabel: {
      color: '#D8E8FF',
      fontSize: 13,
      fontFamily: 'PingFang SC, Noto Sans SC, sans-serif',
      fontWeight: 700,
      ...label,
    },
  }
}

function cloneOption(opt: EChartsOption): EChartsOption {
  // 3D / GL 配置不能 structuredClone / JSON 深拷贝，否则会丢内部引用并报 model not found
  const raw = opt as Record<string, unknown>
  const series = raw.series
  const hasGlSeries =
    Array.isArray(series) &&
    series.some(
      (s) =>
        s &&
        typeof s === 'object' &&
        ['surface', 'line3D', 'scatter3D', 'bar3D', 'lines3D'].includes(
          String((s as { type?: string }).type || ''),
        ),
    )
  const hasCustom =
    Array.isArray(series) &&
    series.some((s) => s && typeof s === 'object' && String((s as { type?: string }).type || '') === 'custom')
  if (raw.geo || raw.geo3D || raw.grid3D || raw.globe || hasGlSeries || hasCustom) {
    return { ...opt }
  }
  try {
    return structuredClone(opt)
  } catch {
    // 图表 option 常含 formatter / symbolSize 函数，JSON 深拷贝会静默删除这些函数。
    const seen = new WeakMap<object, unknown>()
    const copy = (value: unknown): unknown => {
      if (value == null || typeof value !== 'object') return value
      if (value instanceof Date) return new Date(value)
      if (seen.has(value)) return seen.get(value)
      if (Array.isArray(value)) {
        const arr: unknown[] = []
        seen.set(value, arr)
        for (const item of value) arr.push(copy(item))
        return arr
      }
      const out: Record<string, unknown> = {}
      seen.set(value, out)
      for (const [key, item] of Object.entries(value as Record<string, unknown>)) out[key] = copy(item)
      return out
    }
    return copy(opt) as EChartsOption
  }
}

function withChartBase(opt: EChartsOption): EChartsOption {
  const src = opt as Record<string, unknown>
  const series = src.series
  const hasGl =
    src.geo3D ||
    src.grid3D ||
    src.globe ||
    (Array.isArray(series) &&
      series.some(
        (s) =>
          s &&
          typeof s === 'object' &&
          ['surface', 'line3D', 'scatter3D', 'bar3D', 'lines3D'].includes(
            String((s as { type?: string }).type || ''),
          ),
      ))
  const hasCustom =
    Array.isArray(series) &&
    series.some((s) => s && typeof s === 'object' && String((s as { type?: string }).type || '') === 'custom')
  if (src.geo || hasGl || hasCustom) return opt

  const raw = cloneOption(opt) as Record<string, unknown>
  const base = chartBase as Record<string, unknown>
  const merged = { ...raw } as Record<string, unknown>
  merged.textStyle = {
    ...(base.textStyle as Record<string, unknown>),
    ...((raw.textStyle as Record<string, unknown> | undefined) || {}),
  }

  if (raw.legend && !Array.isArray(raw.legend)) {
    const legend = { ...(raw.legend as Record<string, unknown>) }
    legend.textStyle = {
      color: '#e8f3ff',
      fontSize: 14,
      fontWeight: 650,
      fontFamily: 'PingFang SC, Noto Sans SC, sans-serif',
      ...((legend.textStyle as Record<string, unknown> | undefined) || {}),
    }
    merged.legend = legend
  }

  if (raw.tooltip && !Array.isArray(raw.tooltip)) {
    const tooltip = { ...(raw.tooltip as Record<string, unknown>) }
    const userBg = tooltip.backgroundColor != null
    // 未指定背景时给默认白底；指定了则尊重业务侧深色大屏样式
    if (!userBg) {
      tooltip.backgroundColor = 'rgba(255, 255, 255, 0.96)'
      if (tooltip.borderColor == null) tooltip.borderColor = '#d0d7de'
      if (tooltip.borderWidth == null) tooltip.borderWidth = 1
    }
    const prevTs = (tooltip.textStyle as Record<string, unknown> | undefined) || {}
    tooltip.textStyle = {
      fontSize: 14,
      fontFamily: 'PingFang SC',
      color: userBg ? '#e8f3ff' : '#1a1a1a',
      ...prevTs,
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
export function useChart(elRef: Ref<HTMLElement | null>, option: Ref<any>) {
  const chart = shallowRef<echarts.ECharts | null>(null)
  let ro: ResizeObserver | null = null
  let retryTimer = 0

  function applyOption(opt: EChartsOption) {
    if (!chart.value || !opt) return
    chart.value.setOption(
      { animationDurationUpdate: 0, ...(withChartBase(opt) as Record<string, unknown>) },
      { notMerge: true, lazyUpdate: true },
    )
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
