import type { ProvinceKey } from '../data/geoMeta'

const loaders: Record<ProvinceKey, () => Promise<unknown>> = {
  zhejiang: () => import('../assets/geo/zhejiang.json'),
  jiangsu: () => import('../assets/geo/jiangsu.json'),
  shanghai: () => import('../assets/geo/shanghai.json'),
  shandong: () => import('../assets/geo/shandong.json'),
  henan: () => import('../assets/geo/henan.json'),
  hubei: () => import('../assets/geo/hubei.json'),
}

const cache = new Map<ProvinceKey, unknown>()

export async function loadProvinceGeo(key: ProvinceKey) {
  if (cache.has(key)) return cache.get(key)
  const mod = await loaders[key]()
  const geo = (mod as { default?: unknown }).default ?? mod
  cache.set(key, geo)
  return geo
}
