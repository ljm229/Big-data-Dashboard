/** 中文名：等距立体柱（正面 + 顶面 + 侧面） */
import * as echarts from 'echarts'
import { PALETTE } from '../styles/palette'

export type CubeColors = {
  top: string
  front: [string, string]
  side: string
  label: string
}

export const CUBE_CYAN: CubeColors = {
  top: '#83f1ff',
  front: PALETTE.barPos,
  side: '#1453A0',
  label: PALETTE.kpi2,
}

export const CUBE_GOLD: CubeColors = {
  top: PALETTE.chart3,
  front: PALETTE.barKey,
  side: '#F7931A',
  label: PALETTE.chart3,
}

type CubeOpts = {
  name: string
  categories: string[]
  data: (number | null)[]
  colors: CubeColors
  yAxisIndex?: number
  slot?: 'single' | 'left' | 'right'
  showLabel?: boolean
  labelFormat?: (v: number) => string
}

export function cubeBarSeries(opts: CubeOpts) {
  return {
    name: opts.name,
    type: 'custom',
    coordinateSystem: 'cartesian2d',
    xAxisIndex: 0,
    yAxisIndex: opts.yAxisIndex ?? 0,
    renderItem: (params: { dataIndex: number }, api: echarts.CustomSeriesRenderItemAPI) => {
      const cat = api.value(0)
      const raw = api.value(1)
      if (cat == null || raw == null || raw === '-' || Number.isNaN(Number(raw))) return
      const value = Number(raw)
      const top = api.coord([cat, value])
      const base = api.coord([cat, 0])
      if (!top || !base || !Number.isFinite(top[0]) || !Number.isFinite(top[1])) return
      const size = api.size?.([1, 0])
      const band = Math.abs(Number((Array.isArray(size) ? size[0] : size) || 36))
      const grouped = opts.slot !== 'single'
      const barW = Math.max(12, Math.min(grouped ? 18 : 26, band * (grouped ? 0.32 : 0.42)))
      const depth = Math.max(3, Math.round(barW * 0.28))
      const shift = grouped ? (opts.slot === 'left' ? -barW * 0.58 : barW * 0.58) : 0
      const x = top[0] + shift
      const y0 = top[1]
      const y1 = base[1]
      const h = Math.abs(y1 - y0)
      if (h < 1) return

      const x0 = x - barW / 2
      const x1 = x + barW / 2
      const children: Record<string, unknown>[] = [
        {
          type: 'polygon',
          shape: {
            points: [
              [x1, y0],
              [x1 + depth, y0 - depth],
              [x1 + depth, y1 - depth],
              [x1, y1],
            ],
          },
          style: { fill: opts.colors.side },
          silent: true,
        },
        {
          type: 'polygon',
          shape: {
            points: [
              [x0, y0],
              [x1, y0],
              [x1, y1],
              [x0, y1],
            ],
          },
          style: {
            fill: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: opts.colors.front[0] },
              { offset: 1, color: opts.colors.front[1] },
            ]),
          },
        },
        {
          type: 'polygon',
          shape: {
            points: [
              [x0, y0],
              [x0 + depth, y0 - depth],
              [x1 + depth, y0 - depth],
              [x1, y0],
            ],
          },
          style: { fill: opts.colors.top },
          silent: true,
        },
      ]
      if (opts.showLabel) {
        const inside = h > 36
        children.push({
          type: 'text',
          style: {
            text: opts.labelFormat ? opts.labelFormat(value) : String(value),
            x,
            y: inside ? (y0 + y1) / 2 : y0 - depth - 4,
            fill: inside ? '#f4fbff' : opts.colors.label,
            font: inside
              ? '800 12px Rajdhani, DIN Alternate, sans-serif'
              : '800 12px Rajdhani, DIN Alternate, sans-serif',
            align: 'center',
            verticalAlign: 'middle',
            textShadowColor: 'rgba(2,12,32,0.85)',
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
    itemStyle: { color: opts.colors.front[0] },
    encode: { x: 0, y: 1 },
  }
}
