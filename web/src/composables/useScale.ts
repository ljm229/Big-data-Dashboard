/** 中文名：大屏缩放 */
import { inject, onMounted, onUnmounted, ref, watch, type InjectionKey, type Ref } from 'vue'

export const SCREEN_SCALE_KEY: InjectionKey<Ref<number>> = Symbol('screenScale')

/**
 * contain：按宽高同时缩放，铺满且不滚动（1920×1080 经营大屏）。
 * width：仅按视口宽度缩放，高度可滚动。
 */
export function useScreenScale(designW = 1920, designH = 1080, mode: 'width' | 'contain' = 'contain') {
  const scale = ref(1)
  const style = ref<Record<string, string>>({})
  const wrapperStyle = ref<Record<string, string>>({})
  let viewportObserver: ResizeObserver | null = null

  function resize() {
    const ww = Math.max(document.documentElement.clientWidth, 1)
    const wh = Math.max(window.innerHeight, 1)
    const s = mode === 'contain' ? Math.min(ww / designW, wh / designH) : ww / designW
    const canvasH = mode === 'width' ? Math.max(designH, wh / s) : designH
    scale.value = s
    style.value =
      mode === 'contain'
        ? {
            width: `${designW}px`,
            height: `${canvasH}px`,
            position: 'absolute',
            left: '50%',
            top: '50%',
            transform: `translate(-50%, -50%) scale(${s})`,
            transformOrigin: 'center center',
          }
        : {
            width: `${designW}px`,
            height: `${canvasH}px`,
            transform: `scale(${s})`,
            transformOrigin: 'left top',
          }
    wrapperStyle.value = {
      width: '100%',
      height: mode === 'contain' ? '100vh' : `${Math.ceil(canvasH * s)}px`,
      position: 'relative',
      overflow: mode === 'contain' ? 'hidden' : 'visible',
    }
  }

  onMounted(() => {
    resize()
    window.addEventListener('resize', resize)
    viewportObserver = new ResizeObserver(resize)
    viewportObserver.observe(document.documentElement)
  })
  onUnmounted(() => {
    window.removeEventListener('resize', resize)
    viewportObserver?.disconnect()
  })

  return { scale, style, wrapperStyle }
}

/** 下拉/日历挂到 body：按触发器屏幕坐标定位，并用同一 scale 对齐大屏字号 */
export function useFloatingPanel(anchorRef: Ref<HTMLElement | null>, open: Ref<boolean>, estHeight = 340) {
  const scale = inject(SCREEN_SCALE_KEY, ref(1)) as Ref<number>
  const panelStyle = ref<Record<string, string>>({})

  function update() {
    const el = anchorRef.value
    if (!el) return
    const r = el.getBoundingClientRect()
    const s = Math.max(scale.value || 1, 0.01)
    const visualH = estHeight * s
    const spaceBelow = window.innerHeight - r.bottom - 8
    const openUp = spaceBelow < visualH && r.top > spaceBelow
    // 预估面板宽；靠右触发器右对齐，避免贴视口右缘溢出
    const estPanelW = Math.min(Math.max(r.width / s, 220), Math.min(420, (window.innerWidth - 16) / s))
    const pad = 8
    const maxLeft = window.innerWidth - estPanelW * s - pad
    const alignRight = r.right > window.innerWidth * 0.62 || r.left > maxLeft
    const desiredRight = Math.min(r.right, window.innerWidth - pad)
    const left = alignRight
      ? Math.max(pad, desiredRight - estPanelW)
      : Math.max(pad, Math.min(r.left, maxLeft))
    panelStyle.value = {
      position: 'fixed',
      left: `${left}px`,
      width: `${estPanelW}px`,
      top: openUp ? `${r.top - 4}px` : `${r.bottom + 4}px`,
      transform: openUp ? `translateY(-100%) scale(${s})` : `scale(${s})`,
      transformOrigin: openUp ? (alignRight ? 'right bottom' : 'left bottom') : alignRight ? 'right top' : 'left top',
      zIndex: '6000',
    }
  }

  watch(
    open,
    (v) => {
      if (!v) return
      update()
      requestAnimationFrame(update)
    },
    { flush: 'post' },
  )

  function onWin() {
    if (open.value) update()
  }

  onMounted(() => {
    window.addEventListener('resize', onWin)
    window.addEventListener('scroll', onWin, true)
  })
  onUnmounted(() => {
    window.removeEventListener('resize', onWin)
    window.removeEventListener('scroll', onWin, true)
  })

  return { panelStyle, update, scale }
}
