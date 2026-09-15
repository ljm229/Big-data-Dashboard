<!-- 中文名：城市经营质量矩阵
  气泡：预计线上收入
  X：有效订单量日比增速（源表有效订单，已剔整单退订）
  Y：毛利率（含平台后返）
-->
<template>
  <Panel title="城市经营质量矩阵" :empty="!rows.length">
    <template #extra>
      <span class="matrix-note">横轴：订单增长率 · 纵轴：毛利率(含后返) · 气泡：预计线上收入</span>
    </template>
    <div ref="el" class="chart" />
  </Panel>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import Panel from '../Panel.vue'
import { useFilterStore } from '../../stores/filter'
import { previousDayRange, source1ByCity } from '../../api/source1'
import { useChart } from '../../composables/useChart'
import { formatMoney, formatPercent } from '../../utils/format'
import { PALETTE } from '../../styles/palette'
import { vividSphere } from '../../utils/sphereBubble'

const filter = useFilterStore()
const { periodRange, channel, storeQuery, selectedCities } = storeToRefs(filter)
const el = ref<HTMLElement | null>(null)
const option = ref<any>(null)

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
  const prev = previousDayRange(q.from, q.to)
  const last = source1ByCity({ ...q, ...prev })
  const lastMap = new Map(last.map((r) => [r.key, effectiveOrders(r)]))
  return source1ByCity(q)
    .map((r) => {
      const prevOrders = lastMap.get(r.key)
      const orders = effectiveOrders(r)
      const revenue = r.onlineRevenue
      const growth =
        prevOrders != null && prevOrders !== 0 && orders != null
          ? (orders - prevOrders) / Math.abs(prevOrders)
          : null
      return {
        ...r,
        orders,
        revenue,
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
        revenue: number
        orders: number
      } => {
        return r.marginWithRebate != null && r.growth != null && r.revenue != null && r.orders != null
      },
    )
})

const { chart } = useChart(el, option)

const COLORS = [...PALETTE.vivid] as const

watch(
  [rows, selectedCities],
  () => {
    if (!rows.value.length) {
      option.value = null
      return
    }
    const maxRevenue = Math.max(...rows.value.map((r) => Math.abs(r.revenue)), 1)
    const xs = rows.value.map((r) => r.growth)
    const ys = rows.value.map((r) => r.marginWithRebate)
    const xMin = Math.min(-0.1, ...xs) - 0.02
    const xMax = Math.max(0.12, ...xs) + 0.02
    const yMin = Math.min(-0.03, ...ys) - 0.02
    const yMax = Math.max(0.25, ...ys) + 0.02
    const xMid = 0
    const yMid = 0.18

    option.value = {
      animationDuration: 400,
      tooltip: {
        trigger: 'item',
        backgroundColor: PALETTE.panelDeep,
        borderColor: PALETTE.accent,
        textStyle: { color: '#e8f3ff', fontSize: 12 },
        formatter: (p: {
          data: {
            name: string
            value: number[]
            orders: number
            revenue: number
            profit: number | null
          }
        }) => {
          const d = p.data
          const g = (d.value[0] * 100).toFixed(1)
          const m = formatPercent(d.value[1])
          return [
            `<b>${d.name}</b>`,
            `订单增长率 ${Number(g) >= 0 ? '+' : ''}${g}%`,
            `毛利率(含后返) ${m}`,
            `预计线上收入 ${formatMoney(d.revenue)}`,
            `有效订单量 ${d.orders.toLocaleString('zh-CN')}`,
            `预计毛利 ${formatMoney(d.profit)}`,
          ].join('<br/>')
        },
      },
      grid: { left: 52, right: 16, top: 28, bottom: 36, containLabel: false },
      xAxis: {
        type: 'value',
        name: '订单增长率 →',
        nameLocation: 'middle',
        nameGap: 24,
        nameTextStyle: { color: '#9ec9e8', fontSize: 11 },
        min: xMin,
        max: xMax,
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
        name: '毛利率(含后返) ↑',
        nameLocation: 'end',
        nameGap: 6,
        nameTextStyle: { color: '#9ec9e8', fontSize: 11 },
        min: yMin,
        max: yMax,
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
          data: rows.value.map((r, i) => {
            const color = COLORS[i % COLORS.length]
            const picked = selectedCities.value.some((c) => c === r.key)
            return {
              name: r.key,
              value: [r.growth, r.marginWithRebate],
              orders: r.orders,
              revenue: r.revenue,
              profit: r.profit,
              itemStyle: {
                color: vividSphere(color),
                opacity: 1,
                borderColor: picked ? '#fff' : 'rgba(255,255,255,0.7)',
                borderWidth: picked ? 2.2 : 1.3,
                shadowBlur: 18,
                shadowColor: color,
              },
              label: {
                show: true,
                formatter: '{b}',
                color: '#ffffff',
                fontSize: 12,
                fontWeight: 700,
                position: 'top',
                distance: 6,
                textBorderColor: 'rgba(4, 22, 48, 0.9)',
                textBorderWidth: 2.5,
              },
            }
          }),
          symbol: 'circle',
          symbolSize: (_v: number[], p: { data: { revenue: number } }) =>
            12 + Math.sqrt(Math.abs(p.data.revenue) / maxRevenue) * 28,
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
            data: [{ xAxis: xMid }, { yAxis: yMid }],
          },
          markArea: {
            silent: true,
            itemStyle: { color: 'transparent' },
            data: [
              [
                {
                  name: '增收不增利',
                  xAxis: xMin,
                  yAxis: yMid,
                  label: {
                    show: true,
                    position: 'insideTopLeft',
                    color: '#FF9234',
                    fontSize: 12,
                    fontWeight: 600,
                    formatter: '增收不增利',
                  },
                },
                { xAxis: xMid, yAxis: yMax },
              ],
              [
                {
                  name: '加资源',
                  xAxis: xMid,
                  yAxis: yMid,
                  label: {
                    show: true,
                    position: 'insideTopRight',
                    color: '#FFE03B',
                    fontSize: 12,
                    fontWeight: 600,
                    formatter: '加资源',
                  },
                },
                { xAxis: xMax, yAxis: yMax },
              ],
              [
                {
                  name: '重点整改',
                  xAxis: xMin,
                  yAxis: yMin,
                  label: {
                    show: true,
                    position: 'insideBottomLeft',
                    color: '#FF5268',
                    fontSize: 12,
                    fontWeight: 600,
                    formatter: '重点整改',
                  },
                },
                { xAxis: xMid, yAxis: yMid },
              ],
              [
                {
                  name: '保利润',
                  xAxis: xMid,
                  yAxis: yMin,
                  label: {
                    show: true,
                    position: 'insideBottomRight',
                    color: '#5FA8E6',
                    fontSize: 12,
                    fontWeight: 600,
                    formatter: '保利润',
                  },
                },
                { xAxis: xMax, yAxis: yMid },
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
    if (name) {
      const cur = selectedCities.value
      if (cur.length === 1 && cur[0] === name) filter.setCities([])
      else if (cur.includes(name)) filter.setCities(cur.filter((c) => c !== name))
      else filter.setCities([...cur, name])
    }
  })
})
</script>

<style scoped>
.matrix-note {
  color: var(--muted);
  font-size: 12px;
  font-weight: 500;
}
.chart {
  width: 100%;
  height: 100%;
  min-height: 0;
}
</style>
