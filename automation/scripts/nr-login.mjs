import { chromium } from 'playwright'
import path from 'node:path'
import fs from 'node:fs/promises'

const baseDir = path.resolve('.')
const outputDir = path.join(baseDir, 'output')
const downloadDir = path.join(outputDir, 'aixiang-nr')
await fs.mkdir(downloadDir, { recursive: true })

const targetUrl = 'https://nr.ele.me/app/eleme-nr-bfe-newretail/common-next#/pc/homePagePc/'
const userDataDir = path.join(baseDir, '.browser-data', 'nr')

async function loadEnv() {
  const envPath = path.join(baseDir, '.env')
  const raw = await fs.readFile(envPath, 'utf8').catch(() => '')
  const env = {}
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
  return env
}

const env = await loadEnv()
const account = process.env.NR_ACCOUNT || env.NR_ACCOUNT || ''
const password = process.env.NR_PASSWORD || env.NR_PASSWORD || ''

const context = await chromium.launchPersistentContext(userDataDir, {
  headless: false,
  channel: 'chrome',
  viewport: { width: 1440, height: 960 },
  acceptDownloads: true,
  ignoreDefaultArgs: ['--enable-automation'],
  args: [
    '--disable-blink-features=AutomationControlled',
    '--disable-features=AutomationControlled',
    // 抑制「要恢复页面吗？」「Chrome 未正确关闭」等启动气泡
    '--hide-crash-restore-bubble',
    '--disable-session-crashed-bubble',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-infobars',
    '--disable-search-engine-choice-screen',
  ],
})
await context.addInitScript(() => {
  Object.defineProperty(navigator, 'webdriver', { get: () => undefined })
})

const page = context.pages()[0] ?? await context.newPage()
page.setDefaultTimeout(30000)

async function saveDebug(step) {
  await page.screenshot({ path: path.join(outputDir, `nr-${step}.png`), fullPage: true }).catch(() => {})
  const parts = []
  for (const frame of page.frames()) {
    const t = await frame.locator('body').innerText({ timeout: 5000 }).catch(() => '')
    if (t && t.trim()) parts.push(`===== FRAME ${frame.url().slice(0, 120)} =====\n${t}`)
  }
  await fs.writeFile(path.join(outputDir, `nr-${step}.txt`), parts.join('\n\n'), 'utf8').catch(() => {})
}

async function loginFrame() {
  for (const frame of page.frames()) {
    const n = await frame.locator('input[placeholder="请输入您的账号"]').count().catch(() => 0)
    if (n) return frame
  }
  return null
}

// 处理“请先阅读并同意商家端《隐私政策》”协议弹窗
async function handleAgreementDialog() {
  for (const frame of page.frames()) {
    const hit = await frame.evaluate(() => {
      const norm = (s) => (s || '').replace(/\s+/g, '')
      const center = (el) => {
        const r = el.getBoundingClientRect()
        if (r.width <= 0 || r.height <= 0) return null
        return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
      }
      const containers = Array.from(document.querySelectorAll(
        '.ant-modal, .ant-modal-root, .ant-confirm, [class*="modal"], [class*="dialog"], [class*="popup"]'
      ))
      for (const c of containers) {
        const t = c.textContent || ''
        if (!/请先阅读并同意|同意.{0,12}隐私政策/.test(t)) continue
        const btn = Array.from(c.querySelectorAll('button'))
          .find((b) => /^(同\s*意|确\s*定|继续登录)$/.test(norm(b.textContent)))
        if (!btn) continue
        const p = center(btn)
        if (p) return p
      }
      const fallback = Array.from(document.querySelectorAll('button'))
        .filter((b) => /^同\s*意$/.test(norm(b.textContent)))
        .map((b) => center(b))
        .find(Boolean)
      return fallback || null
    }).catch(() => null)
    if (hit) {
      await page.mouse.move(hit.x, hit.y)
      await page.waitForTimeout(200)
      await page.mouse.click(hit.x, hit.y)
      return true
    }
  }
  return false
}


try {
  console.log(`[打开] ${targetUrl}`)
  await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.waitForTimeout(6000)

  if (process.argv.includes('--inspect')) {
    const frames = []
    for (const frame of page.frames()) {
      const text = await frame.locator('body').innerText({ timeout: 5000 }).catch(() => '')
      const inputs = await frame.locator('input').evaluateAll((els) => els.slice(0, 20).map((e) => ({
        type: e.type,
        name: e.name,
        id: e.id,
        placeholder: e.placeholder,
        cls: String(e.className).slice(0, 120),
        visible: e.getBoundingClientRect().width > 0 && e.getBoundingClientRect().height > 0,
      }))).catch(() => [])
      const buttons = await frame.locator('button, a[role="button"], .next-btn, .ant-btn').evaluateAll((els) => els.slice(0, 25).map((e) => ({
        tag: e.tagName,
        text: (e.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 40),
        cls: String(e.className).slice(0, 120),
        visible: e.getBoundingClientRect().width > 0 && e.getBoundingClientRect().height > 0,
      }))).catch(() => [])
      frames.push({ url: frame.url().slice(0, 140), text: text.slice(0, 2500), inputs, buttons })
    }
    await fs.writeFile(path.join(outputDir, 'nr-frames.json'), JSON.stringify(frames, null, 2))
    console.log('页面结构已保存到 output/nr-frames.json')
    throw new Error('inspect 模式结束')
  }

  // 若已登录，直接结束
  const onLoginPage = await loginFrame()
  if (!onLoginPage) {
    console.log('[登录] 未检测到登录表单，可能已登录。当前 URL:', page.url().slice(0, 120))
    for (const frame of page.frames()) {
      const t = await frame.locator('body').innerText({ timeout: 5000 }).catch(() => '')
      if (t && t.trim()) { console.log('[页面]', t.replace(/\s+/g, ' ').slice(0, 300)); break }
    }
    await saveDebug('already-logged')
  } else {
    if (!account || !password) {
      throw new Error('缺少账号或密码，请在 automation/.env 中配置 NR_ACCOUNT / NR_PASSWORD')
    }
    console.log('[登录] 填写账号密码')
    const acc = onLoginPage.locator('input[placeholder="请输入您的账号"]').first()
    const pwd = onLoginPage.locator('input[placeholder="请输入您的密码"]').first()
    await acc.click()
    await acc.fill(account)
    await page.waitForTimeout(400)
    await pwd.click()
    await pwd.fill(password)
    await page.waitForTimeout(600)

    // 勾选隐私政策
    for (const frame of page.frames()) {
      const res = await frame.evaluate(() => {
        const boxes = Array.from(document.querySelectorAll('input[type="checkbox"]'))
          .filter((e) => e.getBoundingClientRect().width > 0)
        if (!boxes.length) return 'nobox'
        const unchecked = boxes.filter((b) => !b.checked)
        if (!unchecked.length) return 'already'
        const target = unchecked[unchecked.length - 1]
        target.click()
        return 'checked'
      }).catch(() => '')
      if (res === 'checked' || res === 'already') { console.log('[登录] 隐私协议:', res); break }
    }
    await page.waitForTimeout(600)

    // 等协议弹窗出现时先同意（部分情况登录前就会弹）
    for (let i = 0; i < 4; i += 1) {
      if (await handleAgreementDialog()) {
        console.log('[登录] 提交前检测到协议弹窗，已点击「同意」')
        await page.waitForTimeout(2000)
      } else break
    }

    console.log('[登录] 提交')
    const loginBtn = onLoginPage.locator('button.eb-login-button, button:has-text("登 录")').first()
    if (await loginBtn.count().catch(() => 0)) {
      await loginBtn.click({ timeout: 10000 })
    } else {
      await onLoginPage.getByRole('button', { name: /登\s*录/ }).first().click({ timeout: 10000 })
    }

    // 等待跳转或验证码
    const deadline = Date.now() + 180000
    let loggedIn = false
    let agreeCount = 0
    while (Date.now() < deadline && !loggedIn) {
      await page.waitForTimeout(3000)

      // 协议弹窗拦截：点「同意」后重新提交登录
      if (agreeCount < 5 && await handleAgreementDialog()) {
        agreeCount += 1
        console.log(`[登录] 检测到协议弹窗，已点击「同意」（第 ${agreeCount} 次），重新提交登录`)
        await page.waitForTimeout(2500)
        const again = await loginFrame()
        if (again) {
          const btn = again.locator('button.eb-login-button, button:has-text("登 录")').first()
          if (await btn.count().catch(() => 0)) await btn.click({ timeout: 8000 }).catch(() => {})
        }
        continue
      }

      const url = page.url()
      if (!/eb_login|login/i.test(url)) { loggedIn = true; break }
      const stillLogin = await loginFrame()
      if (!stillLogin) { loggedIn = true; break }
      const bodyText = await stillLogin.locator('body').innerText({ timeout: 4000 }).catch(() => '')
      if (/验证码|滑块|请拖动|安全验证/.test(bodyText)) {
        console.log('[登录] 检测到验证码/滑块，需要人工处理，请在弹出的浏览器中完成（最多等 3 分钟）')
      }
    }

    await page.waitForTimeout(4000)
    if (await handleAgreementDialog()) {
      console.log('[登录] 登录后检测到协议弹窗，已点击「同意」')
      await page.waitForTimeout(3000)
    }
    // 兜底：清掉登录成功后可能残留的其他协议确认
    for (let i = 0; i < 3; i += 1) {
      if (!(await handleAgreementDialog())) break
      console.log('[登录] 再次点击「同意」')
      await page.waitForTimeout(2000)
    }
    await saveDebug(loggedIn ? 'logged-in' : 'login-timeout')
    console.log(loggedIn ? '[登录] 成功' : '[登录] 超时，请检查 output/nr-login-timeout.png')
  }} catch (error) {
  console.error('结束：', error instanceof Error ? error.message : error)
  await saveDebug('failed')
} finally {
  if (!process.argv.includes('--auto-close')) {
    console.log('浏览器保持打开，按 Enter 后关闭。')
    await new Promise((resolve) => {
      const timer = setTimeout(() => resolve(), 600000)
      process.stdin.once('data', () => { clearTimeout(timer); resolve() })
    })
  }
  await context.close().catch(() => {})
}
