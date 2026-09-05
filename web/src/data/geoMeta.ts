/**
 * 地图地理元数据：省市映射、城市/门店坐标（基于公开地标与地址近似定位）
 * 说明：无官方门店经纬度时，用地址对应商圈/区县中心做可展示级定位。
 */

export type ProvinceKey = 'zhejiang' | 'jiangsu' | 'shanghai' | 'shandong' | 'henan' | 'hubei'

export type ProvinceMeta = {
  key: ProvinceKey
  name: string
  adcode: string
  /** 省域视觉中心 */
  center: [number, number]
  zoom: number
}

export const PROVINCES: Record<ProvinceKey, ProvinceMeta> = {
  zhejiang: { key: 'zhejiang', name: '浙江省', adcode: '330000', center: [120.15, 29.25], zoom: 1.15 },
  jiangsu: { key: 'jiangsu', name: '江苏省', adcode: '320000', center: [119.45, 32.98], zoom: 1.05 },
  shanghai: { key: 'shanghai', name: '上海市', adcode: '310000', center: [121.47, 31.2], zoom: 1.05 },
  shandong: { key: 'shandong', name: '山东省', adcode: '370000', center: [118.5, 36.3], zoom: 1.05 },
  henan: { key: 'henan', name: '河南省', adcode: '410000', center: [113.6, 33.9], zoom: 1.05 },
  hubei: { key: 'hubei', name: '湖北省', adcode: '420000', center: [112.3, 31.0], zoom: 1.05 },
}

/** 城市 → 省份 */
export const CITY_PROVINCE: Record<string, ProvinceKey> = {
  杭州市: 'zhejiang',
  金华市: 'zhejiang',
  宁波市: 'zhejiang',
  嘉兴市: 'zhejiang',
  湖州市: 'zhejiang',
  绍兴市: 'zhejiang',
  台州市: 'zhejiang',
  温州市: 'zhejiang',
  苏州市: 'jiangsu',
  无锡市: 'jiangsu',
  南通市: 'jiangsu',
  淮安市: 'jiangsu',
  南京市: 'jiangsu',
  常州市: 'jiangsu',
  扬州市: 'jiangsu',
  泰州市: 'jiangsu',
  镇江市: 'jiangsu',
  徐州市: 'jiangsu',
  连云港市: 'jiangsu',
  盐城市: 'jiangsu',
  宿迁市: 'jiangsu',
  上海市: 'shanghai',
  济南市: 'shandong',
  青岛市: 'shandong',
  郑州市: 'henan',
  武汉市: 'hubei',
}

/** 更新后的城市中心坐标 */
export const CITY_COORDS: Record<string, [number, number]> = {
  杭州市: [120.1551, 30.2741],
  苏州市: [120.6195, 31.2994],
  上海市: [121.4737, 31.2304],
  金华市: [119.6496, 29.0895],
  无锡市: [120.3119, 31.4912],
  武汉市: [114.3055, 30.5928],
  南通市: [120.8943, 32.0098],
  淮安市: [119.0213, 33.5975],
  济南市: [117.1205, 36.6519],
  郑州市: [113.6254, 34.7466],
  南京市: [118.7969, 32.0603],
  扬州市: [119.4215, 32.3932],
  泰州市: [119.9152, 32.4849],
  青岛市: [120.3826, 36.0671],
  宁波市: [121.544, 29.8683],
  常州市: [119.9465, 31.7728],
}

/**
 * 门店坐标：key 为短名或全名片段（匹配时去空白/括号）
 * 值：[lng, lat]
 */
export const STORE_COORDS: Record<string, [number, number]> = {
  // 杭州
  滨江店: [120.212, 30.208],
  萧山银泰店: [120.274, 30.185],
  新街店: [120.165, 30.268],
  城西中心店: [120.098, 30.292],
  // 苏州
  北门路店: [120.618, 31.335],
  万象汇店: [120.728, 31.323],
  越溪店: [120.592, 31.224],
  黄桥店: [120.618, 31.412],
  青剑湖店: [120.652, 31.378],
  吴江店: [120.645, 31.16],
  通安店: [120.482, 31.358],
  世茂广场店: [120.981, 31.385],
  永旺店: [120.601, 31.248],
  // 无锡
  宜兴店: [119.823, 31.34],
  五洲国际店: [120.285, 31.912],
  滨湖店: [120.248, 31.523],
  金惠路店: [120.283, 31.682],
  无锡新区店: [120.372, 31.491],
  钱桥店: [120.248, 31.652],
  周新中路店: [120.272, 31.542],
  // 上海
  大宁中心店: [121.453, 31.278],
  松江万达店: [121.227, 31.032],
  // 其他
  金华店: [119.647, 29.079],
  文峰广场店: [120.857, 32.014],
  汇通市场店: [119.021, 33.602],
  融创店: [117.145, 36.678],
  淮南街店: [113.638, 34.732],
  龙湖天街店: [114.238, 30.583],
  万象都荟店: [118.778, 32.041],
  浦口店: [118.628, 32.071],
  邗江店: [119.398, 32.394],
  姜堰店: [120.078, 32.509],
  滁州路店: [120.375, 36.088],
}

export function normCityName(name: string) {
  const s = String(name || '').trim()
  if (!s) return ''
  if (s === '全国') return s
  return /市$|区$|县$|州$/.test(s) ? s : `${s}市`
}

export function resolveProvince(cityName: string): ProvinceMeta | null {
  const city = normCityName(cityName)
  if (!city || city === '全国') return null
  const key = CITY_PROVINCE[city]
  return key ? PROVINCES[key] : null
}

export function cityCoord(cityName: string): [number, number] {
  const city = normCityName(cityName)
  return CITY_COORDS[city] || CITY_COORDS['杭州市'] || [120.15, 30.28]
}

function storeKey(name: string) {
  return String(name || '')
    .replace(/淘宝便利店|优沃森超市/g, '')
    .replace(/[（()）\s]/g, '')
    .trim()
}

/** 按门店名解析坐标；没有则回落到城市中心 + 轻微散列，避免重叠 */
export function storeCoord(storeName: string, cityName: string, index = 0): [number, number] {
  const key = storeKey(storeName)
  if (key && STORE_COORDS[key]) return STORE_COORDS[key]
  // 模糊包含匹配
  for (const [k, v] of Object.entries(STORE_COORDS)) {
    if (key.includes(k) || k.includes(key)) return v
  }
  const [lng, lat] = cityCoord(cityName)
  const angle = (index % 8) * (Math.PI / 4)
  const r = 0.035 + (index % 3) * 0.012
  return [lng + Math.cos(angle) * r, lat + Math.sin(angle) * r]
}
