/** PPT 风格等距立体饼（canvas，不依赖 echarts-gl） */

export type Pie3DItem = {
  name: string
  value: number
  itemStyle?: { color?: string }
  profit?: number | null
  profitRate?: number | null
  unitProfit?: number | null
  delta?: number | null
}

export type LaidSlice = Pie3DItem & {
  start: number
  end: number
  share: number
  exploded: boolean
  color: string
}

export type PieGeom = {
  cx: number
  cy: number
  rx: number
  ry: number
  depth: number
}

function parseRgb(input?: string): [number, number, number] {
  if (!input) return [85, 185, 255]
  if (input.startsWith('#')) {
    const h = input.slice(1)
    const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
    const n = Number.parseInt(full.slice(0, 6), 16)
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
  }
  const m = input.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i)
  if (m) return [Number(m[1]), Number(m[2]), Number(m[3])]
  return [85, 185, 255]
}

function rgba(rgb: [number, number, number], alpha = 1, lift = 0) {
  const t = (c: number) => {
    if (lift >= 0) return Math.round(c + (255 - c) * lift)
    return Math.round(c * (1 + lift))
  }
  return `rgba(${t(rgb[0])},${t(rgb[1])},${t(rgb[2])},${alpha})`
}

function polar(cx: number, cy: number, rx: number, ry: number, a: number): [number, number] {
  return [cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]
}

export function pieGeom(w: number, h: number): PieGeom {
  const rx = Math.min(w * 0.44, h * 0.5)
  return {
    cx: w * 0.5,
    cy: h * 0.44,
    rx,
    ry: rx * 0.32,
    depth: Math.min(36, Math.max(20, h * 0.16)),
  }
}

export function layoutPieSlices(pieData: Pie3DItem[], selectedName?: string): LaidSlice[] {
  const cleaned = pieData.filter((d) => Number(d.value) > 0)
  const sum = cleaned.reduce((s, d) => s + d.value, 0)
  if (!sum) return []
  let acc = 0
  const start0 = -Math.PI / 2
  return cleaned.map((d) => {
    const start = start0 + (acc / sum) * Math.PI * 2
    acc += d.value
    const share = d.value / sum
    return {
      ...d,
      start,
      end: start0 + (acc / sum) * Math.PI * 2,
      share,
      exploded: selectedName === d.name || (!selectedName && share < 0.35),
      color: d.itemStyle?.color || '#55b9ff',
    }
  })
}

function slicePose(g: PieGeom, s: LaidSlice, extra = 0) {
  const mid = (s.start + s.end) / 2
  const explode = (s.exploded ? 24 : 5) + extra
  const height = g.depth * (0.92 + s.share * 0.28)
  return {
    cx: g.cx + Math.cos(mid) * explode,
    cy: g.cy + Math.sin(mid) * explode * 0.55,
    mid,
    height,
  }
}

function fillSector(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  a0: number,
  a1: number,
) {
  ctx.beginPath()
  ctx.moveTo(cx, cy)
  const n = Math.max(10, Math.ceil(Math.abs(a1 - a0) / 0.05))
  for (let i = 0; i <= n; i += 1) {
    const a = a0 + ((a1 - a0) * i) / n
    ctx.lineTo(...polar(cx, cy, rx, ry, a))
  }
  ctx.closePath()
  ctx.fill()
}

function drawRadialWall(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  depth: number,
  a: number,
  fill: string,
) {
  const [tx, ty] = polar(cx, cy, rx, ry, a)
  ctx.beginPath()
  ctx.moveTo(cx, cy)
  ctx.lineTo(tx, ty)
  ctx.lineTo(tx, ty + depth)
  ctx.lineTo(cx, cy + depth)
  ctx.closePath()
  ctx.fillStyle = fill
  ctx.fill()
}

function drawRim(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  depth: number,
  a0: number,
  a1: number,
  rgb: [number, number, number],
) {
  const n = Math.max(8, Math.ceil(Math.abs(a1 - a0) / 0.05))
  for (let i = 0; i < n; i += 1) {
    const a = a0 + ((a1 - a0) * i) / n
    const a2 = a0 + ((a1 - a0) * (i + 1)) / n
    if ((Math.sin(a) + Math.sin(a2)) / 2 < -0.12) continue
    const [x1, y1] = polar(cx, cy, rx, ry, a)
    const [x2, y2] = polar(cx, cy, rx, ry, a2)
    ctx.beginPath()
    ctx.moveTo(x1, y1)
    ctx.lineTo(x2, y2)
    ctx.lineTo(x2, y2 + depth)
    ctx.lineTo(x1, y1 + depth)
    ctx.closePath()
    ctx.fillStyle = rgba(rgb, 1, -0.14 - Math.max(0, Math.sin((a + a2) / 2)) * 0.28)
    ctx.fill()
  }
}

export function drawIsometricPie(
  ctx: CanvasRenderingContext2D,
  slices: LaidSlice[],
  w: number,
  h: number,
  hoverName?: string,
) {
  ctx.clearRect(0, 0, w, h)
  if (!slices.length || w < 8 || h < 8) return
  const g = pieGeom(w, h)

  ctx.save()
  ctx.beginPath()
  ctx.ellipse(g.cx, g.cy + g.depth * 1.55, g.rx * 1.06, g.ry * 0.78, 0, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(0, 8, 24, 0.42)'
  ctx.fill()
  ctx.restore()

  const ordered = [...slices].sort((a, b) => {
    const pa = slicePose(g, a)
    const pb = slicePose(g, b)
    return pa.cy - pb.cy
  })

  for (const s of ordered) {
    const extra = hoverName === s.name ? 5 : 0
    const { cx, cy, height } = slicePose(g, s, extra)
    const rgb = parseRgb(s.color)
    drawRadialWall(ctx, cx, cy, g.rx, g.ry, height, s.start, rgba(rgb, 1, -0.44))
    drawRadialWall(ctx, cx, cy, g.rx, g.ry, height, s.end, rgba(rgb, 1, -0.44))
    drawRim(ctx, cx, cy, g.rx, g.ry, height, s.start, s.end, rgb)
    ctx.fillStyle = rgba(rgb, 1, hoverName === s.name ? 0.22 : 0.1)
    fillSector(ctx, cx, cy, g.rx, g.ry, s.start, s.end)
    ctx.strokeStyle = rgba(rgb, 0.95, 0.34)
    ctx.lineWidth = 1
    ctx.stroke()
  }

  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = '800 12px PingFang SC, Noto Sans SC, sans-serif'
  for (const s of slices) {
    if (s.share < 0.07) continue
    const { cx, cy, mid } = slicePose(g, s, hoverName === s.name ? 5 : 0)
    const r = s.share >= 0.16 ? 0.5 : 0.78
    const [lx, ly] = polar(cx, cy, g.rx * r, g.ry * r, mid)
    const pct = `${Math.round(s.share * 100)}%`
    ctx.shadowColor = 'rgba(0, 12, 36, 0.9)'
    ctx.shadowBlur = 6
    ctx.fillStyle = '#f4fbff'
    ctx.fillText(s.name, lx, ly - 8)
    ctx.fillText(pct, lx, ly + 8)
    ctx.shadowBlur = 0
  }
}

export function hitPieSlice(
  slices: LaidSlice[],
  w: number,
  h: number,
  x: number,
  y: number,
): LaidSlice | null {
  if (!slices.length) return null
  const g = pieGeom(w, h)
  const frontFirst = [...slices].sort((a, b) => slicePose(g, b).cy - slicePose(g, a).cy)
  for (const s of frontFirst) {
    const { cx, cy, height } = slicePose(g, s)
    const nx = (x - cx) / g.rx
    const ny = (y - cy) / g.ry
    const onTop = nx * nx + ny * ny <= 1
    const onSide = y >= cy && y <= cy + height && nx * nx <= 1
    if (!onTop && !onSide) continue
    let ang = Math.atan2(onTop ? ny : 0.7, nx)
    if (ang < -Math.PI / 2) ang += Math.PI * 2
    if (ang >= s.start && ang <= s.end) return s
  }
  return null
}
