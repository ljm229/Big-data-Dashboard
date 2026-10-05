import { chromium } from 'playwright'
import path from 'node:path'
import fs from 'node:fs/promises'

const baseDir = path.resolve('.')
const outputDir = path.join(baseDir, 'output')
const downloadDir = path.join(outputDir, 'aixiang-profit')
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
  await page.screenshot({ path: path.join(outputDir, `profit-${step}.png`), fullPage: true }).catch(() => {})
  const parts = []
  for (const frame of page.frames()) {
    const t = await frame.locator('body').innerText({ timeout: 5000 }).catch(() => '')
    if (t && t.trim()) parts.push(`===== FRAME ${frame.url().slice(0, 100)} =====\n${t}`)
  }
  await fs.writeFile(path.join(outputDir, `profit-${step}.txt`), parts.join('\n\n'), 'utf8').catch(() => {})
}

async function dismissMutePopup() {  for (let i = 0; i < 3; i += 1) {
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

const getArg = (n) => (process.argv.find((a) => a.startsWith(`--${n}=`)) || '').slice(n.length + 3)
const periodArg = getArg('period')
const dateArg = getArg('date')
const rangeArg = getArg('range')
const wantStoreView = !process.argv.includes('--overview')
const wantDownload = !process.argv.includes('--no-download')

async function logSelectedTime() {
  for (const frame of page.frames()) {
    try {
      const t = await frame.locator('body').innerText({ timeout: 3000 }).catch(() => '')
      const m = t.match(/已选时间[:：]\s*([^\n]+)/)
      if (m) { console.log('[日期] 已选时间:', m[1].trim()); return }
    } catch {}
  }
}

async function clickRadio(value, label) {
  try { await clickText(label) } catch {}
  await page.waitForTimeout(1200)
  for (const frame of page.frames()) {
    try {
      const hasOpener = await frame.locator('.ant-picker-input input, .ant-picker input').count().catch(() => 0)
      if (hasOpener) return true
      const checked = await frame.locator(`input[type="radio"][value="${value}"]`).isChecked().catch(() => false)
      if (checked) return true
    } catch {}
  }
  for (const frame of page.frames()) {
    try {
      const radio = frame.locator(`input[type="radio"][value="${value}"]`).first()
      if (await radio.count().catch(() => 0)) {
        await radio.click({ timeout: 5000, force: true }).catch(() => {})
        await page.waitForTimeout(1200)
        return true
      }
    } catch {}
  }
  return true
}

async function openPickerPanel() {
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
async function pickCellsAcrossFrames(titles, needOk = true) {
  for (const title of titles) {
    let ok = false
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
      if (res === 'clicked') { ok = true; break }
    }
    if (!ok) { console.log(`[日期] 未点中 ${title}`); return false }
    await page.waitForTimeout(800)
  }
  if (needOk) {
    for (const f2 of page.frames()) {
      const res = await f2.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('.ant-picker-dropdown button, .ant-picker-panel button'))
          .filter((b) => /确定|确认|^OK$/i.test((b.textContent || '').trim()))
          .filter((b) => { const r = b.getBoundingClientRect(); return r.width > 0 && r.height > 0 })
        if (!btns.length) return ''
        btns[btns.length - 1].click()
        return 'ok'
      }).catch(() => '')
      if (res === 'ok') break
    }
  }
  return true
}

async function ensureProfitPage() {
  await page.goto('https://saas-retail.ele.me/#/data/home', { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.waitForTimeout(4000)
  await dismissMutePopup()
  if (!(await page.locator('body').innerText()).includes('海安闪玩家技术服务有限公司')) {
    throw new Error('未确认翱象企业会话，请先完成登录验证')
  }
  await clickText('数据')
  await page.waitForTimeout(1500)
  await dismissMutePopup()
  let ok = false
  try { await clickMenuItem('盈亏分析'); ok = true } catch {}
  if (!ok) {
    console.log('[菜单] 未找到，尝试展开“盈亏”分组后重试')
    try { await clickText('盈亏') } catch {}
    await page.waitForTimeout(1500)
    try { await clickMenuItem('盈亏分析'); ok = true } catch {}
  }
  if (!ok) {
    console.log('[菜单] 仍未找到，重新展开“数据”后重试')
    try { await clickText('数据') } catch {}
    await page.waitForTimeout(1500)
    try { await clickText('盈亏') } catch {}
    await page.waitForTimeout(1200)
    await clickMenuItem('盈亏分析')
  }
  await page.waitForTimeout(3000)
  await dismissMutePopup()
  for (const frame of page.frames()) {
    const t = await frame.locator('body').innerText({ timeout: 5000 }).catch(() => '')
    if (t.includes('已选时间')) { console.log('[页面] 盈亏分析页已加载'); break }
  }
  await waitForText('概览', 60000)
  await page.waitForTimeout(3000)
}

async function setDateSingle(dateStr) {
  console.log(`[日期] 自定义单天: ${dateStr}`)
  await clickRadio('custom', '自定义')
  await openPickerPanel()
  const ok = await pickCellsAcrossFrames([dateStr, dateStr])
  if (!ok) console.log('[日期] 单天点选失败，继续用当前筛选')
  await page.waitForTimeout(3000)
  await logSelectedTime()
}

async function setDateRange(start, end) {
  console.log(`[日期] 自定义区间: ${start} -> ${end}`)
  await clickRadio('custom', '自定义')
  await openPickerPanel()
  const ok = await pickCellsAcrossFrames([start, ...(end && end !== start ? [end] : [start])])
  if (!ok) console.log('[日期] 区间点选失败，继续用当前筛选')
  await page.waitForTimeout(3000)
  await logSelectedTime()
}

async function switchStoreView() {
  let switched = false
  for (const frame of page.frames()) {
    const res = await frame.evaluate(() => {
      const norm = (s) => (s || '').replace(/\s+/g, '')
      const tabs = Array.from(document.querySelectorAll('[class*="tab"], [role="tab"], [class*="Tab"]'))
      const hit = tabs.find((e) => norm(e.textContent) === '门店')
      if (!hit) return 'notab'
      hit.scrollIntoView({ block: 'center' })
      hit.click()
      return 'clicked'
    }).catch(() => 'err')
    if (res === 'clicked') { switched = true; break }
  }
  if (!switched) {
    try { await clickText('门店') } catch {}
  }
  await page.waitForTimeout(3500)
  console.log('[视图] 门店维度切换:', switched ? 'ok' : '兜底点击')
}

async function applyFieldFilter() {
  let filterOpened = false
  for (const frame of page.frames()) {
    try {
      const btn = frame.getByRole('button', { name: /字段过滤/ }).first()
      if ((await btn.count().catch(() => 0)) && (await btn.isVisible().catch(() => false))) {
        await btn.scrollIntoViewIfNeeded().catch(() => {})
        await btn.click({ timeout: 8000 })
        filterOpened = true
        break
      }
    } catch {}
  }
  if (!filterOpened) {
    for (const frame of page.frames()) {
      const res = await frame.evaluate(() => {
        const norm = (s) => (s || '').replace(/\s+/g, '')
        const all = Array.from(document.querySelectorAll('button, span, div'))
        const cands = all.filter((e) => norm(e.textContent).includes('字段过滤'))
          .filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 })
        cands.sort((a, b) => (a.textContent || '').length - (b.textContent || '').length)
        if (!cands.length) return ''
        const el = cands[0]
        const target = el.closest('button') || el
        target.scrollIntoView({ block: 'center' })
        target.click()
        return 'clicked'
      }).catch(() => '')
      if (res === 'clicked') { filterOpened = true; break }
    }
  }
  if (!filterOpened) {
    console.log('[字段过滤] 未找到字段过滤按钮，跳过')
    return
  }
  await page.waitForTimeout(1800)
  for (const frame of page.frames()) {
    const boxes = frame.locator('input[type="checkbox"]')
    const n = await boxes.count().catch(() => 0)
    if (!n) continue
    console.log('[字段过滤] 复选框总数:', n)
    for (let i = 0; i < n; i += 1) {
      try {
        const box = boxes.nth(i)
        if (await box.isChecked().catch(() => true)) continue
        await box.scrollIntoViewIfNeeded().catch(() => {})
        await box.check({ timeout: 5000 })
      } catch {}
    }
    const verify = await frame.evaluate(() => {
      const bs = Array.from(document.querySelectorAll('input[type="checkbox"]'))
      const confirm = Array.from(document.querySelectorAll('button')).map((b) => (b.textContent || '').replace(/\s+/g, '').slice(0, 12)).find((t) => t.startsWith('确定'))
      return `checkbox:${bs.filter((b) => b.checked).length}/${bs.length} confirm:${confirm || 'none'}`
    }).catch(() => '')
    if (verify) console.log('[字段过滤] 勾选后:', verify)
  }
  let confirmed = false
  for (const frame of page.frames()) {
    try {
      const btn = frame.getByRole('button', { name: /^确定/ }).last()
      if (!(await btn.count().catch(() => 0))) continue
      await btn.scrollIntoViewIfNeeded().catch(() => {})
      await btn.click({ timeout: 8000 })
      await page.waitForTimeout(2000)
      confirmed = true
      break
    } catch (e) {
      console.log('[字段过滤] 确定失败:', String(e).slice(0, 100))
    }
  }
  if (!confirmed) console.log('[字段过滤] 未找到确定按钮')
  await page.waitForTimeout(3000)
}

async function downloadExport(tag = '') {
  let exportClicked = false
  const saveName = (download) => {
    const base = download.suggestedFilename() || `aixiang-profit-${new Date().toISOString().slice(0, 10)}.xlsx`
    const tagPart = tag ? `_BIZ-${tag.trim()}` : ''
    return base.replace(/\.xlsx$/i, `${tagPart}.xlsx`)
  }
  for (const frame of page.frames()) {
    try {
      const dl = frame.getByRole('button', { name: /下\s*载/ }).first()
      if (!(await dl.count().catch(() => 0))) continue
      await dl.scrollIntoViewIfNeeded().catch(() => {})
      await dl.hover().catch(() => {})
      await page.waitForTimeout(1000)
      await dl.click({ timeout: 8000 })
      console.log('[下载] 已点击下载按钮')
      await page.waitForTimeout(2000)
      const item = frame.getByText('导出格式化数据', { exact: true }).last()
      if (!(await item.count().catch(() => 0))) continue
      await item.scrollIntoViewIfNeeded().catch(() => {})
      const downloadPromise = page.waitForEvent('download', { timeout: 120000 })
      await item.click({ timeout: 8000 })
      const download = await downloadPromise
      const savePath = path.join(downloadDir, saveName(download))
      await download.saveAs(savePath)
      console.log(`导出成功${tag}：${savePath}`)
      exportClicked = true
      break
    } catch (e) {
      console.log('[导出] 尝试失败:', String(e).slice(0, 120))
    }
  }
  if (!exportClicked) {
    console.log('[导出] 未直接触发下载，转去导出记录查找')
    try { await clickText('导出记录', { timeout: 15000 }) } catch { console.log('[导出记录] 未找到入口') }
    await page.waitForTimeout(1500)
    try { await clickText('刷新列表', { timeout: 10000 }) } catch {}
    const deadline = Date.now() + 180000
    while (Date.now() < deadline && !exportClicked) {
      for (const frame of page.frames()) {
        try {
          const rows = await frame.locator('tr').evaluateAll((trs) => trs.map((tr) => ({
            text: (tr.innerText || '').slice(0, 160),
            done: /已完成/.test(tr.innerText || ''),
          })).filter((r) => /盈亏/.test(r.text) && /已完成|执行中|失败/.test(r.text))).catch(() => [])
          if (!rows.length) continue
          console.log('[导出记录] 行:', JSON.stringify(rows.slice(0, 3)))
          if (!rows[0].done) break
          const dl = frame.getByText('下载', { exact: true }).first()
          if (!(await dl.count().catch(() => 0))) continue
          await dl.scrollIntoViewIfNeeded().catch(() => {})
          const downloadPromise = page.waitForEvent('download', { timeout: 120000 })
          await dl.click({ timeout: 8000 })
          const download = await downloadPromise
          const savePath = path.join(downloadDir, saveName(download))
          await download.saveAs(savePath)
          console.log(`导出成功(记录)${tag}：${savePath}`)
          exportClicked = true
          break
        } catch (e) {
          console.log('[导出记录] 等待中:', String(e).slice(0, 100))
        }
      }
      if (!exportClicked) {
        try { await clickText('刷新列表', { timeout: 8000 }) } catch {}
        await page.waitForTimeout(5000)
      }
    }
    if (!exportClicked) throw new Error('导出记录中未等到已完成的下载项')
  }
}

function expandDateList(spec) {
  const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  const out = []
  for (const part of spec.split(',').map((s) => s.trim()).filter(Boolean)) {
    const m = part.match(/^(\d{4}-\d{2}-\d{2})\s*(?:\.\.|~|至)\s*(\d{4}-\d{2}-\d{2})$/)
    if (m) {
      const cur = new Date(`${m[1]}T12:00:00`)
      const end = new Date(`${m[2]}T12:00:00`)
      while (cur <= end) {
        out.push(fmt(cur))
        cur.setDate(cur.getDate() + 1)
      }
    } else {
      out.push(part)
    }
  }
  return out
}

try {
  await ensureProfitPage()

  if (process.argv.includes('--inspect')) {
    const frames = []
    for (const frame of page.frames()) {
      const text = await frame.locator('body').innerText({ timeout: 5000 }).catch(() => '')
      frames.push({ url: frame.url().slice(0, 120), text: text.slice(0, 3000) })
    }
    await fs.writeFile(path.join(outputDir, 'profit-frames.json'), JSON.stringify(frames, null, 2))
    throw new Error('页面结构已保存到 output/profit-frames.json，本次仅检查')
  }

  const datesSpec = getArg('dates')
  const datesList = datesSpec ? expandDateList(datesSpec) : []

  // 断点续跑：查库，已入库的日期直接跳过（库连不上则全跑；--no-resume 强制全跑）
  async function existingBizDates(table) {
    try {
      const mysql = (await import('mysql2/promise')).default
      const env = {}
      const envText = await fs.readFile(path.join(baseDir, '.env'), 'utf8').catch(() => '')
      for (const line of envText.split('\n')) {
        const m = line.match(/^\s*([A-Z_]+)=(.*)\s*$/)
        if (m) env[m[1]] = m[2].trim()
      }
      const c = await mysql.createConnection({ host: env.DB_HOST || '127.0.0.1', port: Number(env.DB_PORT || 3306), user: env.DB_USER || 'root', password: env.DB_PASSWORD || '', database: env.DB_NAME || 'dashboard' })
      const [rows] = await c.query(`SELECT DISTINCT DATE_FORMAT(biz_date,'%Y-%m-%d') d FROM \`fact_ax_profit_store\``)
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
      const done = await existingBizDates()
      const skipped = todo.filter((d) => done.has(d))
      todo = todo.filter((d) => !done.has(d))
      if (skipped.length) console.log(`[断点续跑] 库中已有 ${skipped.length} 天，跳过：${skipped[0]} → ${skipped[skipped.length - 1]}`)
    }
    console.log(`[批量] 共 ${todo.length} 天：${todo[0]} → ${todo[todo.length - 1]}`)
    let doneCount = 0
    for (const d of todo) {
      console.log(`\n===== [批量 ${doneCount + 1}/${todo.length}] ${d} =====`)
      try {
        await setDateSingle(d)
        if (wantStoreView) await switchStoreView()
        await applyFieldFilter()
        if (wantDownload) {
          await downloadExport(` ${d}`)
          doneCount += 1
        } else {
          await saveDebug(`profit-${d}`)
          doneCount += 1
        }
      } catch (e) {
        console.error(`[批量] ${d} 失败：`, e instanceof Error ? e.message : e)
      }
    }
    console.log(`\n[批量] 完成 ${doneCount}/${todo.length} 天，文件在 ${downloadDir}`)
  } else if (rangeArg) {
    const [start, end] = rangeArg.split(',').map((s) => s.trim())
    await setDateRange(start, end)
  } else if (dateArg) {
    await setDateSingle(dateArg)
  } else if (periodArg) {
    const periodMap = { '昨日': 'yesterday', '近7日': 'last7days', '近30日': 'last30days' }
    const value = periodMap[periodArg]
    if (!value) throw new Error(`不支持的 --period=${periodArg}，盈亏分析可用：昨日/近7日/近30日（本页无“实时”）`)
    console.log(`[日期] 快捷: ${periodArg}`)
    await clickRadio(value, periodArg)
    await page.waitForTimeout(3000)
    await logSelectedTime()
  } else {
    console.log('[日期] 未指定时间参数，沿用页面默认区间')
  }

  if (!datesList.length) {
    if (wantStoreView) await switchStoreView()
    await applyFieldFilter()
    await saveDebug('profit-prepared')
    if (!wantDownload) {
      console.log('已按 --no-download 跳过导出。')
    } else {
      await downloadExport()
      await saveDebug('profit-success')
    }
  }
} catch (error) {
  console.error('失败：', error instanceof Error ? error.message : error)
  await saveDebug('profit-failed')
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
