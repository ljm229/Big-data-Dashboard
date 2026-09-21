<template>
  <div class="street-map">
    <div ref="container" class="street-canvas" aria-label="内嵌门店街道地图，可拖动和滚轮缩放" />
    <div class="street-source" :title="`当前街道底图：${providerName}`">{{ providerName }}</div>
    <div v-if="tileState !== 'ready'" class="tile-status" role="status">
      <template v-if="tileState === 'loading'">正在加载{{ providerName }}街道底图…</template>
      <template v-else>街道底图暂不可用，点位仍可查看。<button type="button" @click="retry">换源重试</button><button type="button" @click="emit('fallback')">查看区域图</button></template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import * as L from 'leaflet'
import 'leaflet/dist/leaflet.css'

export type StreetPoint = {
  key: string
  short: string
  coord: [number, number]
  open: boolean
  color: string
}
const props = defineProps<{ points: StreetPoint[]; focus: string; center: [number, number] }>()
const emit = defineEmits<{ select: [string]; fallback: [] }>()
const container = ref<HTMLDivElement | null>(null)
const tileState = ref<'loading' | 'ready' | 'error'>('loading')
const providerName = ref('OpenStreetMap')
/** 国内可直连的街道底图源：高德/CARTO 为主，OSM 兜底。GCJ-02 偏移对此处概位展示可接受 */
const TILE_PROVIDERS = [
  {
    name: '高德街道',
    url: 'https://webst01.is.autonavi.com/appmaptile?style=7&x={x}&y={y}&z={z}',
    attribution: '&copy; <a href="https://www.amap.com/" target="_blank" rel="noopener noreferrer">高德地图 GS(2021)1030号</a>',
    subdomains: ['01', '02', '03', '04'],
    maxZoom: 18,
  },
  {
    name: 'Carto 街道',
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions" target="_blank" rel="noopener noreferrer">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 20,
  },
  {
    name: 'OpenStreetMap',
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>',
    subdomains: 'abc',
    maxZoom: 19,
  },
]
let map: L.Map | undefined
let tiles: L.TileLayer | undefined
let markers: L.LayerGroup | undefined
let resizeObserver: ResizeObserver | undefined
let timer: ReturnType<typeof setTimeout> | undefined
let resizeFrame = 0
let loaded = 0
let failed = 0
let providerIndex = 0

/** 切换底图源：保留点位与视野，只换瓦片层，避免整图重建闪烁 */
function switchProvider(index: number, auto = false) {
  if (!map || !tiles) return
  providerIndex = index
  const p = TILE_PROVIDERS[index]
  providerName.value = p.name
  loaded = failed = 0
  if (!auto) tileState.value = 'loading'
  tiles.setUrl(p.url)
  try { (tiles as unknown as { options: Record<string, unknown> }).options.subdomains = p.subdomains as never } catch { /* 保持默认子域 */ }
  try { tiles.options.attribution = p.attribution } catch { /* 忽略署名更新失败 */ }
  try { (map.attributionControl as unknown as { setPrefix: (v: boolean) => void }).setPrefix(false) } catch { /* 忽略 */ }
  tiles.redraw()
  watchTiles()
}

function watchTiles() {
  clearTimeout(timer)
  timer = setTimeout(() => {
    if (tileState.value !== 'loading') return
    // 当前源超时：自动切下一个源，而不是直接报错白屏
    if (providerIndex < TILE_PROVIDERS.length - 1) switchProvider(providerIndex + 1, true)
    else tileState.value = 'error'
  }, 8000)
}
function retry() {
  // 重试时换一个源，避免死磕同一个被墙/超时的服务
  const next = (providerIndex + 1) % TILE_PROVIDERS.length
  providerName.value = TILE_PROVIDERS[next].name
  switchProvider(next, false)
  tileState.value = 'loading'
  watchTiles()
}
function fitAll() {
  if (!map) return
  map.invalidateSize({ pan: false })
  if (props.points.length) {
    map.fitBounds(L.latLngBounds(props.points.map(p => [p.coord[1], p.coord[0]] as L.LatLngTuple)), {
      padding: [52, 52], maxZoom: 13, animate: false,
    })
  } else map.setView([props.center[1], props.center[0]], 11, { animate: false })
}
function focusPoint() {
  const point = props.points.find(p => p.key === props.focus)
  if (!map || !point) { fitAll(); return }
  map.invalidateSize({ pan: false })
  map.setView([point.coord[1], point.coord[0]], 15, { animate: false })
}
function zoom(direction: number) { if (direction > 1) map?.zoomIn(); else map?.zoomOut() }
function resize() { map?.invalidateSize({ pan: false }) }
function renderPoints() {
  if (!map || !markers) return
  markers.clearLayers()
  props.points.forEach((point, index) => {
    const active = point.key === props.focus
    const icon = document.createElement('span')
    icon.className = `store-pin${active ? ' is-selected' : ''}${point.open ? '' : ' is-pending'}`
    icon.style.setProperty('--pin-color', active ? '#ffe03b' : point.color)
    const dot = document.createElement('i')
    dot.className = 'store-pin__dot'
    dot.setAttribute('aria-hidden', 'true')
    icon.append(dot)
    const marker = L.marker([point.coord[1], point.coord[0]], {
      icon: L.divIcon({ html: icon, className: 'store-map-marker', iconSize: [30, 34], iconAnchor: [15, 27] }),
      title: `${point.short} · ${point.open ? '已上线' : '待上线'} · 位置待核验`,
      alt: `${point.short}门店点位`, keyboard: true, riseOnHover: true, zIndexOffset: active ? 1000 : 0,
    })
    const label = document.createElement('span')
    label.textContent = point.short
    marker.bindTooltip(label, {
      permanent: true, direction: index % 2 ? 'left' : 'right', offset: [index % 2 ? -12 : 12, -12],
      className: `store-map-label${active ? ' is-selected' : ''}`,
    })
    marker.on('click', () => emit('select', point.key))
    marker.addTo(markers!)
  })
}
onMounted(() => {
  if (!container.value) return
  map = L.map(container.value, { zoomControl: false, attributionControl: true, minZoom: 4, maxZoom: 19 })
  map.attributionControl.setPrefix(false)
  // 仅请求当前视野瓦片；优先国内可直连源，超时自动切换；保留署名与浏览器缓存，不预取。
  const first = TILE_PROVIDERS[0]
  providerIndex = 0
  providerName.value = first.name
  tiles = L.tileLayer(first.url, {
    subdomains: first.subdomains as never,
    maxZoom: first.maxZoom, attribution: first.attribution,
    updateWhenIdle: true, keepBuffer: 1,
  })
  tiles.on('loading', () => { loaded = failed = 0; tileState.value = 'loading'; watchTiles() })
  tiles.on('tileload', () => { loaded++; tileState.value = 'ready' })
  tiles.on('tileerror', () => {
    failed++
    // 单个源连续失败：自动切下一个源，而不是停在灰底上
    if (failed >= 4 && providerIndex < TILE_PROVIDERS.length - 1) switchProvider(providerIndex + 1, true)
  })
  tiles.on('load', () => {
    clearTimeout(timer)
    if (failed > loaded && providerIndex < TILE_PROVIDERS.length - 1) {
      switchProvider(providerIndex + 1, true)
      return
    }
    tileState.value = failed > loaded ? 'error' : loaded ? 'ready' : 'error'
  })
  tiles.addTo(map)
  markers = L.layerGroup().addTo(map)
  L.control.scale({ imperial: false, position: 'bottomleft' }).addTo(map)
  renderPoints()
  focusPoint()
  resizeObserver = new ResizeObserver(() => {
    cancelAnimationFrame(resizeFrame)
    resizeFrame = requestAnimationFrame(resize)
  })
  resizeObserver.observe(container.value)
})
watch([() => props.points, () => props.focus], async () => { await nextTick(); renderPoints(); focusPoint() })
onUnmounted(() => {
  clearTimeout(timer)
  cancelAnimationFrame(resizeFrame)
  resizeObserver?.disconnect()
  map?.remove()
  map = undefined
})
defineExpose({ fitAll, focusPoint, zoom, resize })
</script>

<style scoped>
.street-map, .street-canvas { width: 100%; height: 100%; position: relative; }
/* 底图：与城市地图同系的深海军蓝；街道瓦片未到时也先是深色，不再是浅灰白屏 */
.street-map { isolation: isolate; background: #0a2744; background-image: radial-gradient(ellipse 72% 58% at 50% 48%, rgba(43, 154, 240, 0.28) 0%, transparent 70%), radial-gradient(rgba(120, 180, 230, 0.2) 0.8px, transparent 1px); background-size: 100% 100%, 28px 28px; }
.street-canvas { z-index: 0; font-family: var(--font-cn); background: transparent; }
/* Leaflet 在容器内用绝对定位摆瓦片/点位：容器必须有定位上下文，否则瓦片会溢出形成左侧白条 */
.street-canvas :deep(.leaflet-pane),
.street-canvas :deep(.leaflet-top),
.street-canvas :deep(.leaflet-bottom) { position: absolute; z-index: 400; }
/* 街道瓦片加一层深色统一滤镜，与城市地图行政填充同色系，门店弹窗保持透明可读 */
.street-canvas :deep(.leaflet-tile-pane) { filter: brightness(0.72) saturate(0.82) hue-rotate(-12deg); opacity: 0.92; }
.street-source { position: absolute; z-index: 5; right: 12px; top: 12px; padding: 3px 8px; font-size: 12px; color: #9adfff; background: rgba(3, 32, 67, 0.85); border: 1px solid rgba(94, 200, 255, 0.35); }
.tile-status { position: absolute; z-index: 5; top: 12px; left: 12px; right: 12px; padding: 10px; color: #fff; background: #032043ed; border: 1px solid #16ddff; font-size: 13px; }
.tile-status button { margin-left: 8px; color: #16ddff; background: transparent; border: 1px solid #147aae; cursor: pointer; padding: 4px 8px; }
:deep(.store-map-marker) { background: transparent; border: 0; }
:deep(.store-pin) { display: grid; place-items: center; width: 30px; height: 34px; }
:deep(.store-pin__dot) { display: block; width: 22px; height: 22px; border: 3px solid #032043; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); background: var(--pin-color); box-shadow: 0 2px 6px #0006, inset 0 0 0 2px #fff; }
:deep(.store-pin.is-selected .store-pin__dot) { width: 28px; height: 28px; box-shadow: 0 0 0 5px #ffe03b55, inset 0 0 0 2px #fff; }
:deep(.store-pin.is-pending .store-pin__dot) { border-style: dashed; }
:deep(.store-map-label) { padding: 3px 6px; border: 1px solid #147aae; border-radius: 2px; background: #032043ed; color: #fff; box-shadow: none; font-size: 12px; font-weight: 700; }
:deep(.store-map-label.is-selected) { color: #ffe03b; border-color: #ffe03b; }
:deep(.store-map-label::before) { display: none; }
:deep(.leaflet-control-attribution) { font-size: 11px; background: #fffffff2; color: #253440; }
:deep(.leaflet-control-attribution a) { color: #075585; }
:deep(.leaflet-control-scale-line) { background: #ffffffdf; color: #243746; border-color: #243746; }
:deep(.leaflet-marker-icon:focus-visible) { outline: 3px solid #075585; outline-offset: 4px; }
</style>
