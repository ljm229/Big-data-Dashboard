# 三端部署：GitHub Pages（保留）+ Vercel + Cloudflare Pages

前端目录：`web/` → 构建产物 `web/dist`

## 已保留

- GitHub Pages：https://ljm229.github.io/Big-data-Dashboard/
- 推送 `main` 仍走 `.github/workflows/deploy.yml`

## Vercel（同事可访问优先试这个）

1. 打开 https://vercel.com/new
2. Import GitHub 仓库 `ljm229/Big-data-Dashboard`
3. 配置：
   - **Root Directory**: `web`
   - Framework: Vite
   - Build Command: `npm run build`
   - Output Directory: `dist`
4. Deploy → 得到 `https://xxx.vercel.app`

（可选）把 Vercel 项目里的 Token / Org / Project ID 配到仓库 Secrets：
`VERCEL_TOKEN`、`VERCEL_ORG_ID`、`VERCEL_PROJECT_ID`  
之后推送 `main` 会自动走 `.github/workflows/deploy-vercel.yml`。

## Cloudflare Pages

### 方式一：控制台连 Git（最简单）

1. https://dash.cloudflare.com → Workers & Pages → Create → Pages → Connect to Git
2. 选 `ljm229/Big-data-Dashboard`
3. 配置：
   - Framework: Vite
   - **Root directory**: `web`
   - Build command: `npm run build`
   - Build output directory: `dist`
4. Save and Deploy → 得到 `https://xxx.pages.dev`

### 方式二：GitHub Actions

在仓库 Settings → Secrets 添加：
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

推送 `main` 后走 `.github/workflows/deploy-cloudflare.yml`。

## 说明

- 三端都是同一套静态前端；github.io 继续保留。
- 国内网络下 `vercel.app` / `pages.dev` 通常比 `github.io` 好打开一些，仍不保证 100%。
- 运营质量「实时数据库」在静态托管上不可用，会回退静态考核包。
