import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs/promises';

const userDataDir = path.resolve('.browser-data/aixiang');
const outputDir = path.resolve('output');
await fs.mkdir(outputDir, { recursive: true });

const context = await chromium.launchPersistentContext(userDataDir, {
  headless: false,
  channel: 'chrome',
  viewport: { width: 1440, height: 960 },
});

const page = context.pages()[0] ?? await context.newPage();

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
    for (const frame of page.frames()) {
      try {
        const muteHint = frame.getByText('消息静音提醒', { exact: true }).first();
        if ((await muteHint.count().catch(() => 0)) && (await muteHint.isVisible().catch(() => false))) {
          const ignoreText = frame.getByText('忽略', { exact: true }).last();
          if ((await ignoreText.count().catch(() => 0)) && (await ignoreText.isVisible().catch(() => false))) {
            console.log('发现消息静音提醒文本，自动点击忽略。');
            await ignoreText.click({ timeout: 5000 }).catch(() => {});
            await page.waitForTimeout(800);
            handled = true;
            break;
          }
        }
      } catch {}
    }
    if (!handled) break;
  }
}

await page.goto('https://saas-retail.ele.me/#/data/home', {
  waitUntil: 'domcontentloaded',
  timeout: 60_000,
});

await page.waitForTimeout(3000);
await dismissMutePopup();

console.log('浏览器已打开，已自动处理消息静音提醒弹窗。');
console.log('如果出现登录验证，请由你本人完成；脚本不会绕过验证码。');
console.log('完成后回到此终端按 Enter 继续检查。');

await new Promise((resolve) => {
  process.stdin.once('data', resolve);
});

await page.waitForTimeout(3_000);
const bodyText = await page.locator('body').innerText().catch(() => '');
const companyName = '海安闪玩家技术服务有限公司';
const loggedIn = bodyText.includes(companyName);

await page.screenshot({
  path: path.join(outputDir, 'aixiang-session-check.png'),
  fullPage: true,
});
await fs.writeFile(
  path.join(outputDir, 'aixiang-page-text.txt'),
  bodyText,
  'utf8',
);

if (!loggedIn) {
  console.error('未检测到目标企业名称，登录状态未确认。');
  console.error('请检查是否仍停留在登录页、是否需要验证，或企业名称是否不同。');
  await context.close();
  process.exitCode = 2;
} else {
  console.log(`已确认登录企业：${companyName}`);
  console.log('会话已保存在 .browser-data/aixiang。');
  console.log('截图：output/aixiang-session-check.png');
  await context.close();
}
