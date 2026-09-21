-- 统一由 server/src/init-db.mjs 初始化；数据库结构归 database 管理。
CREATE SCHEMA IF NOT EXISTS retail;

CREATE TABLE IF NOT EXISTS retail.dim_store (
  store_key text PRIMARY KEY,
  store_code text,
  store_name text NOT NULL,
  short_name text NOT NULL,
  city text NOT NULL DEFAULT '',
  business_status text NOT NULL DEFAULT '',
  first_seen date,
  last_seen date,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS dim_store_code_uniq
  ON retail.dim_store (store_code)
  WHERE store_code IS NOT NULL AND store_code <> '';
CREATE INDEX IF NOT EXISTS dim_store_name_idx ON retail.dim_store (store_name);
CREATE INDEX IF NOT EXISTS dim_store_city_idx ON retail.dim_store (city);

CREATE TABLE IF NOT EXISTS retail.fact_business_daily (
  source_code text NOT NULL,
  business_date date NOT NULL,
  dimension_key text NOT NULL,
  city text NOT NULL DEFAULT '',
  store_name text NOT NULL DEFAULT '',
  channel text NOT NULL DEFAULT '',
  metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (source_code, business_date, dimension_key)
);

CREATE INDEX IF NOT EXISTS fact_business_date_idx
  ON retail.fact_business_daily (business_date, source_code);
CREATE INDEX IF NOT EXISTS fact_business_store_idx
  ON retail.fact_business_daily (store_name, business_date);
CREATE INDEX IF NOT EXISTS fact_business_metrics_gin
  ON retail.fact_business_daily USING gin (metrics);

CREATE TABLE IF NOT EXISTS retail.fact_store_quality_daily (
  business_date date NOT NULL,
  store_key text NOT NULL REFERENCES retail.dim_store(store_key),
  sellout_rate numeric(18,8),
  pick_error_rate numeric(18,8),
  warehouse_t numeric(18,4),
  im_reply_rate numeric(18,8),
  merchant_issue_rate numeric(18,8),
  shop_score numeric(18,4),
  raw_metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (business_date, store_key)
);

CREATE INDEX IF NOT EXISTS fact_quality_store_date_idx
  ON retail.fact_store_quality_daily (store_key, business_date DESC);

CREATE TABLE IF NOT EXISTS retail.refresh_state (
  dataset text PRIMARY KEY,
  version bigint NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now(),
  latest_business_date date,
  row_count bigint NOT NULL DEFAULT 0
);

CREATE OR REPLACE VIEW retail.v_store_quality_scored AS
WITH normalized AS (
  SELECT
    q.business_date,
    q.store_key,
    s.store_code,
    s.store_name,
    s.short_name,
    s.city,
    CASE WHEN abs(q.sellout_rate) <= 1.5 THEN q.sellout_rate * 100 ELSE q.sellout_rate END AS sellout_pct,
    CASE WHEN abs(q.pick_error_rate) <= 1.5 THEN q.pick_error_rate * 100 ELSE q.pick_error_rate END AS pick_error_pct,
    q.warehouse_t,
    CASE WHEN abs(q.im_reply_rate) <= 1.5 THEN q.im_reply_rate * 100 ELSE q.im_reply_rate END AS im_reply_pct,
    CASE WHEN abs(q.merchant_issue_rate) <= 1.5 THEN q.merchant_issue_rate * 100 ELSE q.merchant_issue_rate END AS merchant_issue_pct,
    q.shop_score,
    (coalesce(q.sellout_rate, 0) = 0
      AND coalesce(q.pick_error_rate, 0) = 0
      AND coalesce(q.warehouse_t, 0) = 0
      AND coalesce(q.im_reply_rate, 0) = 0
      AND coalesce(q.merchant_issue_rate, 0) = 0) AS empty_row
  FROM retail.fact_store_quality_daily q
  JOIN retail.dim_store s USING (store_key)
), part_scores AS (
  SELECT n.*,
    CASE WHEN empty_row OR sellout_pct IS NULL THEN 0 WHEN sellout_pct <= 7 THEN 100 WHEN sellout_pct <= 8 THEN 80 WHEN sellout_pct <= 10 THEN 60 ELSE 0 END AS sellout_score,
    CASE WHEN empty_row OR pick_error_pct IS NULL THEN 0 WHEN pick_error_pct <= 0.3 THEN 100 WHEN pick_error_pct <= 0.5 THEN 80 WHEN pick_error_pct <= 0.8 THEN 60 ELSE 0 END AS pick_error_score,
    CASE WHEN empty_row OR warehouse_t IS NULL THEN 0 WHEN warehouse_t <= 4 THEN 100 WHEN warehouse_t <= 5 THEN 80 WHEN warehouse_t <= 6 THEN 60 ELSE 0 END AS warehouse_score,
    CASE WHEN empty_row OR merchant_issue_pct IS NULL THEN 0 WHEN merchant_issue_pct <= 1 THEN 100 WHEN merchant_issue_pct <= 1.5 THEN 80 WHEN merchant_issue_pct <= 2.5 THEN 60 ELSE 0 END AS merchant_issue_score,
    CASE WHEN empty_row OR im_reply_pct IS NULL THEN 0 WHEN im_reply_pct >= 95 THEN 100 WHEN im_reply_pct >= 90 THEN 80 WHEN im_reply_pct >= 85 THEN 60 ELSE 0 END AS im_reply_score
  FROM normalized n
), scored AS (
  SELECT p.*,
    round((sellout_score * 0.4 + pick_error_score * 0.2 + warehouse_score * 0.1 + merchant_issue_score * 0.2 + im_reply_score * 0.1)::numeric, 1) AS composite_score
  FROM part_scores p
)
SELECT s.*,
  CASE WHEN composite_score >= 90 THEN 'S' WHEN composite_score >= 80 THEN 'A' WHEN composite_score >= 60 THEN 'B' WHEN composite_score >= 40 THEN 'C' ELSE 'D' END AS grade,
  sellout_pct <= 8 AS sellout_pass,
  pick_error_pct <= 0.5 AS pick_error_pass,
  warehouse_t <= 5 AS warehouse_pass,
  merchant_issue_pct <= 1.5 AS merchant_issue_pass,
  im_reply_pct >= 90 AS im_reply_pass
FROM scored s;

CREATE OR REPLACE VIEW retail.v_store_quality_daily_summary AS
SELECT
  business_date,
  count(*) AS store_count,
  count(*) FILTER (WHERE composite_score >= 80) AS pass_store_count,
  round(avg(composite_score), 2) AS avg_composite_score,
  round(avg(sellout_pct), 4) AS sellout_pct,
  round(avg(pick_error_pct), 4) AS pick_error_pct,
  round(avg(warehouse_t), 4) AS warehouse_t,
  round(avg(merchant_issue_pct), 4) AS merchant_issue_pct,
  round(avg(im_reply_pct), 4) AS im_reply_pct
FROM retail.v_store_quality_scored
WHERE NOT empty_row
GROUP BY business_date;
