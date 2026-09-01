export type AbnormalStore = {
  profit_rate: number
  paid_orders: number
  refund_orders?: number
}

/** 异常门店口径：负毛利，或退款率（退款订单/实付订单）>10% */
export function isAbnormalStore(store: AbnormalStore): boolean {
  if (store.profit_rate < 0) return true
  const refundRate = store.paid_orders > 0 ? (store.refund_orders || 0) / store.paid_orders : 0
  return refundRate > 0.1
}

export function negRateTone(v: number): 'good' | 'warn' | 'bad' {
  if (v <= 0.03) return 'good'
  if (v <= 0.08) return 'warn'
  return 'bad'
}

export function buyerTone(v: number): 'good' | 'warn' | 'bad' {
  if (v > 0) return 'good'
  if (v === 0) return 'warn'
  return 'bad'
}

export function marketingTone(v: number): 'good' | 'warn' | 'bad' {
  if (v <= 0.1) return 'good'
  if (v <= 0.2) return 'warn'
  return 'bad'
}

export function abnormalTone(v: number): 'good' | 'warn' | 'bad' {
  if (v === 0) return 'good'
  if (v <= 2) return 'warn'
  return 'bad'
}
