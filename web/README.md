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

- 当前数据来自 `数据源/` 下 Excel，经根目录 `scripts/` 同步为 `web/src/data/*.json`
- 常用同步：`npm run data:sync` / `data:sync-ops` / `data:sync-pack`

## 设计基准

- 画布 1920×1080，`transform: scale` 等比适配（仅数据大屏）
- 支持切换：数据大屏 / 运营·经典 / 运营·Tab
