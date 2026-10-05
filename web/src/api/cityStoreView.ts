import { ref } from 'vue'

/** 城市门店页「经营表现 / 核心指标追踪」，顶栏与 CityStorePage 共用 */
export type CityStoreDimension = 'ops' | 'track'
export const cityStoreDimension = ref<CityStoreDimension>('ops')
