CREATE TABLE IF NOT EXISTS retail.capture_artifact (
  id bigserial PRIMARY KEY,
  run_id text NOT NULL,
  source_code text NOT NULL,
  sha256 text NOT NULL CHECK (length(sha256)=64),
  file_path text NOT NULL,
  captured_at timestamptz NOT NULL,
  date_from date NOT NULL,
  date_to date NOT NULL,
  row_count integer NOT NULL,
  columns_json jsonb NOT NULL DEFAULT '[]',
  imported_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_code,sha256,date_from,date_to)
);
ALTER TABLE retail.fact_business_daily ADD COLUMN IF NOT EXISTS captured_at timestamptz;
ALTER TABLE retail.fact_business_daily ADD COLUMN IF NOT EXISTS file_hash text;
ALTER TABLE retail.fact_store_quality_daily ADD COLUMN IF NOT EXISTS captured_at timestamptz;
ALTER TABLE retail.fact_store_quality_daily ADD COLUMN IF NOT EXISTS file_hash text;
