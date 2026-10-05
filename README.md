# 淘宝闪购经营看板

这是用于查看门店经营、流量、盈亏、运营质量、商品周期和风险的内部看板。

## 先看这里

非技术同事请从 [项目使用说明](docs/项目使用说明.md) 开始；它说明了“想改什么，该找哪个目录”。

当前正式数据链路只有一条：

```text
翱象 / 淘宝闪购后台 → automation 抓取与校验 → MySQL dashboard
→ 自动生成前端 JSON → web 看板
```

旧 PostgreSQL、旧 Excel 同步脚本、原型和浏览器测试报告已留在本机 `archive/`，不会参与构建或日更，也不会被提交到公司仓库。

## 常用操作

| 目的 | 入口 |
| --- | --- |
| 每日更新数据 | `automation/scripts/daily-run.ps1` |
| 只刷新白天经营数据 | `automation/scripts/midday-refresh.ps1` |
| 从 MySQL 重新生成前端数据 | 在 `web` 执行 `npm run data:refresh` |
| 本地看页面 | 在 `web` 执行 `npm run dev` |
| 检查能否发布 | 在 `web` 执行 `npm run build` |

运行抓取前需要已连公司 VPN，并在 `automation/.env` 中配置数据库连接。账号、密码或 VPN 配置文件不要提交到 Git。

更多边界和部署说明见 [架构与运行边界](docs/架构与运行边界.md)。
