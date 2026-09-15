<!-- 中文名：渠道占比 -->
<template>
  <Panel title="渠道结构" :loading="loading && !rows.length" :empty="!loading && !rows.length">
    <div class="wrap">
      <div ref="el" class="chart" />
      <ul class="legend">
        <li v-for="r in rows" :key="r.channel">
          <i :style="{ background: colorOf(r.channel).solid }" />
          <div class="meta">
            <span class="name">{{ r.channel }}</span>
            <em>{{ (r.paid_share * 100).toFixed(1) }}%</em>
          </div>
          <div class="vals">
            <b>{{ formatMoney(r.paid_amount) }}</b>
            <small>毛利率 {{ formatPercent(r.profit_rate) }}</small>
          </div>
        </li>
      </ul>
    </div>

    <Teleport to="body">
      <div v-if="tip" class="channel-tip" :style="tipStyle">
        <strong>{{ tip.name }}</strong>
        <span>实付 {{ tip.money }}（{{ tip.percent }}%）</span>
      </div>
    </Teleport>
  </Panel>
</template>

<script setup lang="ts">
import { computed, inject, onUnmounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import Panel from '../Panel.vue'
import { useFilterStore } from '../../stores/filter'
import { fetchChannelShare } from '../../api/dashboard'
import { useChart } from '../../composables/useChart'
import { SCREEN_SCALE_KEY } from '../../composables/useScale'
import { formatMoney, formatPercent } from '../../utils/format'

const COLORS: Record<string, { solid: string; from: string; to: string }> = {
  // 高饱和鲜明色：避免灰蓝哑光
  淘宝闪购: { solid: '#FF7A1F', from: '#FFB066', to: '#FF5A00' },
  美团: { solid: '#FFE14A', from: '#FFF0A0', to: '#FFC107' },
  POS: { solid: '#3DB8FF', from: '#8AD4FF', to: '#1A9AEF' },
  京东: { solid: '#FF3D6E', from: '#FF8AA8', to: '#E0184A' },
}

/** 饼图中心偏右，给左侧悬停留空间 */
const PIE_CX = '62%'
const PIE_CY = '48%'
const PIE_CY_SHADOW = '53%'

const filter = useFilterStore()
const { dataKey, cityQuery, loadingTick, hasData } = storeToRefs(filter)
const el = ref<HTMLElement | null>(null)
const loading = ref(true)
const rows = ref<
  {
    channel: string
    paid_amount: number
    est_profit: number
    paid_orders: number
    profit_rate: number
    paid_share: number
  }[]
>([])
const option = ref<any>(null)
const tip = ref<{ name: string; money: string; percent: string } | null>(null)
const tipPos = ref({ left: 0, top: 0 })
const screenScale = inject(SCREEN_SCALE_KEY, ref(1))
const { chart } = useChart(el, option)

function colorOf(ch: string) {
  return COLORS[ch] || { solid: '#8899AA', from: '#b0c0d0', to: '#667788' }
}

function round2(n: number) {
  return Math.round((Number(n) || 0) * 100) / 100
}

function gradientOf(ch: string) {
  const c = colorOf(ch)
  return {
    type: 'linear' as const,
    x: 0,
    y: 0,
    x2: 1,
    y2: 1,
    colorStops: [
      { offset: 0, color: c.from },
      { offset: 1, color: c.to },
    ],
  }
}

const tipStyle = computed(() => {
  const s = Math.max(screenScale.value || 1, 0.01)
  const cardW = 200 * s
  const cardH = 64 * s
  let left = tipPos.value.left + 18
  let top = tipPos.value.top - 12
  if (left + cardW > window.innerWidth - 8) left = tipPos.value.left - cardW - 12
  if (left < 8) left = 8
  if (top < 8) top = 8
  if (top + cardH > window.innerHeight - 8) top = window.innerHeight - cardH - 8
  return {
    position: 'fixed' as const,
    left: `${left}px`,
    top: `${top}px`,
    zIndex: 7000,
    transform: `scale(${s})`,
    transformOrigin: 'top left',
  }
})

function bindTipEvents() {
  const c = chart.value
  if (!c) return
  c.off('mouseover', onPieOver)
  c.off('mousemove', onPieMove)
  c.off('globalout', onPieOut)
  c.on('mouseover', onPieOver)
  c.on('mousemove', onPieMove)
  c.on('globalout', onPieOut)
}

function onPieOver(params: any) {
  if (params?.seriesType !== 'pie' || params?.seriesIndex !== 1) return
  const val = round2(Number(params.value))
  const pct = typeof params.percent === 'number' ? params.percent.toFixed(1) : '--'
  tip.value = {
    name: String(params.name || ''),
    money: formatMoney(val),
    percent: pct,
  }
  const ev = params?.event?.event as MouseEvent | undefined
  if (ev) tipPos.value = { left: ev.clientX, top: ev.clientY }
}

function onPieMove(params: any) {
  if (!tip.value) return
  if (params?.seriesType !== 'pie' || params?.seriesIndex !== 1) return
  const ev = params?.event?.event as MouseEvent | undefined
  if (ev) tipPos.value = { left: ev.clientX, top: ev.clientY }
}

function onPieOut() {
  tip.value = null
}

async function load() {
  loading.value = true
  tip.value = null
  try {
    if (!hasData.value) {
      rows.value = []
      option.value = null
      return
    }
    const cityParam = Array.isArray(cityQuery.value) ? cityQuery.value.join('|') : cityQuery.value
    rows.value = await fetchChannelShare(dataKey.value, cityParam)
    const total = round2(rows.value.reduce((s, r) => s + (r.paid_amount || 0), 0))
    const pieData = rows.value.map((r) => ({
      name: r.channel,
      value: round2(r.paid_amount),
    }))

    option.value = {
      tooltip: { show: false },
      graphic: [
        {
          type: 'group',
          left: PIE_CX,
          top: PIE_CY,
          bounding: 'raw',
          z: 1,
          children: [
            {
              type: 'circle',
              shape: { cx: 0, cy: 0, r: 42 },
              style: {
                fill: {
                  type: 'radial',
                  x: 0.35,
                  y: 0.3,
                  r: 0.85,
                  colorStops: [
                    { offset: 0, color: 'rgba(28, 70, 130, 0.98)' },
                    { offset: 1, color: 'rgba(6, 20, 48, 0.98)' },
                  ],
                },
                shadowBlur: 22,
                shadowColor: 'rgba(0, 30, 80, 0.65)',
                shadowOffsetY: 8,
                stroke: 'rgba(120, 200, 255, 0.28)',
                lineWidth: 1.5,
              },
            },
          ],
        },
      ],
      title: [
        {
          text: formatMoney(total),
          left: PIE_CX,
          top: '38%',
          textAlign: 'center',
          z: 5,
          textStyle: {
            color: '#7ec8ff',
            fontSize: 17,
            fontWeight: 700,
            fontFamily: 'Rajdhani, DIN Alternate, Bahnschrift, monospace',
            textShadowColor: 'rgba(0,0,0,0.35)',
            textShadowBlur: 4,
          },
        },
        {
          text: '实付汇总',
          left: PIE_CX,
          top: '52%',
          textAlign: 'center',
          z: 5,
          textStyle: {
            color: 'rgba(200, 220, 240, 0.88)',
            fontSize: 12,
            fontWeight: 600,
          },
        },
      ],
      series: [
        {
          type: 'pie',
          radius: ['48%', '74%'],
          center: [PIE_CX, PIE_CY_SHADOW],
          silent: true,
          z: 0,
          animation: false,
          tooltip: { show: false },
          label: { show: false },
          labelLine: { show: false },
          itemStyle: {
            color: 'rgba(0, 12, 36, 0.55)',
            borderWidth: 0,
            shadowBlur: 18,
            shadowColor: 'rgba(0, 0, 0, 0.45)',
            shadowOffsetY: 10,
          },
          data: pieData,
        },
        {
          type: 'pie',
          radius: ['48%', '72%'],
          center: [PIE_CX, PIE_CY],
          z: 2,
          avoidLabelOverlap: true,
          padAngle: 1.8,
          itemStyle: {
            borderRadius: 4,
            borderColor: 'rgba(4, 18, 47, 0.9)',
            borderWidth: 2,
            shadowBlur: 16,
            shadowColor: 'rgba(40, 140, 255, 0.35)',
            shadowOffsetY: 4,
          },
          label: { show: false },
          labelLine: { show: false },
          emphasis: {
            scale: true,
            scaleSize: 8,
            itemStyle: {
              shadowBlur: 24,
              shadowColor: 'rgba(120, 210, 255, 0.55)',
              shadowOffsetY: 6,
            },
          },
          data: pieData.map((d) => ({
            name: d.name,
            value: d.value,
            itemStyle: { color: gradientOf(d.name) },
          })),
        },
      ],
    }
  } finally {
    loading.value = false
  }
}

watch([dataKey, cityQuery, loadingTick], load, { immediate: true })
watch(chart, (c) => {
  if (c) {
    bindTipEvents()
    window.setTimeout(bindTipEvents, 80)
  }
})
watch(option, () => window.setTimeout(bindTipEvents, 60))
onUnmounted(() => {
  chart.value?.off('mouseover', onPieOver)
  chart.value?.off('mousemove', onPieMove)
  chart.value?.off('globalout', onPieOut)
})
</script>

<style scoped lang="scss">
.wrap {
  height: 100%;
  min-height: 0;
  display: grid;
  grid-template-columns: 1.15fr 0.95fr;
  gap: 8px;
  align-items: center;
}
.chart {
  min-height: 0;
  height: 100%;
  min-width: 0;
  overflow: visible;
}
.legend {
  list-style: none;
  margin: 0;
  padding: 2px 2px 2px 0;
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-height: 0;
  li {
    display: grid;
    grid-template-columns: 10px 1fr auto;
    column-gap: 10px;
    align-items: center;
  }
  i {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    box-shadow: 0 0 8px rgba(90, 200, 255, 0.25);
  }
  .meta {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }
  .name {
    font-size: 13px;
    font-weight: 600;
    color: #f2f7ff;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  em {
    font-style: normal;
    color: #9adfff;
    font-size: 12px;
    font-family: var(--font-num);
    font-variant-numeric: tabular-nums;
  }
  .vals {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 2px;
  }
  b {
    font-family: var(--font-num);
    font-size: 13px;
    font-weight: 700;
    color: #fff;
    font-variant-numeric: tabular-nums;
  }
  small {
    color: rgba(160, 190, 220, 0.8);
    font-size: 11px;
  }
}
</style>

<style lang="scss">
.channel-tip {
  min-width: 160px;
  padding: 10px 14px;
  border-radius: 8px;
  background: rgba(4, 16, 40, 0.96);
  border: 1px solid rgba(90, 200, 255, 0.4);
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.5);
  color: #e8f3ff;
  pointer-events: none;
  strong {
    display: block;
    font-size: 14px;
    font-weight: 700;
    margin-bottom: 4px;
    color: #fff;
  }
  span {
    font-size: 13px;
    color: #9adfff;
    font-family: var(--font-num), sans-serif;
  }
}
</style>
