# API 契约 v1（大屏 9 模块 / MySQL 直连）

> 服务：`server/mysql-api.mjs`（新建，`mysql2`，读 `dashboard` 库）。
> 通用：`from/to=YYYY-MM-DD`，`city=全国|xx市`，`channel=全部|淘宝闪购|美团…`，`store=全部|门店名`（多选用 `,` 分隔）。
> 缺值一律返回 `null`，前端显示"—"（与现逻辑一致：缺值不参与、不当 0）。

## 0. 元信息

| 接口 | 说明 | 响应 |
|---|---|---|
| `GET /api/health` | 存活 | `{ok:true, time}` |
| `GET /api/meta/refresh-state` | 各数据集水位（看板判断新鲜度） | `[{dataset, updated_at, latest_biz_date, row_count, src_file}]` |
| `GET /api/meta/days?dataset=business\|supply\|profit` | 可用日期列表 | `{days:["2026-08-01",…]}` |
| `GET /api/meta/stores` | 门店维表（下拉/地图用） | `[{name, code, city, platform}]`（`dim_store`） |

## 1. source1 系（读 `fact_ax_business_daily` + `fact_product_store_daily`）

`metrics` JSON 键 = 翱象表头原名（`预计线上收入/预计毛利(含平台后返)/总营业额/有效订单金额（实付）/有效订单量/毛利率(含平台后返)/单均毛利(含平台后返)/退款率/退款订单量…`），服务端映射为：

`Fact{date, channel, store, turnover, onlineRevenue, profit, marginRate, unitProfit, paid, orders, refundRate, refundOrders}`

| 接口 | 对应前端函数 | 用途模块 |
|---|---|---|
| `GET /api/kpi?from&to&city&channel&store` | `aggregateSource1Kpi` | KeyNumbers |
| `GET /api/trend?city&channel&store&from&to` | `source1TrendRange` | ProfitTrend（缺日保留空点） |
| `GET /api/group/city?...` | `source1ByCity` | CityMatrix |
| `GET /api/group/channel?...` | `source1ByChannel` | ChannelProfit |
| `GET /api/group/store?...` | `source1ByStore` | StoreTop、RiskTop（按店×渠道） |
| `GET /api/risk?...` | `source1RiskStores` | RiskTop（见 §3 规则） |
| `GET /api/map/cities?...` | CityMap 按城市聚合 | CityMap |
| `GET /api/supply/stores?...` | `source1StockoutStores` | RiskTop 缺货部分、StoreTop 供给 |

聚合规则（必须与前端一致）：
- 加总：只加非 null 行，全空则 `null`（`turnover/profit/paid/onlineRevenue/orders/refundOrders`）。
- 毛利率/退款率/单均毛利：加权平均，权重=营业额→线上收入→实付（取绝对值），无权重退简单平均。
- 客单价 `arpu = paid/orders`（订单量为 0 则 `null`）。

## 2. 收支 / 盈亏（读 `fact_ax_business_daily.metrics` 收支键 + `fact_ax_profit_store`）

| 接口 | 对应前端 | 用途模块 |
|---|---|---|
| `GET /api/cost/summary?from&to&...` | `costSummary` | CostBalance（总收入/总支出/收支构成；后返活动期内才计入） |
| `GET /api/cost/by-store?...` | `costProfitByStore` | StoreTop |
| `GET /api/profit/store?from&to&city&store` | `selectProfitPcFacts` | CostBalance（门店盈亏明细：订单量/营业额/实付/补贴率/净利润/利润率/收入明细/支出明细） |

`metrics` 收支键：`收入/总收入,收入/商品原价,…,支出/总支出,支出/商品成本,…`；
盈亏键：`经营指标/*,净利/*,收入/*,支出/*`（27 列全透出，不截断）。

## 3. 风险规则（服务端算，前端只展示）

- 负毛利：门店×渠道期内预计毛利合计 < 0（全店汇总会冲掉单渠道亏损，必须按店×渠道判）。
- 高退款：该渠道退款率 ≥ 5%。
- 缺货：供给出勤率 < 85%（`fact_product_store_daily.attendance_rate` 按店平均），或缺勤损失 > 0。
- 排序按 `impact` 倒序；每条带 `asOf`（事实最近日期）。

## 4. 开业追踪（手工表，新建 `dim_store_launch`）

```sql
CREATE TABLE dim_store_launch (
  store_name VARCHAR(128) PRIMARY KEY,
  city VARCHAR(32) DEFAULT '',
  status VARCHAR(16) DEFAULT '',   -- 已营业/筹建中…
  address VARCHAR(256) DEFAULT '',
  is_new TINYINT NULL              -- 1新店/0老店/NULL未标注
);
```

| 接口 | 对应前端 | 用途模块 |
|---|---|---|
| `GET /api/launch/by-city?city&store` | `source1LaunchByCity` | LaunchTrack（各城市 plan/open/pending/rate） |
| `GET /api/launch/stores?kind=open\|pending...` | `source1StoresByStatus` | LaunchTrack 明细 |

上线进度表由人工维护（`DataUploadPage` 或直导入库），不在自动链内。

## 5. 品类（读 `fact_product_item_period`，周期快照）

| 接口 | 说明 |
|---|---|
| `GET /api/category/top?store&city` | 一级类目按实际销售额倒序：`[{name, sales, qty, orders, refundAmt, stockoutLoss, stockoutTimes}]` + `{from, to}` 区间元信息 |

筛选有门店/城市时按 `store_name` 过滤后重聚（`categoryByStore` 逻辑）；无筛选直接返回全量聚合。
**注意**：这是周期快照（当前 08-23~09-21），不是日趋势，大屏展示须带区间角标。

## 6. 明确不做（v1 以外）

- 经典运营页的流量分来源接口（`traffic.ts`，大屏不用）→ v2。
- `DataUploadPage` 的本地 localStorage 逻辑不动；服务端持久化（`/api/upload`）v2 再接。
- 鉴权：沿用现有 `PasswordGate`，API 暂不加鉴权（内网本机）。
