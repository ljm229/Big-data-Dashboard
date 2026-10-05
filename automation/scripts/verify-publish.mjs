import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import mysql from 'mysql2/promise'

const root = path.resolve('..')
const getArg = (name) => process.argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3) || ''
const date = getArg('date')
const mode = getArg('mode') || 'daily'
if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('必须指定有效的 --date=YYYY-MM-DD')

const env = {}
for (const line of fs.readFileSync(path.join(process.cwd(), '.env'), 'utf8').split(/\r?\n/)) {
  const match = line.match(/^\s*([A-Z_]+)=(.*)\s*$/)
  if (match) env[match[1]] = match[2].trim()
}
const db = await mysql.createConnection({
  host: env.DB_HOST || '127.0.0.1',
  port: Number(env.DB_PORT || 3306),
  user: env.DB_USER || 'root',
  password: env.DB_PASSWORD || '',
  database: env.DB_NAME || 'dashboard',
  dateStrings: true,
})

try {
  const required = [
    ['fact_ax_business_daily', '业务经营'],
    ['fact_traffic_daily', '流量'],
    ['fact_product_store_daily', '商品'],
    ['fact_ax_profit_store', '盈亏'],
    ['fact_store_quality_daily', '门店质量'],
  ]
  const counts = {}
  for (const [table, label] of (mode === 'daily' ? required : required.slice(0, 1))) {
    const [[row]] = await db.query(`SELECT COUNT(*) count FROM \`${table}\` WHERE biz_date=?`, [date])
    counts[table] = Number(row.count)
    if (!counts[table]) throw new Error(`${label}在${date}没有事实明细`)
  }
  const [[business]] = await db.query(
    `SELECT COUNT(*) row_count,
      SUM(CASE WHEN CAST(JSON_UNQUOTE(JSON_EXTRACT(metrics, '$."有效订单量"')) AS DECIMAL(18,2)) > 0 THEN 1 ELSE 0 END) order_rows,
      SUM(CASE WHEN CAST(JSON_UNQUOTE(JSON_EXTRACT(metrics, '$."有效订单金额（实付）"')) AS DECIMAL(18,2)) > 0 THEN 1 ELSE 0 END) paid_rows
     FROM fact_ax_business_daily WHERE biz_date=?`, [date],
  )
  if (!Number(business.order_rows) || !Number(business.paid_rows)) {
    throw new Error(`业务指标校验失败：${date} 有 ${business.row_count} 行，但订单/实付非零行分别为 ${business.order_rows}/${business.paid_rows}`)
  }

  const dataDir = path.join(root, 'web', 'src', 'data')
  const files = ['source1.json', 'trafficData.json', 'costData.json', 'profitPcData.json', 'orderMarginData.json', 'riskData.json', 'dashboard.json']
  const generatedAt = new Set()
  for (const file of files) {
    const filePath = path.join(dataDir, file)
    const payload = JSON.parse(fs.readFileSync(filePath, 'utf8'))
    if (fs.statSync(filePath).size < 3) throw new Error(`${file} 为空`)
    if (!payload.generatedAt) throw new Error(`${file} 缺少 generatedAt`)
    generatedAt.add(payload.generatedAt)
    if (file === 'source1.json' && !payload.days?.includes(date)) throw new Error(`source1.json 不含业务日期 ${date}`)
    if (file === 'dashboard.json' && !payload.days?.includes(date)) throw new Error(`dashboard.json 不含业务日期 ${date}`)
    if (file === 'source1.json' && !payload.facts?.some((fact) => fact.date === date && Number(fact.orders) > 0 && Number(fact.paid) > 0)) {
      throw new Error(`source1.json 在 ${date} 没有有效订单和实付事实`)
    }
  }
  if (generatedAt.size !== 1) throw new Error(`JSON 生成版本不一致：${[...generatedAt].join(', ')}`)

  const manifest = JSON.parse(fs.readFileSync(path.join(dataDir, 'dataVersion.json'), 'utf8'))
  if (manifest.latestBizDate < date) throw new Error(`dataVersion 日期落后：目标 ${date}，实际最新日期 ${manifest.latestBizDate}`)
  if (manifest.generatedAt !== [...generatedAt][0]) throw new Error('数据版本清单与 JSON 生成时间不一致')
  for (const [file, expectedHash] of Object.entries(manifest.files || {})) {
    const actualHash = createHash('sha256').update(fs.readFileSync(path.join(dataDir, file))).digest('hex')
    if (actualHash !== expectedHash) throw new Error(`${file} 与版本清单哈希不一致`)
  }
  if (Object.keys(manifest.files || {}).length !== files.length) throw new Error('数据版本清单文件数量不完整')
  console.log(JSON.stringify({ status: 'ok', businessDate: date, generatedAt: manifest.generatedAt, counts, version: manifest.version }, null, 2))
} finally {
  await db.end()
}
