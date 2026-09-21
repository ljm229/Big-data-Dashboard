// 人工 Chrome 方案：用你自己平时用的 Chrome 登录一次，再让 Playwright 接管复用。
// 1. 先把所有 Chrome 关掉。
// 2. 执行： node scripts/aixiang-cdp-open.mjs
// 3. 在打开的 Chrome 里手动登录翱象并通过滑块。
// 4. 保持该 Chrome 不关，再新开一个 PowerShell 运行：
//    node scripts/aixiang-cdp-check.mjs
import { execFile } from 'node:child_process';
import path from 'node:path';

const profile = path.resolve('.browser-data/aixiang-manual');
const chromePaths = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
];

function tryLaunch(index = 0) {
  if (index >= chromePaths.length) {
    console.error('没有找到本机 Chrome，请先安装 Google Chrome。');
    process.exit(1);
  }
  const exe = chromePaths[index];
  const child = execFile(
    exe,
    [
      '--remote-debugging-port=9222',
      `--user-data-dir=${profile}`,
      'https://saas-retail.ele.me/#/data/home',
    ],
    { windowsHide: false },
    (error) => {
      if (error) {
        console.error(`启动失败：${exe}`);
        tryLaunch(index + 1);
      }
    },
  );
  child.on('spawn', () => {
    console.log(`已用人工 Chrome 打开翱象：${exe}`);
    console.log('请手动登录并通过滑块，然后保持该窗口不关闭。');
    console.log('接下来新开一个终端运行： node scripts/aixiang-cdp-check.mjs');
  });
}

tryLaunch();
