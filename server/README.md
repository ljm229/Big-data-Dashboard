# 门店运营质量数据服务

本服务只把 `数据采集/raw` 中由自动化新抓取的经营分析和门店营运考核 Excel 导入 PostgreSQL，并为看板提供接口和实时刷新事件。项目原有 `数据源/` 不参与导入。

1. 复制 `.env.example` 为 `.env`，填写本机 PostgreSQL 密码。
2. `npm install`
3. `npm run db:init`
4. `npm run data:import`
5. 先在 `web` 目录执行 `npm run build`，再回到本目录执行 `npm run start:all`。

`start:all` 同时启动接口和新抓取归档目录监听。新文件归档后约 1.2 秒开始入库；事务提交后页面通过 SSE 立即刷新。项目根目录的 `启动门店运营质量看板.cmd` 可一键启动。

接口：`/api/quality/coverage`、`/api/quality/options`、`/api/quality/board`、`/api/quality/report`、`/api/events`。
