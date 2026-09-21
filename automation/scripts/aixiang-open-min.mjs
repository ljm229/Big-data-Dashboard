import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';

console.log('[1/5] Node version:', process.version);
console.log('[2/5] Playwright chromium launch test...');

const userDataDir = path.resolve('.browser-data/aixiang');
console.log('[3/5] userDataDir =', userDataDir);

// 检查 SingleLock 是否残留
const lockFiles = ['SingletonLock', 'SingletonSocket', 'SingletonCookie'];
for (const f of lockFiles) {
  const p = path.join(userDataDir, f);
  if (fs.existsSync(p)) {
    console.log(`[WARN] 发现残留锁文件: ${p}，建议先关闭所有 Chrome 后删除它`);
  }
}

let context;
try {
  // 先用最简参数，不指定 channel，用 Playwright 自带 Chromium，排除本机 Chrome 干扰
  context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    viewport: { width: 1366, height: 900 },
  });
  console.log('[4/5] 浏览器已启动，正在打开测试页...');
} catch (e) {
  console.error('[FAIL] 浏览器启动失败，完整错误：');
  console.error(e);
  console.error('');
  console.error('常见原因：');
  console.error('1. 上一次 Chrome 没关，profile 被锁定 -> 关闭所有 Chrome 重试');
  console.error('2. 以管理员身份运行 PowerShell -> 换普通权限 PowerShell');
  console.error('3. .browser-data/aixiang 被占用 -> 删除该目录下的 SingletonLock/SingletonSocket 后重试');
  process.exit(1);
}

try {
  const page = context.pages()[0] ?? (await context.newPage());
  // 先打开百度，验证浏览器+网络本身是否正常
  await page.goto('https://www.baidu.com', { waitUntil: 'domcontentloaded', timeout: 30000 });
  console.log('[5/5] 测试页打开成功，标题 =', await page.title());
  console.log('如果能看到百度，说明 Playwright 本体正常，问题在翱象站点本身。');
  console.log('接下来再打开翱象...');
  await page.goto('https://saas-retail.ele.me/#/data/home', { waitUntil: 'domcontentloaded', timeout: 60000 });
  console.log('翱象页面已发起导航，当前 URL =', page.url());
  console.log('请观察浏览器窗口：如果一直白屏，把窗口截图发我（遮住账号信息）。');
  console.log('保持窗口打开，按 Ctrl+C 结束本脚本。');
  await new Promise(() => {});
} catch (e) {
  console.error('[FAIL] 页面打开失败：');
  console.error(e);
  await context.close().catch(() => {});
  process.exit(1);
}
