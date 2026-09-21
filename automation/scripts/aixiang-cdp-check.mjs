// 接管已人工登录的 Chrome（9222 端口），把会话复制到 automation 专用目录。
import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs/promises';

const manualCookiesPath = path.resolve('output/aixiang-manual-cookies.json');
const manualStoragePath = path.resolve('output/aixiang-manual-storage.json');
await fs.mkdir('output', { recursive: true });

// 先连接你手动登录好的 Chrome
const manual = await chromium.connectOverCDP('http://127.0.0.1:9222');
const manualContext = manual.contexts()[0];
if (!manualContext) throw new Error('没有找到已打开的人工 Chrome 页面，请先运行 aixiang-cdp-open.mjs');
const manualPage = manualContext.pages()[0] ?? (await manualContext.newPage());
await manualPage.goto('https://saas-retail.ele.me/#/data/home', {
  waitUntil: 'domcontentloaded',
  timeout: 60000,
});
await manualPage.waitForTimeout(3000);
const ok = await manualPage
  .getByText('海安闪玩家技术服务有限公司')
  .isVisible()
  .catch(() => false);
if (!ok) {
  console.error('人工 Chrome 里还没有进入公司主页，请先完成登录和滑块再运行本脚本。');
  await manual.close().catch(() => {});
  process.exit(1);
}

// 导出会话
await manualContext.storageState({ path: manualStoragePath });
const cookies = await manualContext.cookies();
await fs.writeFile(manualCookiesPath, JSON.stringify(cookies, null, 2), 'utf8');
console.log('已导出人工会话，准备导入到 automation 专用浏览器目录。');
await manual.close().catch(() => {});

// 导入到 automation 专用目录
const autoDir = path.resolve('.browser-data/aixiang');
const auto = await chromium.launchPersistentContext(autoDir, {
  headless: false,
  channel: 'chrome',
  viewport: null,
  args: ['--start-maximized'],
});
await auto.addCookies(cookies);
const page = auto.pages()[0] ?? (await auto.newPage());
await page.goto('https://saas-retail.ele.me/#/data/home', {
  waitUntil: 'domcontentloaded',
  timeout: 60000,
});
await page.waitForTimeout(5000);
const body = await page.locator('body').innerText().catch(() => '');
if (body.includes('海安闪玩家技术服务有限公司')) {
  console.log('导入成功：automation 目录已可免登录进入翱象。');
} else {
  console.log('导入后仍需登录，说明翱象绑定了更严格的设备/指纹，请直接用人工 Chrome 方案做采集。');
}
await page.screenshot({ path: 'output/aixiang-imported.png', fullPage: true });
await auto.close();
