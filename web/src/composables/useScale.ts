import { onMounted, onUnmounted, ref } from 'vue'

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
    // transform 不占文档流，用外壳撑开真实滚动高度
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
