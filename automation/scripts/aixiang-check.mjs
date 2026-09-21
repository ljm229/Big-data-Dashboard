import { chromium } from 'playwright';
import path from 'node:path';

const context = await chromium.launchPersistentContext(
  path.resolve('.browser-data/aixiang'),
  {
    headless: false,
    channel: 'chrome',
    viewport: null,
  },
);

const page = context.pages()[0] ?? (await context.newPage());

async function dismissMutePopup() {
  for (const frame of page.frames()) {
    try {
      const ignoreBtn = frame.getByRole('button', { name: '忽略', exact: true }).first();
      if ((await ignoreBtn.count().catch(() => 0)) && (await ignoreBtn.isVisible().catch(() => false))) {
        console.log('发现消息静音提醒，自动点击忽略。');
        await ignoreBtn.click({ timeout: 5000 }).catch(() => {});
        await page.waitForTimeout(800);
        return true;
      }
    } catch {}
    try {
      const muteHint = frame.getByText('消息静音提醒', { exact: true }).first();
      if ((await muteHint.count().catch(() => 0)) && (await muteHint.isVisible().catch(() => false))) {
        const ignoreText = frame.getByText('忽略', { exact: true }).last();
        if ((await ignoreText.count().catch(() => 0)) && (await ignoreText.isVisible().catch(() => false))) {
          console.log('发现消息静音提醒文本，自动点击忽略。');
          await ignoreText.click({ timeout: 5000 }).catch(() => {});
          await page.waitForTimeout(800);
          return true;
        }
      }
    } catch {}
  }
  return false;
}

async function waitAndAutoDismiss(timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const handled = await dismissMutePopup();
    // 弹窗可能延迟出现，多轮询几遍；即使没弹窗也继续等页面稳定
    await page.waitForTimeout(handled ? 800 : 1000);
    if (!handled && Date.now() > deadline - 5000) break;
  }
  // 最后再清一次，防止刚冒出来的弹窗卡住后续逻辑
  await dismissMutePopup();
}

try {
  await page.goto('https://saas-retail.ele.me/#/data/home', {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });

  await page.waitForTimeout(3000);
  await waitAndAutoDismiss(15000);

  const bodyText = await page.locator('body').innerText().catch(() => '');
  const loggedIn = bodyText.includes('海安闪玩家技术服务有限公司');

  if (loggedIn) {
    console.log('会话有效：已自动进入企业工作台，无需重新登录。');
  } else {
    console.log('会话无效或已过期，请重新运行人工登录流程。');
  }

  await page.screenshot({ path: 'output/aixiang-check.png', fullPage: true });
  console.log('截图已保存到 output/aixiang-check.png');
  console.log('浏览器将保持打开。确认页面后，回到终端按 Enter 关闭。');

  await new Promise((resolve) => {
    process.stdin.once('data', resolve);
  });
} finally {
  await context.close();
}

