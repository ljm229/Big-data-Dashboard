import raw from '../data/storeLaunch.json'
import { formatStoreName } from '../utils/storeName'

export type StoreLaunchCity = {
  city: string
  total: number
  launched: number
  pending: number
}

export type StoreLaunchSchedule = {
  date: string
  dateISO: string | null
  store: string
  city: string
  address: string
}

export type StoreLaunchData = {
  generatedAt: string
  source: string
  summary: {
    total: number
    launched: number
    pending: number
    scheduled: number
    unscheduled: number
  }
  cities: StoreLaunchCity[]
  schedule: StoreLaunchSchedule[]
}

export function fetchStoreLaunch(): Promise<StoreLaunchData> {
  const data = structuredClone(raw as StoreLaunchData)
  data.schedule = (data.schedule || []).map((row) => ({
    ...row,
    store: formatStoreName(row.store) || row.store,
  }))
  return Promise.resolve(data)
}
