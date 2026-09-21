import raw from '../data/trafficData.json'
import { ref } from 'vue'
import type { TrafficData, TrafficDimension } from '../utils/trafficAnalysis'

export const trafficData = raw as TrafficData
export const trafficPeriodLabel = `${trafficData.period.from} 至 ${trafficData.period.to}`
export const trafficGrain = trafficData.period.grain

/** 流量页「平台渠道 / APP 内页面」视角，顶栏与页面共用 */
export const trafficDimension = ref<TrafficDimension>('platform')
