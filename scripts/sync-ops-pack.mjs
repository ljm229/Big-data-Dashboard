/**
 * 同步运营看板增量包：流量分来源 + 商品店铺汇总 + 商品明细聚合（缺货/退款）
 * 不编造：无文件则跳过对应块；空单元格 → null
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import XLSX from 'xlsx'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const SRC = path.join(ROOT, '数据源', '9月日更')
const OUT = path.join(ROOT, 'web', 'src', 'data', 'opsPack.json')

function readSheet(file, sheetPrefer = 'data') {
  const wb = XLSX.readFile(file, { cellDates: true })
  const name = wb.SheetNames.includes(sheetPrefer) ? sheetPrefer : wb.SheetNames[0]
  return XLSX.utils.sheet_to_json(wb.Sheets[name], { defval: null })
}

function toNumOrNull(v) {
  if (v == null || v === '') return null
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  const s = String(v).trim().replace(/,/g, '')
  if (!s || s === '--' || s === '-' || s === '—') return null
  if (s.endsWith('%')) {
    const n = parseFloat(s) / 100
    return Number.isFinite(n) ? n : null
  }
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

function toNum(v) {
  return toNumOrNull(v) ?? 0
}

function ymd8ToIso(s) {
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`
}

function parseDay(v) {
  const s = String(v ?? '').trim()
  if (/^\d{8}$/.test(s)) return ymd8ToIso(s)
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)
  return ''
}

/** 商品明细常见：20260809-20260907 区间汇总（非按日） */
function parseDayOrPeriod(v) {
  const s = String(v ?? '').trim()
  const range = s.match(/^(\d{8})-(\d{8})$/)
  if (range) {
    return { kind: 'period', from: ymd8ToIso(range[1]), to: ymd8ToIso(range[2]), key: 'period' }
  }
  const day = parseDay(s)
  return day ? { kind: 'day', from: day, to: day, key: day } : null
}

function shortStore(name) {
  const s = String(name || '')
  const m = s.match(/[（(]([^）)]+)[）)]/)
  return (m ? m[1] : s).replace(/^淘宝便利店/, '').replace(/^优沃森超市/, '') || s
}

function findFile(pred) {
  if (!fs.existsSync(SRC)) return null
  return fs
    .readdirSync(SRC)
    .filter((f) => f.endsWith('.xlsx') && !f.startsWith('~$'))
    .find((f) => pred(f))
}

function rate(a, b) {
  if (!b) return null
  return a / b
}

function round(n, d = 4) {
  if (n == null || !Number.isFinite(n)) return null
  const p = 10 ** d
  return Math.round(n * p) / p
}

function ingestTraffic(file) {
  const rows = readSheet(file)
  /** @type {Record<string, any>} */
  const byDay = {}
  for (const r of rows) {
    const day = parseDay(r['日期'])
    if (!day) continue
    const city = String(r['城市名称'] || '').replace(/市$/, '') || '—'
    const store = String(r['门店名称'] || '')
    const short = shortStore(store)
    const srcCat = String(r['来源分类'] || '其他')
    const srcName = String(r['来源名称'] || '未知')
    const expose = toNum(r['曝光人数'])
    const enter = toNum(r['进店人数'])
    const orderUsers = toNum(r['下单人数'])

    if (!byDay[day]) byDay[day] = { sources: new Map(), stores: new Map() }
    const bucket = byDay[day]

    const sk = `${srcCat}||${srcName}`
    const s = bucket.sources.get(sk) || { cat: srcCat, name: srcName, expose: 0, enter: 0, orderUsers: 0 }
    s.expose += expose
    s.enter += enter
    s.orderUsers += orderUsers
    bucket.sources.set(sk, s)

    const st = bucket.stores.get(short) || {
      name: store,
      shortName: short,
      city,
      expose: 0,
      enter: 0,
      orderUsers: 0,
    }
    st.expose += expose
    st.enter += enter
    st.orderUsers += orderUsers
    if (city && city !== '—') st.city = city
    bucket.stores.set(short, st)
  }

  /** @type {Record<string, any>} */
  const out = {}
  for (const [day, bucket] of Object.entries(byDay)) {
    const stores = [...bucket.stores.values()]
      .map((st) => ({
        ...st,
        enterRate: round(rate(st.enter, st.expose), 4),
        orderRate: round(rate(st.orderUsers, st.enter), 4),
        overallRate: round(rate(st.orderUsers, st.expose), 4),
      }))
      .sort((a, b) => (a.overallRate ?? 1) - (b.overallRate ?? 1))

    const expose = stores.reduce((a, s) => a + s.expose, 0)
    const enter = stores.reduce((a, s) => a + s.enter, 0)
    const orderUsers = stores.reduce((a, s) => a + s.orderUsers, 0)

    const sources = [...bucket.sources.values()]
      .map((s) => ({
        ...s,
        enterRate: round(rate(s.enter, s.expose), 4),
        orderRate: round(rate(s.orderUsers, s.enter), 4),
        overallRate: round(rate(s.orderUsers, s.expose), 4),
      }))
      .sort((a, b) => b.expose - a.expose)
      .slice(0, 12)

    out[day] = {
      funnel: {
        expose,
        enter,
        orderUsers,
        enterRate: round(rate(enter, expose), 4),
        orderRate: round(rate(orderUsers, enter), 4),
        overallRate: round(rate(orderUsers, expose), 4),
      },
      sources,
      stores,
      storeCnt: stores.length,
    }
  }
  return out
}

function ingestSupply(file) {
  const rows = readSheet(file)
  /** @type {Record<string, any>} */
  const byDay = {}
  for (const r of rows) {
    const day = parseDay(r['日期'])
    if (!day) continue
    const store = String(r['门店名称'] || '')
    const short = shortStore(store)
    const row = {
      name: store,
      shortName: short,
      id: String(r['门店id'] || ''),
      online: toNumOrNull(r['在架商品数']),
      sellable: toNumOrNull(r['可售商品数']),
      active: toNumOrNull(r['动销商品数']),
      stockout: toNumOrNull(r['缺货商品数']),
      refundSku: toNumOrNull(r['退款商品数']),
      badSku: toNumOrNull(r['差评商品数']),
      attendance: toNumOrNull(r['商品出勤率']),
      absent: toNumOrNull(r['缺勤商品数']),
      absentLoss: toNumOrNull(r['缺勤商品损失金额']),
      bundleCnt: toNumOrNull(r['组套商品数']),
      bundleOrders: toNumOrNull(r['组套商品订单数']),
      bundleGmv: toNumOrNull(r['组套商品原始交易额']),
      bundlePaid: toNumOrNull(r['组套商品实际交易额']),
      bundleUsers: toNumOrNull(r['组套商品下单人数']),
    }
    if (!byDay[day]) byDay[day] = []
    byDay[day].push(row)
  }

  /** @type {Record<string, any>} */
  const out = {}
  for (const [day, list] of Object.entries(byDay)) {
    const stores = list.sort((a, b) => (b.absentLoss || 0) - (a.absentLoss || 0))
    const sum = (k) => stores.reduce((a, s) => a + (Number(s[k]) || 0), 0)
    const avg = (k) => {
      const vals = stores.map((s) => s[k]).filter((v) => v != null && Number.isFinite(Number(v)))
      if (!vals.length) return null
      return round(vals.reduce((a, b) => a + Number(b), 0) / vals.length, 4)
    }
    out[day] = {
      summary: {
        storeCnt: stores.length,
        online: sum('online'),
        sellable: sum('sellable'),
        active: sum('active'),
        stockout: sum('stockout'),
        refundSku: sum('refundSku'),
        badSku: sum('badSku'),
        attendance: avg('attendance'),
        absent: sum('absent'),
        absentLoss: round(sum('absentLoss'), 2),
        bundlePaid: round(sum('bundlePaid'), 2),
        bundleOrders: sum('bundleOrders'),
      },
      stores,
    }
  }
  return out
}

/** 商品明细过大：只聚合成店级逆向/缺货 + Top SKU；日期可能是区间汇总 */
function ingestProductAgg(file) {
  const rows = readSheet(file)
  /** @type {Record<string, any>} */
  const byKey = {}
  for (const r of rows) {
    const period = parseDayOrPeriod(r['日期'])
    if (!period) continue
    const store = String(r['门店名称'] || '')
    const short = shortStore(store)
    const sku = String(r['商品名称'] || '').slice(0, 48)
    const refundAmt = toNum(r['退款金额'])
    const refundOrders = toNum(r['退款单量'])
    const bad = toNum(r['差评数'])
    const loss =
      toNum(r['缺货导致的流失单预计损失']) +
      toNum(r['缺货导致的取消单预计损失']) +
      toNum(r['缺货导致的整单退预计损失']) +
      toNum(r['缺货导致的部分退预计损失'])
    const stockoutTimes = toNum(r['缺货次数'])
    const reasonRaw = String(r['退款原因分类'] || '').trim()

    if (!byKey[period.key]) {
      byKey[period.key] = {
        kind: period.kind,
        from: period.from,
        to: period.to,
        stores: new Map(),
        lossSku: new Map(),
        refundSku: new Map(),
        reasons: new Map(),
      }
    }
    const b = byKey[period.key]
    const st = b.stores.get(short) || {
      shortName: short,
      name: store,
      refundAmt: 0,
      refundOrders: 0,
      badCnt: 0,
      stockoutLoss: 0,
      stockoutTimes: 0,
    }
    st.refundAmt += refundAmt
    st.refundOrders += refundOrders
    st.badCnt += bad
    st.stockoutLoss += loss
    st.stockoutTimes += stockoutTimes
    b.stores.set(short, st)

    if (loss > 0 && sku) {
      const cur = b.lossSku.get(sku) || { name: sku, loss: 0, times: 0 }
      cur.loss += loss
      cur.times += stockoutTimes
      b.lossSku.set(sku, cur)
    }
    if (refundAmt > 0 && sku) {
      const cur = b.refundSku.get(sku) || { name: sku, amount: 0, orders: 0 }
      cur.amount += refundAmt
      cur.orders += refundOrders
      b.refundSku.set(sku, cur)
    }
    // 明细里原因字段常被拼成「用户原因个商户原因个…」，无可靠计数则跳过
    const reasonParts = reasonRaw.match(/用户原因|商户原因|配送原因|其他原因/g)
    if (reasonParts && reasonParts.length === 1 && refundOrders > 0) {
      b.reasons.set(reasonParts[0], (b.reasons.get(reasonParts[0]) || 0) + refundOrders)
    }
  }

  /** @type {Record<string, any>} */
  const out = {}
  for (const [key, b] of Object.entries(byKey)) {
    out[key] = {
      kind: b.kind,
      from: b.from,
      to: b.to,
      stores: [...b.stores.values()]
        .map((s) => ({
          ...s,
          refundAmt: round(s.refundAmt, 2),
          stockoutLoss: round(s.stockoutLoss, 2),
        }))
        .sort((a, c) => c.stockoutLoss - a.stockoutLoss),
      topLossSku: [...b.lossSku.values()]
        .map((x) => ({ ...x, loss: round(x.loss, 2) }))
        .sort((a, c) => c.loss - a.loss)
        .slice(0, 15),
      topRefundSku: [...b.refundSku.values()]
        .map((x) => ({ ...x, amount: round(x.amount, 2) }))
        .sort((a, c) => c.amount - a.amount)
        .slice(0, 15),
      refundReasons: [...b.reasons.entries()]
        .map(([name, value]) => ({ name, value }))
        .sort((a, c) => c.value - a.value)
        .slice(0, 12),
    }
  }
  return out
}

function main() {
  const pack = {
    updated_at: new Date().toISOString().slice(0, 19).replace('T', ' '),
    traffic: null,
    supply: null,
    product: null,
    activity: null,
    notes: [],
  }

  const trafficFile = findFile((f) => f.includes('流量分析') && f.includes('分来源'))
  const supplyFile = findFile((f) => f.includes('商品分析') && f.includes('店铺汇总'))
  const productFile = findFile((f) => f.includes('商品分析') && f.includes('商品明细'))
  const activityFile = findFile((f) => f.includes('活动') && f.includes('店铺'))

  if (trafficFile) {
    console.log('traffic', trafficFile)
    pack.traffic = ingestTraffic(path.join(SRC, trafficFile))
    pack.notes.push(`流量：${Object.keys(pack.traffic).length} 天`)
  } else {
    pack.notes.push('流量：数据源缺失，未接入')
  }

  if (supplyFile) {
    console.log('supply', supplyFile)
    pack.supply = ingestSupply(path.join(SRC, supplyFile))
    pack.notes.push(`供给：${Object.keys(pack.supply).length} 天`)
  } else {
    pack.notes.push('供给：数据源缺失，未接入')
  }

  if (productFile) {
    console.log('product', productFile)
    pack.product = ingestProductAgg(path.join(SRC, productFile))
    const n = Object.keys(pack.product).length
    const sample = pack.product.period || Object.values(pack.product)[0]
    pack.notes.push(
      sample?.kind === 'period'
        ? `品钻聚合：区间 ${sample.from}～${sample.to}（非按日）`
        : `品钻聚合：${n} 天`,
    )
  } else {
    pack.notes.push('品钻：数据源缺失，未接入')
  }

  if (activityFile) {
    pack.notes.push('活动：文件存在但本版未解析（待字段确认）')
  } else {
    pack.notes.push('活动：数据源缺失，未接入')
  }

  fs.writeFileSync(OUT, JSON.stringify(pack))
  console.log('wrote', OUT, 'bytes', fs.statSync(OUT).size)
  console.log(pack.notes.join('\n'))
}

main()
