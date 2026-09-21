/** 中文名：径向高光球体填充（矩阵/地图气泡） */
import * as echarts from 'echarts'

function hexToRgb(hex: string) {
  const h = hex.replace('#', '').trim()
  const n = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
  return {
    r: Number.parseInt(n.slice(0, 2), 16) || 0,
    g: Number.parseInt(n.slice(2, 4), 16) || 0,
    b: Number.parseInt(n.slice(4, 6), 16) || 0,
  }
}

function rgb(r: number, g: number, b: number, a = 1) {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)))
  return `rgba(${clamp(r)}, ${clamp(g)}, ${clamp(b)}, ${a})`
}

function mix(hex: string, t: number, target = { r: 255, g: 255, b: 255 }) {
  const c = hexToRgb(hex)
  return rgb(c.r + (target.r - c.r) * t, c.g + (target.g - c.g) * t, c.b + (target.b - c.b) * t)
}

/** 左上高光 + 外圈本色光晕，看起来像发光球体 */
export function sphereGradient(hex: string) {
  return new echarts.graphic.RadialGradient(0.34, 0.30, 0.78, [
    { offset: 0, color: '#ffffff' },
    { offset: 0.14, color: mix(hex, 0.78) },
    { offset: 0.38, color: mix(hex, 0.22) },
    { offset: 0.68, color: hex },
    { offset: 1, color: mix(hex, 0.22, { r: 6, g: 16, b: 10 }) },
  ])
}

/** 高饱和球体：少洗白、外圈不压暗，避免哑光感 */
export function vividSphere(hex: string) {
  return new echarts.graphic.RadialGradient(0.34, 0.30, 0.78, [
    { offset: 0, color: mix(hex, 0.42) },
    { offset: 0.22, color: mix(hex, 0.12) },
    { offset: 0.55, color: hex },
    { offset: 1, color: mix(hex, 0.08, { r: 8, g: 24, b: 48 }) },
  ])
}

export function sphereShadow(hex: string) {
  const c = hexToRgb(hex)
  return rgb(c.r, c.g, c.b, 0.95)
}

export function sphereHalo(hex: string) {
  const c = hexToRgb(hex)
  return new echarts.graphic.RadialGradient(0.5, 0.5, 0.72, [
    { offset: 0, color: rgb(c.r, c.g, c.b, 0.45) },
    { offset: 0.55, color: rgb(c.r, c.g, c.b, 0.18) },
    { offset: 1, color: rgb(c.r, c.g, c.b, 0) },
  ])
}
