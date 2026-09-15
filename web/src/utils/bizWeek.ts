/** 业务周：周五起点、周四终点（上周五 → 这周四） */
function pad2(n: number) {
  return String(n).padStart(2, '0')
}

export function toIsoFromDate(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

export function shiftDay(iso: string, delta: number) {
  const d = new Date(`${iso}T12:00:00`)
  d.setDate(d.getDate() + delta)
  return toIsoFromDate(d)
}

export function fridayOfWeek(iso: string) {
  const d = new Date(`${iso}T12:00:00`)
  const sinceFri = (d.getDay() + 2) % 7
  d.setDate(d.getDate() - sinceFri)
  return toIsoFromDate(d)
}

export function thursdayOfWeek(iso: string) {
  const d = new Date(`${fridayOfWeek(iso)}T12:00:00`)
  d.setDate(d.getDate() + 6)
  return toIsoFromDate(d)
}

export function calendarWeekLabel(friIso: string) {
  const fri = new Date(`${friIso}T12:00:00`)
  if (Number.isNaN(fri.getTime())) return friIso
  const y = fri.getFullYear()
  const m = fri.getMonth()
  let ordinal = 0
  for (let day = 1; day <= fri.getDate(); day++) {
    const dt = new Date(y, m, day, 12)
    if (dt.getDay() === 5) ordinal++
  }
  return `${m + 1}月第${ordinal}周`
}

export function daysInRange(from: string, to: string) {
  const out: string[] = []
  if (!from || !to || to < from) return out
  for (let d = from; d <= to; d = shiftDay(d, 1)) out.push(d)
  return out
}
