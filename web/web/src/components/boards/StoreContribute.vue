<!-- 中文名：重点门店毛利结构（与右侧 TOP5 互补） -->
<template>
  <Panel title="门店毛利贡献" :empty="!rows.length">
    <div class="share">
      <div ref="el" class="chart" />
      <div v-if="lead" class="core">
        <em>TOP1</em>
        <b>{{ lead.short }}</b>
        <strong>{{ formatMoney(lead.profit) }}</strong>
        <span>{{ shareOf(lead) }}</span>
      </div>
    </div>
  </Panel>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import Panel from '../Panel.vue'
import { useChart } from '../../composables/useChart'
import { useStoreTop5 } from '../../composables/useStoreTop5'
import { formatMoney, formatPercent } from '../../utils/format'

const { filter, selectedStore, selectedStores, rows, profitSum } = useStoreTop5(5)
const el = ref<HTMLElement | null>(null)
const option = ref<any>(null)
const lead = computed(() => rows.value[0] || null)
const { chart } = useChart(el, option)

function shareOf(row: { profit: number | null }) {
  if (row.profit == null || !profitSum.value) return '—'
  return `${((Math.abs(row.profit) / profitSum.value) * 100).toFixed(2)}%`
}

watch(
  [rows, selectedStores],
  () => {
    const list = rows.value.filter((r) => r.profit != null)
    option.value = {
      tooltip: {
        trigger: 'item',
        backgroundColor: 'rgba(3,14,36,0.96)',
        borderColor: 'rgba(120,210,255,0.5)',
        textStyle: { color: '#f4fbff', fontSize: 14, fontWeight: 700 },
        formatter: (p: { name: string; value: number; percent: number; data: { rate: string; orders: string } }) =>
          `<div style="font-weight:800;margin-bottom:6px">${p.name}</div>毛利 ${formatMoney(p.value)}<br/>占比 ${p.percent.toFixed(2)}%<br/>毛利率 ${p.data.rate}<br/>订单 ${p.data.orders}`,
      },
      legend: { show: false },
      series: [
        {
          type: 'pie',
          roseType: 'radius',
          radius: ['34%', '68%'],
          center: ['50%', '54%'],
          startAngle: 98,
          padAngle: 3,
          itemStyle: { borderColor: '#04122c', borderWidth: 2 },
          label: {
            show: true,
            formatter: (p: { name: string; percent: number }) => `{n|${p.name}}\n{p|${p.percent.toFixed(0)}%}`,
            minMargin: 6,
            lineHeight: 18,
            rich: {
              n: { color: '#e8f3ff', fontSize: 13, fontWeight: 750, lineHeight: 18 },
              p: {
                color: '#9be7ff',
                fontSize: 15,
                fontWeight: 800,
                fontFamily: 'Rajdhani, DIN Alternate, sans-serif',
                lineHeight: 20,
              },
            },
          },
          labelLine: { length: 10, length2: 8, lineStyle: { color: 'rgba(140,190,230,0.45)' } },
          data: list.map((r) => ({
            name: r.short,
            value: Math.abs(r.profit || 0),
            key: r.key,
            rate: formatPercent(r.profitRate),
            orders: r.orders == null ? '—' : String(Math.round(r.orders)),
            itemStyle: {
              color: r.color,
              shadowBlur: selectedStores.value.includes(r.key) ? 18 : 0,
              shadowColor: r.color,
            },
          })),
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
    const key = (p.data as { key?: string } | undefined)?.key
    if (key) {
      const cur = selectedStores.value
      filter.setStores(cur.includes(key) ? cur.filter((s) => s !== key) : [...cur, key])
    }
  })
})
</script>

<style scoped lang="scss">
.share {
  position: relative;
  width: 100%;
  height: 100%;
}
.chart { width: 100%; height: 100%; }
.core {
  position: absolute;
  left: 50%;
  top: 54%;
  transform: translate(-50%, -50%);
  text-align: center;
  pointer-events: none;
  em {
    display: block;
    color: #8fb0cc;
    font-size: 11px;
    font-style: normal;
    letter-spacing: 0.12em;
  }
  b {
    display: block;
    margin-top: 2px;
    color: #f4fbff;
    font-size: 15px;
    font-weight: 750;
  }
  strong {
    display: block;
    margin-top: 4px;
    color: #f6c344;
    font: 800 20px/1 var(--font-num);
  }
  span {
    display: block;
    margin-top: 3px;
    color: #9be7ff;
    font: 800 14px var(--font-num);
  }
}
</style>
