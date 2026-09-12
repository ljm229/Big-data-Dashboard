/**
 * 同步运营看板增量包：经营趋势、流量、服务、商品、活动、逆向与配送异常
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

function bareStore(name) {
  const s = String(name || '')
  const m = s.match(/[（(]([^）)]+)[）)]/)
  return (m ? m[1] : s).replace(/^淘宝便利店/, '').replace(/^优沃森超市/, '').replace(/[（()）\s]/g, '') || s
}

function shortStore(name) {
  const bare = bareStore(name)
  return bare ? `淘宝便利店（${bare}）` : ''
}

function findFile(pred) {
  const dirs = [SRC, path.join(ROOT, '数据源')].filter((d, i, arr) => arr.indexOf(d) === i)
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) continue
    const hit = fs
      .readdirSync(dir)
      .filter((f) => f.endsWith('.xlsx') && !f.startsWith('~$'))
      .find((f) => pred(f))
    if (hit) return { dir, file: hit }
  }
  return null
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

function ingestMarketingTrend(file) {
  const rows = readSheet(file)
  const out = {}
  for (const r of rows) {
    const day = parseDay(r['日期'])
    if (!day) continue
    out[day] = {
      paid: toNumOrNull(r['有效订单金额（实付）']),
      orders: toNumOrNull(r['有效订单量']),
      profit: toNumOrNull(r['预计毛利']),
      promotionSpend: toNumOrNull(r['推广费用']),
      activityCost: toNumOrNull(r['营销活动费用']),
      merchantSubsidyRate: toNumOrNull(r['商家补贴率']),
      refundRate: toNumOrNull(r['退款率']),
      refundAmount: toNumOrNull(r['退款金额']),
      refundOrders: toNumOrNull(r['退款订单量']),
    }
  }
  return out
}

function ingestService(file) {
  const rows = readSheet(file)
  const byDay = {}
  for (const r of rows) {
    const day = parseDay(r['日期'])
    if (!day) continue
    if (!byDay[day]) byDay[day] = []
    byDay[day].push({
      id: String(r['门店id'] || ''),
      name: String(r['门店名称'] || ''),
      shortName: shortStore(r['门店名称']),
      fulfillmentRate: toNumOrNull(r['履约渗透率']),
      trackRate: toNumOrNull(r['轨迹渗透率']),
      ontimeRate: toNumOrNull(r['及时送达率']),
      lostOrders: toNum(r['流失订单']),
      lostRate: toNumOrNull(r['流失订单率']),
      merchantLost: toNum(r['商家原因流失订单数']),
      userLost: toNum(r['用户原因流失订单数']),
      logisticsLost: toNum(r['物流原因流失订单数']),
      otherLost: toNum(r['其他原因流失订单数']),
      stockoutLost: toNum(r['缺货导致流失订单数']),
      stockoutLoss:
        toNum(r['缺货导致流失预计损失']) +
        toNum(r['缺货导致整单取消预计损失']) +
        toNum(r['缺货导致整单退预计损失']) +
        toNum(r['缺货导致部分退预计损失']),
      pickOntimeRate: toNumOrNull(r['拣货及时订单率']),
      acceptMinutes: toNumOrNull(r['平均接单时长（分）']),
      deliveryMinutes: toNumOrNull(r['平均配送时长（分）']),
      outboundMinutes: toNumOrNull(r['平均出货时长（分）']),
      complaintOrders: toNum(r['客诉订单数']),
      complaintRate: toNumOrNull(r['客诉订单率']),
      urgeOrders: toNum(r['催单订单数']),
      urgeRate: toNumOrNull(r['催单订单率']),
      shopScore: toNumOrNull(r['店铺评分']),
    })
  }
  return byDay
}

function ingestActivity(file) {
  const rows = readSheet(file)
  const byDay = {}
  for (const r of rows) {
    const day = parseDay(r['活动时间'])
    if (!day) continue
    if (!byDay[day]) byDay[day] = []
    byDay[day].push({
      id: String(r['活动id'] || ''),
      name: String(r['活动名称'] || ''),
      storeId: String(r['商家id'] || ''),
      store: String(r['商家名称'] || ''),
      shortStore: shortStore(r['商家名称']),
      status: String(r['活动状态'] || ''),
      source: String(r['活动来源'] || ''),
      paid: toNum(r['实际交易额']),
      subsidy: toNum(r['活动总补贴']),
      merchantSubsidy: toNum(r['商家补贴金额']),
      platformSubsidy: toNum(r['平台补贴金额']),
      subsidyIntensity: toNumOrNull(r['商户补贴强度']),
      roi: toNumOrNull(r['投入产出比']),
      activityOrders: toNum(r['活动订单量']),
      storeOrders: toNum(r['门店总订单量']),
      activityOrderRate: toNumOrNull(r['活动订单占比']),
      newUsers: toNum(r['新客数']),
      newOrders: toNum(r['新客订单数']),
      newAov: toNumOrNull(r['新客笔单价']),
      oldUsers: toNum(r['老客数']),
      oldOrders: toNum(r['老客订单数']),
      oldAov: toNumOrNull(r['老客笔单价']),
    })
  }
  return byDay
}

function addCount(map, key, value = 1) {
  const name = String(key || '未知').trim() || '未知'
  map.set(name, (map.get(name) || 0) + value)
}

function topMap(map, limit = 20) {
  return [...map.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, limit)
}

function ingestReverse(file) {
  const rows = readSheet(file)
  const byDay = {}
  for (const r of rows) {
    const day = parseDay(r['日期'])
    if (!day) continue
    if (!byDay[day]) byDay[day] = new Map()
    const storeId = String(r['商户id'] || '')
    const storeName = String(r['商户名称'] || '')
    const key = storeId || storeName
    const store = byDay[day].get(key) || {
      id: storeId,
      name: storeName,
      shortName: shortStore(storeName),
      city: String(r['城市名称'] || ''),
      lineCnt: 0,
      orderIds: new Set(),
      amount: 0,
      reasons: new Map(),
      types: new Map(),
      categories: new Map(),
      products: new Map(),
    }
    store.lineCnt += 1
    store.orderIds.add(String(r['订单id'] || ''))
    store.amount += toNum(r['退货商品金额'])
    addCount(store.reasons, r['逆向单原因'])
    addCount(store.types, r['逆向单类型'])
    addCount(store.categories, r['一级类目'])
    const product = String(r['退货商品名称'] || '')
    if (product) {
      const cur = store.products.get(product) || { name: product, value: 0, amount: 0 }
      cur.value += 1
      cur.amount += toNum(r['退货商品金额'])
      store.products.set(product, cur)
    }
    byDay[day].set(key, store)
  }
  const out = {}
  for (const [day, storesMap] of Object.entries(byDay)) {
    out[day] = {
      stores: [...storesMap.values()].map((store) => ({
        id: store.id,
        name: store.name,
        shortName: store.shortName,
        city: store.city,
        lineCnt: store.lineCnt,
        orderCnt: [...store.orderIds].filter(Boolean).length,
        amount: round(store.amount, 2),
        reasons: topMap(store.reasons),
        types: topMap(store.types),
        categories: topMap(store.categories),
        products: [...store.products.values()].sort((a, b) => b.value - a.value).slice(0, 20),
      })),
    }
  }
  return out
}

function ingestDelivery(file) {
  const rows = readSheet(file)
  const byDay = {}
  for (const r of rows) {
    const day = parseDay(r['日期'])
    if (!day) continue
    if (!byDay[day]) byDay[day] = new Map()
    const storeId = String(r['商户id'] || '')
    const storeName = String(r['商户名称'] || '')
    const key = storeId || storeName
    const store = byDay[day].get(key) || {
      id: storeId,
      name: storeName,
      shortName: shortStore(storeName),
      city: String(r['城市名称'] || ''),
      total: 0,
      timely: 0,
      late: 0,
      missing: 0,
      merchantBasis: 0,
      riderBasis: 0,
    }
    store.total += 1
    const remark = String(r['备注'] || '')
    if (remark === '及时订单') store.timely += 1
    else if (remark === '不及时订单') store.late += 1
    else store.missing += 1
    const basis = String(r['判断出货及时与否依据'] || '')
    if (basis === '商家') store.merchantBasis += 1
    if (basis === '骑手') store.riderBasis += 1
    byDay[day].set(key, store)
  }
  return Object.fromEntries(
    Object.entries(byDay).map(([day, stores]) => [day, { stores: [...stores.values()] }]),
  )
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
    const sales = toNum(r['实际销售额'])
    const qty = toNum(r['销量(不含退款)']) || toNum(r['销量'])
    const orders = toNum(r['带来订单量'])
    const category = String(r['一级分类'] || '其他')
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
        salesSku: new Map(),
        categories: new Map(),
        rowCnt: 0,
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
      sales: 0,
      qty: 0,
      orders: 0,
    }
    st.sales += sales
    st.qty += qty
    st.orders += orders
    st.refundAmt += refundAmt
    st.refundOrders += refundOrders
    st.badCnt += bad
    st.stockoutLoss += loss
    st.stockoutTimes += stockoutTimes
    b.stores.set(short, st)
    b.rowCnt += 1

    const cat = b.categories.get(category) || { name: category, sales: 0, qty: 0, refundAmt: 0, stockoutLoss: 0 }
    cat.sales += sales
    cat.qty += qty
    cat.refundAmt += refundAmt
    cat.stockoutLoss += loss
    b.categories.set(category, cat)

    if (sales > 0 && sku) {
      const cur = b.salesSku.get(sku) || { name: sku, sales: 0, qty: 0 }
      cur.sales += sales
      cur.qty += qty
      b.salesSku.set(sku, cur)
    }

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
      summary: {
        skuRows: b.rowCnt,
        sales: round([...b.stores.values()].reduce((a, s) => a + s.sales, 0), 2),
        qty: round([...b.stores.values()].reduce((a, s) => a + s.qty, 0), 0),
        orders: round([...b.stores.values()].reduce((a, s) => a + s.orders, 0), 0),
        refundAmt: round([...b.stores.values()].reduce((a, s) => a + s.refundAmt, 0), 2),
        refundOrders: round([...b.stores.values()].reduce((a, s) => a + s.refundOrders, 0), 0),
        badCnt: round([...b.stores.values()].reduce((a, s) => a + s.badCnt, 0), 0),
        stockoutLoss: round([...b.stores.values()].reduce((a, s) => a + s.stockoutLoss, 0), 2),
        stockoutTimes: round([...b.stores.values()].reduce((a, s) => a + s.stockoutTimes, 0), 0),
      },
      categories: [...b.categories.values()]
        .map((x) => ({ ...x, sales: round(x.sales, 2), refundAmt: round(x.refundAmt, 2), stockoutLoss: round(x.stockoutLoss, 2) }))
        .sort((a, c) => c.sales - a.sales)
        .slice(0, 20),
      topSalesSku: [...b.salesSku.values()]
        .map((x) => ({ ...x, sales: round(x.sales, 2) }))
        .sort((a, c) => c.sales - a.sales)
        .slice(0, 15),
    }
  }
  return out
}

function main() {
  const pack = {
    updated_at: new Date().toISOString().slice(0, 19).replace('T', ' '),
    traffic: null,
    marketing: null,
    service: null,
    supply: null,
    product: null,
    activity: null,
    reverse: null,
    delivery: null,
    notes: [],
  }

  const trafficFile = findFile((f) => f.includes('流量分析') && (f.includes('分来源') || !f.includes('商品')))
    || findFile((f) => f.includes('流量分析'))
  const supplyFile = findFile((f) => f.includes('商品分析') && f.includes('店铺汇总'))
  const productFile = findFile((f) => f.includes('商品分析') && f.includes('商品明细'))
  const activityFile = findFile((f) => f.includes('活动') && f.includes('店铺'))
  const marketingFile = findFile((f) => f.startsWith('周期趋势') && !f.includes('渠道'))
  const serviceFile = findFile((f) => f.includes('服务数据'))
  const reverseFile = findFile((f) => f.includes('订单分析') && f.includes('逆向单'))
  const deliveryFile = findFile((f) => f.includes('订单分析') && f.includes('配送异常单'))

  if (marketingFile) {
    pack.marketing = ingestMarketingTrend(path.join(marketingFile.dir, marketingFile.file))
    pack.notes.push(`经营推广趋势：${Object.keys(pack.marketing).length} 天`)
  }

  if (trafficFile) {
    console.log('traffic', trafficFile.dir, trafficFile.file)
    pack.traffic = ingestTraffic(path.join(trafficFile.dir, trafficFile.file))
    pack.notes.push(`流量：${Object.keys(pack.traffic).length} 天`)
  } else {
    pack.notes.push('流量：数据源缺失，未接入')
  }

  if (serviceFile) {
    pack.service = ingestService(path.join(serviceFile.dir, serviceFile.file))
    pack.notes.push(`服务：${Object.keys(pack.service).length} 天`)
  }

  if (supplyFile) {
    console.log('supply', supplyFile.file)
    pack.supply = ingestSupply(path.join(supplyFile.dir, supplyFile.file))
    pack.notes.push(`供给：${Object.keys(pack.supply).length} 天`)
  } else {
    pack.notes.push('供给：数据源缺失，未接入')
  }

  if (productFile) {
    console.log('product', productFile.file)
    pack.product = ingestProductAgg(path.join(productFile.dir, productFile.file))
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
    pack.activity = ingestActivity(path.join(activityFile.dir, activityFile.file))
    pack.notes.push(`活动：${Object.keys(pack.activity).length} 天`)
  } else {
    pack.notes.push('活动：数据源缺失，未接入')
  }


  if (reverseFile) {
    pack.reverse = ingestReverse(path.join(reverseFile.dir, reverseFile.file))
    pack.notes.push(`逆向单：${Object.keys(pack.reverse).length} 天`)
  }

  if (deliveryFile) {
    pack.delivery = ingestDelivery(path.join(deliveryFile.dir, deliveryFile.file))
    pack.notes.push(`配送异常：${Object.keys(pack.delivery).length} 天`)
  }

  fs.writeFileSync(OUT, JSON.stringify(pack))
  console.log('wrote', OUT, 'bytes', fs.statSync(OUT).size)
  console.log(pack.notes.join('\n'))
}

main()
