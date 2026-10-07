-- MySQL 8.x 建库脚本：抓取数据入库 + 看板读取。
-- 执行：mysql -h127.0.0.1 -P3306 -uroot -p < database/mysql-schema.sql
-- 字符集 utf8mb4（门店名含中文/括号），时区以 DATE 列为准不存时间戳。
CREATE DATABASE IF NOT EXISTS taobian CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE taobian;

-- 门店维度（nr/翱象两边门店名统一归一到这里）
CREATE TABLE IF NOT EXISTS dim_store (
  store_key VARCHAR(128) PRIMARY KEY COMMENT '归一键：norm(门店名)+渠道',
  store_code VARCHAR(64) NULL DEFAULT NULL COMMENT '门店编码（翱象），NULL 可重复不触发唯一键',
  store_name VARCHAR(128) NOT NULL COMMENT '门店名称',
  city VARCHAR(32) NOT NULL DEFAULT '',
  platform VARCHAR(16) NULL DEFAULT NULL COMMENT 'nr/翱象/美团等',
  first_seen DATE NULL,
  last_seen DATE NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_store_code (store_code, platform),
  KEY idx_store_name (store_name),
  KEY idx_city (city)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- nr 流量：分来源按日（日期/门店/来源分类/来源名称 粒度）
CREATE TABLE IF NOT EXISTS fact_traffic_daily (
  biz_date DATE NOT NULL,
  store_id VARCHAR(32) NOT NULL DEFAULT '',
  store_name VARCHAR(128) NOT NULL DEFAULT '',
  city VARCHAR(32) NOT NULL DEFAULT '',
  source_category VARCHAR(32) NOT NULL DEFAULT '',
  source_name VARCHAR(64) NOT NULL DEFAULT '',
  exposure INT DEFAULT 0 COMMENT '曝光人数',
  visitors INT DEFAULT 0 COMMENT '进店人数',
  orders INT DEFAULT 0 COMMENT '下单人数',
  visit_conv DECIMAL(10,4) NULL COMMENT '进店转化率',
  order_conv DECIMAL(10,4) NULL COMMENT '下单转化率',
  overall_conv DECIMAL(10,4) NULL COMMENT '整体转化率',
  PRIMARY KEY (biz_date, store_id, source_category, source_name),
  KEY idx_traffic_store_date (store_name, biz_date),
  KEY idx_traffic_date (biz_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- nr 商品：按店铺汇总按日（日期/门店 粒度）
CREATE TABLE IF NOT EXISTS fact_product_store_daily (
  biz_date DATE NOT NULL,
  store_id VARCHAR(32) NOT NULL DEFAULT '',
  store_name VARCHAR(128) NOT NULL DEFAULT '',
  on_shelf INT DEFAULT 0 COMMENT '在架商品数',
  saleable INT DEFAULT 0 COMMENT '可售商品数',
  active_goods INT DEFAULT 0 COMMENT '动销商品数',
  oos_goods INT DEFAULT 0 COMMENT '缺货商品数',
  refund_goods INT DEFAULT 0 COMMENT '退款商品数',
  bad_review_goods INT DEFAULT 0 COMMENT '差评商品数',
  attendance_rate DECIMAL(10,6) NULL COMMENT '商品出勤率',
  absent_cnt INT DEFAULT 0 COMMENT '缺勤商品数',
  absent_loss DECIMAL(14,4) NULL COMMENT '缺勤商品损失金额',
  PRIMARY KEY (biz_date, store_id),
  KEY idx_product_store_date (store_name, biz_date),
  KEY idx_product_date (biz_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- nr 商品明细：平台仅提供周期汇总，不能混入日粒度表。
-- 唯一键保留完整商品与类目维度，支持同一商品在不同类目/门店的原始事实回放。
CREATE TABLE IF NOT EXISTS fact_product_item_period (
  period_from DATE NOT NULL,
  period_to DATE NOT NULL,
  store_id VARCHAR(32) NOT NULL DEFAULT '',
  store_name VARCHAR(128) NOT NULL DEFAULT '',
  item_id VARCHAR(64) NOT NULL DEFAULT '',
  item_name VARCHAR(512) NOT NULL DEFAULT '',
  cat1 VARCHAR(128) NOT NULL DEFAULT '',
  cat2 VARCHAR(128) NOT NULL DEFAULT '',
  cat3 VARCHAR(128) NOT NULL DEFAULT '',
  list_sales DECIMAL(16,4) NULL,
  actual_sales DECIMAL(16,4) NULL,
  qty INT NULL,
  qty_norefund INT NULL,
  bring_orders INT NULL,
  order_buyers INT NULL,
  order_gmv DECIMAL(16,4) NULL,
  refund_qty INT NULL,
  refund_amount DECIMAL(16,4) NULL,
  refund_orders INT NULL,
  oos_times INT NULL,
  oos_lost_orders INT NULL,
  oos_cancel_orders INT NULL,
  oos_full_refund_orders INT NULL,
  oos_part_refund_orders INT NULL,
  oos_lost_loss DECIMAL(16,4) NULL,
  oos_cancel_loss DECIMAL(16,4) NULL,
  oos_full_refund_loss DECIMAL(16,4) NULL,
  oos_part_refund_loss DECIMAL(16,4) NULL,
  PRIMARY KEY (period_from, period_to, store_id, item_id, cat1, cat2, cat3),
  KEY idx_item_period_store (store_name, period_from, period_to),
  KEY idx_item_period_category (cat1, period_from, period_to)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- nr 异常单：逆向单订单行粒度（订单id+退货SKU+逆向类型 粒度）
CREATE TABLE IF NOT EXISTS fact_reverse_order (
  order_id VARCHAR(32) NOT NULL COMMENT '订单id',
  reverse_type VARCHAR(32) NOT NULL DEFAULT '' COMMENT '逆向单类型',
  return_sku_id VARCHAR(32) NOT NULL DEFAULT '' COMMENT '退货商品ID',
  biz_date DATE NULL COMMENT '日期列',
  manager_name VARCHAR(128) NOT NULL DEFAULT '',
  supplier_name VARCHAR(128) NOT NULL DEFAULT '',
  store_name VARCHAR(128) NOT NULL DEFAULT '',
  store_id VARCHAR(32) NOT NULL DEFAULT '',
  city VARCHAR(32) NOT NULL DEFAULT '',
  order_amount DECIMAL(14,2) NULL COMMENT '订单成交金额',
  order_date DATE NULL,
  return_sku_name VARCHAR(512) NOT NULL DEFAULT '',
  return_barcode VARCHAR(512) NOT NULL DEFAULT '',
  cat1 VARCHAR(64) NOT NULL DEFAULT '',
  cat2 VARCHAR(64) NOT NULL DEFAULT '',
  cat3 VARCHAR(64) NOT NULL DEFAULT '',
  return_amount DECIMAL(14,2) NULL COMMENT '退货商品金额',
  reverse_start_date DATETIME NULL COMMENT '逆向单发起日期',
  reverse_reason VARCHAR(512) NOT NULL DEFAULT '' COMMENT '逆向单原因',
  pick_done_time DATETIME NULL,
  deliver_done_time DATETIME NULL,
  PRIMARY KEY (order_id, reverse_type, return_sku_id),
  KEY idx_reverse_date (biz_date),
  KEY idx_reverse_store_date (store_name, biz_date),
  KEY idx_reverse_order (order_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 翱象经营分析下钻（昨日，日环比等长尾列收进 JSON，日期/渠道/门店 粒度）
CREATE TABLE IF NOT EXISTS fact_ax_business_daily (
  biz_date DATE NOT NULL,
  channel VARCHAR(32) NOT NULL DEFAULT '',
  store_name VARCHAR(128) NOT NULL DEFAULT '',
  metrics JSON NOT NULL COMMENT '全部指标含环比列',
  PRIMARY KEY (biz_date, channel, store_name),
  KEY idx_ax_biz_date (biz_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 翱象盈亏分析门店维度（业务日期由导入参数 --date 指定，默认导出前一天）
CREATE TABLE IF NOT EXISTS fact_ax_profit_store (
  biz_date DATE NOT NULL,
  store_name VARCHAR(128) NOT NULL,
  metrics JSON NOT NULL COMMENT '经营指标/净利/收入/支出全列',
  PRIMARY KEY (biz_date, store_name),
  KEY idx_ax_profit_date (biz_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 翱象订单毛利（订单编码 粒度，增量 upsert）
CREATE TABLE IF NOT EXISTS fact_ax_order_margin (
  order_code VARCHAR(32) PRIMARY KEY COMMENT '订单编码',
  store_name VARCHAR(128) NOT NULL DEFAULT '',
  store_code VARCHAR(64) NOT NULL DEFAULT '',
  channel VARCHAR(32) NOT NULL DEFAULT '',
  created_time DATETIME NULL,
  receivable DECIMAL(14,2) NULL COMMENT '应收',
  cost DECIMAL(14,2) NULL COMMENT '成本',
  est_profit DECIMAL(14,2) NULL COMMENT '预计毛利',
  settle_amount DECIMAL(14,2) NULL COMMENT '结算金额',
  refund_no VARCHAR(64) NOT NULL DEFAULT '',
  finish_time DATETIME NULL,
  order_status VARCHAR(32) NOT NULL DEFAULT '',
  extra JSON NULL COMMENT '其余长尾费用列',
  KEY idx_margin_store_time (store_name, created_time),
  KEY idx_margin_created (created_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 翱象门店营运考核（日期/门店 粒度，对齐 PG 的 fact_store_quality_daily）
CREATE TABLE IF NOT EXISTS fact_store_quality_daily (
  biz_date DATE NOT NULL,
  store_name VARCHAR(128) NOT NULL,
  store_code VARCHAR(64) NOT NULL DEFAULT '',
  sellout_rate DECIMAL(12,6) NULL COMMENT '动销商品售罄率',
  pick_error_rate DECIMAL(12,6) NULL COMMENT '错漏拣率',
  warehouse_t DECIMAL(10,2) NULL COMMENT '仓T',
  im_reply_rate DECIMAL(12,6) NULL COMMENT 'IM 3分钟回复率',
  merchant_issue_rate DECIMAL(12,6) NULL COMMENT '商责问题订单率',
  shop_score DECIMAL(10,2) NULL COMMENT '店铺分',
  PRIMARY KEY (biz_date, store_name),
  KEY idx_quality_date (biz_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 翱象订单毛利归档表（180 天以外，结构同 fact_ax_order_margin，由 db-import 自动迁移）
CREATE TABLE IF NOT EXISTS fact_ax_order_margin_archive LIKE fact_ax_order_margin;

-- 门店上线进度（手工表，由 城市门店及上线进度.xlsx 导入，不在自动链内）
CREATE TABLE IF NOT EXISTS dim_store_launch (
  store_name VARCHAR(128) PRIMARY KEY,
  city VARCHAR(32) NOT NULL DEFAULT '',
  status VARCHAR(16) NOT NULL DEFAULT '' COMMENT '已营业/筹建中…',
  address VARCHAR(256) NOT NULL DEFAULT '',
  is_new TINYINT NULL COMMENT '1新店/0老店/NULL未标注'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 导入水位：每个数据集最后一次入库状态，看板用它判断新鲜度
CREATE TABLE IF NOT EXISTS refresh_state (
  dataset VARCHAR(64) PRIMARY KEY COMMENT 'traffic/product/reverse/ax_business/ax_profit/ax_margin/ax_quality',
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  latest_biz_date DATE NULL,
  row_count BIGINT NOT NULL DEFAULT 0,
  src_file VARCHAR(256) NOT NULL DEFAULT ''
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
