/** 门店名称规范：统一展示为「淘宝便利店（店名）」 */

const BRAND = '淘宝便利店'

/** 去掉品牌与括号，得到店名核心，如 黄桥店 */
export function bareStoreName(v: unknown): string {
  return String(v || '')
    .replace(/淘宝便利店/g, '')
    .replace(/优沃森超市/g, '')
    .replace(/[（()）\s]/g, '')
    .trim()
}

/** 规范展示名：淘宝便利店（黄桥店） */
export function formatStoreName(v: unknown): string {
  const bare = bareStoreName(v)
  if (!bare) return ''
  return `${BRAND}（${bare}）`
}

/** 是否同一门店（忽略品牌前缀与半角/全角括号） */
export function sameStore(a: unknown, b: unknown): boolean {
  const x = bareStoreName(a)
  const y = bareStoreName(b)
  if (!x || !y) return false
  return x === y || x.includes(y) || y.includes(x)
}
