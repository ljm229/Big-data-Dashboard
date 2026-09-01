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

- 当前数据来自 `数据源/` 下 Excel，已转换为 `web/src/data/dashboard.json`
- `8.28` 映射为「今日」，`8.21` 映射为「昨日」
- 接入 API 时修改 `web/src/api/dashboard.ts` 中 `USE_API = true`

## 设计基准

- 画布 1920×1080，`transform: scale` 等比适配
- 背景图 `public/images/beijing.png`
- 交互参考 `js/index.html` + `index.css`（背景环动效、滚动列表、模块边框）
