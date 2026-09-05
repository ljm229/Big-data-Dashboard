import raw from '../data/storeLaunch.json'

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
  return Promise.resolve(structuredClone(raw as StoreLaunchData))
}
