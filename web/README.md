# 电商经营数据驾驶舱

Vue 3 + TypeScript + Vite + ECharts + Pinia，按《大屏方案》实现。

## 启动

```bash
cd web
npm install
npm run dev
```

浏览器打开终端提示的本地地址（默认 http://localhost:5173）。

## 数据

- `src/data/*.json` 是部署时读取的版本化快照。
- 生产刷新链路为 `automation/scripts/daily-run.ps1`：采集 → MySQL → JSON → 发布。
- 本地需要运营质量或经营明细 API 时，在仓库根执行 `npm start`；开发服务器会把
  `/api` 代理到 `127.0.0.1:8787`。静态部署不包含这个本机 API。
- 历史 PostgreSQL 服务已冻结；当前唯一生产数据库为 MySQL `dashboard`。

## 设计基准

- 画布 1920×1080，`transform: scale` 等比适配（仅数据大屏）
- 支持切换：数据大屏 / 运营·经典 / 运营·Tab
