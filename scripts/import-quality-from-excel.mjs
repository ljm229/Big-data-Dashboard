/**
 * 将 数据源/门店营运考核指标.xlsx 日明细导入 PostgreSQL，
 * 并用门店信息表补全城市，供运营质量看板日期与环比可用。
 */
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'
import XLSX from 'xlsx'
import { makePool } from '../server/src/db.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const sourceDir = path.join(root, '数据源')

function pad(n) {
  return String(n).padStart(2, '0')
}

function toIsoDate(v) {
  if (v == null || v === '') return ''
  if (typeof v === 'number' && v > 30000) {
    const parsed = XLSX.SSF.parse_date_code(v)
    if (parsed) return `${parsed.y}-${pad(parsed.m)}-${pad(parsed.d)}`
  }
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    return `${v.getFullYear()}-${pad(v.getMonth() + 1)}-${pad(v.getDate())}`
  }
  const s = String(v).trim()
  if (/^\d{8}$/.test(s)) return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)
  const mdy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/)
  if (mdy) {
    const y = mdy[3].length === 2 ? `20${mdy[3]}` : mdy[3]
    return `${y}-${pad(mdy[1])}-${pad(mdy[2])}`
  }
  return ''
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

function bareStore(name) {
  return String(name || '')
    .replace(/淘宝便利店/g, '')
    .replace(/优沃森超市/g, '')
    .replace(/[（()）\s]/g, '')
    .trim()
}

function findQualityFile() {
  const names = fs.readdirSync(sourceDir).filter((n) => n.endsWith('.xlsx') && !n.startsWith('~$'))
  const hit = names.find((n) => n.includes('门店营运考核指标'))
  if (!hit) throw new Error('数据源中未找到 门店营运考核指标.xlsx')
  return path.join(sourceDir, hit)
}

function findStoreInfoFile() {
  const names = fs.readdirSync(sourceDir).filter((n) => n.endsWith('.xlsx') && !n.startsWith('~$'))
  const hit = names.find((n) => n.includes('淘宝便利店门店信息'))
  return hit ? path.join(sourceDir, hit) : ''
}

function loadStoreInfoMap() {
  const file = findStoreInfoFile()
  const map = new Map()
  if (!file) return map
  const book = XLSX.readFile(file)
  const sheet = book.Sheets.Sheet1 || book.Sheets[book.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: null })
  for (const row of rows) {
    const bare = bareStore(row['门店名称'])
    if (!bare) continue
    const cityRaw = String(row['城市'] || '').trim().replace(/市$/, '')
    const city = cityRaw ? (cityRaw.endsWith('市') ? cityRaw : `${cityRaw}市`) : ''
    const status = String(row['营业'] || '').trim() || '待营业'
    map.set(bare, { city, status })
  }
  return map
}

function readDailyRows(file) {
  const rows = XLSX.utils.sheet_to_json(XLSX.readFile(file).Sheets.data || XLSX.readFile(file).Sheets[0], {
    defval: null,
  })
  const out = []
  for (const row of rows) {
    const name = String(row['门店名称'] || '').trim()
    const code = String(row['门店编码'] || '').trim()
    if (!name || name === '门店名称' || code === '门店编码') continue
    const iso = toIsoDate(row['日期'])
    if (!iso) continue
    out.push({
      date: iso,
      name,
      shortName: bareStore(name),
      code,
      sellout_rate: toNumOrNull(row['动销商品售罄率']),
      pick_error_rate: toNumOrNull(row['错漏拣率']),
      warehouse_t: toNumOrNull(row['仓T']),
      im_reply_rate: toNumOrNull(row['IM 3分钟回复率']),
      merchant_issue_rate: toNumOrNull(row['商责问题订单率']),
      shop_score: toNumOrNull(row['店铺分']),
    })
  }
  return out
}

async function main() {
  const file = findQualityFile()
  const infoMap = loadStoreInfoMap()
  const rows = readDailyRows(file)
  if (!rows.length) throw new Error('没有可导入的日明细行')
  const dates = [...new Set(rows.map((r) => r.date))].sort()
  const hash = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')
  const capturedAt = fs.statSync(file).mtime.toISOString()
  const relative = path.relative(root, file).replaceAll('\\', '/')

  const pool = makePool()
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query("SELECT pg_advisory_xact_lock(hashtext('aoxiang_quality_excel_import'))")
    await client.query(`ALTER TABLE retail.dim_store ADD COLUMN IF NOT EXISTS business_status text NOT NULL DEFAULT ''`)

    for (const row of rows) {
      const storeKey = row.code || `NAME_${crypto.createHash('sha256').update(row.name).digest('hex').slice(0, 24)}`
      const info = infoMap.get(row.shortName) || { city: '', status: '' }
      await client.query(
        `INSERT INTO retail.dim_store(store_key,store_code,store_name,short_name,city,business_status,first_seen,last_seen)
         VALUES($1,$2,$3,$4,$5,$6,$7::date,$7::date)
         ON CONFLICT(store_key) DO UPDATE SET
           store_code=COALESCE(EXCLUDED.store_code, retail.dim_store.store_code),
           store_name=EXCLUDED.store_name,
           short_name=EXCLUDED.short_name,
           city=CASE WHEN EXCLUDED.city<>'' THEN EXCLUDED.city ELSE retail.dim_store.city END,
           business_status=CASE WHEN EXCLUDED.business_status<>'' THEN EXCLUDED.business_status ELSE retail.dim_store.business_status END,
           first_seen=LEAST(retail.dim_store.first_seen, EXCLUDED.first_seen),
           last_seen=GREATEST(retail.dim_store.last_seen, EXCLUDED.last_seen)`,
        [storeKey, row.code || null, row.name, row.shortName, info.city, info.status, row.date],
      )
      await client.query(
        `INSERT INTO retail.fact_store_quality_daily
          (business_date,store_key,sellout_rate,pick_error_rate,warehouse_t,im_reply_rate,merchant_issue_rate,shop_score,raw_metrics,source_file,captured_at,file_hash)
         VALUES($1::date,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11::timestamptz,$12)
         ON CONFLICT(business_date,store_key) DO UPDATE SET
           sellout_rate=EXCLUDED.sellout_rate,
           pick_error_rate=EXCLUDED.pick_error_rate,
           warehouse_t=EXCLUDED.warehouse_t,
           im_reply_rate=EXCLUDED.im_reply_rate,
           merchant_issue_rate=EXCLUDED.merchant_issue_rate,
           shop_score=EXCLUDED.shop_score,
           raw_metrics=EXCLUDED.raw_metrics,
           source_file=EXCLUDED.source_file,
           captured_at=EXCLUDED.captured_at,
           file_hash=EXCLUDED.file_hash,
           ingested_at=now()`,
        [
          row.date,
          storeKey,
          row.sellout_rate,
          row.pick_error_rate,
          row.warehouse_t,
          row.im_reply_rate,
          row.merchant_issue_rate,
          row.shop_score,
          JSON.stringify(row),
          relative,
          capturedAt,
          hash,
        ],
      )
    }

    // 用门店信息再扫一遍，补空城市 / 营业状态（含尚无考核行的店）
    for (const [bare, info] of infoMap) {
      await client.query(
        `UPDATE retail.dim_store SET
           city=CASE WHEN $2<>'' THEN $2 ELSE city END,
           business_status=CASE WHEN $3<>'' THEN $3 ELSE business_status END
         WHERE short_name=$1 OR store_name LIKE '%' || $1 || '%'`,
        [bare, info.city, info.status],
      )
    }

    await client.query(
      `INSERT INTO retail.refresh_state(dataset,version,updated_at,latest_business_date,row_count)
       SELECT 'store_quality', 1, now(), max(business_date), count(*) FROM retail.fact_store_quality_daily
       ON CONFLICT(dataset) DO UPDATE SET
         version=retail.refresh_state.version+1,
         updated_at=now(),
         latest_business_date=EXCLUDED.latest_business_date,
         row_count=EXCLUDED.row_count`,
    )
    await client.query(`SELECT pg_notify('retail_data_updated', $1)`, [
      JSON.stringify({ dataset: 'store_quality', source: '数据源Excel', dates, rows: rows.length }),
    ])
    await client.query('COMMIT')
    const launched = [...infoMap.values()].filter((x) => x.status === '已营业').length
    console.log(
      JSON.stringify(
        {
          ok: true,
          file: path.basename(file),
          rows: rows.length,
          dates,
          dateMin: dates[0],
          dateMax: dates.at(-1),
          storeInfo: { total: infoMap.size, launched },
        },
        null,
        2,
      ),
    )
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
    await pool.end()
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
