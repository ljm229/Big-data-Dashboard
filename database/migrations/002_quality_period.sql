CREATE TABLE IF NOT EXISTS retail.fact_store_quality_period (
  period_start date NOT NULL,
  period_end date NOT NULL,
  period_kind text NOT NULL DEFAULT 'week',
  store_key text NOT NULL REFERENCES retail.dim_store(store_key),
  sellout_rate numeric(18,8),
  pick_error_rate numeric(18,8),
  warehouse_t numeric(18,4),
  im_reply_rate numeric(18,8),
  merchant_issue_rate numeric(18,8),
  shop_score numeric(18,4),
  raw_metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (period_start, period_end, store_key),
  CHECK (period_end >= period_start)
);

CREATE INDEX IF NOT EXISTS fact_quality_period_dates_idx
  ON retail.fact_store_quality_period (period_start, period_end);
