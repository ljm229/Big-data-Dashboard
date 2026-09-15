/**
 * 只读导入「订单毛利导出」→ web/src/data/orderMarginData.json
 * 导出含全量订单；负毛利结构按预计毛利 < 0 归类；＞3 元负毛利 = 预计毛利 ≤ -3。
 * 同步按日门店渠道汇总：应收/预计毛利/营销/配送/平台费/退款单毛利，供利润变化桥。
 * 不写回 Excel，不采集、不入库。
 */
import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import xlsx from 'xlsx'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SOURCE = path.join(ROOT, '数据源1', '翱象')
const OUTPUT = path.join(ROOT, 'web', 'src', 'data', 'orderMarginData.json')
const TMP = `${OUTPUT}.tmp`

const REASON_KEYS = ['商品毛利为负', '营销折扣过高', '配送成本过高', '平台费用占比高', '其他']

function norm(s) {
  return String(s || '')
    .replace(/\s+/g, '')
    .replace(/（/g, '(')
    .replace(/）/g, ')')
}

function channelOf(s) {
  const t = String(s || '').trim()
  return t === 'POS' ? 'POS渠道' : t
}

function iso(v) {
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    const y = v.getFullYear()
    const m = String(v.getMonth() + 1).padStart(2, '0')
    const d = String(v.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }
  const text = String(v || '').trim()
  if (/^\d{8}$/.test(text)) return `${text.slice(0, 4)}-${text.slice(4, 6)}-${text.slice(6, 8)}`
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10)
  return ''
}

function num(v) {
  if (v == null || v === '') return null
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  const n = Number(String(v).trim().replace(/,/g, ''))
  return Number.isFinite(n) ? n : null
}

function n0(v) {
  return num(v) ?? 0
}

function money(v) {
  return Math.round(v * 100) / 100
}

function pickSourceFile() {
  if (!existsSync(SOURCE)) throw new Error(`缺少目录: ${SOURCE}`)
  const files = readdirSync(SOURCE).filter(
    (f) => f.includes('订单毛利') && f.endsWith('.xlsx') && !f.startsWith('~$'),
  )
  if (!files.length) throw new Error('缺少源文件: 翱象/*订单毛利*.xlsx')
  return files
    .map((name) => {
      const full = path.join(SOURCE, name)
      return { name, full, mtime: statSync(full).mtimeMs }
    })
    .sort((a, b) => b.mtime - a.mtime || b.name.localeCompare(a.name))[0]
}

function classifyReason(row) {
  const product = n0(row['应收商品总额']) + n0(row['商家商品优惠']) + n0(row['商品采购成本'])
  const marketing = n0(row['商家商品优惠']) + n0(row['商家整单优惠'])
  const delivery =
    n0(row['应收配送费']) + n0(row['配送费优惠']) + n0(row['商家自配送成本']) + n0(row['平台配送服务费'])
  const platform = n0(row['佣金']) + n0(row['其他平台费']) + n0(row['平台配送服务费'])
  const parts = [
    ['商品毛利为负', product],
    ['营销折扣过高', marketing],
    ['配送成本过高', delivery],
    ['平台费用占比高', platform],
  ].sort((a, b) => a[1] - b[1])
  return parts[0][1] < 0 ? parts[0][0] : '其他'
}

function emptyReasons() {
  return Object.fromEntries(REASON_KEYS.map((k) => [k, { count: 0, amount: 0 }]))
}

function hasRefund(row) {
  const v = row['退款单号']
  if (v == null || v === '') return false
  return String(v).trim() !== ''
}

function main() {
  const src = pickSourceFile()
  const buf = readFileSync(src.full)
  const sha256 = createHash('sha256').update(buf).digest('hex')
  const wb = xlsx.read(buf, { type: 'buffer', cellDates: true })
  const sheetName = wb.SheetNames.find((n) => n.includes('订单毛利')) || wb.SheetNames[0]
  const rows = xlsx.utils.sheet_to_json(wb.Sheets[sheetName], { defval: null })
  if (!rows.length) throw new Error(`${src.name} 无数据行`)

  const required = ['门店名称', '渠道名称', '创建时间', '预计毛利']
  const sampleKeys = Object.keys(rows[0] || {})
  const missing = required.filter((k) => !sampleKeys.includes(k))
  if (missing.length) throw new Error(`${src.name} 缺少列: ${missing.join(', ')}`)

  const map = new Map()
  let raw = 0
  let skipped = 0
  let positiveOrders = 0
  let negativeOrders = 0
  let refundOrders = 0
  const channelTotals = {}
  const channelNeg = {}

  for (const row of rows) {
    raw++
    const date = iso(row['创建时间'] ?? row['订单完成时间'])
    const store = norm(row['门店名称'])
    const channel = channelOf(row['渠道名称'])
    const profit = num(row['预计毛利'])
    if (!date || !store || !channel || profit == null) {
      skipped++
      continue
    }
    const key = `${date}|${store}|${channel}`
    let fact = map.get(key)
    if (!fact) {
      fact = {
        date,
        store,
        storeCode: String(row['门店编码'] || '').trim(),
        channel,
        orders: 0,
        negOrders: 0,
        negGt3: 0,
        loss: 0,
        revenue: 0,
        profitSum: 0,
        marketing: 0,
        delivery: 0,
        platform: 0,
        refundOrders: 0,
        refundProfit: 0,
        reasons: emptyReasons(),
      }
      map.set(key, fact)
    }
    fact.orders++
    fact.revenue += n0(row['应收'])
    fact.profitSum += profit
    fact.marketing += n0(row['商家商品优惠']) + n0(row['商家整单优惠']) + n0(row['配送费优惠'])
    fact.delivery += n0(row['应收配送费']) + n0(row['商家自配送成本']) + n0(row['平台配送服务费'])
    fact.platform += n0(row['佣金']) + n0(row['其他平台费'])
    channelTotals[channel] = (channelTotals[channel] || 0) + 1
    if (hasRefund(row)) {
      refundOrders++
      fact.refundOrders++
      fact.refundProfit += profit
    }
    if (profit < 0) {
      negativeOrders++
      fact.negOrders++
      fact.loss += profit
      if (profit <= -3) fact.negGt3++
      const reason = classifyReason(row)
      fact.reasons[reason].count++
      fact.reasons[reason].amount += profit
      channelNeg[channel] = (channelNeg[channel] || 0) + 1
    } else {
      positiveOrders++
    }
  }

  const facts = [...map.values()]
    .map((f) => ({
      ...f,
      loss: money(f.loss),
      revenue: money(f.revenue),
      profitSum: money(f.profitSum),
      marketing: money(f.marketing),
      delivery: money(f.delivery),
      platform: money(f.platform),
      refundProfit: money(f.refundProfit),
      reasons: Object.fromEntries(
        REASON_KEYS.map((k) => [
          k,
          {
            count: f.reasons[k].count,
            amount: money(f.reasons[k].amount),
          },
        ]),
      ),
    }))
    .sort((a, b) => a.date.localeCompare(b.date) || a.store.localeCompare(b.store) || a.channel.localeCompare(b.channel))

  const dates = [...new Set(facts.map((f) => f.date))].sort()
  const payload = {
    generatedAt: new Date().toISOString(),
    source: {
      path: path.relative(path.join(ROOT, '数据源1'), src.full).replace(/\\/g, '/'),
      sheet: sheetName,
      sha256,
      note: '全量订单；负毛利结构按预计毛利<0；＞3元=预计毛利≤-3；变化桥字段=应收/预计毛利/营销/配送/平台费/退款单毛利。',
    },
    reasonKeys: REASON_KEYS,
    stats: {
      rawRows: raw,
      skipped,
      positiveOrders,
      negativeOrders,
      refundOrders,
      factRows: facts.length,
      orderRows: facts.reduce((a, f) => a + f.orders, 0),
      negOrderRows: facts.reduce((a, f) => a + f.negOrders, 0),
      negGt3: facts.reduce((a, f) => a + f.negGt3, 0),
      loss: money(facts.reduce((a, f) => a + f.loss, 0)),
      revenue: money(facts.reduce((a, f) => a + f.revenue, 0)),
      profitSum: money(facts.reduce((a, f) => a + f.profitSum, 0)),
      dateFrom: dates[0] || null,
      dateTo: dates[dates.length - 1] || null,
      channels: channelTotals,
      channelNeg,
    },
    facts,
  }

  writeFileSync(TMP, `${JSON.stringify(payload)}\n`, 'utf8')
  renameSync(TMP, OUTPUT)
  console.log(
    JSON.stringify(
      {
        ok: true,
        output: path.relative(ROOT, OUTPUT).replace(/\\/g, '/'),
        ...payload.stats,
        sha256: sha256.slice(0, 12),
      },
      null,
      2,
    ),
  )
}

try {
  main()
} catch (err) {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
}
