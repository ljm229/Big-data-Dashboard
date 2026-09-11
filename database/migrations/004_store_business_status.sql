-- 门店营业状态：与大屏「已营业」口径对齐
ALTER TABLE retail.dim_store
  ADD COLUMN IF NOT EXISTS business_status text NOT NULL DEFAULT '';
