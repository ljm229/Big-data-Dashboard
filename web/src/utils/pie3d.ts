/** ECharts GL 立体饼图（surface 参数方程） */

export type Pie3DItem = {
  name: string
  value: number
  itemStyle?: { color?: string; opacity?: number }
}

function getParametricEquation(
  startRatio: number,
  endRatio: number,
  isSelected: boolean,
  isHovered: boolean,
  k: number,
  height: number,
) {
  const startRadian = startRatio * Math.PI * 2
  const endRadian = endRatio * Math.PI * 2
  const midRadian = (startRadian + endRadian) / 2
  k = typeof k === 'number' && !Number.isNaN(k) ? k : 1 / 3
  const offsetX = isSelected ? Math.cos(midRadian) * 0.12 : 0
  const offsetY = isSelected ? Math.sin(midRadian) * 0.12 : 0
  const hoverRate = isHovered ? 1.08 : 1

  return {
    u: { min: -Math.PI, max: Math.PI * 3, step: Math.PI / 28 },
    v: { min: 0, max: Math.PI * 2, step: Math.PI / 18 },
    x(u: number, v: number) {
      if (u < startRadian) {
        return offsetX + Math.cos(startRadian) * (1 + Math.cos(v) * k) * hoverRate
      }
      if (u > endRadian) {
        return offsetX + Math.cos(endRadian) * (1 + Math.cos(v) * k) * hoverRate
      }
      return offsetX + Math.cos(u) * (1 + Math.cos(v) * k) * hoverRate
    },
    y(u: number, v: number) {
      if (u < startRadian) {
        return offsetY + Math.sin(startRadian) * (1 + Math.cos(v) * k) * hoverRate
      }
      if (u > endRadian) {
        return offsetY + Math.sin(endRadian) * (1 + Math.cos(v) * k) * hoverRate
      }
      return offsetY + Math.sin(u) * (1 + Math.cos(v) * k) * hoverRate
    },
    z(u: number, v: number) {
      if (u < -Math.PI * 0.5) return Math.sin(u)
      if (u > Math.PI * 2.5) return Math.sin(u) * height
      return Math.sin(v) > 0 ? height : -1
    },
  }
}

/** 生成立体饼图 option（需先 import 'echarts-gl'） */
export function buildPie3DOption(
  pieData: Pie3DItem[],
  opts?: {
    internalDiameterRatio?: number
    alpha?: number
    beta?: number
    distance?: number
    selectedName?: string
  },
) {
  const internalDiameterRatio = opts?.internalDiameterRatio ?? 0.58
  const series: any[] = []
  let sumValue = 0
  let startValue = 0
  const k =
    typeof internalDiameterRatio !== 'undefined'
      ? (1 - internalDiameterRatio) / (1 + internalDiameterRatio)
      : 1 / 3

  const cleaned = pieData
    .filter((d) => d.value > 0)
    .map((d) => ({ ...d, value: Math.max(0, Number(d.value) || 0) }))

  for (const item of cleaned) {
    sumValue += item.value
    const seriesItem: any = {
      name: item.name,
      type: 'surface',
      parametric: true,
      wireframe: { show: false },
      pieData: item,
      pieStatus: { selected: false, hovered: false, k },
      itemStyle: {
        color: item.itemStyle?.color,
        opacity: item.itemStyle?.opacity ?? 0.95,
      },
    }
    series.push(seriesItem)
  }

  if (!sumValue || !series.length) {
    return {
      title: {
        text: '暂无渠道数据',
        left: 'center',
        top: 'middle',
        textStyle: { color: '#94a3b8', fontSize: 13, fontWeight: 500 },
      },
    }
  }

  const maxVal = Math.max(...cleaned.map((d) => d.value))
  for (let i = 0; i < series.length; i++) {
    const endValue = startValue + series[i].pieData.value
    series[i].pieData.startRatio = startValue / sumValue
    series[i].pieData.endRatio = endValue / sumValue
    const h = 0.55 + (series[i].pieData.value / maxVal) * 0.85
    const selected = opts?.selectedName === series[i].name
    series[i].parametricEquation = getParametricEquation(
      series[i].pieData.startRatio,
      series[i].pieData.endRatio,
      selected,
      false,
      k,
      h,
    )
    startValue = endValue
  }

  // 扇区中部标注百分比
  const labelData = series
    .filter((s) => s.pieData)
    .map((s) => {
      const start = s.pieData.startRatio as number
      const end = s.pieData.endRatio as number
      const mid = ((start + end) / 2) * Math.PI * 2
      const selected = opts?.selectedName === s.name
      const r = (selected ? 1.05 : 0.92) * (1 + k * 0.35)
      const pct = ((s.pieData.value / sumValue) * 100).toFixed(1)
      return {
        name: `${pct}%`,
        value: [
          Math.cos(mid) * r,
          Math.sin(mid) * r,
          Math.max(0.2, (0.55 + (s.pieData.value / maxVal) * 0.85) * 0.55),
        ],
        itemStyle: { color: 'transparent' },
        label: {
          show: true,
          formatter: `${s.name}\n${pct}%`,
          color: '#334155',
          fontSize: 11,
          fontWeight: 700,
          backgroundColor: 'rgba(255,255,255,0.88)',
          padding: [3, 6],
          borderRadius: 4,
        },
      }
    })

  series.push({
    type: 'scatter3D',
    symbolSize: 1,
    silent: true,
    label: { show: true },
    data: labelData,
  })

  // 透明鼠标拾取盘
  series.push({
    name: 'mouseoutSeries',
    type: 'surface',
    parametric: true,
    wireframe: { show: false },
    itemStyle: { opacity: 0 },
    parametricEquation: {
      u: { min: 0, max: Math.PI * 2, step: Math.PI / 20 },
      v: { min: 0, max: Math.PI, step: Math.PI / 20 },
      x: (u: number, v: number) => Math.sin(v) * Math.sin(u) + Math.sin(u),
      y: (u: number, v: number) => Math.sin(v) * Math.cos(u) + Math.cos(u),
      z: (u: number, v: number) => (Math.cos(v) > 0 ? 0.1 : -0.1),
    },
  })

  const legendPct: Record<string, string> = {}
  cleaned.forEach((d) => {
    legendPct[d.name] = ((d.value / sumValue) * 100).toFixed(1) + '%'
  })

  return {
    tooltip: {
      formatter: (p: any) => {
        if (p.seriesName === 'mouseoutSeries' || p.seriesType === 'scatter3D') return ''
        const d = series.find((s) => s.name === p.seriesName)?.pieData
        if (!d) return p.seriesName
        const share = ((d.value / sumValue) * 100).toFixed(1)
        return `${d.name}<br/>实付 ¥${Math.round(d.value).toLocaleString()}（${share}%）`
      },
    },
    legend: {
      bottom: 4,
      left: 'center',
      itemWidth: 10,
      itemHeight: 10,
      textStyle: { color: '#64748b', fontSize: 11 },
      data: cleaned.map((d) => d.name),
      formatter: (name: string) => `${name}  ${legendPct[name] || ''}`,
    },
    xAxis3D: { min: -1.35, max: 1.35 },
    yAxis3D: { min: -1.35, max: 1.35 },
    zAxis3D: { min: -1.2, max: 1.2 },
    grid3D: {
      show: false,
      boxHeight: 18,
      top: '-8%',
      viewControl: {
        alpha: opts?.alpha ?? 28,
        beta: opts?.beta ?? 35,
        distance: opts?.distance ?? 170,
        rotateSensitivity: 1,
        zoomSensitivity: 0,
        panSensitivity: 0,
        autoRotate: false,
      },
      light: {
        main: { intensity: 1.15, shadow: true },
        ambient: { intensity: 0.55 },
      },
    },
    series,
  }
}
