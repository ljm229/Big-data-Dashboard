/** 中文名：正面立体圆柱柱（椭圆顶 + 罐体，参考产品销售达成图） */
import * as echarts from 'echarts'

export type CylinderColors = {
  top: string
  topInner: string
  shine: string
  body: [string, string, string]
  bottom: string
  rim: string
  label: string
}

export const CYLINDER_CYAN: CylinderColors = {
  top: '#f2fcff',
  topInner: '#5ed4ff',
  shine: '#ffffff',
  body: ['#b7f0ff', '#2eb4ff', '#0a5ad4'],
  bottom: '#043a96',
  rim: 'rgba(210, 244, 255, 0.95)',
  label: '#f5fbff',
}

export const CYLINDER_INDIGO: CylinderColors = {
  top: '#f3f5ff',
  topInner: '#8aa0ff',
  shine: '#ffffff',
  body: ['#c9d2ff', '#6d84ff', '#2a3fd4'],
  bottom: '#1828a0',
  rim: 'rgba(214, 222, 255, 0.95)',
  label: '#f4f7ff',
}

type CylinderOpts = {
  name: string
  categories: string[]
  data: (number | null)[]
  colors: CylinderColors
  yAxisIndex?: number
  slot?: 'single' | 'left' | 'right'
  showLabel?: boolean
  labelFormat?: (v: number) => string
}

export function cylinderBarSeries(opts: CylinderOpts) {
  return {
    name: opts.name,
    type: 'custom',
    coordinateSystem: 'cartesian2d',
    xAxisIndex: 0,
    yAxisIndex: opts.yAxisIndex ?? 0,
    renderItem: (_params: { dataIndex: number }, api: echarts.CustomSeriesRenderItemAPI) => {
      const cat = api.value(0)
      const raw = api.value(1)
      if (cat == null || raw == null || raw === '-' || Number.isNaN(Number(raw))) return
      const value = Number(raw)
      if (value <= 0) return
      const top = api.coord([cat, value])
      const base = api.coord([cat, 0])
      if (!top || !base || !Number.isFinite(top[0]) || !Number.isFinite(top[1])) return

      const size = api.size?.([1, 0])
      const band = Math.abs(Number((Array.isArray(size) ? size[0] : size) || 40))
      const grouped = opts.slot !== 'single'
      const barW = Math.max(16, Math.min(grouped ? 24 : 42, band * (grouped ? 0.36 : 0.58)))
      const shift = grouped ? (opts.slot === 'left' ? -barW * 0.6 : barW * 0.6) : 0
      const x = top[0] + shift
      const yTop = top[1]
      const yBottom = base[1]
      const h = Math.abs(yBottom - yTop)
      if (h < 2) return

      const rx = barW / 2
      const ry = Math.min(Math.max(7, rx * 0.42), Math.max(6, h * 0.28))
      const colors = opts.colors
      const children: Record<string, unknown>[] = [
        {
          type: 'ellipse',
          shape: { cx: x, cy: yBottom + 4, rx: rx * 1.08, ry: ry * 0.72 },
          style: { fill: 'rgba(2, 12, 40, 0.5)' },
          silent: true,
        },
        {
          type: 'ellipse',
          shape: { cx: x, cy: yBottom, rx, ry },
          style: { fill: colors.bottom, stroke: colors.rim, lineWidth: 1 },
          silent: true,
        },
        {
          type: 'rect',
          shape: { x: x - rx, y: yTop, width: rx * 2, height: Math.max(1, yBottom - yTop) },
          style: {
            fill: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
              { offset: 0, color: colors.body[0] },
              { offset: 0.14, color: colors.shine },
              { offset: 0.28, color: colors.body[0] },
              { offset: 0.52, color: colors.body[1] },
              { offset: 1, color: colors.body[2] },
            ]),
            stroke: colors.rim,
            lineWidth: 1.1,
          },
        },
        {
          type: 'rect',
          shape: {
            x: x - rx * 0.68,
            y: yTop + ry * 0.4,
            width: Math.max(3, rx * 0.22),
            height: Math.max(6, yBottom - yTop - ry),
            r: 6,
          },
          style: { fill: 'rgba(255, 255, 255, 0.55)' },
          silent: true,
        },
        {
          type: 'rect',
          shape: {
            x: x - rx * 0.42,
            y: yTop + ry * 0.55,
            width: Math.max(2, rx * 0.08),
            height: Math.max(4, yBottom - yTop - ry * 1.2),
            r: 4,
          },
          style: { fill: 'rgba(255, 255, 255, 0.28)' },
          silent: true,
        },
        {
          type: 'ellipse',
          shape: { cx: x, cy: yTop, rx, ry },
          style: {
            fill: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: colors.shine },
              { offset: 0.4, color: colors.top },
              { offset: 1, color: colors.topInner },
            ]),
            stroke: colors.rim,
            lineWidth: 1.4,
          },
          silent: true,
        },
        {
          type: 'ellipse',
          shape: { cx: x - rx * 0.22, cy: yTop - ry * 0.18, rx: rx * 0.38, ry: ry * 0.28 },
          style: { fill: 'rgba(255, 255, 255, 0.62)' },
          silent: true,
        },
      ]

      if (opts.showLabel) {
        const inside = h > 40
        children.push({
          type: 'text',
          style: {
            text: opts.labelFormat ? opts.labelFormat(value) : String(value),
            x,
            y: inside ? (yTop + yBottom) / 2 + ry * 0.2 : yTop - ry - 5,
            fill: inside ? colors.label : colors.top,
            font: inside
              ? '800 13px Rajdhani, DIN Alternate, sans-serif'
              : '800 12px Rajdhani, DIN Alternate, sans-serif',
            align: 'center',
            verticalAlign: 'middle',
            textShadowColor: 'rgba(2, 12, 32, 0.85)',
            textShadowBlur: 4,
          },
          silent: true,
        })
      }

      return { type: 'group', children }
    },
    data: opts.categories.map((key, i) => [key, opts.data[i]]),
    clip: false,
    z: 3,
    zlevel: 1,
    itemStyle: { color: opts.colors.body[1] },
    encode: { x: 0, y: 1 },
  }
}
