<template>
  <div class="street-map">
    <div ref="container" class="street-canvas" aria-label="内嵌门店街道地图，可拖动和滚轮缩放" />
    <div v-if="tileState !== 'ready'" class="tile-status" role="status">
      <template v-if="tileState === 'loading'">正在加载街道底图…</template>
      <template v-else>街道底图暂不可用，点位仍可查看。<button type="button" @click="retry">重试</button><button type="button" @click="emit('fallback')">查看区域图</button></template>
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
let map: L.Map | undefined
let tiles: L.TileLayer | undefined
let markers: L.LayerGroup | undefined
let resizeObserver: ResizeObserver | undefined
let timer: ReturnType<typeof setTimeout> | undefined
let resizeFrame = 0
let loaded = 0
let failed = 0

function watchTiles() {
  clearTimeout(timer)
  timer = setTimeout(() => { if (tileState.value === 'loading') tileState.value = 'error' }, 12000)
}
function retry() {
  loaded = failed = 0
  tileState.value = 'loading'
  tiles?.redraw()
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
  // Only visible tiles are requested. Preserve browser cache and provider attribution; never prefetch.
  tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>',
    updateWhenIdle: true, keepBuffer: 1,
  })
  tiles.on('loading', () => { loaded = failed = 0; tileState.value = 'loading'; watchTiles() })
  tiles.on('tileload', () => { loaded++; tileState.value = 'ready' })
  tiles.on('tileerror', () => { failed++ })
  tiles.on('load', () => { clearTimeout(timer); tileState.value = failed > loaded ? 'error' : loaded ? 'ready' : 'error' })
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
.street-map, .street-canvas { width: 100%; height: 100%; }
.street-map { position: relative; isolation: isolate; background: #dce4e3; }
.street-canvas { z-index: 0; font-family: var(--font-cn); }
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
