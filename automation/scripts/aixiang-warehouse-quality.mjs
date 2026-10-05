import { chromium } from 'playwright'
import path from 'node:path'
import fs from 'node:fs/promises'

const baseDir = path.resolve('.')
const outputDir = path.join(baseDir, 'output')
const downloadDir = path.join(outputDir, 'aixiang-warehouse')
await fs.mkdir(downloadDir, { recursive: true })

const manualStorage = path.join(outputDir, 'aixiang-manual-storage.json')
const browser = await chromium.launch({ headless: false, channel: 'chrome' })
const context = await browser.newContext({
  viewport: { width: 1440, height: 960 },
  acceptDownloads: true,
  storageState: manualStorage,
})
const page = context.pages()[0] ?? await context.newPage()

async function saveDebug(step) {
  await page.screenshot({ path: path.join(outputDir, `wh-${step}.png`), fullPage: true }).catch(() => {})
  const parts = []
  for (const frame of page.frames()) {
    const t = await frame.locator('body').innerText({ timeout: 5000 }).catch(() => '')
    if (t && t.trim()) parts.push(`===== FRAME ${frame.url().slice(0, 100)} =====\n${t}`)
  }
  await fs.writeFile(path.join(outputDir, `wh-${step}.txt`), parts.join('\n\n'), 'utf8').catch(() => {})
}

async function dismissMutePopup() {
  for (let i = 0; i < 3; i += 1) {
    let handled = false
    for (const frame of page.frames()) {
      try {
        const ignoreBtn = frame.getByRole('button', { name: '忽略', exact: true }).first()
        if ((await ignoreBtn.count().catch(() => 0)) && (await ignoreBtn.isVisible().catch(() => false))) {
          await ignoreBtn.click({ timeout: 5000 }).catch(() => {})
          await page.waitForTimeout(800)
          handled = true
          break
        }
      } catch {}
    }
    if (!handled) break
  }
}

async function clickText(text, options = {}) {
  console.log(`[点击] ${text}`)
  await dismissMutePopup()
  const timeout = options.timeout ?? 30000
  const exact = options.exact ?? true
  const deadline = Date.now() + timeout
  let lastError = ''
  while (Date.now() < deadline) {
    for (const frame of page.frames()) {
      try {
        const locator = frame.getByText(text, { exact }).first()
        if ((await locator.count().catch(() => 0)) && (await locator.isVisible().catch(() => false))) {
          await locator.click({ timeout: 5000 })
          await page.waitForTimeout(600)
          await dismissMutePopup()
          return
        }
      } catch (e) {
        lastError = String(e).slice(0, 160)
      }
      try {
        const jsHit = await frame.evaluate((t) => {
          const norm = (s) => (s || '').replace(/\s+/g, '')
          const all = Array.from(document.querySelectorAll('button, span, div, a, label'))
          const cands = all.filter((e) => norm(e.textContent) === norm(t))
            .filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 })
          cands.sort((a, b) => (a.textContent || '').length - (b.textContent || '').length)
          if (!cands.length) return ''
          const el = cands[0]
          const target = el.closest('button') || el
          target.scrollIntoView({ block: 'center' })
          target.click()
          if (el !== target) el.click()
          return 'clicked:' + el.tagName
        }, text).catch(() => '')
        if (jsHit.startsWith('clicked')) {
          console.log(`[点击][JS兜底] ${text}`)
          await page.waitForTimeout(800)
          await dismissMutePopup()
          return
        }
      } catch {}
    }
    await page.waitForTimeout(1000)
    await dismissMutePopup()
  }
  throw new Error(`点击超时：${text} ${lastError}`)
}

async function waitForText(text, timeout = 60000) {
  console.log(`[等待] ${text}`)
  const deadline = Date.now() + timeout
  while (Date.now() < deadline) {
    await dismissMutePopup()
    for (const frame of page.frames()) {
      try {
        const locator = frame.getByText(text, { exact: true }).first()
        if ((await locator.count().catch(() => 0)) && (await locator.isVisible().catch(() => false))) return
      } catch {}
      try {
        const bodyText = await frame.locator('body').innerText({ timeout: 3000 }).catch(() => '')
        if (bodyText && bodyText.includes(text)) return
      } catch {}
    }
    await page.waitForTimeout(1000)
  }
  throw new Error(`等待超时：${text}`)
}

async function clickMenuItem(text) {
  console.log(`[菜单] ${text}`)
  for (let attempt = 0; attempt < 10; attempt += 1) {
    for (const frame of page.frames()) {
      const hit = await frame.evaluate((t) => {
        const norm = (s) => (s || '').replace(/\s+/g, '')
        const all = Array.from(document.querySelectorAll('a, span, div, li'))
        const cands = all.filter((e) => norm(e.textContent) === norm(t))
        if (!cands.length) return null
        cands.sort((a, b) => (a.textContent || '').length - (b.textContent || '').length)
        const el = cands[0]
        let scrollHost = el.parentElement
        while (scrollHost && scrollHost !== document.body) {
          const st = getComputedStyle(scrollHost)
          if (/(auto|scroll)/.test(st.overflowY) && scrollHost.scrollHeight > scrollHost.clientHeight + 4) {
            scrollHost.scrollTop = Math.max(0, el.offsetTop - 200)
            break
          }
          scrollHost = scrollHost.parentElement
        }
        el.scrollIntoView({ block: 'center' })
        const clickable = el.closest('a') || el.closest('li') || el
        const r = clickable.getBoundingClientRect()
        if (r.width <= 0 || r.height <= 0) return null
        return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
      }, text).catch(() => null)
      if (!hit) continue
      await page.mouse.move(hit.x, hit.y)
      await page.waitForTimeout(300)
      await page.mouse.click(hit.x, hit.y)
      console.log(`[菜单] ${text} 已点击 (${Math.round(hit.x)},${Math.round(hit.y)})`)
      await page.waitForTimeout(3000)
      await dismissMutePopup()
      return true
    }
    await page.waitForTimeout(1000)
  }
  throw new Error(`菜单项未找到或不可点：${text}`)
}

const getArg = (n) => (process.argv.find((a) => a.startsWith(`--${n}=`)) || '').slice(n.length + 3)
const dateArg = getArg('date')
const datesSpec = getArg('dates')
const rangeArg = getArg('range')
const wantDownload = !process.argv.includes('--no-download')

function expandDateList(spec) {
  const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  const out = []
  for (const part of spec.split(',').map((s) => s.trim()).filter(Boolean)) {
    const m = part.match(/^(\d{4}-\d{2}-\d{2})\s*(?:\.\.|~|至)\s*(\d{4}-\d{2}-\d{2})$/)
    if (m) {
      const cur = new Date(`${m[1]}T12:00:00`)
      const end = new Date(`${m[2]}T12:00:00`)
      while (cur <= end) { out.push(fmt(cur)); cur.setDate(cur.getDate() + 1) }
    } else {
      out.push(part)
    }
  }
  return out
}

async function ensureWarehousePage() {
  await page.goto('https://saas-retail.ele.me/#/data/home', { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.waitForTimeout(4000)
  await dismissMutePopup()
  if (!(await page.locator('body').innerText()).includes('海安闪玩家技术服务有限公司')) {
    throw new Error('未确认翱象企业会话，请先完成登录验证')
  }
  await clickText('闪购仓')
  await page.waitForTimeout(1500)
  await dismissMutePopup()
  let ok = false
  try { await clickMenuItem('门店营运质量'); ok = true } catch {}
  if (!ok) {
    console.log('[菜单] 未找到，重试展开“闪购仓”')
    try { await clickText('闪购仓') } catch {}
    await page.waitForTimeout(1500)
    await clickMenuItem('门店营运质量')
  }
  await page.waitForTimeout(3000)
  await dismissMutePopup()
}

async function selectDayMode() {
  for (const frame of page.frames()) {
    const res = await frame.evaluate(() => {
      const norm = (s) => (s || '').replace(/\s+/g, '')
      const radios = Array.from(document.querySelectorAll('input[type="radio"]'))
      const dayRadio = radios.find((r) => {
        const label = r.closest('label')
        return label && norm(label.textContent) === '日'
      })
      if (!dayRadio) return 'noradio'
      const label = dayRadio.closest('label')
      label.scrollIntoView({ block: 'center' })
      if (dayRadio.checked) return 'already'
      label.click()
      return 'clicked'
    }).catch(() => 'err')
    if (res === 'clicked' || res === 'already') {
      console.log('[周期] 日模式:', res)
      await page.waitForTimeout(3000)
      return true
    }
  }
  console.log('[周期] 未找到“日”按钮，尝试文本点击')
  try { await clickText('日') } catch {}
  await page.waitForTimeout(3000)
  return false
}

async function openDatePicker() {
  for (const frame of page.frames()) {
    try {
      const opener = frame.locator('.ant-picker-input input, .ant-picker input').first()
      if (!(await opener.count().catch(() => 0))) continue
      await opener.scrollIntoViewIfNeeded().catch(() => {})
      await opener.click({ timeout: 8000 })
      await page.waitForTimeout(1500)
      return true
    } catch {}
  }
  console.log('[日期] 未找到日期输入框')
  return false
}

async function ensureMonthVisible(f2, dateStr) {
  const [y, m] = dateStr.split('-').map(Number)
  for (let step = 0; step < 14; step += 1) {
    const st = await f2.evaluate((want) => {
      const root = document.querySelector('.ant-picker-dropdown') || document
      const vis = Array.from(root.querySelectorAll(`td[title="${want.d}"]`))
        .filter((c) => { const r = c.getBoundingClientRect(); return r.width > 0 && r.height > 0 })
      if (vis.length) return 'hit'
      const headers = Array.from(root.querySelectorAll('.ant-picker-header'))
      if (!headers.length) return 'noheader'
      let moved = false
      for (const header of headers) {
        const hm = ((header.textContent || '').match(/(\d{4})年\s*(\d{1,2})月/))
        if (!hm) continue
        const diff = (want.y - Number(hm[1])) * 12 + (want.m - Number(hm[2]))
        if (diff === 0) continue
        const btn = header.querySelector(diff > 0 ? '.ant-picker-header-next-btn' : '.ant-picker-header-prev-btn')
          || header.querySelector(diff > 0 ? '.ant-picker-header-super-next-btn' : '.ant-picker-header-super-prev-btn')
        if (btn) { btn.click(); moved = true }
      }
      return moved ? 'moved' : 'stuck'
    }, { d: dateStr, y, m }).catch(() => 'err')
    if (st === 'hit') return true
    if (st === 'stuck' || st === 'noheader' || st === 'err') return false
    await page.waitForTimeout(700)
  }
  return false
}
async function pickDate(title) {
  for (const f2 of page.frames()) {
    if (!(await ensureMonthVisible(f2, title))) continue
    const res = await f2.evaluate((d) => {
      const cells = Array.from(document.querySelectorAll(`td[title="${d}"]`))
        .filter((c) => { const r = c.getBoundingClientRect(); return r.width > 0 && r.height > 0 })
      if (!cells.length) return ''
      cells[0].scrollIntoView({ block: 'center' })
      cells[0].click()
      return 'clicked'
    }, title).catch(() => '')
    if (res === 'clicked') return true
  }
  return false
}

async function setSingleDay(dateStr) {
  console.log(`[日期] 设为单日: ${dateStr}`)
  if (!(await openDatePicker())) return false
  const a = await pickDate(dateStr)
  await page.waitForTimeout(900)
  const b = await pickDate(dateStr)
  if (!a || !b) {
    throw new Error(`[日期] 点选失败 起:${a} 止:${b}（${dateStr}），已停止（拒绝用默认日期导出）`)
  }
  await page.waitForTimeout(2500)
  for (const frame of page.frames()) {
    const vals = await frame.evaluate(() => Array.from(document.querySelectorAll('.ant-picker-input input')).map((i) => i.value)).catch(() => [])
    if (vals.filter(Boolean).length) {
      console.log('[日期] 输入框当前值:', JSON.stringify(vals))
      break
    }
  }
  return true
}

async function setDateRange(start, end) {
  console.log(`[日期] 设为区间: ${start} -> ${end}`)
  if (!(await openDatePicker())) return false
  await pickDate(start)
  await page.waitForTimeout(900)
  await pickDate(end)
  await page.waitForTimeout(2500)
  return true
}

async function downloadOnce(tag = '') {
  // 优先精确定位「门店营运考核指标」模块内的下载按钮
  let target = null
  for (const frame of page.frames()) {
    const marked = await frame.evaluate((moduleTitle) => {
      document.querySelectorAll('[data-zx-dl]').forEach((e) => e.removeAttribute('data-zx-dl'))
      const norm = (s) => (s || '').replace(/\s+/g, '')
      const leaves = Array.from(document.querySelectorAll('div, span, h3, h4'))
        .filter((e) => norm(e.textContent) === norm(moduleTitle))
        .filter((e) => !Array.from(e.children).some((c) => norm(c.textContent) === norm(moduleTitle)))
      for (const leaf of leaves) {
        let node = leaf
        for (let up = 0; up < 8 && node; up += 1) {
          const btn = Array.from(node.querySelectorAll('button'))
            .find((b) => /^下\s*载$/.test(norm(b.textContent)))
          if (btn) {
            const r = btn.getBoundingClientRect()
            if (r.width > 0 && r.height > 0) {
              btn.setAttribute('data-zx-dl', '1')
              return 'ok'
            }
          }
          node = node.parentElement
        }
      }
      return 'notfound'
    }, '门店营运考核指标').catch(() => '')
    if (marked === 'ok') { target = frame.locator('[data-zx-dl="1"]').first(); break }
  }

  const candidates = []
  if (target) {
    candidates.push(target)
    console.log('[下载] 已定位「门店营运考核指标」模块内的下载按钮')
  }
  for (const frame of page.frames()) {
    try {
      const btns = frame.getByRole('button', { name: /下\s*载/ })
      const n = await btns.count().catch(() => 0)
      for (let i = 0; i < n; i += 1) {
        const btn = btns.nth(i)
        if (await btn.isVisible().catch(() => false)) candidates.push(btn)
      }
    } catch {}
  }
  if (!candidates.length) throw new Error('未找到下载按钮')
  console.log(`[下载] 候选下载按钮数量: ${candidates.length}`)

  for (let idx = 0; idx < candidates.length; idx += 1) {
    const btn = candidates[idx]
    try {
      await btn.scrollIntoViewIfNeeded().catch(() => {})
      const downloadPromise = page.waitForEvent('download', { timeout: 60000 })
      await btn.click({ timeout: 8000 })
      console.log(`[下载] 已点击候选 ${idx + 1}/${candidates.length}，等待文件...`)
      const download = await downloadPromise
      const rawName = download.suggestedFilename() || `aixiang-warehouse-${new Date().toISOString().slice(0, 10)}.xlsx`
      const tagPart = tag ? `_BIZ-${tag.trim()}` : ''
      const filename = rawName.replace(/\.xlsx$/i, `${tagPart}.xlsx`)
      const savePath = path.join(downloadDir, filename)
      await download.saveAs(savePath)
      console.log(`导出成功${tag}：${savePath}`)
      await page.waitForTimeout(2000)
      return savePath
    } catch (e) {
      console.log(`[下载] 候选 ${idx + 1} 在 60s 内无文件，尝试下一个`)
    }
  }
  throw new Error('所有下载按钮均未产出文件')
}

try {
  await ensureWarehousePage()
  await saveDebug('loaded')

  if (process.argv.includes('--inspect')) {
    const frames = []
    for (const frame of page.frames()) {
      const text = await frame.locator('body').innerText({ timeout: 5000 }).catch(() => '')
      const controls = await frame.locator('body *').evaluateAll((elements) => elements
        .filter((e) => /^(日|周|月|按月|下载)$/.test((e.textContent || '').replace(/\s+/g, '')))
        .slice(0, 20)
        .map((e) => ({
          tag: e.tagName,
          text: (e.textContent || '').replace(/\s+/g, '').slice(0, 40),
          cls: (e.className || '').toString().slice(0, 140),
          html: e.outerHTML.slice(0, 700),
        }))).catch(() => [])
      frames.push({ url: frame.url().slice(0, 120), text: text.slice(0, 3000), controls })
    }
    await fs.writeFile(path.join(outputDir, 'wh-frames.json'), JSON.stringify(frames, null, 2))
    throw new Error('页面结构已保存到 output/wh-frames.json，本次仅检查')
  }

  const datesList = datesSpec ? expandDateList(datesSpec) : []

  // 断点续跑：查库跳过已入库日期（库连不上则全跑；--no-resume 强制全跑）
  async function existingQualityDates() {
    try {
      const mysql = (await import('mysql2/promise')).default
      const env = {}
      const envText = await fs.readFile(path.join(baseDir, '.env'), 'utf8').catch(() => '')
      for (const line of envText.split('\n')) {
        const m = line.match(/^\s*([A-Z_]+)=(.*)\s*$/)
        if (m) env[m[1]] = m[2].trim()
      }
      const c = await mysql.createConnection({ host: env.DB_HOST || '127.0.0.1', port: Number(env.DB_PORT || 3306), user: env.DB_USER || 'root', password: env.DB_PASSWORD || '', database: env.DB_NAME || 'dashboard' })
      const [rows] = await c.query(`SELECT DISTINCT DATE_FORMAT(biz_date,'%Y-%m-%d') d FROM fact_store_quality_daily`)
      await c.end()
      return new Set(rows.map((r) => r.d))
    } catch (e) {
      console.log('[断点续跑] 查库失败，本轮不跳过:', String(e).slice(0, 100))
      return new Set()
    }
  }

  if (datesList.length) {
    let todo = datesList
    if (!process.argv.includes('--no-resume')) {
      const done = await existingQualityDates()
      const skipped = todo.filter((d) => done.has(d))
      todo = todo.filter((d) => !done.has(d))
      if (skipped.length) console.log(`[断点续跑] 库中已有 ${skipped.length} 天，跳过：${skipped[0]} → ${skipped[skipped.length - 1]}`)
    }
    console.log(`[批量] 共 ${todo.length} 天：${todo[0]} → ${todo[todo.length - 1]}`)
    await selectDayMode()
    let done = 0
    for (const d of todo) {
      console.log(`\n===== [批量 ${done + 1}/${todo.length}] ${d} =====`)
      try {
        if (!(await setSingleDay(d))) throw new Error('单日设置失败')
        if (wantDownload) {
          await downloadOnce(` ${d}`)
        } else {
          await saveDebug(`wh-${d}`)
        }
        done += 1
      } catch (e) {
        console.error(`[批量] ${d} 失败：`, e instanceof Error ? e.message : e)
      }
    }
    console.log(`\n[批量] 完成 ${done}/${todo.length} 天，文件在 ${downloadDir}`)
  } else {
    await selectDayMode()
    if (rangeArg) {
      const [s, e] = rangeArg.split(',').map((x) => x.trim())
      await setDateRange(s, e)
    } else if (dateArg) {
      await setSingleDay(dateArg)
    } else {
      console.log('[日期] 未指定 --date/--range/--dates，沿用页面默认单日')
    }
    await saveDebug('prepared')
    if (wantDownload) {
      await downloadOnce()
      await saveDebug('success')
    } else {
      console.log('已按 --no-download 跳过导出。')
    }
  }
} catch (error) {
  console.error('失败：', error instanceof Error ? error.message : error)
  await saveDebug('failed')
  process.exitCode = 1
} finally {
  if (!process.argv.includes('--auto-close')) {
    console.log('浏览器保持打开，按 Enter 后关闭。')
    await new Promise((resolve) => {
      const timer = setTimeout(resolve, 300000)
      process.stdin.once('data', () => {
        clearTimeout(timer)
        resolve()
      })
    })
  }
  await context.close().catch(() => {})
  await browser.close().catch(() => {})
}
