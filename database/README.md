# 数据库

PostgreSQL 主库为 `retail_dashboard`，业务表位于 `retail` schema。

- `migrations/`：增量结构脚本，由后端初始化命令自动执行。
- `retail.fact_business_daily`：经营分析日粒度明细。
- `retail.fact_store_quality_daily`：门店运营质量日粒度明细。
- `retail.fact_store_quality_period`：平台只提供周汇总时的原粒度记录，不拆成虚构日数据。
- `retail.refresh_state`：前端分秒级刷新使用的数据版本。

连接密码仅保存在 `server/.env`，该文件不提交到版本库。
