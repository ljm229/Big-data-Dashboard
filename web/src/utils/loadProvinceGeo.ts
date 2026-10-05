import type { ProvinceKey } from '../data/geoMeta'

/** 全省地图本地包（31 省 + 直辖市，echarts@4 pinyin 命名；台湾/港澳暂无离线包） */
const loaders: Record<ProvinceKey, () => Promise<unknown>> = {
  zhejiang: () => import('../assets/geo/zhejiang.json'),
  jiangsu: () => import('../assets/geo/jiangsu.json'),
  shanghai: () => import('../assets/geo/shanghai.json'),
  shandong: () => import('../assets/geo/shandong.json'),
  henan: () => import('../assets/geo/henan.json'),
  hubei: () => import('../assets/geo/hubei.json'),
  beijing: () => import('../assets/geo/beijing.json'),
  tianjin: () => import('../assets/geo/tianjin.json'),
  hebei: () => import('../assets/geo/hebei.json'),
  shanxi: () => import('../assets/geo/shanxi.json'),
  neimenggu: () => import('../assets/geo/neimenggu.json'),
  liaoning: () => import('../assets/geo/liaoning.json'),
  jilin: () => import('../assets/geo/jilin.json'),
  heilongjiang: () => import('../assets/geo/heilongjiang.json'),
  anhui: () => import('../assets/geo/anhui.json'),
  fujian: () => import('../assets/geo/fujian.json'),
  jiangxi: () => import('../assets/geo/jiangxi.json'),
  hunan: () => import('../assets/geo/hunan.json'),
  guangdong: () => import('../assets/geo/guangdong.json'),
  guangxi: () => import('../assets/geo/guangxi.json'),
  hainan: () => import('../assets/geo/hainan.json'),
  chongqing: () => import('../assets/geo/chongqing.json'),
  sichuan: () => import('../assets/geo/sichuan.json'),
  guizhou: () => import('../assets/geo/guizhou.json'),
  yunnan: () => import('../assets/geo/yunnan.json'),
  xizang: () => import('../assets/geo/xizang.json'),
  shaanxi: () => import('../assets/geo/shaanxi.json'),
  gansu: () => import('../assets/geo/gansu.json'),
  qinghai: () => import('../assets/geo/qinghai.json'),
  ningxia: () => import('../assets/geo/ningxia.json'),
  xinjiang: () => import('../assets/geo/xinjiang.json'),
}

const cache = new Map<ProvinceKey, unknown>()

export async function loadProvinceGeo(key: ProvinceKey) {
  if (cache.has(key)) return cache.get(key)
  const mod = await loaders[key]()
  const geo = (mod as { default?: unknown }).default ?? mod
  cache.set(key, geo)
  return geo
}
