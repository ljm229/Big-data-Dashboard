<!-- 中文名：城市经营健康矩阵
  看规模 + 毛利质量
  X：有效订单量环比增速
  Y：毛利率（含平台后返）
  气泡：实付金额
  颜色：右上绿健康 / 左上青流量弱 / 右下黄规模压 / 左下红双弱
-->
<template>
  <Panel title="城市经营健康矩阵" :empty="!rows.length">
    <template #extra>
      <span class="matrix-note" title="横轴=订单环比增速，纵轴=毛利率(含后返)，球大小=实付；四色对应四象限">
        球=实付
        <i class="leg good" />健康
        <i class="leg thin" />流量弱
        <i class="leg warn" />规模压
        <i class="leg bad" />双弱
      </span>
      <button type="button" class="matrix-zoom-btn" title="回到主体城市视角" @click="resetZoom">复位</button>
      <button type="button" class="matrix-zoom-btn" title="显示全部城市含离群点" @click="showAll">全部</button>
    </template>
    <div ref="el" class="chart" />
  </Panel>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import Panel from '../Panel.vue'
import { useFilterStore } from '../../stores/filter'
import { previousPeriodRange, source1ByCity } from '../../api/source1'
import { useChart } from '../../composables/useChart'
import { formatMoney, formatPercent } from '../../utils/format'
import { PALETTE } from '../../styles/palette'
import { vividSphere } from '../../utils/sphereBubble'

const filter = useFilterStore()
const { periodRange, channel, storeQuery, selectedCities, periodMode } = storeToRefs(filter)
const el = ref<HTMLElement | null>(null)
const option = ref<any>(null)
const viewBox = ref({
  xMin: -0.12,
  xMax: 0.2,
  yMin: -0.05,
  yMax: 0.3,
  fullXMin: -0.12,
  fullXMax: 0.2,
  fullYMin: -0.05,
  fullYMax: 0.3,
})

/** 横轴分界：订单零增长；纵轴分界：毛利率 18% */
const X_MID = 0
const Y_MID = 0.18

function quantile(vals: number[], q: number) {
  if (!vals.length) return 0
  const s = [...vals].sort((a, b) => a - b)
  const i = (s.length - 1) * q
  const lo = Math.floor(i)
  const hi = Math.ceil(i)
  if (lo === hi) return s[lo]!
  return s[lo]! * (1 - (i - lo)) + s[hi]! * (i - lo)
}

/** 主体视角：用分位裁掉极端离群，避免高增点把黄/绿球挤到左侧 */
function focusSpan(vals: number[], pad: number, softMin: number, softMax: number) {
  if (!vals.length) return { min: softMin - pad, max: softMax + pad }
  const lo = quantile(vals, 0.1)
  const hi = quantile(vals, 0.85)
  return {
    min: Math.min(softMin, lo) - pad,
    max: Math.max(softMax, hi) + pad,
  }
}

/** 默认视野右缘跟主体走，不再强行拉到 36% 造成右半空白 */
function plotCapX(vals: number[], focusMax: number) {
  if (!vals.length) return Math.max(focusMax, 0.12)
  const q90 = quantile(vals, 0.9)
  return Math.max(focusMax, Math.min(Math.max(q90, focusMax) + 0.03, focusMax + 0.08))
}

const viewMode = ref<'focus' | 'all'>('focus')

function resetZoom() {
  viewMode.value = 'focus'
}

function showAll() {
  viewMode.value = 'all'
}

type ZoneKey = 'healthy' | 'scaleLoss' | 'profitThin' | 'weak'

/** 四象限四色：右上绿 / 左上青 / 右下黄 / 左下红 */
const ZONE = {
  healthy: {
    name: '健康增长',
    formula: '订单↑ · 毛利高',
    action: '可加大投入',
    color: '#00F0A8',
    tone: '健康',
  },
  profitThin: {
    name: '流量不足',
    formula: '订单↓ · 毛利高',
    action: '关注流量',
    color: '#3DB8FF',
    tone: '流量弱',
  },
  scaleLoss: {
    name: '规模承压',
    formula: '订单↑ · 毛利低',
    action: '关注成本/活动',
    color: '#FFE14A',
    tone: '规模压',
  },
  weak: {
    name: '双弱',
    formula: '订单↓ · 毛利低',
    action: '优先排查',
    color: '#FF3D5A',
    tone: '双弱',
  },
} as const

/** 按图上落点分区，保证球色与所在象限一致（含离群钉边） */
function zoneOf(plotX: number, margin: number): ZoneKey {
  const up = plotX >= X_MID
  const rich = margin >= Y_MID
  if (up && rich) return 'healthy'
  if (up && !rich) return 'scaleLoss'
  if (!up && rich) return 'profitThin'
  return 'weak'
}

/** 有效订单量：源表 orders（有效订单，已剔整单退订） */
function effectiveOrders(row: { orders: number | null }) {
  return row.orders
}

/** 城市毛利率：用合计 含后返毛利/实付，与球坐标、分区同口径（不用行内 rate 加权，避免错位） */
function cityMarginRate(row: { profit: number | null; paid: number | null; profitRate: number | null }) {
  if (row.profit != null && row.paid != null && row.paid !== 0) return row.profit / row.paid
  return row.profitRate
}

const rows = computed(() => {
  const q = {
    from: periodRange.value.from,
    to: periodRange.value.to,
    channel: channel.value,
    store: storeQuery.value,
  }
  const prev = previousPeriodRange(q.from, q.to, periodMode.value)
  const last = source1ByCity({ ...q, ...prev })
  const lastMap = new Map(last.map((r) => [r.key, effectiveOrders(r)]))
  return source1ByCity(q)
    .map((r) => {
      const prevOrders = lastMap.get(r.key)
      const orders = effectiveOrders(r)
      const paid = r.paid
      const growth =
        prevOrders != null && prevOrders !== 0 && orders != null
          ? (orders - prevOrders) / Math.abs(prevOrders)
          : null
      const marginWithRebate = cityMarginRate(r)
      return {
        ...r,
        orders,
        paid,
        growth,
        marginWithRebate,
      }
    })
    .filter(
      (
        r,
      ): r is typeof r & {
        marginWithRebate: number
        growth: number
        paid: number
        orders: number
      } => {
        return r.marginWithRebate != null && r.growth != null && r.paid != null && r.orders != null
      },
    )
})

const { chart } = useChart(el, option)

watch(
  [rows, selectedCities, viewMode],
  () => {
    if (!rows.value.length) {
      option.value = null
      return
    }
    const maxPaid = Math.max(...rows.value.map((r) => Math.abs(r.paid)), 1)
    const xs = rows.value.map((r) => r.growth)
    const ys = rows.value.map((r) => r.marginWithRebate)
    const xFocus = focusSpan(xs, 0.012, -0.08, 0.06)
    const yFocus = focusSpan(ys, 0.012, 0.04, 0.26)
    const xMin = Math.min(xFocus.min, -0.05)
    const xMax = Math.max(xFocus.max, 0.08)
    const yMin = Math.min(yFocus.min, 0)
    const yMax = Math.max(yFocus.max, 0.26)
    const rawMax = Math.max(...xs, xMax)
    const fullXMin = Math.min(-0.1, ...xs) - 0.02
    const fullXMax = rawMax + 0.03
    const fullYMin = Math.min(-0.02, ...ys) - 0.015
    const fullYMax = Math.max(0.28, ...ys) + 0.02
    // 默认主体视野：轴范围=焦点，离群钉在右缘；「全部」才拉满
    const focus = viewMode.value === 'focus'
    const axisXMin = focus ? xMin : fullXMin
    const axisXMax = focus ? xMax : fullXMax
    const axisYMin = focus ? yMin : fullYMin
    const axisYMax = focus ? yMax : fullYMax
    const xCap = focus ? xMax : plotCapX(xs, xMax)
    viewBox.value = { xMin, xMax, yMin, yMax, fullXMin, fullXMax, fullYMin, fullYMax }

    const zoneLabel = (key: ZoneKey, position: string) => ({
      show: true,
      position,
      color: ZONE[key].color,
      fontSize: 10,
      fontWeight: 700,
      lineHeight: 14,
      padding: 4,
      formatter: ZONE[key].formula,
    })

    option.value = {
      animationDuration: 400,
      tooltip: {
        trigger: 'item',
        confine: true,
        appendTo: 'body',
        extraCssText:
          'max-width:240px;white-space:normal;z-index:40;pointer-events:none;box-shadow:0 8px 24px rgba(0,0,0,.45);',
        backgroundColor: PALETTE.panelDeep,
        borderColor: PALETTE.accent,
        textStyle: { color: '#e8f3ff', fontSize: 12 },
        position: (
          point: number[],
          _p: unknown,
          _el: HTMLElement,
          _rect: unknown,
          size: { contentSize: number[]; viewSize: number[] },
        ) => {
          const [cw, ch] = size.contentSize
          const [vw, vh] = size.viewSize
          let x = point[0] + 14
          let y = point[1] + 14
          if (x + cw > vw - 8) x = Math.max(8, point[0] - cw - 14)
          if (y + ch > vh - 8) y = Math.max(8, point[1] - ch - 14)
          return [x, y]
        },
        formatter: (p: {
          data: {
            name: string
            growth: number
            value: number[]
            orders: number
            paid: number
            profit: number | null
            zone: ZoneKey
            capped?: boolean
          }
        }) => {
          const d = p.data
          const z = ZONE[d.zone]
          const g = (d.growth * 100).toFixed(2)
          const m = formatPercent(d.value[1])
          const side = d.growth >= X_MID ? '右' : '左'
          const tall = d.value[1] >= Y_MID ? '上' : '下'
          const capHint = d.capped
            ? `<span style="color:#ffe14a">增速离群，已钉在右缘（真实 ${Number(g) >= 0 ? '+' : ''}${g}%）</span>`
            : null
          return [
            `<b>${d.name}</b> · <span style="color:${z.color}">${side}${tall} · ${z.formula} · ${z.tone}</span>`,
            `动作建议：${z.action}`,
            `订单增长率 ${Number(g) >= 0 ? '+' : ''}${g}%`,
            `毛利率(含后返) ${m}　（毛利÷实付）`,
            `实付金额 ${formatMoney(d.paid)}`,
            `有效订单量 ${d.orders.toLocaleString('zh-CN')}`,
            `预计毛利 ${formatMoney(d.profit)}`,
            capHint,
            `<span style="color:#8fb0c8">滚轮缩放 · 点击打开地图</span>`,
          ]
            .filter(Boolean)
            .join('<br/>')
        },
      },
      grid: { left: 38, right: 8, top: 12, bottom: 22, containLabel: false },
      dataZoom: [
        {
          type: 'inside',
          xAxisIndex: 0,
          filterMode: 'none',
          startValue: axisXMin,
          endValue: axisXMax,
          zoomOnMouseWheel: true,
          moveOnMouseMove: true,
          moveOnMouseWheel: false,
          throttle: 40,
        },
        {
          type: 'inside',
          yAxisIndex: 0,
          filterMode: 'none',
          startValue: axisYMin,
          endValue: axisYMax,
          zoomOnMouseWheel: true,
          moveOnMouseMove: true,
          moveOnMouseWheel: false,
          throttle: 40,
        },
      ],
      xAxis: {
        type: 'value',
        name: '低增长 ← 订单增长率 → 高增长',
        nameLocation: 'middle',
        nameGap: 16,
        nameTextStyle: { color: '#9ec9e8', fontSize: 10 },
        min: axisXMin,
        max: axisXMax,
        axisLabel: {
          formatter: (v: number) => `${(v * 100).toFixed(0)}%`,
          color: '#8fb0c8',
          fontSize: 11,
        },
        splitLine: { lineStyle: { color: 'rgba(90, 160, 220, 0.22)' } },
        axisLine: { lineStyle: { color: 'rgba(94, 180, 255, 0.55)' } },
        axisTick: { show: false },
      },
      yAxis: {
        type: 'value',
        name: '毛利率(含后返)',
        nameLocation: 'middle',
        nameGap: 28,
        nameRotate: 90,
        nameTextStyle: { color: '#9ec9e8', fontSize: 10 },
        min: axisYMin,
        max: axisYMax,
        axisLabel: {
          formatter: (v: number) => `${(v * 100).toFixed(0)}%`,
          color: '#8fb0c8',
          fontSize: 11,
        },
        splitLine: { lineStyle: { color: 'rgba(90, 160, 220, 0.22)' } },
        axisLine: { lineStyle: { color: 'rgba(94, 180, 255, 0.55)' } },
        axisTick: { show: false },
      },
      series: [
        {
          type: 'scatter',
          z: 3,
          cursor: 'pointer',
          data: (() => {
            const labelPos = ['top', 'bottom', 'left', 'right'] as const
            const sorted = [...rows.value].sort((a, b) => Math.abs(b.paid) - Math.abs(a.paid))
            const rank = new Map(sorted.map((r, i) => [r.key, i]))
            return rows.value.map((r) => {
              const capped = r.growth > xCap
              const plotX = Math.min(r.growth, xCap)
              const zone = zoneOf(plotX, r.marginWithRebate)
              const color = ZONE[zone].color
              const picked = selectedCities.value.some((c) => c === r.key)
              const i = rank.get(r.key) ?? 0
              return {
                name: r.key,
                growth: r.growth,
                capped,
                value: [plotX, r.marginWithRebate],
                orders: r.orders,
                paid: r.paid,
                profit: r.profit,
                zone,
                itemStyle: {
                  color: vividSphere(color),
                  opacity: 0.96,
                  borderColor: capped ? '#FFE14A' : picked ? '#fff' : 'rgba(255,255,255,0.7)',
                  borderWidth: capped || picked ? 2.2 : 1.2,
                  shadowBlur: 10,
                  shadowColor: color,
                },
                label: {
                  show: true,
                  formatter: capped ? '{b}·离群' : '{b}',
                  color: '#ffffff',
                  fontSize: 11,
                  fontWeight: 700,
                  position: capped ? 'left' : labelPos[i % labelPos.length],
                  distance: 6 + (i % 3) * 3,
                  textBorderColor: 'rgba(4, 22, 48, 0.92)',
                  textBorderWidth: 2.5,
                },
              }
            })
          })(),
          symbol: 'circle',
          symbolSize: (_v: number[], p: { data: { paid: number } }) =>
            18 + Math.sqrt(Math.abs(p.data.paid) / maxPaid) * 38,
          labelLayout: {
            hideOverlap: true,
            moveOverlap: 'shiftY',
            draggable: false,
          },
          emphasis: {
            scale: 1.1,
            focus: 'self',
            label: { show: true, fontSize: 12, position: 'top' },
            itemStyle: { shadowBlur: 18 },
          },
          blur: {
            label: { show: false },
            itemStyle: { opacity: 0.35 },
          },
          markLine: {
            silent: true,
            symbol: 'none',
            animation: false,
            data: [
              {
                xAxis: X_MID,
                label: {
                  show: true,
                  formatter: '增速 0%',
                  position: 'insideEndTop',
                  color: '#9ec9e8',
                  fontSize: 10,
                },
                lineStyle: { type: 'solid', width: 1.2, color: 'rgba(120, 200, 230, 0.65)' },
              },
              {
                yAxis: Y_MID,
                label: {
                  show: true,
                  formatter: '毛利率 18%',
                  position: 'insideStartTop',
                  color: '#9ec9e8',
                  fontSize: 10,
                },
                lineStyle: { type: 'dashed', width: 1.2, color: 'rgba(120, 200, 230, 0.65)' },
              },
            ],
          },
          markArea: {
            silent: true,
            itemStyle: { color: 'transparent' },
            data: [
              [
                {
                  name: ZONE.profitThin.name,
                  xAxis: axisXMin,
                  yAxis: Y_MID,
                  label: zoneLabel('profitThin', 'insideTopLeft'),
                },
                { xAxis: X_MID, yAxis: axisYMax },
              ],
              [
                {
                  name: ZONE.healthy.name,
                  xAxis: X_MID,
                  yAxis: Y_MID,
                  label: zoneLabel('healthy', 'insideTopRight'),
                },
                { xAxis: axisXMax, yAxis: axisYMax },
              ],
              [
                {
                  name: ZONE.weak.name,
                  xAxis: axisXMin,
                  yAxis: axisYMin,
                  label: zoneLabel('weak', 'insideBottomLeft'),
                },
                { xAxis: X_MID, yAxis: Y_MID },
              ],
              [
                {
                  name: ZONE.scaleLoss.name,
                  xAxis: X_MID,
                  yAxis: axisYMin,
                  label: zoneLabel('scaleLoss', 'insideBottomRight'),
                },
                { xAxis: axisXMax, yAxis: Y_MID },
              ],
            ],
          },
        },
      ],
    }
  },
  { immediate: true },
)

watch(chart, (c) => {
  if (!c) return
  c.off('click')
  c.on('click', (p) => {
    const name = (p.data as { name?: string } | undefined)?.name
    if (!name) return
    // 点选矩阵气泡 → 地图城市摘要（紧凑卡）；同步城市筛选
    filter.setCities([name])
  })
})
</script>

<style scoped>
.matrix-note {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--muted);
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
}
.matrix-zoom-btn {
  margin-left: 6px;
  height: 24px;
  padding: 0 8px;
  border: 1px solid rgba(94, 200, 255, 0.45);
  border-radius: 4px;
  background: rgba(8, 36, 72, 0.75);
  color: #cfe8ff;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}
.matrix-zoom-btn:hover {
  border-color: rgba(154, 223, 255, 0.85);
  color: #fff;
}
.leg {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-left: 4px;
  box-shadow: 0 0 6px currentColor;
}
.leg.good {
  background: #00f0a8;
  color: #00f0a8;
}
.leg.thin {
  background: #3db8ff;
  color: #3db8ff;
}
.leg.warn {
  background: #ffe14a;
  color: #ffe14a;
}
.leg.bad {
  background: #ff3d5a;
  color: #ff3d5a;
}
.chart {
  width: 100%;
  height: 100%;
  min-height: 0;
}
:deep(.panel__body) {
  padding: 4px 6px 6px;
}
:deep(.panel__content) {
  min-height: 0;
}
</style>
