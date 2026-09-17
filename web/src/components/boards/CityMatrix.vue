<!-- 中文名：城市经营健康矩阵
  看规模 + 毛利质量
  X：有效订单量环比增速
  Y：毛利率（含平台后返）
  气泡：实付金额
  颜色：绿健康 / 黄关注 / 红整改
-->
<template>
  <Panel title="城市经营健康矩阵" :empty="!rows.length">
    <template #extra>
      <span class="matrix-note">
        订单↑毛利高=绿 · 离群钉右缘
        <i class="leg good" />健康
        <i class="leg warn" />关注
        <i class="leg bad" />整改
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

/** 主体视角：用 IQR 丢掉极端离群点，避免济南这类点把绿点挤到画面左侧 */
function focusSpan(vals: number[], pad: number, softMin: number, softMax: number) {
  if (!vals.length) return { min: softMin - pad, max: softMax + pad }
  const q1 = quantile(vals, 0.25)
  const q3 = quantile(vals, 0.75)
  const iqr = Math.max(q3 - q1, 0.06)
  const lo = Math.max(Math.min(...vals), q1 - 1.5 * iqr)
  const hi = Math.min(Math.max(...vals), q3 + 1.5 * iqr)
  return {
    min: Math.min(softMin, lo) - pad,
    max: Math.max(softMax, hi) + pad,
  }
}

/** 作图用横轴上限：极端增速钉在右缘，真实值仍在 tooltip */
function plotCapX(vals: number[], focusMax: number) {
  return Math.max(0.36, focusMax + 0.06, quantile(vals, 0.8) + 0.05)
}

function resetZoom() {
  const c = chart.value
  const v = viewBox.value
  if (!c) return
  c.dispatchAction({
    type: 'dataZoom',
    batch: [
      { dataZoomIndex: 0, startValue: v.xMin, endValue: v.xMax },
      { dataZoomIndex: 1, startValue: v.yMin, endValue: v.yMax },
    ],
  })
}

function showAll() {
  const c = chart.value
  const v = viewBox.value
  if (!c) return
  c.dispatchAction({
    type: 'dataZoom',
    batch: [
      { dataZoomIndex: 0, startValue: v.fullXMin, endValue: v.fullXMax },
      { dataZoomIndex: 1, startValue: v.fullYMin, endValue: v.fullYMax },
    ],
  })
}

type ZoneKey = 'healthy' | 'scaleLoss' | 'profitThin' | 'rectify'

const ZONE = {
  healthy: {
    name: '健康增长',
    formula: '订单↑ · 毛利高',
    action: '扩大投入',
    color: '#00F0A8',
    tone: '健康',
  },
  scaleLoss: {
    name: '规模亏损',
    formula: '订单↑ · 毛利低',
    action: '控制成本/活动',
    color: '#FFE14A',
    tone: '关注',
  },
  profitThin: {
    name: '流量不足',
    formula: '订单↓ · 毛利高',
    action: '提升流量',
    color: '#FFE14A',
    tone: '关注',
  },
  rectify: {
    name: '重点整改',
    formula: '订单↓ · 毛利低',
    action: '专项优化',
    color: '#FF3D5A',
    tone: '整改',
  },
} as const

function zoneOf(growth: number, margin: number): ZoneKey {
  const up = growth >= X_MID
  const rich = margin >= Y_MID
  if (up && rich) return 'healthy'
  if (up && !rich) return 'scaleLoss'
  if (!up && rich) return 'profitThin'
  return 'rectify'
}

/** 有效订单量：源表 orders（有效订单，已剔整单退订） */
function effectiveOrders(row: { orders: number | null }) {
  return row.orders
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
      return {
        ...r,
        orders,
        paid,
        growth,
        /** 源表 marginRate 加权，口径为毛利率（含平台后返） */
        marginWithRebate: r.profitRate,
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
  [rows, selectedCities],
  () => {
    if (!rows.value.length) {
      option.value = null
      return
    }
    const maxPaid = Math.max(...rows.value.map((r) => Math.abs(r.paid)), 1)
    const xs = rows.value.map((r) => r.growth)
    const ys = rows.value.map((r) => r.marginWithRebate)
    const xFocus = focusSpan(xs, 0.03, -0.12, 0.18)
    const yFocus = focusSpan(ys, 0.02, 0, 0.28)
    // 主体窗口不得小于分界线附近可读范围
    const xMin = Math.min(xFocus.min, -0.08)
    const xMax = Math.max(xFocus.max, 0.15)
    const yMin = Math.min(yFocus.min, -0.02)
    const yMax = Math.max(yFocus.max, 0.26)
    // 全景横轴软裁剪：极端增速钉在右缘，避免把「健康」绿点挤到画面左侧
    const xCap = plotCapX(xs, xMax)
    const fullXMin = Math.min(-0.12, ...xs) - 0.02
    const fullXMax = xCap + 0.02
    const fullYMin = Math.min(-0.03, ...ys) - 0.02
    const fullYMax = Math.max(0.28, ...ys) + 0.02
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
          const capHint = d.capped
            ? `<span style="color:#ffe14a">增速离群，已钉在右缘（真实 ${Number(g) >= 0 ? '+' : ''}${g}%）</span>`
            : null
          return [
            `<b>${d.name}</b> · <span style="color:${z.color}">${z.formula} · ${z.name}</span>`,
            `动作建议：${z.action}`,
            `订单增长率 ${Number(g) >= 0 ? '+' : ''}${g}%`,
            `毛利率(含后返) ${m}`,
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
      grid: { left: 56, right: 28, top: 36, bottom: 44, containLabel: false },
      dataZoom: [
        {
          type: 'inside',
          xAxisIndex: 0,
          filterMode: 'none',
          startValue: xMin,
          endValue: xMax,
          zoomOnMouseWheel: true,
          moveOnMouseMove: true,
          moveOnMouseWheel: false,
          throttle: 40,
        },
        {
          type: 'inside',
          yAxisIndex: 0,
          filterMode: 'none',
          startValue: yMin,
          endValue: yMax,
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
        nameGap: 24,
        nameTextStyle: { color: '#9ec9e8', fontSize: 11 },
        min: fullXMin,
        max: fullXMax,
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
        name: '高毛利率 ↑',
        nameLocation: 'end',
        nameGap: 6,
        nameTextStyle: { color: '#9ec9e8', fontSize: 11 },
        min: fullYMin,
        max: fullYMax,
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
          data: rows.value.map((r) => {
            const zone = zoneOf(r.growth, r.marginWithRebate)
            const color = ZONE[zone].color
            const picked = selectedCities.value.some((c) => c === r.key)
            const capped = r.growth > xCap
            const plotX = Math.min(r.growth, xCap)
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
                opacity: 1,
                borderColor: capped ? '#FFE14A' : picked ? '#fff' : 'rgba(255,255,255,0.75)',
                borderWidth: capped || picked ? 2.4 : 1.3,
                shadowBlur: 16,
                shadowColor: color,
              },
              label: {
                show: true,
                formatter: capped ? '{b}·离群' : '{b}',
                color: '#ffffff',
                fontSize: 11,
                fontWeight: 700,
                position: 'top',
                distance: 8,
                textBorderColor: 'rgba(4, 22, 48, 0.9)',
                textBorderWidth: 2.5,
              },
            }
          }),
          symbol: 'circle',
          symbolSize: (_v: number[], p: { data: { paid: number } }) =>
            12 + Math.sqrt(Math.abs(p.data.paid) / maxPaid) * 28,
          labelLayout: { hideOverlap: true, moveOverlap: 'shiftY' },
          emphasis: {
            scale: 1.12,
            label: { show: true, fontSize: 12 },
          },
          markLine: {
            silent: true,
            symbol: 'none',
            animation: false,
            label: { show: false },
            lineStyle: { type: 'dashed', width: 1, color: 'rgba(120, 200, 230, 0.5)' },
            data: [{ xAxis: X_MID }, { yAxis: Y_MID }],
          },
          markArea: {
            silent: true,
            itemStyle: { color: 'transparent' },
            data: [
              [
                {
                  name: ZONE.profitThin.name,
                  xAxis: fullXMin,
                  yAxis: Y_MID,
                  label: zoneLabel('profitThin', 'insideTopLeft'),
                },
                { xAxis: X_MID, yAxis: fullYMax },
              ],
              [
                {
                  name: ZONE.healthy.name,
                  xAxis: X_MID,
                  yAxis: Y_MID,
                  label: zoneLabel('healthy', 'insideTopRight'),
                },
                { xAxis: fullXMax, yAxis: fullYMax },
              ],
              [
                {
                  name: ZONE.rectify.name,
                  xAxis: fullXMin,
                  yAxis: fullYMin,
                  label: zoneLabel('rectify', 'insideBottomLeft'),
                },
                { xAxis: X_MID, yAxis: Y_MID },
              ],
              [
                {
                  name: ZONE.scaleLoss.name,
                  xAxis: X_MID,
                  yAxis: fullYMin,
                  label: zoneLabel('scaleLoss', 'insideBottomRight'),
                },
                { xAxis: fullXMax, yAxis: Y_MID },
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
</style>
