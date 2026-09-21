/** 同步 翱象/盈亏分析PC-门店维度 -> web/web/src/data/profitPcData.json（覆盖式） */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import XLSX from 'xlsx'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dir = path.join(root, '数据源', '翱象')
const file = fs.readdirSync(dir).filter(n => n.includes('盈亏分析PC') && n.endsWith('.xlsx')).sort().at(-1)
if (!file) throw new Error('找不到盈亏PC文件')
const wb = XLSX.readFile(path.join(dir, file), { cellDates: true })
const rows = XLSX.utils.sheet_to_json(wb.Sheets['data'] || wb.Sheets[wb.SheetNames[0]], { defval: '' })
const iso = v => {
  if (v instanceof Date && !isNaN(v)) return `${v.getFullYear()}-${String(v.getMonth()+1).padStart(2,'0')}-${String(v.getDate()).padStart(2,'0')}`
  const s = String(v ?? '').trim()
  if (/^\d{8}$/.test(s)) return `${s.slice(0,4)}-${s.slice(4,6)}-${s.slice(6,8)}`
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0,10)
  return ''
}
const num = v => {
  if (v == null || v === '') return null
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  const s = String(v).trim().replace(/,/g, '')
  if (!s) return null
  if (s.endsWith('%')) { const n = parseFloat(s); return Number.isFinite(n) ? n/100 : null }
  const n = Number(s); return Number.isFinite(n) ? n : null
}
const facts = []
for (const r of rows) {
  const date = iso(r['日期'])
  const store = String(r['门店/门店'] || '').trim()
  if (!date || !store || /模板/.test(store)) continue
  facts.push({
    date, store,
    orders: num(r['经营指标/有效订单量']),
    turnover: num(r['经营指标/总营业额']),
    paid: num(r['经营指标/有效订单金额（实付）']),
    subsidyRateSrc: num(r['经营指标/商品补贴率']),
    profit: num(r['净利/净利润']),
    profitRateSrc: num(r['净利/利润率']),
    incomeTotal: num(r['收入/总收入']),
    incomes: {
      goodsOriginal: num(r['收入/商品原价']), delivery: num(r['收入/应收配送费']),
      packaging: num(r['收入/包装费原价']), marketing: num(r['收入/营销活动费用']),
      addrChange: num(r['收入/地址变更费']), other: num(r['收入/其他收入']),
      salesOrder: num(r['收入/销售开单收入']),
    },
    expenseTotal: num(r['支出/总支出']),
    expenses: {
      goodsCost: num(r['支出/商品成本']), offlineGoods: num(r['支出/线下销售商品成本支出']),
      selfDelivery: num(r['支出/自配送费用']), platformDelivery: num(r['支出/平台配送服务费']),
      commission: num(r['支出/佣金']), donation: num(r['支出/公益捐款']),
      labor: num(r['支出/人力成本']), utilities: num(r['支出/水电杂项']),
      rent: num(r['支出/房租物业']), other: num(r['支出/其他支出']),
      promotion: num(r['支出/推广费用']),
    },
  })
}
const out = path.join(root, 'web', 'web', 'src', 'data', 'profitPcData.json')
fs.mkdirSync(path.dirname(out), { recursive: true })
fs.writeFileSync(out, JSON.stringify({ generatedAt: new Date().toISOString(), source: file, facts }, null, 0))
const ds = [...new Set(facts.map(f => f.date))].sort()
console.log(JSON.stringify({ file, facts: facts.length, from: ds[0], to: ds.at(-1), dates: ds }, null, 2))
