# 数据库

当前生产主库为 MySQL `dashboard`。建库脚本为 `mysql-schema.sql`，日更由
`automation/scripts/daily-run.ps1` 执行；前端以 MySQL 生成的 JSON 快照发布。

`schema.sql` 与 `migrations/` 属于已停止演进的 PostgreSQL 原型，仅为历史兼容
保留，不能与 MySQL 生产链路混用。

- `fact_ax_business_daily`、`fact_traffic_daily` 等：业务事实表。
- `fact_product_item_period`：商品周期汇总，禁止作为日趋势数据。
- `refresh_state`：每个数据集的业务日期和行数水位。

连接参数仅保存在 `automation/.env`，该文件不提交到版本库。
