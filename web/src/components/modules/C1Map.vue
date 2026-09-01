<template>
  <Panel title="城市分布" :updated-at="time" :loading="loading && !list.length">
    <div class="wrap">
      <div class="map-toolbar">
        <label class="city-filter">
          城市筛选
          <select :value="cityId" @change="onCity">
            <option v-for="c in cities" :key="c.id" :value="c.id">{{ c.name }}</option>
          </select>
        </label>
        <div class="summary">
          <span>覆盖门店 <b>{{ storeCnt }}</b></span>
          <span class="map-hint">点击城市气泡查看诊断弹窗</span>
        </div>
      </div>
      <div class="map-body">
        <div ref="el" class="chart" />

        <aside v-if="popup" class="city-popup" :style="popupStyle">
          <button type="button" class="city-popup__close" @click="closePopup">×</button>
          <h4>{{ popup.name }}</h4>
          <ul>
            <li v-for="row in popupRows" :key="row.label">
              <span>{{ row.label }}</span>
              <b>{{ row.value }}</b>
              <em :class="row.tone">{{ row.arrow }}{{ row.diff }}</em>
            </li>
          </ul>
          <div class="city-popup__line" />
          <p class="city-popup__diag">诊断：{{ popup.diagnosis }}</p>
          <button type="button" class="city-popup__action" @click="openStoreDetail">
            💡 点击查看门店明细
          </button>
        </aside>
      </div>
    </div>
  </Panel>
</template>

<script setup lang="ts">
import * as echarts from 'echarts'
import { computed, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import Panel from '../Panel.vue'
import { useFilterStore } from '../../stores/filter'
import { fetchGeo, fetchCityOptions, fetchCityPopup, fetchStoreRank } from '../../api/dashboard'
import { useEcharts } from '../../composables/useEcharts'
import { formatMoney, formatInt, formatPercent } from '../../utils/format'
import chinaGeo from '../../assets/china.json'

type GeoCity = {
  city: string
  city_code?: string
  lng: number
  lat: number
  paid_amount: number
  profit_rate: number
  est_profit: number
  paid_orders: number
  store_cnt: number
}

type CityPopup = Awaited<ReturnType<typeof fetchCityPopup>>

const filter = useFilterStore()
const { dataKey, loadingTick, updatedAt, cityId, cityName, hasData, compareKey } = storeToRefs(filter)
const el = ref<HTMLElement | null>(null)
const loading = ref(true)
const option = ref<any>(null)
const list = ref<GeoCity[]>([])
const cities = ref<{ id: string; name: string }[]>([{ id: 'all', name: '全国' }])
const focus = ref<GeoCity | null>(null)
const popup = ref<CityPopup | null>(null)
const popupPos = ref({ left: 24, top: 24 })
const mapReady = ref(false)
const time = computed(() => (updatedAt.value ? updatedAt.value.slice(5, 10) : ''))
const storeCnt = computed(() => {
  if (!cityName.value || cityName.value === '全国') {
    return list.value.reduce((a, c) => a + (c.store_cnt || 0), 0)
  }
  const hit = list.value.find((c) => c.city === cityName.value)
  return hit?.store_cnt ?? 0
})
const { chart } = useEcharts(el, option)

const popupStyle = computed(() => ({
  left: `${popupPos.value.left}px`,
  top: `${popupPos.value.top}px`,
}))

function trendTone(diff: number, invert = false) {
  if (Math.abs(diff) < 1e-9) return 'flat'
  const up = diff > 0
  if (invert) return up ? 'bad' : 'good'
  return up ? 'good' : 'bad'
}

function trendArrow(diff: number) {
  if (Math.abs(diff) < 1e-9) return '—'
  return diff > 0 ? '▲' : '▼'
}

const popupRows = computed(() => {
  const p = popup.value
  if (!p) return []
  return [
    {
      label: '实付营业额',
      value: formatMoney(p.paid_amount),
      diff: `${Math.abs(p.paid_amount_diff * 100).toFixed(1)}%`,
      arrow: trendArrow(p.paid_amount_diff),
      tone: trendTone(p.paid_amount_diff),
    },
    {
      label: '有效订单量',
      value: `${formatInt(p.paid_orders)}单`,
      diff: `${Math.abs(p.paid_orders_diff * 100).toFixed(1)}%`,
      arrow: trendArrow(p.paid_orders_diff),
      tone: trendTone(p.paid_orders_diff),
    },
    {
      label: '有效客单价',
      value: `${(p.aov || 0).toFixed(1)}元`,
      diff: `${Math.abs(p.aov_diff * 100).toFixed(1)}%`,
      arrow: trendArrow(p.aov_diff),
      tone: trendTone(p.aov_diff),
    },
    {
      label: '毛利率',
      value: formatPercent(p.profit_rate),
      diff: `${Math.abs(p.profit_rate_diff).toFixed(1)}pt`,
      arrow: trendArrow(p.profit_rate_diff),
      tone: trendTone(p.profit_rate_diff),
    },
    {
      label: '退款率',
      value: formatPercent(p.refund_rate),
      diff: `${Math.abs(p.refund_rate_diff).toFixed(1)}pt`,
      arrow: trendArrow(p.refund_rate_diff),
      tone: trendTone(p.refund_rate_diff, true),
    },
  ]
})

function ensureMap() {
  if (mapReady.value) return true
  try {
    echarts.registerMap('china', chinaGeo as never)
    mapReady.value = true
    return true
  } catch {
    return false
  }
}

function mixColor(a: string, b: string, t: number) {
  const pa = parseInt(a.slice(1), 16)
  const pb = parseInt(b.slice(1), 16)
  const r = Math.round(((pa >> 16) & 255) + (((pb >> 16) & 255) - ((pa >> 16) & 255)) * t)
  const g = Math.round(((pa >> 8) & 255) + (((pb >> 8) & 255) - ((pa >> 8) & 255)) * t)
  const bl = Math.round((pa & 255) + ((pb & 255) - (pa & 255)) * t)
  return 'rgb(' + r + ',' + g + ',' + bl + ')'
}

function colorByAmount(value: number, min: number, max: number) {
  const t = max > min ? Math.min(1, Math.max(0, (value - min) / (max - min))) : 0.5
  if (t < 0.5) return mixColor('#00D4FF', '#00FFE4', t / 0.5)
  if (t < 0.8) return mixColor('#00FFE4', '#FFC53D', (t - 0.5) / 0.3)
  return mixColor('#FFC53D', '#FF7A45', (t - 0.8) / 0.2)
}

function onCity(e: Event) {
  const id = (e.target as HTMLSelectElement).value
  const name = cities.value.find((c) => c.id === id)?.name || '全国'
  filter.setCity(id, name)
  if (name === '全国') closePopup()
}

function applyFocus(city: GeoCity | null) {
  focus.value = city
}

function closePopup() {
  popup.value = null
}

async function openStoreDetail() {
  if (!popup.value) return
  const stores = await fetchStoreRank(dataKey.value, popup.value.name)
  const top = stores[0]
  filter.openDrawer('city', {
    name: popup.value.name,
    store_cnt: popup.value.store_cnt,
    paid_amount: popup.value.paid_amount,
    profit: popup.value.est_profit,
    profit_rate: popup.value.profit_rate,
    orders: popup.value.paid_orders,
    aov: popup.value.aov,
    refund_rate: popup.value.refund_rate,
    diagnosis: popup.value.diagnosis,
    top_store: top?.name,
    orders_per_store_day: popup.value.store_cnt ? popup.value.paid_orders / popup.value.store_cnt : 0,
  })
}

function placePopup(event?: { offsetX?: number; offsetY?: number }) {
  const box = el.value?.parentElement
  if (!box) return
  const w = box.clientWidth
  const h = box.clientHeight
  const cardW = 268
  const cardH = 280
  let left = (event?.offsetX ?? w * 0.55) + 16
  let top = (event?.offsetY ?? h * 0.35) - 20
  if (left + cardW > w - 8) left = Math.max(8, (event?.offsetX ?? left) - cardW - 16)
  if (top + cardH > h - 8) top = Math.max(8, h - cardH - 8)
  if (top < 8) top = 8
  if (left < 8) left = 8
  popupPos.value = { left, top }
}

async function showCityPopup(city: GeoCity, event?: { offsetX?: number; offsetY?: number }) {
  applyFocus(city)
  filter.setCity(String(city.city_code || city.city), city.city)
  placePopup(event)
  popup.value = await fetchCityPopup(dataKey.value, compareKey.value, city.city)
}

function paint() {
  const ok = ensureMap()
  const amounts = list.value.map((c) => c.paid_amount)
  const minAmount = amounts.length ? Math.min(...amounts) : 0
  const maxAmount = amounts.length ? Math.max(...amounts) : 1
  const scatter = list.value.map((c) => ({
    name: c.city,
    value: [c.lng, c.lat, c.paid_amount, c.profit_rate, c.store_cnt],
    itemStyle: { color: colorByAmount(c.paid_amount, minAmount, maxAmount) },
  }))
  const selected = list.value.find((c) => c.city === cityName.value)
  applyFocus(selected || null)

  option.value = {
    visualMap: {
      type: 'continuous',
      min: minAmount,
      max: maxAmount,
      dimension: 2,
      orient: 'horizontal',
      left: 'center',
      bottom: 4,
      itemWidth: 120,
      itemHeight: 10,
      text: ['实付高', '实付低'],
      textGap: 10,
      textStyle: { color: '#8FA3BF', fontSize: 12 },
      inRange: { color: ['#00D4FF', '#00FFE4', '#FFC53D', '#FF7A45'] },
    },
    geo: {
      map: ok ? 'china' : undefined,
      roam: true,
      zoom: selected ? 7.2 : 1.3,
      center: selected ? [selected.lng, selected.lat] : [116.5, 31.2],
      itemStyle: {
        areaColor: 'rgba(82, 200, 214, 0.30)',
        borderColor: '#8fe6f2',
        borderWidth: 1,
        shadowColor: 'rgba(0, 220, 240, 0.28)',
        shadowBlur: 16,
      },
      emphasis: {
        itemStyle: { areaColor: 'rgba(112, 225, 235, 0.46)' },
        label: { show: false },
      },
      label: { show: false },
    },
    tooltip: { show: false },
    series: [
      {
        type: 'effectScatter',
        coordinateSystem: 'geo',
        data: scatter,
        symbolSize: (val: number[]) => Math.max(14, Math.min(36, Math.sqrt(val[2]) / 6.2)),
        rippleEffect: { scale: 2.6, brushType: 'stroke' },
        label: {
          show: true,
          formatter: '{b}',
          position: 'right',
          color: '#E6F1FF',
          fontSize: 12,
          fontWeight: 600,
        },
      },
    ],
  }

  chart.value?.off('click')
  chart.value?.on('click', (params: any) => {
    const name = params.data?.name || params.name
    if (!name) return
    const city = list.value.find((c) => c.city === name)
    if (city) {
      const event = params.event?.event as { offsetX?: number; offsetY?: number } | undefined
      void showCityPopup(city, event)
    }
  })
}

async function load() {
  loading.value = true
  try {
    if (!hasData.value) {
      list.value = []
      option.value = null
      closePopup()
      return
    }
    cities.value = await fetchCityOptions(dataKey.value)
    list.value = (await fetchGeo(dataKey.value)) as typeof list.value
    paint()
    if (popup.value) {
      const city = list.value.find((c) => c.city === popup.value?.name)
      if (city) popup.value = await fetchCityPopup(dataKey.value, compareKey.value, city.city)
      else closePopup()
    }
  } finally {
    loading.value = false
  }
}

watch([dataKey, loadingTick], load, { immediate: true })
watch(cityName, () => {
  if (list.value.length) paint()
})
</script>

<style scoped lang="scss">
.wrap {
  height: 100%;
  width: 100%;
  display: flex;
  flex-direction: column;
  min-height: 0;
}
.map-toolbar {
  flex-shrink: 0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 2px 10px 8px;
}
.city-filter {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: var(--fs-axis);
  color: var(--c-muted);
  select {
    min-width: 150px;
    background: rgba(8, 24, 56, 0.9);
    border: 1px solid rgba(0, 170, 255, 0.45);
    color: #f2f7ff;
    border-radius: 4px;
    padding: 7px 10px;
    font-size: var(--fs-data);
  }
}
.summary {
  display: flex;
  align-items: center;
  gap: 18px;
  color: var(--c-muted);
  font-size: var(--fs-axis);
  b {
    margin-left: 4px;
    color: #00d4ff;
    font-family: var(--font-num);
    font-size: var(--fs-data);
    font-variant-numeric: tabular-nums;
  }
}
.map-hint {
  color: var(--c-muted);
  font-size: var(--fs-axis);
}
.map-body {
  position: relative;
  flex: 1;
  min-height: 0;
  padding: 0 12px 6px;
}
.chart {
  width: 100%;
  height: 100%;
  min-height: 120px;
}

.city-popup {
  position: absolute;
  z-index: 5;
  width: 268px;
  padding: 14px 16px 12px;
  border-radius: 8px;
  background: rgba(0, 10, 30, 0.92);
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 12px 36px rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(10px);
  color: #e8f3ff;
  animation: popup-in 0.18s ease-out;
  h4 {
    margin: 0 0 10px;
    font-size: 16px;
    font-weight: 700;
    color: #fff;
    padding-right: 20px;
  }
  ul {
    margin: 0;
    padding: 0;
    list-style: none;
  }
  li {
    display: grid;
    grid-template-columns: 1fr auto 58px;
    gap: 8px;
    align-items: center;
    padding: 5px 0;
    font-size: 12px;
    span {
      color: #8899aa;
    }
    b {
      color: #fff;
      font-family: var(--font-num);
      font-variant-numeric: tabular-nums;
      font-weight: 600;
      text-align: right;
    }
    em {
      font-style: normal;
      font-family: var(--font-num);
      font-variant-numeric: tabular-nums;
      text-align: right;
      font-size: 11px;
      &.good {
        color: #00e396;
      }
      &.bad {
        color: #ff4560;
      }
      &.flat {
        color: #8899aa;
      }
    }
  }
}
.city-popup__close {
  position: absolute;
  top: 8px;
  right: 10px;
  border: 0;
  background: transparent;
  color: #8899aa;
  font-size: 20px;
  line-height: 1;
  cursor: pointer;
}
.city-popup__line {
  height: 1px;
  margin: 8px 0;
  background: rgba(255, 255, 255, 0.1);
}
.city-popup__diag {
  margin: 0 0 10px;
  font-size: 12px;
  color: #9adfff;
  line-height: 1.4;
}
.city-popup__action {
  width: 100%;
  border: 0;
  border-radius: 6px;
  padding: 8px 10px;
  background: rgba(0, 143, 251, 0.16);
  color: #9adfff;
  font-size: 12px;
  cursor: pointer;
  text-align: left;
  &:hover {
    background: rgba(0, 143, 251, 0.28);
  }
}
@keyframes popup-in {
  from {
    opacity: 0;
    transform: translateY(6px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
