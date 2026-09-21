# 门店运营质量数据服务

本服务为看板提供门店运营质量查询、指标评分和刷新事件接口。数据采集与文件自动导入功能已移除。

1. 复制 `.env.example` 为 `.env`，填写本机 PostgreSQL 密码。
2. `npm install`
3. `npm run db:init`
4. 先在 `web` 目录执行 `npm run build`，再回到本目录执行 `npm run start:all`。

`start:all` 启动接口服务。项目根目录的 `启动门店运营质量看板.cmd` 可一键启动。

接口：`/api/quality/coverage`、`/api/quality/options`、`/api/quality/board`、`/api/quality/report`、`/api/events`。
