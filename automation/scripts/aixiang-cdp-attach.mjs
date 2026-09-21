import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';

const outputDir = path.resolve('output');
await fs.mkdir(outputDir, { recursive: true });

const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
const context = browser.contexts()[0];
if (!context) throw new Error('9222 Chrome 没有可用浏览器上下文。');

const page = context.pages()[0] ?? await context.newPage();
console.log('已直接接管 9222 Chrome，不复制 Cookie、不启动第二个浏览器。');

async function dismissMutePopup() {
  for (let i = 0; i < 3; i += 1) {
    let handled = false;
    for (const frame of page.frames()) {
      try {
        const ignoreBtn = frame.getByRole('button', { name: '忽略', exact: true }).first();
        if ((await ignoreBtn.count().catch(() => 0)) && (await ignoreBtn.isVisible().catch(() => false))) {
          console.log('发现消息静音提醒，自动点击忽略。');
          await ignoreBtn.click({ timeout: 5000 }).catch(() => {});
          await page.waitForTimeout(800);
          handled = true;
          break;
        }
      } catch {}
    }
    if (handled) continue;
    break;
  }
}

async function pageText() {
  return page.locator('body').innerText().catch(() => '');
}

async function isCompanyHome() {
  const text = await pageText();
  return text.includes('海安闪玩家技术服务有限公司') && !text.includes('账户登录');
}

if (!page.url().startsWith('https://saas-retail.ele.me/')) {
  await page.goto('https://saas-retail.ele.me/#/data/home', {
    waitUntil: 'domcontentloaded',
    timeout: 60_000,
  });
}

await page.waitForTimeout(3000);
await dismissMutePopup();

if (!(await isCompanyHome())) {
  console.error('9222 Chrome 当前未确认进入目标企业，请先在该窗口完成官方登录验证。');
  await page.screenshot({ path: path.join(outputDir, 'aixiang-cdp-not-logged-in.png'), fullPage: true });
  await browser.close().catch(() => {});
  process.exit(2);
}

const text = await pageText();
console.log('已确认企业主体：海安闪玩家技术服务有限公司');
console.log('当前 URL：', page.url());
console.log('页面已就绪，不自动点击“数据”，避免误点重复菜单。');
console.log('请在该已登录 Chrome 中打开要采集的报表，脚本会继续接管当前页面。');
console.log('完成后回到终端按 Enter，脚本将保存页面诊断信息。');

await new Promise((resolve) => process.stdin.once('data', resolve));

const afterText = await pageText();
await fs.writeFile(path.join(outputDir, 'aixiang-cdp-page-text.txt'), afterText, 'utf8');
await page.screenshot({ path: path.join(outputDir, 'aixiang-cdp-current-page.png'), fullPage: true });
console.log('已保存当前页面诊断：output/aixiang-cdp-page-text.txt');
console.log('已保存当前页面截图：output/aixiang-cdp-current-page.png');
console.log('本次任务结束，浏览器保持打开。');

void text;
