import { inject, onMounted, onUnmounted, ref, watch, type InjectionKey, type Ref } from 'vue'

export const SCREEN_SCALE_KEY: InjectionKey<Ref<number>> = Symbol('screenScale')

/**
 * 仅按视口宽度等比缩放，铺满左右；高度随设计稿展开，页面可纵向滚动。
 */
export function useScreenScale(designW = 1920, designH = 1280) {
  const scale = ref(1)
  const style = ref<Record<string, string>>({})
  const wrapperStyle = ref<Record<string, string>>({})

  function resize() {
    const ww = Math.max(window.innerWidth, 1)
    const s = ww / designW
    scale.value = s
    style.value = {
      width: `${designW}px`,
      height: `${designH}px`,
      transform: `scale(${s})`,
      transformOrigin: 'left top',
    }
    wrapperStyle.value = {
      width: '100%',
      height: `${Math.ceil(designH * s)}px`,
    }
  }

  onMounted(() => {
    resize()
    window.addEventListener('resize', resize)
  })
  onUnmounted(() => window.removeEventListener('resize', resize))

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
    panelStyle.value = {
      position: 'fixed',
      left: `${Math.max(8, Math.min(r.left, window.innerWidth - 8))}px`,
      top: openUp ? `${r.top - 4}px` : `${r.bottom + 4}px`,
      transform: openUp ? `translateY(-100%) scale(${s})` : `scale(${s})`,
      transformOrigin: openUp ? 'left bottom' : 'left top',
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
