import { chromium } from 'playwright';
import path from 'node:path';

// 降低自动化特征的打开方式：去掉 --enable-automation，关闭 AutomationControlled
// 注意：这只能降低识别率，不能保证 100% 过滑块。
// 如果还是失败，请用“人工 Chrome 登录法”（见 aixiang-cdp-check.mjs 的注释）。
const userDataDir = path.resolve('.browser-data/aixiang');

const context = await chromium.launchPersistentContext(userDataDir, {
  headless: false,
  channel: 'chrome',
  viewport: null,
  ignoreDefaultArgs: ['--enable-automation'],
  args: [
    '--start-maximized',
    '--disable-blink-features=AutomationControlled',
    '--disable-features=AutomationControlled',
  ],
});

// 去掉 navigator.webdriver 特征
await context.addInitScript(() => {
  Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  // @ts-ignore
  if (window.chrome) window.chrome.runtime = window.chrome.runtime || {};
});

const pages = context.pages();
const page = pages[0] ?? (await context.newPage());

await page.goto('https://saas-retail.ele.me/#/data/home', {
  waitUntil: 'domcontentloaded',
  timeout: 60000,
});

console.log('请在弹出的浏览器里手动登录翱象，滑块请一次慢拖通过，不要快速重试。');
console.log('登录成功后确认左上角是“海安闪玩家技术服务有限公司”。');
console.log('确认后直接关闭浏览器窗口即可，会话会自动保存。');
