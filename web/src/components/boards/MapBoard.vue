<!-- 中文名：地图看板 -->
<template>
  <Panel :title="panelTitle" :loading="loading && !list.length">
    <div class="wrap">
      <div class="map-toolbar">
        <div class="map-toolbar__filters">
          <label class="city-filter">
            城市
            <SelectMenu
              class="city-filter__select"
              multiple
              all-value="全国"
              :model-value="selectedCities"
              :options="citySelectOptions"
              placeholder="全国"
              search-placeholder="搜索城市"
              @update:model-value="onCitiesSelect"
            />
          </label>
          <label class="city-filter">
            门店
            <SelectMenu
              class="city-filter__select"
              multiple
              all-value=""
              :model-value="selectedStores"
              :options="storeSelectOptions"
              :disabled="!storeOptions.length"
              placeholder="全部门店"
              search-placeholder="搜索门店"
              @update:model-value="onStoresSelect"
            />
          </label>
          <label class="city-filter city-filter--metric">
            地图指标
            <SelectMenu
              class="city-filter__select city-filter__select--metric"
              :model-value="mapMetric"
              :options="metricOptions"
              @update:model-value="onMetricSelect"
            />
          </label>
        </div>
        <div class="summary">
          <span class="legend">
            <i class="lg lg--hi" />高毛利
            <i class="lg lg--mid" />中
            <i class="lg lg--lo" />低/负
          </span>
          <span>覆盖门店 <b>{{ visibleStoreCnt }}</b></span>
          <button v-if="provinceView" type="button" class="back-btn" @click="backNationwide">返回全国</button>
        </div>
      </div>

      <div class="map-body">
        <div ref="el" class="chart" />
      </div>

      <Teleport to="body">
        <aside
          v-if="profilePopup"
          class="city-popup city-popup--profile"
          :style="popupStyle"
          @click.stop
        >
          <button type="button" class="city-popup__close" @click="closePopup">×</button>
          <h4>{{ profilePopup.name }}</h4>
          <p class="city-popup__sub">{{ profilePopup.city || '—' }} · 点地图空白关闭</p>
          <ul class="profile-rows">
            <li v-for="row in profileRows" :key="row.label">
              <span>{{ row.label }}</span>
              <b>{{ row.value }}</b>
            </li>
          </ul>
          <template v-if="profilePopup.channels?.length">
            <div class="city-popup__line" />
            <p class="city-popup__sec">渠道拆分</p>
            <div v-for="c in profilePopup.channels" :key="c.channel" class="ch-row">
              <strong>{{ c.channel }}</strong>
              <em>{{ formatMoney(c.paid_amount) }}</em>
              <span>订单 {{ formatInt(c.paid_orders) }} · 毛利率 {{ formatPercent(c.profit_rate) }}</span>
            </div>
          </template>
        </aside>
      </Teleport>
    </div>
  </Panel>
</template>

<script setup lang="ts">
import * as echarts from 'echarts'
import { computed, inject, nextTick, onUnmounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import Panel from '../Panel.vue'
import SelectMenu from '../SelectMenu.vue'
import { useFilterStore } from '../../stores/filter'
import { SCREEN_SCALE_KEY } from '../../composables/useScale'
import {
  fetchGeo,
  fetchCityOptions,
  fetchCoverageStoreCnt,
  fetchMapStores,
  fetchStoreProfile,
  type MapStorePoint,
} from '../../api/dashboard'
import { useChart } from '../../composables/useChart'
import { formatMoney, formatInt, formatPercent } from '../../utils/format'
import { bareStoreName } from '../../utils/storeName'
import { resolveProvince, type ProvinceMeta } from '../../data/geoMeta'
import { loadProvinceGeo } from '../../utils/loadProvinceGeo'
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
  province?: string
  provinceKey?: string
}

type StoreProfile = NonNullable<Awaited<ReturnType<typeof fetchStoreProfile>>>

const filter = useFilterStore()
const { dataKey, loadingTick, cityId, cityName, selectedCities, selectedStores, hasData, channel } = storeToRefs(filter)
const el = ref<HTMLElement | null>(null)
const loading = ref(true)
const option = ref<any>(null)
const list = ref<GeoCity[]>([])
const stores = ref<MapStorePoint[]>([])
const cities = ref<{ id: string; name: string }[]>([{ id: 'all', name: '全国' }])
const focus = ref<GeoCity | null>(null)
const profilePopup = ref<StoreProfile | null>(null)
const popupPos = ref({ left: 24, top: 24 })
const mapReady = ref(false)
const registeredProvinces = new Set<string>()
const activeProvince = ref<ProvinceMeta | null>(null)
const storeFocus = ref('')
/** 全国选店后切城市时保留焦点，避免 cityName watch 清空 */
const pendingStoreFocus = ref('')
/** 地图数据编码：大小看规模，颜色看毛利率 */
const mapMetric = ref<'paid' | 'orders' | 'profit'>('paid')
const lastMode = ref<'nation' | 'province'>('nation')
const lastProvinceKey = ref<string>('')
let mapClickHandled = false

const provinceView = computed(() => !!activeProvince.value && selectedCities.value.length > 0)
const panelTitle = computed(() =>
  provinceView.value ? `${activeProvince.value?.name || ''} · ${cityName.value}` : '城市分布',
)

function matchCityLocal(a: string, b: string | string[]) {
  const list = Array.isArray(b) ? b : b ? [b] : []
  if (!list.length || list.some((x) => !x || x === '全国' || x === 'all')) return true
  const left = a.replace(/市$/g, '')
  return list.some((item) => left === String(item).replace(/市$/g, '') || a === item)
}

/** 门店下拉：全国列出全部门店；选城市后仅该城门店 */
const storeOptions = computed(() => {
  if (!selectedCities.value.length) return stores.value
  return stores.value.filter((s) => matchCityLocal(s.city, selectedCities.value))
})

const citySelectOptions = computed(() =>
  cities.value.map((c) => ({ value: c.id === 'all' ? '全国' : c.name, label: c.name })),
)
const storeSelectOptions = computed(() => [
  { value: '', label: '全部门店' },
  ...storeOptions.value.map((s) => ({
    value: s.shortName,
    label: !selectedCities.value.length && s.city ? `${s.shortName} · ${s.city}` : s.shortName,
  })),
])
const metricOptions = [
  { value: 'paid', label: '气泡=实付 · 颜色=毛利率' },
  { value: 'orders', label: '气泡=订单 · 颜色=毛利率' },
  { value: 'profit', label: '气泡=毛利 · 颜色=毛利率' },
]

/** 省内门店点：始终保留全部门店，高亮用 storeFocus，不删点（避免只能点一次） */
const cityStores = computed(() => {
  if (selectedCities.value.length) {
    return stores.value.filter((s) => matchCityLocal(s.city, selectedCities.value))
  }
  return stores.value
})

const visibleStoreCnt = computed(() => {
  if (selectedCities.value.length) return storeOptions.value.length
  return fetchCoverageStoreCnt(dataKey.value, '全国')
})

const { chart } = useChart(el, option)
const screenScale = inject(SCREEN_SCALE_KEY, ref(1))

const popupStyle = computed(() => {
  const s = Math.max(screenScale.value || 1, 0.01)
  return {
    position: 'fixed' as const,
    left: `${popupPos.value.left}px`,
    top: `${popupPos.value.top}px`,
    zIndex: 5000,
    transform: `scale(${s})`,
    transformOrigin: 'top left',
  }
})

const profileRows = computed(() => {
  const p = profilePopup.value
  if (!p) return []
  return [
    { label: '实付营业额', value: formatMoney(p.paid_amount) },
    { label: '有效订单', value: `${formatInt(p.paid_orders)}单` },
    { label: '客单价', value: `${(p.arpu || 0).toFixed(1)}元` },
    { label: '毛利(含后返)', value: formatMoney(p.est_profit) },
    { label: '毛利率', value: formatPercent(p.profit_rate) },
    { label: '退款率', value: formatPercent(p.refund_rate) },
    { label: '营销费用', value: formatMoney(p.marketing_cost) },
  ]
})

function ensureChinaMap() {
  if (mapReady.value) return true
  try {
    echarts.registerMap('china', chinaGeo as never)
    mapReady.value = true
    return true
  } catch {
    return false
  }
}

async function ensureProvinceMap(meta: ProvinceMeta) {
  const mapName = `province-${meta.key}`
  if (registeredProvinces.has(mapName)) return mapName
  const geo = await loadProvinceGeo(meta.key)
  echarts.registerMap(mapName, geo as never)
  registeredProvinces.add(mapName)
  return mapName
}

function onCitiesSelect(value: string | string[]) {
  const names = (Array.isArray(value) ? value : value ? [value] : []).filter((v) => v && v !== '全国' && v !== 'all')
  storeFocus.value = ''
  closePopup()
  filter.setCities(names)
}

function onCitySelect(id: string) {
  const name = cities.value.find((c) => c.id === id)?.name || '全国'
  storeFocus.value = ''
  closePopup()
  filter.setCity(id, name)
}

function backNationwide() {
  storeFocus.value = ''
  filter.setCities([])
  closePopup()
}

function findStoreByFocus(value: string) {
  if (!value) return undefined
  return stores.value.find(
    (s) => s.shortName === value || bareStoreName(s.shortName) === bareStoreName(value),
  )
}

function onStoresSelect(value: string | string[]) {
  const names = (Array.isArray(value) ? value : value ? [value] : []).filter(Boolean)
  if (!names.length) {
    pendingStoreFocus.value = ''
    storeFocus.value = ''
    filter.setStores([])
    closePopup()
    void paint()
    return
  }
  filter.setStores(names)
  const last = names[names.length - 1]!
  const store = findStoreByFocus(last)
  if (store && !selectedCities.value.length) {
    const cityOpt = cities.value.find((c) => c.id !== 'all' && matchCityLocal(c.name, store.city))
    if (cityOpt) {
      pendingStoreFocus.value = store.shortName
      filter.setCities([cityOpt.name])
    }
  }
  storeFocus.value = last
  onStoreFocus()
}

function onStoreSelect(value: string) {
  if (!value) {
    pendingStoreFocus.value = ''
    storeFocus.value = ''
    closePopup()
    void paint()
    return
  }
  const store = findStoreByFocus(value)
  // 全国选店：先切到所属城市，再聚焦门店
  if (store && !selectedCities.value.length) {
    const cityOpt = cities.value.find((c) => c.id !== 'all' && matchCityLocal(c.name, store.city))
    if (cityOpt) {
      pendingStoreFocus.value = store.shortName
      filter.setCity(cityOpt.id, cityOpt.name)
      return
    }
  }
  storeFocus.value = value
  onStoreFocus()
}

/** 下拉选门店：只高亮并微微放大到点位，不弹经营窗（弹窗仅地图点击） */
function onStoreFocus() {
  const store = findStoreByFocus(storeFocus.value)
  closePopup()
  if (store) {
    highlightProvinceStores()
    focusMapOnStore(store)
  } else {
    void paint()
  }
}

/** 将地图中心微移到门店并略放大 */
function focusMapOnStore(store: MapStorePoint) {
  if (!chart.value || lastMode.value !== 'province') return
  chart.value.setOption(
    {
      geo: {
        center: [store.lng, store.lat],
        zoom: 2.35,
      },
    },
    { lazyUpdate: true },
  )
}

function onMetricSelect(value: string | string[]) {
  const next = Array.isArray(value) ? value[0] : value
  if (next === 'paid' || next === 'orders' || next === 'profit') {
    mapMetric.value = next
    void paint()
  }
}

/** 气泡大小看规模，颜色看毛利率 */
function normalizeRate(rate: number) {
  if (!Number.isFinite(rate)) return NaN
  return Math.abs(rate) > 1 ? rate / 100 : rate
}

function colorByProfitRate(rate: number) {
  const r = normalizeRate(rate)
  if (!Number.isFinite(r)) return '#5b9dff'
  if (r < 0) return '#ff5c5c'
  if (r < 0.08) return '#ff7a45'
  if (r < 0.15) return '#ffc53d'
  if (r < 0.22) return '#7dffb0'
  return '#3dff7a'
}

function metricValue(c: { paid_amount: number; paid_orders: number; est_profit: number }) {
  if (mapMetric.value === 'orders') return c.paid_orders
  if (mapMetric.value === 'profit') return Math.max(0, c.est_profit)
  return c.paid_amount
}

function metricSymbolSize(sizeBase: number) {
  const div = mapMetric.value === 'orders' ? 3.2 : 6.2
  return Math.max(14, Math.min(40, Math.sqrt(Math.max(sizeBase, 1)) / div))
}

function applyFocus(city: GeoCity | null) {
  focus.value = city
}

function closePopup() {
  profilePopup.value = null
}

function fallbackProfile(store: MapStorePoint): StoreProfile {
  return {
    name: store.shortName,
    fullName: store.name,
    city: store.city,
    paid_amount: store.paid_amount,
    total_gmv: 0,
    paid_orders: store.paid_orders,
    buyer_cnt: 0,
    arpu: store.paid_orders ? store.paid_amount / store.paid_orders : 0,
    est_profit: store.est_profit,
    est_profit_raw: store.est_profit,
    rebate: 0,
    rebate_share: 0,
    profit_rate: store.profit_rate,
    neg_profit_order_rate: 0,
    marketing_cost: 0,
    refund_orders: 0,
    refund_amount: 0,
    refund_rate: 0,
    self_delivery_cost: 0,
    channels: [],
  }
}

/** 弹窗锚点：优先门店像素坐标，避免盖住选中点 */
function resolveMarkerAnchor(store?: MapStorePoint, event?: { clientX?: number; clientY?: number }) {
  if (store && chart.value && el.value) {
    try {
      const raw = chart.value.convertToPixel({ geoIndex: 0 }, [store.lng, store.lat])
      const pixel = Array.isArray(raw) ? raw : null
      if (pixel && pixel.length >= 2) {
        const node = el.value
        const r = node.getBoundingClientRect()
        const sx = r.width / Math.max(node.clientWidth, 1)
        const sy = r.height / Math.max(node.clientHeight, 1)
        return { x: r.left + pixel[0] * sx, y: r.top + pixel[1] * sy }
      }
    } catch {
      /* fall through */
    }
  }
  if (event?.clientX != null && event?.clientY != null) {
    return { x: event.clientX, y: event.clientY }
  }
  if (el.value) {
    const r = el.value.getBoundingClientRect()
    return { x: r.left + r.width * 0.55, y: r.top + r.height * 0.3 }
  }
  return { x: 120, y: 160 }
}

/** 弹窗放到锚点旁侧，不遮挡门店标记 */
function placePopup(store?: MapStorePoint, event?: { clientX?: number; clientY?: number }) {
  const s = Math.max(screenScale.value || 1, 0.01)
  const cardW = 320 * s
  const cardH = Math.min(460, window.innerHeight * 0.78) * s
  const gap = 36
  const anchor = resolveMarkerAnchor(store, event)

  let left = anchor.x + gap
  let top = anchor.y - cardH * 0.28

  // 右侧放不下 → 放到左侧
  if (left + cardW > window.innerWidth - 12) {
    left = anchor.x - cardW - gap
  }
  // 仍与标记重叠或超出 → 再试上方 / 下方
  if (left < 12) left = 12
  if (top < 12) top = 12
  if (top + cardH > window.innerHeight - 12) {
    top = Math.max(12, window.innerHeight - cardH - 12)
  }
  // 若水平仍会盖住锚点，强制推到远离侧
  const overlapsX = left <= anchor.x && left + cardW >= anchor.x
  const overlapsY = top <= anchor.y && top + cardH >= anchor.y
  if (overlapsX && overlapsY) {
    if (anchor.x > window.innerWidth * 0.5) left = Math.max(12, anchor.x - cardW - gap)
    else left = Math.min(window.innerWidth - cardW - 12, anchor.x + gap)
  }

  const maxL = window.innerWidth - cardW - 12
  const maxT = window.innerHeight - cardH - 12
  popupPos.value = {
    left: Math.max(12, Math.min(left, maxL)),
    top: Math.max(12, Math.min(top, maxT)),
  }
}

async function showStorePopup(store: MapStorePoint, event?: { clientX?: number; clientY?: number }) {
  storeFocus.value = store.shortName
  placePopup(store, event)
  profilePopup.value = fallbackProfile(store)
  const profile = await fetchStoreProfile(dataKey.value, store.shortName || store.name)
  if (profile && storeFocus.value === store.shortName) profilePopup.value = profile
  // 只刷新门店高亮，不重建整图、不重绑事件
  highlightProvinceStores()
}

function highlightProvinceStores() {
  if (!chart.value || lastMode.value !== 'province' || !activeProvince.value) return
  const mapName = `province-${activeProvince.value.key}`
  if (!registeredProvinces.has(mapName)) return
  const partial = buildProvinceOption(mapName)
  chart.value.setOption({ series: partial.series }, { lazyUpdate: true })
}

/** 点城市气泡：下钻到该城门店地图 */
function enterCity(city: GeoCity) {
  closePopup()
  applyFocus(city)
  filter.setCity(city.city, city.city)
}

function bindMapInteractions() {
  const c = chart.value
  if (!c) return
  c.off('click')
  c.getZr().off('click', onZrBlankClick)
  c.getZr().on('click', onZrBlankClick)

  c.on('click', (params: any) => {
    mapClickHandled = true
    const name = params?.data?.name || params?.name
    const ev = params?.event?.event as { clientX?: number; clientY?: number } | undefined
    const point = ev?.clientX != null ? { clientX: ev.clientX, clientY: ev.clientY } : undefined

    if (params?.seriesName === '门店' || (lastMode.value === 'province' && params?.seriesType === 'effectScatter')) {
      const store = cityStores.value.find((s) => s.shortName === name || s.name === name)
      if (store) void showStorePopup(store, point)
      return
    }

    if (params?.seriesName === '省名') return

    if (params?.seriesName === '城市' || params?.seriesType === 'effectScatter') {
      const city = list.value.find((x) => x.city === name)
      if (city) {
        enterCity(city)
        return
      }
    }
  })
}

function onZrBlankClick() {
  window.setTimeout(() => {
    if (!mapClickHandled) closePopup()
    mapClickHandled = false
  }, 0)
}

function unbindMapInteractions() {
  const c = chart.value
  if (!c) return
  c.off('click')
  c.getZr().off('click', onZrBlankClick)
}

function startPulse() {
  /* no-op */
}

function stopPulse() {
  /* no-op */
}

function geoBaseStyle() {
  return {
    itemStyle: {
      areaColor: {
        type: 'linear',
        x: 0,
        y: 0,
        x2: 0,
        y2: 1,
        colorStops: [
          { offset: 0, color: 'rgba(12, 48, 98, 0.78)' },
          { offset: 1, color: 'rgba(6, 22, 52, 0.92)' },
        ],
      },
      borderColor: 'rgba(70, 170, 230, 0.55)',
      borderWidth: 0.9,
      shadowColor: 'rgba(0, 160, 255, 0.35)',
      shadowBlur: 14,
      shadowOffsetY: 3,
    },
    emphasis: {
      itemStyle: {
        areaColor: 'rgba(40, 130, 210, 0.72)',
        borderColor: '#9ef0ff',
        borderWidth: 1.4,
      },
      label: { show: true, color: '#e8f7ff', fontSize: 11, fontWeight: 600 },
    },
  }
}

function buildNationOption(mapName: string | undefined) {
  const cityScatter = list.value
    .filter((c) => c.paid_amount > 0 || c.store_cnt > 0)
    .map((c) => {
      const sizeBase = metricValue(c)
      return {
        name: c.city,
        value: [c.lng, c.lat, sizeBase, normalizeRate(c.profit_rate), c.store_cnt, c.paid_amount, c.est_profit, c.paid_orders],
        itemStyle: { color: colorByProfitRate(c.profit_rate) },
        symbolSize: metricSymbolSize(sizeBase),
      }
    })

  const coveredProvinceNames = new Set(
    list.value.map((c) => resolveProvince(c.city)?.name.replace(/省|市$/, '')).filter(Boolean) as string[],
  )
  const nationRegions = [...coveredProvinceNames].map((name) => ({
    name,
    itemStyle: {
      areaColor: {
        type: 'linear',
        x: 0,
        y: 0,
        x2: 0,
        y2: 1,
        colorStops: [
          { offset: 0, color: 'rgba(28, 110, 180, 0.72)' },
          { offset: 1, color: 'rgba(12, 55, 110, 0.85)' },
        ],
      },
      borderColor: 'rgba(120, 220, 255, 0.75)',
      borderWidth: 1.1,
    },
  }))

  const provinceLabelPoints = (
    (chinaGeo as unknown as { features?: Array<{ properties?: { name?: string; cp?: number[] } }> }).features || []
  )
    .map((f) => {
      const name = f.properties?.name
      const cp = f.properties?.cp
      if (!name || !cp || cp.length < 2) return null
      const covered = coveredProvinceNames.has(name)
      return {
        name,
        value: [cp[0], cp[1]] as [number, number],
        label: {
          show: true,
          formatter: '{b}',
          color: covered ? '#e8f7ff' : 'rgba(160, 195, 225, 0.78)',
          fontSize: covered ? 11 : 10,
          fontWeight: covered ? 700 : 500,
          textBorderColor: 'rgba(2, 12, 32, 0.75)',
          textBorderWidth: 2,
        },
        itemStyle: { color: 'transparent', borderWidth: 0 },
        symbolSize: 1,
      }
    })
    .filter(Boolean)

  return {
    backgroundColor: 'rgba(0,0,0,0)',
    visualMap: {
      type: 'continuous',
      min: 0,
      max: 0.28,
      dimension: 3,
      seriesIndex: 1,
      orient: 'horizontal',
      left: 'center',
      bottom: 4,
      itemWidth: 120,
      itemHeight: 10,
      text: ['毛利率高', '毛利率低'],
      textGap: 10,
      textStyle: { color: '#8FA3BF', fontSize: 12 },
      inRange: { color: ['#ff5c5c', '#ffc53d', '#3dff7a'] },
      calculable: false,
    },
    geo: {
      map: mapName,
      roam: true,
      zoom: 1.18,
      center: [104.5, 35.5],
      layoutCenter: ['50%', '50%'],
      layoutSize: '94%',
      aspectScale: 0.78,
      ...geoBaseStyle(),
      label: { show: false },
      regions: nationRegions,
    },
    tooltip: {
      show: true,
      trigger: 'item',
      backgroundColor: 'rgba(4, 16, 40, 0.92)',
      borderColor: 'rgba(90, 200, 255, 0.45)',
      textStyle: { color: '#e8f3ff', fontSize: 12 },
      formatter: (params: any) => {
        if (params.seriesType === 'effectScatter' || params.seriesType === 'scatter') {
          if (params.seriesName === '省名') return params.name
          const v = params.value || []
          return `${params.name}<br/>实付 ${formatMoney(v[5])}<br/>订单 ${formatInt(v[7])}<br/>毛利 ${formatMoney(v[6])}<br/>毛利率 ${formatPercent(v[3])}<br/>门店 ${v[4] || '-'} 家`
        }
        return params.name
      },
    },
    series: [
      {
        name: '省名',
        type: 'scatter',
        coordinateSystem: 'geo',
        zlevel: 1,
        silent: true,
        data: provinceLabelPoints as any[],
        symbolSize: 1,
        labelLayout: { hideOverlap: false },
      },
      {
        name: '城市',
        type: 'effectScatter',
        coordinateSystem: 'geo',
        zlevel: 2,
        data: cityScatter,
        symbolSize: (val: number[] | { value: number[] }) => {
          const arr = Array.isArray(val) ? val : val?.value
          return metricSymbolSize(arr?.[2] ?? 0)
        },
        rippleEffect: { scale: 2.2, brushType: 'stroke', period: 3.2 },
        label: {
          show: true,
          formatter: '{b}',
          position: 'right',
          color: '#E6F1FF',
          fontSize: 11,
          fontWeight: 600,
          textBorderColor: 'rgba(0,20,50,0.75)',
          textBorderWidth: 2,
        },
      },
    ],
  }
}

function balloonColor(store: MapStorePoint) {
  if (!store.active) return '#8fa3bf'
  return colorByProfitRate(store.profit_rate)
}

/** 省内门店：二维地图（可稳定点击），气泡大小/颜色编码经营指标 */
function buildProvinceOption(mapName: string) {
  const rows = cityStores.value
  const sizeVals = rows.filter((s) => s.active).map((s) => metricValue(s))
  const maxSize = Math.max(...sizeVals, 1)

  const storePoints = rows.map((s) => {
    const focused = !storeFocus.value || s.shortName === storeFocus.value
    const color = balloonColor(s)
    const sizeBase = metricValue(s)
    const pinSize = s.active
      ? Math.max(16, Math.min(44, 14 + (sizeBase / maxSize) * 30))
      : 12
    return {
      name: s.shortName,
      value: [s.lng, s.lat, sizeBase],
      symbolSize: storeFocus.value && focused ? pinSize + 6 : pinSize,
      itemStyle: {
        color: focused ? color : 'rgba(140,170,200,0.35)',
        opacity: focused ? 1 : 0.4,
        borderColor: '#ffffff',
        borderWidth: 1.5,
      },
      label: {
        show: true,
        formatter: '{b}',
        position: 'right',
        color: '#f2f9ff',
        fontSize: focused && storeFocus.value ? 12 : 10,
        fontWeight: 600,
        textBorderColor: 'rgba(0,16,40,0.75)',
        textBorderWidth: 2,
      },
    }
  })

  return {
    backgroundColor: 'rgba(0,0,0,0)',
    // 关掉内置 tooltip，统一用门店经营弹窗
    tooltip: { show: false },
    geo: {
      map: mapName,
      roam: true,
      zoom: 1.2,
      layoutCenter: ['50%', '52%'],
      layoutSize: '96%',
      ...geoBaseStyle(),
      label: { show: true, color: 'rgba(200, 230, 255, 0.55)', fontSize: 10 },
      emphasis: {
        label: { show: true, color: '#e8f7ff' },
        itemStyle: {
          areaColor: 'rgba(40, 130, 210, 0.55)',
          borderColor: '#9ef0ff',
        },
      },
    },
    series: [
      {
        id: 'stores-main',
        name: '门店',
        type: 'effectScatter',
        coordinateSystem: 'geo',
        zlevel: 2,
        data: storePoints,
        rippleEffect: { scale: 2.1, brushType: 'stroke', period: 3 },
        silent: false,
      },
    ],
  }
}

async function paint() {
  const ok = ensureChinaMap()
  const selected =
    selectedCities.value.length === 1
      ? list.value.find((c) => matchCityLocal(c.city, selectedCities.value[0]!)) || null
      : null
  applyFocus(selected)

  const province = selectedCities.value.length === 1 ? resolveProvince(selectedCities.value[0]!) : null
  activeProvince.value = province

  let mapName: string | undefined = ok ? 'china' : undefined
  let provinceMode = false

  if (province) {
    try {
      mapName = await ensureProvinceMap(province)
      provinceMode = true
    } catch {
      mapName = ok ? 'china' : undefined
      activeProvince.value = null
      provinceMode = false
    }
  }

  const mode: 'nation' | 'province' = provinceMode ? 'province' : 'nation'
  const provinceKey = province?.key || ''
  const modeChanged = mode !== lastMode.value || provinceKey !== lastProvinceKey.value
  if (modeChanged) {
    chart.value?.clear()
    lastMode.value = mode
    lastProvinceKey.value = provinceKey
  }

  if (provinceMode && mapName) {
    option.value = buildProvinceOption(mapName)
  } else {
    lastProvinceKey.value = ''
    option.value = buildNationOption(mapName)
  }

  await nextTick()
  bindMapInteractions()
  window.setTimeout(() => bindMapInteractions(), 60)
}

async function load() {
  loading.value = true
  try {
    if (!hasData.value) {
      list.value = []
      stores.value = []
      option.value = null
      closePopup()
      return
    }
    cities.value = await fetchCityOptions(dataKey.value)
    list.value = (await fetchGeo(dataKey.value)) as typeof list.value
    const cityParam = selectedCities.value.length ? selectedCities.value.join('|') : '全国'
    stores.value = await fetchMapStores(
      dataKey.value,
      cityParam,
      channel.value,
    )
    await paint()
    if (profilePopup.value) {
      const name = profilePopup.value.name
      const profile = await fetchStoreProfile(dataKey.value, name)
      if (profile) profilePopup.value = profile
      else closePopup()
    }
  } finally {
    loading.value = false
  }
}

watch([dataKey, loadingTick, channel], load, { immediate: true })
watch([selectedCities, channel], async () => {
  if (!list.value.length) return
  const keepFocus = pendingStoreFocus.value
  pendingStoreFocus.value = ''
  storeFocus.value = keepFocus || ''
  const cityParam = selectedCities.value.length ? selectedCities.value.join('|') : '全国'
  stores.value = await fetchMapStores(
    dataKey.value,
    cityParam,
    channel.value,
  )
  await paint()
  if (keepFocus) {
    storeFocus.value = keepFocus
    await nextTick()
    onStoreFocus()
  }
})

onUnmounted(() => {
  unbindMapInteractions()
  stopPulse()
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
.map-toolbar__filters {
  display: flex;
  align-items: center;
  gap: 16px 20px;
  flex-wrap: wrap;
  min-width: 0;
}
.city-filter {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 14px;
  color: var(--c-muted);
  flex-shrink: 0;
  .city-filter__select {
    width: 168px;
  }
  .city-filter__select--metric {
    width: 240px;
  }
}
.summary {
  display: flex;
  align-items: center;
  gap: 14px;
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
.legend {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-right: 4px;
}
.lg {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  &--hi {
    background: #3dff7a;
  }
  &--mid {
    background: #ffc53d;
  }
  &--lo {
    background: #ff5c5c;
  }
}
.back-btn {
  border: 1px solid rgba(94, 200, 255, 0.45);
  background: rgba(20, 70, 140, 0.35);
  color: #9adfff;
  border-radius: 4px;
  padding: 4px 10px;
  font-size: 12px;
  cursor: pointer;
  &:hover {
    background: rgba(30, 100, 180, 0.5);
  }
}
.map-body {
  position: relative;
  flex: 1;
  min-height: 0;
  padding: 4px 12px 8px;
  border-radius: 6px;
  overflow: hidden;
  background-color: #04122f;
  background-image:
    radial-gradient(ellipse 65% 50% at 50% 46%, rgba(30, 100, 180, 0.12), transparent 72%),
    radial-gradient(circle, rgba(100, 180, 230, 0.38) 1px, transparent 1.4px);
  background-size:
    100% 100%,
    32px 32px;
  background-position: center, 0 0;
  box-shadow: inset 0 0 28px rgba(0, 30, 70, 0.25);
}
.chart {
  width: 100%;
  height: 100%;
  min-height: 120px;
  background: transparent;
}
</style>

<!-- 弹窗挂到 body，避免被地图 overflow 裁切；样式需非 scoped -->
<style lang="scss">
.city-popup.city-popup--profile {
  position: fixed;
  z-index: 5000;
  width: 320px;
  max-height: min(460px, 78vh);
  display: flex;
  flex-direction: column;
  padding: 16px 18px 14px;
  border-radius: 8px;
  background: rgba(0, 10, 30, 0.96);
  border: 1px solid rgba(90, 200, 255, 0.35);
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(10px);
  color: #e8f3ff;
  animation: map-popup-in 0.18s ease-out;
  overflow: auto;
  h4 {
    margin: 0 0 2px;
    font-size: 18px;
    font-weight: 700;
    color: #fff;
    padding-right: 20px;
  }
}
.city-popup__sub {
  margin: 0 0 10px;
  font-size: 13px;
  color: #7a90a8;
}
.profile-rows {
  margin: 0;
  padding: 0;
  list-style: none;
  li {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    padding: 7px 0;
    font-size: 14px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    span {
      color: #8899aa;
    }
    b {
      color: #fff;
      font-weight: 700;
      font-variant-numeric: tabular-nums;
    }
  }
}
.city-popup__line {
  height: 1px;
  margin: 10px 0 8px;
  background: rgba(255, 255, 255, 0.08);
}
.city-popup__sec {
  margin: 0 0 8px;
  font-size: 13px;
  color: #9adfff;
  font-weight: 600;
}
.ch-row {
  display: grid;
  grid-template-columns: 72px 1fr;
  gap: 2px 10px;
  padding: 6px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  font-size: 13px;
  strong {
    grid-row: span 2;
    color: #e8f3ff;
  }
  em {
    font-style: normal;
    color: #fff;
    font-weight: 700;
  }
  span {
    grid-column: 2;
    color: #8899aa;
    font-size: 12px;
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
  &:hover {
    color: #fff;
  }
}
@keyframes map-popup-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
</style>
