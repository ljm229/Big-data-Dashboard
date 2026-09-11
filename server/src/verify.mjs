import { pool } from './db.mjs'

const checks = await Promise.all([
  pool.query(`SELECT count(*)::int AS rows, count(DISTINCT business_date)::int AS days, count(DISTINCT store_key)::int AS stores, to_char(min(business_date),'YYYY-MM-DD') AS "dateMin", to_char(max(business_date),'YYYY-MM-DD') AS "dateMax" FROM retail.fact_store_quality_daily`),
  pool.query(`SELECT source_code AS source, count(*)::int AS rows, count(DISTINCT business_date)::int AS days FROM retail.fact_business_daily GROUP BY source_code ORDER BY source_code`),
  pool.query(`SELECT count(*)::int AS rows, round(avg(composite_score),2) AS "avgScore" FROM retail.v_store_quality_scored WHERE NOT empty_row`),
])
console.log(JSON.stringify({ quality: checks[0].rows[0], business: checks[1].rows, scoredView: checks[2].rows[0] }, null, 2))
await pool.end()
