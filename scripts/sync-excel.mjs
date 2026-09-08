/**
 * 从 数据源/* 周包重新生成 web/src/data/dashboard.json
 * 支持按日 / 按周 / 按月取数，含渠道维；毛利默认「含平台后返」
 * 用法：node scripts/sync-excel.mjs
 */
import XLSX from 'xlsx'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const sourceRoot = path.join(root, '数据源')

function readSheet(file, sheetName) {
  const wb = XLSX.readFile(file)
  const name = sheetName || (wb.SheetNames.includes('data') ? 'data' : wb.SheetNames[0])
  return XLSX.utils.sheet_to_json(wb.Sheets[name], { defval: null })
}

function pad(n) {
  return String(n).padStart(2, '0')
}

/** Excel 序列号 / YYYYMMDD / Date → YYYY-MM-DD */
function toIsoDate(v) {
  if (v == null || v === '') return ''
  if (typeof v === 'number' && v > 30000) {
    const parsed = XLSX.SSF.parse_date_code(v)
    if (parsed) return `${parsed.y}-${pad(parsed.m)}-${pad(parsed.d)}`
  }
  const s = String(v).trim()
  if (/^\d{8}$/.test(s)) return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)
  return ''
}

function isoToLabel(iso) {
  if (!iso) return ''
  const [, m, d] = iso.split('-')
  return `${Number(m)}.${Number(d)}`
}

/** 周五所在月的第几个周五 →「8月第3周」 */
function calendarWeekLabel(friIso) {
  const fri = new Date(`${friIso}T12:00:00`)
  if (Number.isNaN(fri.getTime())) return friIso
  const y = fri.getFullYear()
  const m = fri.getMonth()
  let ordinal = 0
  for (let day = 1; day <= fri.getDate(); day++) {
    const dt = new Date(y, m, day, 12)
    if (dt.getDay() === 5) ordinal++
  }
  return `${m + 1}月第${ordinal}周`
}

function fridayOfWeek(iso) {
  const d = new Date(`${iso}T12:00:00`)
  const sinceFri = (d.getDay() + 2) % 7
  d.setDate(d.getDate() - sinceFri)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function thursdayOfWeek(iso) {
  const d = new Date(`${fridayOfWeek(iso)}T12:00:00`)
  d.setDate(d.getDate() + 6)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function normStoreName(name) {
  return String(name || '')
    .replace(/淘宝便利店[（(]/g, '')
    .replace(/优沃森超市[（(]/g, '')
    .replace(/[）)]/g, '')
    .replace(/\s+/g, '')
    .trim()
}

function normCity(city) {
  const c = String(city || '')
    .trim()
    .replace(/^城市$/, '')
  if (!c || c === '全国') return ''
  return c.endsWith('市') ? c : `${c}市`
}

function toNumOrNull(v) {
  if (v == null || v === '') return null
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  const s = String(v).trim().replace(/,/g, '')
  if (!s || s === '--' || s === '-' || s === '—' || s.toUpperCase() === 'N/A') return null
  if (s.endsWith('%')) {
    const n = parseFloat(s) / 100
    return Number.isFinite(n) ? n : null
  }
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

function toNum(v) {
  const n = toNumOrNull(v)
  return n == null ? 0 : n
}

function sumField(rows, key) {
  return rows.reduce((a, r) => a + toNum(r[key]), 0)
}

function avgField(rows, key) {
  const vals = rows.map((r) => toNum(r[key])).filter((v) => v !== 0 || true)
  if (!rows.length) return 0
  return vals.reduce((a, b) => a + b, 0) / rows.length
}

/** 经营分析行 → 统一指标（毛利含后返） */
function pickMetrics(r) {
  const gmv = toNum(r['总营业额'])
  const paid = toNum(r['有效订单金额（实付）'])
  const orders = toNum(r['有效订单量'])
  const profit = toNum(r['预计毛利(含平台后返)'])
  const profitRaw = toNum(r['预计毛利'])
  const profitRate = toNum(r['毛利率(含平台后返)']) || (gmv ? profit / gmv : 0)
  const buyers = toNum(r['有效买家数'])
  return {
    total_gmv: gmv,
    paid_amount: paid,
    paid_orders: orders,
    effective_orders: orders,
    buyer_cnt: buyers,
    arpu: toNum(r['有效客单价（实付）']) || (buyers ? paid / buyers : orders ? paid / orders : 0),
    est_profit: profit,
    est_profit_raw: profitRaw,
    profit_rate: profitRate,
    profit_rate_raw: toNum(r['毛利率']),
    rebate: toNum(r['平台后返']),
    online_income: toNum(r['预计线上收入']),
    est_expense: toNum(r['预计线上支出']),
    purchase_cost: toNum(r['商品成本']),
    marketing_cost: toNum(r['营销活动费用']),
    commission: toNum(r['佣金&其他平台费用']),
    platform_delivery: toNum(r['平台配送服务费']),
    self_delivery: toNum(r['自配送费用']),
    promo_cost: toNum(r['推广费用']),
    platform_subsidy: toNum(r['平台补贴']),
    neg_profit_order_rate: toNum(r['负毛利订单占比']),
    merchant_subsidy_rate: toNum(r['商家补贴率']),
    refund_rate: toNum(r['退款率']),
    refund_amount: toNum(r['退款金额']),
    refund_orders: toNum(r['退款订单量']),
    cancel_orders: toNum(r['取消订单量']),
    partial_refund_orders: toNum(r['部分退款订单量']),
    full_refund_orders: toNum(r['整单退款订单量']),
    inafter_refund_ratio: toNum(r['售中售后退款比']),
  }
}

function metricsFromRows(rows) {
  if (!rows.length) return null
  const m = rows.map(pickMetrics)
  const sum = (k) => m.reduce((a, x) => a + x[k], 0)
  const gmv = sum('total_gmv')
  const paid = sum('paid_amount')
  const orders = sum('effective_orders')
  const profit = sum('est_profit')
  const buyers = sum('buyer_cnt')
  return {
    total_gmv: gmv,
    paid_amount: paid,
    paid_orders: orders,
    effective_orders: orders,
    buyer_cnt: buyers,
    arpu: buyers ? paid / buyers : orders ? paid / orders : 0,
    est_profit: profit,
    est_profit_raw: sum('est_profit_raw'),
    profit_rate: gmv ? profit / gmv : 0,
    profit_rate_raw: gmv ? sum('est_profit_raw') / gmv : 0,
    rebate: sum('rebate'),
    online_income: sum('online_income'),
    est_expense: sum('est_expense'),
    purchase_cost: sum('purchase_cost'),
    marketing_cost: sum('marketing_cost'),
    commission: sum('commission'),
    platform_delivery: sum('platform_delivery'),
    self_delivery: sum('self_delivery'),
    promo_cost: sum('promo_cost'),
    platform_subsidy: sum('platform_subsidy'),
    neg_profit_order_rate: orders
      ? m.reduce((a, x) => a + x.neg_profit_order_rate * x.effective_orders, 0) / orders
      : avgField(
          rows,
          '负毛利订单占比',
        ),
    merchant_subsidy_rate: avgField(rows, '商家补贴率'),
    refund_rate: orders ? sum('refund_orders') / orders : avgField(rows, '退款率'),
    refund_amount: sum('refund_amount'),
    refund_orders: sum('refund_orders'),
    cancel_orders: sum('cancel_orders'),
    partial_refund_orders: sum('partial_refund_orders'),
    full_refund_orders: sum('full_refund_orders'),
    inafter_refund_ratio: avgField(rows, '售中售后退款比'),
    store_cnt: new Set(rows.map((r) => normStoreName(r['门店'] || r['门店名称']))).size || undefined,
  }
}

function costFromMetrics(ov) {
  if (!ov) return { est_expense: 0, items: [] }
  const items = [
    { item: '商品成本', amount: ov.purchase_cost, key: 'purchase' },
    { item: '营销活动费用', amount: ov.marketing_cost, key: 'marketing' },
    { item: '佣金&其他平台费用', amount: ov.commission, key: 'commission' },
    { item: '平台配送服务费', amount: ov.platform_delivery, key: 'platform_delivery' },
    { item: '商家自配送费用', amount: ov.self_delivery, key: 'self_delivery' },
    { item: '推广费用', amount: ov.promo_cost, key: 'promo' },
    { item: '平台补贴', amount: ov.platform_subsidy, key: 'platform_subsidy' },
    { item: '平台后返', amount: ov.rebate, key: 'rebate' },
    {
      item: '总优惠金额',
      amount: Math.max(0, ov.total_gmv - ov.paid_amount),
      key: 'discount',
    },
  ]
    .filter((x) => x.amount > 0)
    .sort((a, b) => b.amount - a.amount)
  const base = ov.total_gmv || items.reduce((a, b) => a + b.amount, 0) || 1
  return {
    est_expense: ov.est_expense,
    items: items.map((i) => ({ ...i, rate: i.amount / base })),
  }
}

function isExcelFile(f) {
  // 跳过 Excel 打开时的临时锁文件 ~$xxx.xlsx
  return f.endsWith('.xlsx') && !path.basename(f).startsWith('~$')
}

function findFile(files, ...preds) {
  return files.find((f) => isExcelFile(f) && preds.every((p) => (typeof p === 'string' ? f.includes(p) : p(f))))
}

function mapAssessRow(r) {
  return {
    name: String(r['门店名称'] || ''),
    shortName: normStoreName(r['门店名称']),
    code: String(r['门店编码'] || ''),
    sellout_rate: toNumOrNull(r['动销商品售罄率']),
    pick_error_rate: toNumOrNull(r['错漏拣率']),
    warehouse_t: toNumOrNull(r['仓T']),
    im_reply_rate: toNumOrNull(r['IM 3分钟回复率']),
    merchant_issue_rate: toNumOrNull(r['商责问题订单率']),
    shop_score: toNumOrNull(r['店铺分']),
  }
}

function isAssessHeaderRow(r) {
  const name = String(r['门店名称'] || '').trim()
  const code = String(r['门店编码'] || '').trim()
  return !name || name === '门店名称' || code === '门店编码'
}

/** 支持：按日序列号、整月区块（如「8月」小节后的门店行） */
function ingestAssessmentSheet(file, assessment, fallbackWeekId) {
  const rows = readSheet(file)
  const hasDateCol = rows.some((r) => r['日期'] != null && String(r['日期']).trim() !== '')
  if (!hasDateCol) {
    if (!fallbackWeekId) return
    assessment[fallbackWeekId] = rows.filter((r) => !isAssessHeaderRow(r) && r['门店名称']).map(mapAssessRow)
    return
  }

  let monthSection = '' // e.g. 8月
  let dayCount = 0
  let monthCount = 0
  for (const r of rows) {
    const dateRaw = r['日期']
    const dateStr = String(dateRaw ?? '').trim()

    // 小节标题行：日期=「8月」且门店列仍是表头
    if (/^\d{1,2}月$/.test(dateStr) && isAssessHeaderRow(r)) {
      monthSection = dateStr
      continue
    }
    if (isAssessHeaderRow(r)) continue
    if (!r['门店名称']) continue

    const iso = toIsoDate(dateRaw)
    if (iso) {
      if (!assessment[iso]) assessment[iso] = []
      assessment[iso].push(mapAssessRow(r))
      dayCount++
      continue
    }

    // 新口径：日期列直接写「8月」+ 门店行 → 整月键
    if (/^\d{1,2}月$/.test(dateStr)) {
      const monthNum = Number(dateStr.replace('月', ''))
      if (monthNum >= 1 && monthNum <= 12) {
        const key = `M:2026-${pad(monthNum)}`
        if (!assessment[key]) assessment[key] = []
        assessment[key].push(mapAssessRow(r))
        monthSection = dateStr
        monthCount++
        continue
      }
    }

    // 旧口径：小节标题后，日期列脏值仍归入该月
    if (monthSection && /^\d{1,2}月$/.test(monthSection)) {
      const monthNum = Number(monthSection.replace('月', ''))
      if (monthNum >= 1 && monthNum <= 12) {
        const key = `M:2026-${pad(monthNum)}`
        if (!assessment[key]) assessment[key] = []
        assessment[key].push(mapAssessRow(r))
        monthCount++
        continue
      }
    }
  }
  console.log(
    'assessment ingest',
    path.basename(file),
    'dayRows',
    dayCount,
    'monthRows',
    monthCount,
    'keys',
    Object.keys(assessment).filter((k) => k.includes('2026-09') || k.startsWith('M:')).join(','),
  )
}

const weekDirs = fs
  .readdirSync(sourceRoot)
  .filter((name) => {
    const dir = path.join(sourceRoot, name)
    if (!fs.statSync(dir).isDirectory()) return false
    const files = fs.readdirSync(dir)
    return files.some((f) => isExcelFile(f) && f.includes('周趋势'))
  })
  .sort((a, b) => {
    // 整月包（如「8月」）最后处理，覆盖同日周包并补齐月初
    const ma = a.includes('月') ? 1 : 0
    const mb = b.includes('月') ? 1 : 0
    if (ma !== mb) return ma - mb
    return a.localeCompare(b, 'zh')
  })

const byDay = {}
const weeks = []
const assessment = {}
const channelSet = new Set()
let storeListGlobal = []

for (const folder of weekDirs) {
  const dir = path.join(sourceRoot, folder)
  const files = fs.readdirSync(dir).filter(isExcelFile)

  const weekFile = findFile(files, '周趋势')
  const cityFile = findFile(files, '城市')
  const channelFile = findFile(files, '渠道')
  const storeFile = files.find((f) => f.includes('门店周期') && !f.includes('渠道'))
  const infoFile = files.find((f) => f.includes('门店信息'))
  const assessFile = files.find((f) => f.includes('考核'))

  if (!weekFile || !cityFile || !storeFile || !channelFile) {
    console.warn('skip incomplete folder', folder)
    continue
  }

  const weekRows = readSheet(path.join(dir, weekFile))
  const cityRows = readSheet(path.join(dir, cityFile)).filter((r) => normCity(r['城市']))
  const storeRows = readSheet(path.join(dir, storeFile)).filter((r) => r['门店'])
  const channelRows = readSheet(path.join(dir, channelFile)).filter((r) => r['门店'] && r['渠道'])
  channelRows.forEach((r) => channelSet.add(String(r['渠道']).trim()))

  // 月包/残周常无「门店信息表」：沿用此前周包的门店→城市映射，避免城市贡献被清空
  const storeCityMap = {}
  if (infoFile) {
    const infoRows = readSheet(path.join(dir, infoFile))
    storeListGlobal = infoRows
      .filter((r) => r['门店名称'] || r['门店'])
      .map((r) => ({
        city: normCity(r['城市'] || ''),
        name: String(r['门店名称'] || r['门店'] || ''),
        shortName: normStoreName(r['门店名称'] || r['门店']),
        status: String(r['营业'] || ''),
        address: String(r['__EMPTY'] || r['地址'] || ''),
      }))
  }
  storeListGlobal.forEach((r) => {
    if (r.shortName && r.city) storeCityMap[r.shortName] = r.city
    const nk = normStoreName(r.name)
    if (nk && r.city) storeCityMap[nk] = r.city
  })

  const daySet = new Set()
  weekRows.forEach((r) => {
    const iso = toIsoDate(r['日期'])
    if (iso) daySet.add(iso)
  })
  storeRows.forEach((r) => {
    const iso = toIsoDate(r['日期'])
    if (iso) daySet.add(iso)
  })
  const days = [...daySet].sort()
  if (!days.length) {
    console.warn('no days in', folder)
    continue
  }

  const isMonthPack = folder.includes('月')
  const weekId = `${days[0]}_${days[days.length - 1]}`
  if (!isMonthPack) {
    // 周口径：周五 → 周四；标签按周五所在月第几周
    const fri = fridayOfWeek(days[0])
    weeks.push({
      id: weekId,
      label: calendarWeekLabel(fri),
      start: fri,
      end: days[days.length - 1],
      days,
    })
  }

  if (assessFile) {
    ingestAssessmentSheet(path.join(dir, assessFile), assessment, isMonthPack ? '' : weekId)
  }

  for (const iso of days) {
    const wDay = weekRows.filter((r) => toIsoDate(r['日期']) === iso)
    const cDay = cityRows.filter((r) => toIsoDate(r['日期']) === iso)
    const sDay = storeRows.filter((r) => toIsoDate(r['日期']) === iso)
    const chDay = channelRows.filter((r) => toIsoDate(r['日期']) === iso)

    const overview = wDay.length ? pickMetrics(wDay[0]) : metricsFromRows(sDay)

    let cities = cDay.map((r) => {
      const m = pickMetrics(r)
      return {
        城市: normCity(r['城市']),
        日期: iso,
        ...Object.fromEntries(
          Object.entries({
            总营业额: m.total_gmv,
            '有效订单金额（实付）': m.paid_amount,
            有效订单量: m.effective_orders,
            有效买家数: m.buyer_cnt,
            '预计毛利(含平台后返)': m.est_profit,
            预计毛利: m.est_profit,
            '毛利率(含平台后返)': m.profit_rate,
            毛利率: m.profit_rate,
            预计线上收入: m.online_income,
            预计线上支出: m.est_expense,
            商品成本: m.purchase_cost,
            营销活动费用: m.marketing_cost,
            '佣金&其他平台费用': m.commission,
            平台配送服务费: m.platform_delivery,
            自配送费用: m.self_delivery,
            推广费用: m.promo_cost,
            平台补贴: m.platform_subsidy,
            平台后返: m.rebate,
            负毛利订单占比: m.neg_profit_order_rate,
            退款率: m.refund_rate,
            退款金额: m.refund_amount,
            退款订单量: m.refund_orders,
            部分退款订单量: m.partial_refund_orders,
            整单退款订单量: m.full_refund_orders,
            售中售后退款比: m.inafter_refund_ratio,
          }),
        ),
      }
    })

    const storeRank = sDay.map((r) => {
      const m = pickMetrics(r)
      const short = normStoreName(r['门店'])
      const city = storeCityMap[short] || ''
      return {
        日期: iso,
        城市名称: city,
        门店名称: String(r['门店']),
        渠道名称: '全部',
        总营业额: m.total_gmv,
        总优惠金额: Math.max(0, m.total_gmv - m.paid_amount),
        用户实付营业额: m.paid_amount,
        用户实付订单量: m.effective_orders,
        交易用户数: m.buyer_cnt,
        预计毛利: m.est_profit,
        预计毛利_不含后返: m.est_profit_raw,
        毛利率: m.profit_rate,
        预计线上收入: m.online_income,
        预计线上支出: m.est_expense,
        采购成本: m.purchase_cost,
        商家自配送费用: m.self_delivery,
        退款订单量: m.refund_orders,
        退款金额: m.refund_amount,
        负毛利订单占比: m.neg_profit_order_rate,
        平台后返: m.rebate,
        营销活动费用: m.marketing_cost,
      }
    })

    // 月包城市表无日期时，按门店实付汇总城市
    if (!cities.length && storeRank.length) {
      const cityAgg = {}
      storeRank.forEach((r) => {
        const city = r['城市名称']
        if (!city) return
        if (!cityAgg[city]) {
          cityAgg[city] = {
            城市: city,
            日期: iso,
            总营业额: 0,
            '有效订单金额（实付）': 0,
            有效订单量: 0,
            有效买家数: 0,
            '预计毛利(含平台后返)': 0,
            预计毛利: 0,
            预计线上收入: 0,
            退款金额: 0,
            退款订单量: 0,
          }
        }
        const t = cityAgg[city]
        t['总营业额'] += toNum(r['总营业额'])
        t['有效订单金额（实付）'] += toNum(r['用户实付营业额'])
        t['有效订单量'] += toNum(r['用户实付订单量'])
        t['有效买家数'] += toNum(r['交易用户数'])
        t['预计毛利(含平台后返)'] += toNum(r['预计毛利'])
        t['预计毛利'] += toNum(r['预计毛利'])
        t['预计线上收入'] += toNum(r['预计线上收入'])
        t['退款金额'] += toNum(r['退款金额'])
        t['退款订单量'] += toNum(r['退款订单量'])
      })
      cities = Object.values(cityAgg).map((t) => ({
        ...t,
        '毛利率(含平台后返)': toNum(t['总营业额']) ? t['预计毛利(含平台后返)'] / t['总营业额'] : 0,
        毛利率: toNum(t['总营业额']) ? t['预计毛利'] / t['总营业额'] : 0,
      }))
    }

    const channelStores = chDay.map((r) => {
      const m = pickMetrics(r)
      const short = normStoreName(r['门店'])
      return {
        日期: iso,
        渠道: String(r['渠道']).trim(),
        城市名称: storeCityMap[short] || '',
        门店名称: String(r['门店']),
        总营业额: m.total_gmv,
        用户实付营业额: m.paid_amount,
        用户实付订单量: m.effective_orders,
        交易用户数: m.buyer_cnt,
        预计毛利: m.est_profit,
        毛利率: m.profit_rate,
        预计线上收入: m.online_income,
        退款订单量: m.refund_orders,
        退款金额: m.refund_amount,
        负毛利订单占比: m.neg_profit_order_rate,
        平台后返: m.rebate,
        营销活动费用: m.marketing_cost,
        商品成本: m.purchase_cost,
        平台配送服务费: m.platform_delivery,
        自配送费用: m.self_delivery,
        '佣金&其他平台费用': m.commission,
        推广费用: m.promo_cost,
        平台补贴: m.platform_subsidy,
      }
    })

    byDay[iso] = {
      overview: {
        ...overview,
        store_cnt: storeListGlobal.filter((s) => s.status === '已营业').length || storeRank.length,
        active_store_cnt: storeRank.filter((r) => toNum(r['用户实付订单量']) > 0).length,
        updated_at: '',
      },
      cities,
      storeRank,
      channelStores,
      storeList: storeListGlobal,
      costs: costFromMetrics(overview),
      reverse: {
        refund_rate: overview?.refund_rate || 0,
        refund_amount: overview?.refund_amount || 0,
        refund_orders: overview?.refund_orders || 0,
        inafter_refund_ratio: overview?.inafter_refund_ratio || 0,
        partial_refund_orders: overview?.partial_refund_orders || 0,
        full_refund_orders: overview?.full_refund_orders || 0,
      },
      weekId: isMonthPack ? fridayOfWeek(iso) : weekId,
    }
  }

  if (isMonthPack) {
    console.log('synced month-pack', folder, 'days', days.length)
    continue
  }

  // 周汇总
  const weekStoreMap = {}
  const weekCityMap = {}
  const weekChannel = []
  days.forEach((iso) => {
    const day = byDay[iso]
    day.storeRank.forEach((r) => {
      const key = normStoreName(r['门店名称'])
      if (!weekStoreMap[key]) {
        weekStoreMap[key] = { ...r, 日期: weekId }
      } else {
        const t = weekStoreMap[key]
        ;[
          '总营业额',
          '总优惠金额',
          '用户实付营业额',
          '用户实付订单量',
          '交易用户数',
          '预计毛利',
          '预计毛利_不含后返',
          '预计线上收入',
          '预计线上支出',
          '采购成本',
          '商家自配送费用',
          '退款订单量',
          '退款金额',
          '平台后返',
          '营销活动费用',
        ].forEach((k) => {
          t[k] = toNum(t[k]) + toNum(r[k])
        })
      }
    })
    day.cities.forEach((r) => {
      const key = r['城市']
      if (!weekCityMap[key]) weekCityMap[key] = { ...r, 日期: weekId }
      else {
        const t = weekCityMap[key]
        Object.keys(r).forEach((k) => {
          if (k === '城市' || k === '日期' || typeof r[k] === 'string') return
          t[k] = toNum(t[k]) + toNum(r[k])
        })
      }
    })
    weekChannel.push(...day.channelStores)
  })

  Object.values(weekStoreMap).forEach((t) => {
    t['毛利率'] = toNum(t['总营业额']) ? toNum(t['预计毛利']) / toNum(t['总营业额']) : 0
  })
  Object.values(weekCityMap).forEach((t) => {
    t['毛利率'] = toNum(t['总营业额']) ? toNum(t['预计毛利(含平台后返)'] || t['预计毛利']) / toNum(t['总营业额']) : 0
    t['毛利率(含平台后返)'] = t['毛利率']
  })

  // 渠道周汇总按 渠道+门店
  const chWeekMap = {}
  weekChannel.forEach((r) => {
    const key = `${r['渠道']}__${normStoreName(r['门店名称'])}`
    if (!chWeekMap[key]) chWeekMap[key] = { ...r, 日期: weekId }
    else {
      const t = chWeekMap[key]
      ;[
        '总营业额',
        '用户实付营业额',
        '用户实付订单量',
        '交易用户数',
        '预计毛利',
        '预计线上收入',
        '退款订单量',
        '退款金额',
        '平台后返',
        '营销活动费用',
        '商品成本',
        '平台配送服务费',
        '自配送费用',
        '佣金&其他平台费用',
        '推广费用',
        '平台补贴',
      ].forEach((k) => {
        t[k] = toNum(t[k]) + toNum(r[k])
      })
    }
  })
  Object.values(chWeekMap).forEach((t) => {
    t['毛利率'] = toNum(t['总营业额']) ? toNum(t['预计毛利']) / toNum(t['总营业额']) : 0
  })

  const weekOverview = metricsFromRows(
    days.flatMap((iso) => {
      // reconstruct raw-like from overview
      const ov = byDay[iso].overview
      return [
        {
          总营业额: ov.total_gmv,
          '有效订单金额（实付）': ov.paid_amount,
          有效订单量: ov.effective_orders,
          有效买家数: ov.buyer_cnt,
          '预计毛利(含平台后返)': ov.est_profit,
          预计毛利: ov.est_profit_raw,
          '毛利率(含平台后返)': ov.profit_rate,
          毛利率: ov.profit_rate_raw,
          平台后返: ov.rebate,
          预计线上收入: ov.online_income,
          预计线上支出: ov.est_expense,
          商品成本: ov.purchase_cost,
          营销活动费用: ov.marketing_cost,
          '佣金&其他平台费用': ov.commission,
          平台配送服务费: ov.platform_delivery,
          自配送费用: ov.self_delivery,
          推广费用: ov.promo_cost,
          平台补贴: ov.platform_subsidy,
          负毛利订单占比: ov.neg_profit_order_rate,
          商家补贴率: ov.merchant_subsidy_rate,
          退款率: ov.refund_rate,
          退款金额: ov.refund_amount,
          退款订单量: ov.refund_orders,
          取消订单量: ov.cancel_orders,
          部分退款订单量: ov.partial_refund_orders,
          整单退款订单量: ov.full_refund_orders,
          售中售后退款比: ov.inafter_refund_ratio,
          '有效客单价（实付）': ov.arpu,
        },
      ]
    }),
  )

  byDay[`W:${weekId}`] = {
    overview: {
      ...weekOverview,
      store_cnt: storeListGlobal.filter((s) => s.status === '已营业').length,
      active_store_cnt: Object.values(weekStoreMap).filter((r) => toNum(r['用户实付订单量']) > 0).length,
    },
    cities: Object.values(weekCityMap),
    storeRank: Object.values(weekStoreMap),
    channelStores: Object.values(chWeekMap),
    storeList: storeListGlobal,
    costs: costFromMetrics(weekOverview),
    reverse: {
      refund_rate: weekOverview?.refund_rate || 0,
      refund_amount: weekOverview?.refund_amount || 0,
      refund_orders: weekOverview?.refund_orders || 0,
      inafter_refund_ratio: weekOverview?.inafter_refund_ratio || 0,
      partial_refund_orders: weekOverview?.partial_refund_orders || 0,
      full_refund_orders: weekOverview?.full_refund_orders || 0,
    },
    weekId,
  }

  console.log('synced week', folder, 'days', days.length, 'weekId', weekId)
}

/** 按周五→周四重建周列表与 W: 汇总（纳入月初补数） */
Object.keys(byDay)
  .filter((k) => k.startsWith('W:'))
  .forEach((k) => {
    delete byDay[k]
  })
weeks.length = 0

{
  const dayKeys = Object.keys(byDay)
    .filter((k) => !k.startsWith('M:'))
    .sort()
  const byFri = {}
  dayKeys.forEach((iso) => {
    const fri = fridayOfWeek(iso)
    if (!byFri[fri]) byFri[fri] = []
    byFri[fri].push(iso)
  })
  for (const fri of Object.keys(byFri).sort()) {
    const days = byFri[fri].sort()
    const weekId = `${fri}_${days[days.length - 1]}`
    weeks.push({
      id: weekId,
      label: calendarWeekLabel(fri),
      start: fri,
      end: days[days.length - 1],
      days,
    })

    const weekStoreMap = {}
    const weekCityMap = {}
    const weekChannel = []
    days.forEach((iso) => {
      const day = byDay[iso]
      if (!day) return
      day.storeRank.forEach((r) => {
        const key = normStoreName(r['门店名称'])
        if (!weekStoreMap[key]) weekStoreMap[key] = { ...r, 日期: weekId }
        else {
          const t = weekStoreMap[key]
          ;[
            '总营业额',
            '总优惠金额',
            '用户实付营业额',
            '用户实付订单量',
            '交易用户数',
            '预计毛利',
            '预计毛利_不含后返',
            '预计线上收入',
            '预计线上支出',
            '采购成本',
            '商家自配送费用',
            '退款订单量',
            '退款金额',
            '平台后返',
            '营销活动费用',
          ].forEach((k) => {
            t[k] = toNum(t[k]) + toNum(r[k])
          })
        }
      })
      day.cities.forEach((r) => {
        const key = r['城市']
        if (!key) return
        if (!weekCityMap[key]) weekCityMap[key] = { ...r, 日期: weekId }
        else {
          const t = weekCityMap[key]
          Object.keys(r).forEach((k) => {
            if (k === '城市' || k === '日期' || typeof r[k] === 'string') return
            t[k] = toNum(t[k]) + toNum(r[k])
          })
        }
      })
      weekChannel.push(...(day.channelStores || []))
    })
    Object.values(weekStoreMap).forEach((t) => {
      t['毛利率'] = toNum(t['总营业额']) ? toNum(t['预计毛利']) / toNum(t['总营业额']) : 0
    })
    Object.values(weekCityMap).forEach((t) => {
      t['毛利率'] = toNum(t['总营业额']) ? toNum(t['预计毛利(含平台后返)'] || t['预计毛利']) / toNum(t['总营业额']) : 0
      t['毛利率(含平台后返)'] = t['毛利率']
    })
    const chWeekMap = {}
    weekChannel.forEach((r) => {
      const key = `${r['渠道']}__${normStoreName(r['门店名称'])}`
      if (!chWeekMap[key]) chWeekMap[key] = { ...r, 日期: weekId }
      else {
        const t = chWeekMap[key]
        ;[
          '总营业额',
          '用户实付营业额',
          '用户实付订单量',
          '交易用户数',
          '预计毛利',
          '预计线上收入',
          '退款订单量',
          '退款金额',
          '平台后返',
          '营销活动费用',
          '商品成本',
          '平台配送服务费',
          '自配送费用',
          '佣金&其他平台费用',
          '推广费用',
          '平台补贴',
        ].forEach((k) => {
          t[k] = toNum(t[k]) + toNum(r[k])
        })
      }
    })
    Object.values(chWeekMap).forEach((t) => {
      t['毛利率'] = toNum(t['总营业额']) ? toNum(t['预计毛利']) / toNum(t['总营业额']) : 0
    })
    const weekOverview = metricsFromRows(
      days.flatMap((iso) => {
        const ov = byDay[iso]?.overview
        if (!ov) return []
        return [
          {
            总营业额: ov.total_gmv,
            '有效订单金额（实付）': ov.paid_amount,
            有效订单量: ov.effective_orders,
            有效买家数: ov.buyer_cnt,
            '预计毛利(含平台后返)': ov.est_profit,
            预计毛利: ov.est_profit_raw,
            '毛利率(含平台后返)': ov.profit_rate,
            毛利率: ov.profit_rate_raw,
            平台后返: ov.rebate,
            预计线上收入: ov.online_income,
            预计线上支出: ov.est_expense,
            商品成本: ov.purchase_cost,
            营销活动费用: ov.marketing_cost,
            '佣金&其他平台费用': ov.commission,
            平台配送服务费: ov.platform_delivery,
            自配送费用: ov.self_delivery,
            推广费用: ov.promo_cost,
            平台补贴: ov.platform_subsidy,
            负毛利订单占比: ov.neg_profit_order_rate,
            商家补贴率: ov.merchant_subsidy_rate,
            退款率: ov.refund_rate,
            退款金额: ov.refund_amount,
            退款订单量: ov.refund_orders,
            取消订单量: ov.cancel_orders,
            部分退款订单量: ov.partial_refund_orders,
            整单退款订单量: ov.full_refund_orders,
            售中售后退款比: ov.inafter_refund_ratio,
            '有效客单价（实付）': ov.arpu,
          },
        ]
      }),
    )
    byDay[`W:${weekId}`] = {
      overview: {
        ...weekOverview,
        store_cnt: storeListGlobal.filter((s) => s.status === '已营业').length,
        active_store_cnt: Object.values(weekStoreMap).filter((r) => toNum(r['用户实付订单量']) > 0).length,
      },
      cities: Object.values(weekCityMap),
      storeRank: Object.values(weekStoreMap),
      channelStores: Object.values(chWeekMap),
      storeList: storeListGlobal,
      costs: costFromMetrics(weekOverview),
      reverse: {
        refund_rate: weekOverview?.refund_rate || 0,
        refund_amount: weekOverview?.refund_amount || 0,
        refund_orders: weekOverview?.refund_orders || 0,
        inafter_refund_ratio: weekOverview?.inafter_refund_ratio || 0,
        partial_refund_orders: weekOverview?.partial_refund_orders || 0,
        full_refund_orders: weekOverview?.full_refund_orders || 0,
      },
      weekId,
    }
    console.log('rebuilt week', weekId, 'label', calendarWeekLabel(fri), 'days', days.length)
  }
}

const allDays = Object.keys(byDay)
  .filter((k) => !k.startsWith('W:') && !k.startsWith('M:'))
  .sort()

/** 按自然月汇总（从日键聚合） */
const months = []
const daysByMonth = {}
allDays.forEach((iso) => {
  const ym = iso.slice(0, 7)
  if (!daysByMonth[ym]) daysByMonth[ym] = []
  daysByMonth[ym].push(iso)
})
const STORE_SUM_KEYS = [
  '总营业额',
  '总优惠金额',
  '用户实付营业额',
  '用户实付订单量',
  '交易用户数',
  '预计毛利',
  '预计毛利_不含后返',
  '预计线上收入',
  '预计线上支出',
  '采购成本',
  '商家自配送费用',
  '退款订单量',
  '退款金额',
  '平台后返',
  '营销活动费用',
  '商品成本',
  '平台配送服务费',
  '自配送费用',
  '佣金&其他平台费用',
  '推广费用',
  '平台补贴',
]
for (const ym of Object.keys(daysByMonth).sort()) {
  const mDays = daysByMonth[ym].sort()
  const [y, mo] = ym.split('-')
  months.push({
    id: ym,
    label: `${Number(y)}年${Number(mo)}月`,
    start: mDays[0],
    end: mDays[mDays.length - 1],
    days: mDays,
  })
  const storeMap = {}
  const cityMap = {}
  const chMap = {}
  let storeListMonth = []
  mDays.forEach((iso) => {
    const day = byDay[iso]
    if (!day) return
    day.storeRank.forEach((r) => {
      const key = normStoreName(r['门店名称'])
      if (!storeMap[key]) storeMap[key] = { ...r, 日期: ym }
      else {
        const t = storeMap[key]
        STORE_SUM_KEYS.forEach((k) => {
          t[k] = toNum(t[k]) + toNum(r[k])
        })
      }
    })
    day.cities.forEach((r) => {
      const key = r['城市']
      if (!key) return
      if (!cityMap[key]) cityMap[key] = { ...r, 日期: ym }
      else {
        const t = cityMap[key]
        Object.keys(r).forEach((k) => {
          if (k === '城市' || k === '日期' || typeof r[k] === 'string') return
          t[k] = toNum(t[k]) + toNum(r[k])
        })
      }
    })
    ;(day.channelStores || []).forEach((r) => {
      const key = `${r['渠道']}__${normStoreName(r['门店名称'])}`
      if (!chMap[key]) chMap[key] = { ...r, 日期: ym }
      else {
        const t = chMap[key]
        STORE_SUM_KEYS.forEach((k) => {
          t[k] = toNum(t[k]) + toNum(r[k])
        })
      }
    })
    if (day.storeList?.length) storeListMonth = day.storeList
  })
  Object.values(storeMap).forEach((t) => {
    t['毛利率'] = toNum(t['总营业额']) ? toNum(t['预计毛利']) / toNum(t['总营业额']) : 0
  })
  Object.values(cityMap).forEach((t) => {
    t['毛利率'] = toNum(t['总营业额'])
      ? toNum(t['预计毛利(含平台后返)'] || t['预计毛利']) / toNum(t['总营业额'])
      : 0
    t['毛利率(含平台后返)'] = t['毛利率']
  })
  Object.values(chMap).forEach((t) => {
    t['毛利率'] = toNum(t['总营业额']) ? toNum(t['预计毛利']) / toNum(t['总营业额']) : 0
  })
  const monthOverview = metricsFromRows(
    mDays.flatMap((iso) => {
      const ov = byDay[iso]?.overview
      if (!ov) return []
      return [
        {
          总营业额: ov.total_gmv,
          '有效订单金额（实付）': ov.paid_amount,
          有效订单量: ov.effective_orders,
          有效买家数: ov.buyer_cnt,
          '预计毛利(含平台后返)': ov.est_profit,
          预计毛利: ov.est_profit_raw,
          '毛利率(含平台后返)': ov.profit_rate,
          毛利率: ov.profit_rate_raw,
          平台后返: ov.rebate,
          预计线上收入: ov.online_income,
          预计线上支出: ov.est_expense,
          商品成本: ov.purchase_cost,
          营销活动费用: ov.marketing_cost,
          '佣金&其他平台费用': ov.commission,
          平台配送服务费: ov.platform_delivery,
          自配送费用: ov.self_delivery,
          推广费用: ov.promo_cost,
          平台补贴: ov.platform_subsidy,
          负毛利订单占比: ov.neg_profit_order_rate,
          商家补贴率: ov.merchant_subsidy_rate,
          退款率: ov.refund_rate,
          退款金额: ov.refund_amount,
          退款订单量: ov.refund_orders,
          取消订单量: ov.cancel_orders,
          部分退款订单量: ov.partial_refund_orders,
          整单退款订单量: ov.full_refund_orders,
          售中售后退款比: ov.inafter_refund_ratio,
          '有效客单价（实付）': ov.arpu,
        },
      ]
    }),
  )
  byDay[`M:${ym}`] = {
    overview: {
      ...monthOverview,
      store_cnt: storeListMonth.filter((s) => s.status === '已营业').length,
      active_store_cnt: Object.values(storeMap).filter((r) => toNum(r['用户实付订单量']) > 0).length,
    },
    cities: Object.values(cityMap),
    storeRank: Object.values(storeMap),
    channelStores: Object.values(chMap),
    storeList: storeListMonth,
    costs: costFromMetrics(monthOverview),
    reverse: {
      refund_rate: monthOverview?.refund_rate || 0,
      refund_amount: monthOverview?.refund_amount || 0,
      refund_orders: monthOverview?.refund_orders || 0,
      inafter_refund_ratio: monthOverview?.inafter_refund_ratio || 0,
      partial_refund_orders: monthOverview?.partial_refund_orders || 0,
      full_refund_orders: monthOverview?.full_refund_orders || 0,
    },
    monthId: ym,
  }
  console.log('synced month', ym, 'days', mDays.length)
}

// 兼容旧结构：storeRank / cities / overview 按 dataKey
const storeRank = {}
const cities = {}
const overview = {}
const costs = {}
const reverse = {}
const storeList = {}
const channelStores = {}
const geo = {}

const cityCoords = {
  杭州市: [120.1551, 30.2741],
  金华市: [119.6496, 29.0895],
  苏州市: [120.6195, 31.2994],
  上海市: [121.4737, 31.2304],
  无锡市: [120.3119, 31.4912],
  郑州市: [113.6254, 34.7466],
  武汉市: [114.3055, 30.5928],
  南通市: [120.8943, 32.0098],
  济南市: [117.1205, 36.6519],
}

function buildGeo(rankRows, listRows) {
  const cover = {}
  listRows.forEach((r) => {
    if (!r.city) return
    cover[r.city] = (cover[r.city] || 0) + 1
  })
  const map = {}
  rankRows.forEach((r) => {
    const city = r['城市名称']
    if (!city) return
    if (!map[city]) {
      map[city] = { city, city_code: '', paid_amount: 0, est_profit: 0, paid_orders: 0, store_cnt: 0 }
    }
    map[city].paid_amount += toNum(r['用户实付营业额'])
    map[city].est_profit += toNum(r['预计毛利'])
    map[city].paid_orders += toNum(r['用户实付订单量'])
    map[city].store_cnt += 1
  })
  Object.entries(cover).forEach(([city, cnt]) => {
    if (!map[city]) {
      map[city] = { city, city_code: '', paid_amount: 0, est_profit: 0, paid_orders: 0, store_cnt: cnt }
    } else map[city].store_cnt = cnt
  })
  return Object.values(map).map((c) => ({
    ...c,
    profit_rate: c.paid_amount ? c.est_profit / c.paid_amount : 0,
    lng: (cityCoords[c.city] || [116.4, 39.9])[0],
    lat: (cityCoords[c.city] || [116.4, 39.9])[1],
  }))
}

for (const key of Object.keys(byDay)) {
  const block = byDay[key]
  storeRank[key] = block.storeRank
  cities[key] = block.cities
  overview[key] = block.overview
  costs[key] = block.costs
  reverse[key] = block.reverse
  storeList[key] = block.storeList
  channelStores[key] = block.channelStores
  geo[key] = buildGeo(block.storeRank, block.storeList)
}

/** 品类分析导出（数据源根目录）：overall ≈ 两周合计；byStore 可筛门店/城市 */
function mapCategoryRow(r, withStore = false) {
  const row = {
    name: String(r['一级品类'] || '').trim(),
    total_gmv: toNum(r['商品总销售额']),
    sales: toNum(r['商品销售额']),
    income: toNum(r['销售收入']),
    orders: toNum(r['有效订单量']),
    qty: toNum(r['总商品销量']),
    aov: toNum(r['商品客单价']),
    profit: toNum(r['商品毛利额']),
    profit_rate: toNum(r['商品毛利率']),
    active_rate: toNum(r['商品动销率']),
    refund_amount: toNum(r['商品退款金额']),
    refund_orders: toNum(r['退款订单量']),
    sku_online: toNum(r['在售商品数']),
    sku_active: toNum(r['动销商品数量']),
    wow_rate: toNum(r['商品总销售额_自定义对比_比率']),
  }
  if (withStore) {
    const full = String(r['门店'] || '')
    row.store = full
    row.shortName = normStoreName(full)
  }
  return row
}

function loadCategoryBlock() {
  const files = fs
    .readdirSync(sourceRoot)
    .filter((f) => f.includes('品类分析') && f.endsWith('.xlsx') && !f.startsWith('~$'))
    .sort()
  if (!files.length) return null

  let overall = []
  let byStore = []
  for (const f of files) {
    const rows = readSheet(path.join(sourceRoot, f))
    if (!rows.length) continue
    if (Object.prototype.hasOwnProperty.call(rows[0], '门店')) {
      byStore = rows.filter((r) => r['一级品类'] && r['门店']).map((r) => mapCategoryRow(r, true))
    } else {
      overall = rows.filter((r) => r['一级品类']).map((r) => mapCategoryRow(r, false))
    }
  }
  if (!overall.length && !byStore.length) return null

  const start = allDays[0] || weeks[0]?.start || ''
  const end = allDays[allDays.length - 1] || weeks[weeks.length - 1]?.end || ''
  return {
    period: {
      start,
      end,
      label: start && end ? `${isoToLabel(start)}-${isoToLabel(end)}` : '',
    },
    overall: overall.sort((a, b) => b.total_gmv - a.total_gmv),
    byStore,
  }
}

const category = loadCategoryBlock()
if (category) {
  console.log(
    'category overall',
    category.overall.length,
    'byStore',
    category.byStore.length,
    'period',
    category.period.label,
  )
} else {
  console.warn('no category export found in 数据源/')
}

const payload = {
  schemaVersion: 2,
  primaryDate: allDays[allDays.length - 1] || '',
  compareDate: allDays.length > 1 ? allDays[allDays.length - 2] : '',
  days: allDays,
  weeks,
  months,
  channels: ['全部', ...[...channelSet].sort()],
  overview,
  cities,
  storeRank,
  storeList,
  channelStores,
  geo,
  costs,
  reverse,
  assessment,
  category,
  updated_at: new Date().toISOString().slice(0, 19).replace('T', ' '),
}

const out = path.join(root, 'web', 'src', 'data', 'dashboard.json')
const tmp = `${out}.tmp`
fs.writeFileSync(tmp, JSON.stringify(payload))
try {
  fs.renameSync(tmp, out)
} catch {
  fs.copyFileSync(tmp, out)
  try {
    fs.unlinkSync(tmp)
  } catch {
    /* ignore */
  }
}
console.log('synced ->', out)
console.log(
  'days',
  allDays.length,
  'weeks',
  weeks.length,
  'months',
  months.length,
  'channels',
  payload.channels.join(','),
)
