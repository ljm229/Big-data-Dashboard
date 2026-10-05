import { chromium } from 'playwright'
import path from 'node:path'
import fs from 'node:fs/promises'

const baseDir = path.resolve('.')
export const outputDir = path.join(baseDir, 'output')

export const NR_URL = 'https://nr.ele.me/app/eleme-nr-bfe-newretail/common-next#/pc/homePagePc/'

export async function loadEnv() {
  const raw = await fs.readFile(path.join(baseDir, '.env'), 'utf8').catch(() => '')
  const env = {}
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
  return env
}

export async function launchNrContext() {
  const userDataDir = path.join(baseDir, '.browser-data', 'nr')
  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    channel: 'chrome',
    viewport: { width: 1600, height: 1000 },
    acceptDownloads: true,
    ignoreDefaultArgs: ['--enable-automation'],
    args: [
      '--disable-blink-features=AutomationControlled',
      '--disable-features=AutomationControlled',
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
  return { context, page }
}

export async function loginFrame(page) {
  for (const frame of page.frames()) {
    const n = await frame.locator('input[placeholder="请输入您的账号"]').count().catch(() => 0)
    if (n) return frame
  }
  return null
}

/** 处理「请先阅读并同意商家端《隐私政策》」等确认弹窗，成功点击返回 true */
export async function handleAgreementDialog(page) {
  for (const frame of page.frames()) {
    const hit = await frame.evaluate(() => {
      const norm = (s) => (s || '').replace(/\s+/g, '')
      const wanted = /^(同意|确定|确认|继续登录|我同意)$/
      const containers = Array.from(document.querySelectorAll(
        '.ant-modal, .ant-modal-root, [class*="modal"], [class*="dialog"], [class*="Dialog"], [class*="Modal"]',
      ))
      for (const c of containers) {
        const t = c.textContent || ''
        if (!/请先阅读并同意|隐私政策|用户协议|服务协议/.test(t)) continue
        const btns = Array.from(c.querySelectorAll('button, a[role="button"], [class*="btn"]'))
          .filter((b) => wanted.test(norm(b.textContent)))
        for (const b of btns) {
          const r = b.getBoundingClientRect()
          if (r.width > 0 && r.height > 0) return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
        }
      }
      // 兜底：全局可见的「同意」按钮
      const any = Array.from(document.querySelectorAll('button'))
        .filter((b) => norm(b.textContent) === '同意')
        .find((b) => {
          const r = b.getBoundingClientRect()
          return r.width > 0 && r.height > 0
        })
      if (any) {
        const r = any.getBoundingClientRect()
        return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
      }
      return null
    }).catch(() => null)
    if (hit) {
      await page.mouse.move(hit.x, hit.y)
      await page.waitForTimeout(200)
      await page.mouse.click(hit.x, hit.y)
      await page.waitForTimeout(1500)
      return true
    }
  }
  return false
}

/** Chrome 启动时的「要恢复页面吗？」气泡：带「恢复/取消」两个按钮，点恢复 */
export async function dismissRestoreBubble(page) {
  const shot = await page.screenshot({ type: 'jpeg', quality: 30 }).catch(() => null)
  if (!shot) return false
  // 该气泡不是页面 DOM，无 JS 句柄；用键盘 Escape 关闭最稳妥
  await page.keyboard.press('Escape').catch(() => {})
  await page.waitForTimeout(300)
  return false
}

export async function ensureLoggedIn(page, options = {}) {
  const quiet = options.quiet ?? false
  const log = (...a) => { if (!quiet) console.log(...a) }
  const env = await loadEnv()
  const account = process.env.NR_ACCOUNT || env.NR_ACCOUNT || ''
  const password = process.env.NR_PASSWORD || env.NR_PASSWORD || ''

  await page.goto(NR_URL, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.waitForTimeout(6000)
  await page.keyboard.press('Escape').catch(() => {})

  let onLoginPage = await loginFrame(page)
  if (!onLoginPage && !/nr\.ele\.me/.test(page.url())) {
    await page.waitForTimeout(3000)
    onLoginPage = await loginFrame(page)
  }

  if (!onLoginPage) {
    log('[登录] 已是登录态')
    for (let i = 0; i < 3; i += 1) {
      if (!(await handleAgreementDialog(page))) break
      log('[登录] 关闭协议弹窗')
    }
    return true
  }

  if (!account || !password) {
    throw new Error('缺少账号或密码，请在 automation/.env 中配置 NR_ACCOUNT / NR_PASSWORD')
  }

  log('[登录] 填写账号密码')
  const acc = onLoginPage.locator('input[placeholder="请输入您的账号"]').first()
  const pwd = onLoginPage.locator('input[placeholder="请输入您的密码"]').first()
  await acc.click()
  await acc.fill(account)
  await page.waitForTimeout(400)
  await pwd.click()
  await pwd.fill(password)
  await page.waitForTimeout(600)

  for (const frame of page.frames()) {
    const res = await frame.evaluate(() => {
      const boxes = Array.from(document.querySelectorAll('input[type="checkbox"]'))
        .filter((e) => e.getBoundingClientRect().width > 0)
      if (!boxes.length) return 'nobox'
      const unchecked = boxes.filter((b) => !b.checked)
      if (!unchecked.length) return 'already'
      unchecked[unchecked.length - 1].click()
      return 'checked'
    }).catch(() => '')
    if (res === 'checked' || res === 'already') break
  }
  await page.waitForTimeout(600)

  for (let i = 0; i < 4; i += 1) {
    if (await handleAgreementDialog(page)) {
      log('[登录] 提交前出现协议弹窗，已同意')
      await page.waitForTimeout(1500)
    } else break
  }

  log('[登录] 提交')
  const btn = onLoginPage.locator('button.eb-login-button, button:has-text("登 录")').first()
  if (await btn.count().catch(() => 0)) await btn.click({ timeout: 10000 }).catch(() => {})
  else await onLoginPage.getByRole('button', { name: /登\s*录/ }).first().click({ timeout: 10000 }).catch(() => {})

  const deadline = Date.now() + 180000
  let loggedIn = false
  let agreeCount = 0
  while (Date.now() < deadline && !loggedIn) {
    await page.waitForTimeout(3000)
    if (agreeCount < 5 && await handleAgreementDialog(page)) {
      agreeCount += 1
      log(`[登录] 检测到协议弹窗，已点击「同意」（第 ${agreeCount} 次），重新提交登录`)
      await page.waitForTimeout(2500)
      const again = await loginFrame(page)
      if (again) {
        const b2 = again.locator('button.eb-login-button, button:has-text("登 录")').first()
        if (await b2.count().catch(() => 0)) await b2.click({ timeout: 8000 }).catch(() => {})
      }
      continue
    }
    if (!/eb_login|login/i.test(page.url())) { loggedIn = true; break }
    const still = await loginFrame(page)
    if (!still) { loggedIn = true; break }
    const bodyText = await still.locator('body').innerText({ timeout: 4000 }).catch(() => '')
    if (/验证码|滑块|请拖动|安全验证/.test(bodyText)) {
      log('[登录] 检测到验证码/滑块，需人工处理（最多等 3 分钟）')
    }
  }

  await page.waitForTimeout(4000)
  for (let i = 0; i < 3; i += 1) {
    if (!(await handleAgreementDialog(page))) break
    log('[登录] 登录后关闭协议弹窗')
  }
  if (!loggedIn) throw new Error('登录超时')
  log('[登录] 成功')
  return true
}

export async function dumpPage(page, name) {
  await page.screenshot({ path: path.join(outputDir, `${name}.png`), fullPage: true }).catch(() => {})
  const parts = []
  parts.push(`FRAMES (${page.frames().length}):\n` + page.frames().map((f) => `  - ${f.url().slice(0, 160)}`).join('\n'))
  for (const frame of page.frames()) {
    const t = await frame.locator('body').innerText({ timeout: 5000 }).catch(() => '')
    if (t && t.trim()) parts.push(`===== FRAME ${frame.url().slice(0, 130)} =====\n${t}`)
  }
  // 补充：shadow DOM 内的文本（该后台主内容区可能挂在 shadow root）
  for (const frame of page.frames()) {
    const shadows = await frame.evaluate(() => {
      const out = []
      const hosts = []
      const collect = (root) => {
        const els = Array.from(root.querySelectorAll('*'))
        for (const el of els) {
          if (el.shadowRoot) hosts.push(el)
        }
      }
      collect(document)
      for (let i = 0; i < hosts.length && i < 12; i += 1) {
        const t = (hosts[i].shadowRoot.textContent || '').replace(/\s+/g, ' ').trim()
        if (t) out.push(`[shadow ${i}] ${t.slice(0, 2000)}`)
      }
      return out
    }).catch(() => [])
    if (shadows.length) parts.push(`===== SHADOW @ ${frame.url().slice(0, 100)} =====\n${shadows.join('\n')}`)
  }
  await fs.writeFile(path.join(outputDir, `${name}.txt`), parts.join('\n\n'), 'utf8').catch(() => {})
}

/** 计算 frame 相对于顶层页面的偏移，用于把 iframe 内坐标换算成页面绝对坐标 */
export async function frameOffset(frame) {
  let x = 0
  let y = 0
  let cur = frame
  while (cur && cur.parentFrame()) {
    try {
      const el = await cur.frameElement()
      const box = el ? await el.boundingBox() : null
      if (box) {
        x += box.x
        y += box.y
      }
    } catch {}
    cur = cur.parentFrame()
  }
  return { x, y }
}

/** 用真实鼠标点击（避免 React 重渲染让 locator 失效）；自动处理 iframe 坐标偏移 */
export async function mouseClickByText(page, text, options = {}) {
  const exact = options.exact ?? true
  const timeout = options.timeout ?? 30000
  const deadline = Date.now() + timeout
  while (Date.now() < deadline) {
    for (const frame of page.frames()) {
      const hit = await frame.evaluate(({ t, exact }) => {
        const norm = (s) => (s || '').replace(/\s+/g, '')
        const all = Array.from(document.querySelectorAll('a, span, div, li, button, label'))
        let cands = all.filter((e) => (exact ? norm(e.textContent) === norm(t) : norm(e.textContent).includes(norm(t))))
        if (!cands.length) return null
        cands.sort((a, b) => (a.textContent || '').length - (b.textContent || '').length)
        const el = cands[0]
        el.scrollIntoView({ block: 'center' })
        const clickable = el.closest('a') || el.closest('button') || el.closest('li') || el
        const r = clickable.getBoundingClientRect()
        if (r.width <= 0 || r.height <= 0) return null
        return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
      }, { t: text, exact }).catch(() => null)
      if (hit) {
        const off = await frameOffset(frame)
        const ax = off.x + hit.x
        const ay = off.y + hit.y
        await page.mouse.move(ax, ay)
        await page.waitForTimeout(250)
        await page.mouse.click(ax, ay)
        await page.waitForTimeout(1500)
        return true
      }
    }
    await page.waitForTimeout(800)
  }
  return false
}
