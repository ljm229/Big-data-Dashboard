/** 门店展示名：筛选项只写店名，不含「淘宝便利店」 */
const BRAND = '淘宝便利店'

/** 去掉品牌与括号，得到店名核心，如 黄桥店 */
export function bareStoreName(v: unknown): string {
  return String(v || '')
    .replace(/淘宝便利店/g, '')
    .replace(/优沃森超市/g, '')
    .replace(/[（()）\s]/g, '')
    .trim()
}

/** 筛选项/列表短名：金华店 */
export function storeFilterLabel(v: unknown): string {
  return bareStoreName(v) || String(v || '')
}

/** 规范展示名：淘宝便利店（黄桥店）——数据键仍可用；界面筛选请用 storeFilterLabel */
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
