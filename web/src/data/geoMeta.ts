/**
 * 地图地理元数据：省市映射、城市/门店坐标（基于公开地标与地址近似定位）
 * 说明：无官方门店经纬度时，用门店信息表地址对应商圈/区县中心做可展示级定位。
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
 * 门店概位坐标：按《淘宝便利店门店信息表》地址落到商圈/地标中心（非精确定位）
 * key 为短名；值：[lng, lat]
 */
export const STORE_COORDS: Record<string, [number, number]> = {
  // 杭州
  滨江店: [120.212, 30.208],
  萧山银泰店: [120.264, 30.231],
  新街店: [120.169, 30.259],
  城西中心店: [120.098, 30.292],
  // 苏州（含昆山）
  北门路店: [120.618, 31.335],
  万象汇店: [120.728, 31.323],
  越溪店: [120.592, 31.224],
  黄桥店: [120.618, 31.412],
  青剑湖店: [120.652, 31.378],
  吴江店: [120.645, 31.16],
  通安店: [120.482, 31.358],
  // 昆山开发区红枫路1号东创科技中心（世茂广场对面）
  世茂广场店: [120.983, 31.386],
  // 吴中区水墨花园
  永旺店: [120.628, 31.265],
  // 无锡 / 江阴 / 宜兴
  宜兴店: [119.823, 31.34],
  // 江阴五洲国际广场
  五洲国际店: [120.285, 31.911],
  // 滨湖荣巷梅园徐巷（梅园开原寺地铁附近）
  滨湖店: [120.227, 31.535],
  // 惠山金惠路595号
  金惠路店: [120.286, 31.685],
  // 新区汇融商务广场
  无锡新区店: [120.377, 31.491],
  // 惠山通溪路79号
  钱桥店: [120.255, 31.655],
  // 滨湖周新中路188号
  周新中路店: [120.275, 31.545],
  // 上海
  大宁中心店: [121.453, 31.278],
  松江万达店: [121.227, 31.032],
  // 其他城市（按门店信息表地址）
  金华店: [119.647, 29.079],
  文峰广场店: [120.857, 32.014],
  // 淮安清江浦淮海路农贸市场
  汇通市场店: [119.028, 33.598],
  // 济南历城经十路×凤集路 融创国主馆
  融创店: [117.158, 36.675],
  淮南街店: [113.638, 34.732],
  龙湖天街店: [114.238, 30.583],
  // 南京万象都荟
  万象都荟店: [118.778, 32.041],
  // 浦口新科二路10号
  浦口店: [118.718, 32.085],
  // 扬州邗江平山北路81号众鑫大厦
  邗江店: [119.396, 32.401],
  // 姜堰新世纪市民广场
  姜堰店: [120.134, 32.509],
  // 青岛市北滁州路501
  滁州路店: [120.368, 36.091],
}

/** 地址关键词 → 概位（当门店名未命中时，用门店信息表地址二次定位） */
const ADDRESS_COORDS: Array<{ keys: string[]; coord: [number, number] }> = [
  { keys: ['红枫路', '东创科技', '昆山开发区'], coord: [120.983, 31.386] },
  { keys: ['水墨花园'], coord: [120.628, 31.265] },
  { keys: ['梅园', '开原寺', '荣巷', '徐巷'], coord: [120.227, 31.535] },
  { keys: ['平山北路', '众鑫大厦'], coord: [119.396, 32.401] },
  { keys: ['新世纪市民广场', '姜堰'], coord: [120.134, 32.509] },
  { keys: ['融创国主', '凤集路'], coord: [117.158, 36.675] },
  { keys: ['万象都荟'], coord: [118.778, 32.041] },
  { keys: ['五洲国际', '江阴'], coord: [120.285, 31.911] },
  { keys: ['滁州路'], coord: [120.368, 36.091] },
  { keys: ['金惠路'], coord: [120.286, 31.685] },
  { keys: ['新科二路', '浦口'], coord: [118.718, 32.085] },
  { keys: ['汇融商务'], coord: [120.377, 31.491] },
  { keys: ['通溪路'], coord: [120.255, 31.655] },
  { keys: ['周新中路'], coord: [120.275, 31.545] },
  { keys: ['淮海路农贸', '清江浦'], coord: [119.028, 33.598] },
]

export function normCityName(name: string) {
  const s = String(name || '').trim()
  if (!s) return ''
  if (s === '全国') return s
  const alias = ({ 昆山: '苏州市', 昆山市: '苏州市', 姜堰: '泰州市', 姜堰区: '泰州市' } as Record<string, string>)[s]
  if (alias) return alias
  if (CITY_PROVINCE[`${s}市`]) return `${s}市`
  return /市$|区$|县$|自治州$/.test(s) ? s : `${s}市`
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

/** 按地址文本匹配商圈概位 */
export function coordFromAddress(address: string): [number, number] | null {
  const text = String(address || '').replace(/\s+/g, '')
  if (!text) return null
  for (const row of ADDRESS_COORDS) {
    if (row.keys.some((k) => text.includes(k))) return row.coord
  }
  return null
}

export type StoreLocationPrecision = 'address-approx' | 'city-fallback'

export type StoreLocation = {
  coord: [number, number]
  precision: StoreLocationPrecision
  precisionLabel: '地址概位' | '城市概位'
}

/**
 * 按门店名/地址解析可展示坐标，并显式返回定位精度。
 * 没有经地图服务核验的点一律标“地址概位”，禁止在界面上冒充精确门牌坐标。
 */
export function resolveStoreLocation(
  storeName: string,
  cityName: string,
  _index = 0,
  address?: string,
): StoreLocation {
  const key = storeKey(storeName)
  if (key && STORE_COORDS[key]) {
    return { coord: STORE_COORDS[key], precision: 'address-approx', precisionLabel: '地址概位' }
  }
  for (const [k, v] of Object.entries(STORE_COORDS)) {
    if (key && (key.includes(k) || k.includes(key))) {
      return { coord: v, precision: 'address-approx', precisionLabel: '地址概位' }
    }
  }
  const byAddr = address ? coordFromAddress(address) : null
  if (byAddr) return { coord: byAddr, precision: 'address-approx', precisionLabel: '地址概位' }
  const [lng, lat] = cityCoord(cityName)
  return {
    coord: [lng, lat],
    precision: 'city-fallback',
    precisionLabel: '城市概位',
  }
}

/** 兼容既有调用，只取坐标。新界面优先用 resolveStoreLocation 展示精度。 */
export function storeCoord(
  storeName: string,
  cityName: string,
  index = 0,
  address?: string,
): [number, number] {
  return resolveStoreLocation(storeName, cityName, index, address).coord
}
