import { chromium } from 'playwright'
import path from 'node:path'
import fs from 'node:fs/promises'

const baseDir = path.resolve('.')
const outputDir = path.join(baseDir, 'output')
const downloadDir = path.join(outputDir, 'aixiang-quality')
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
  await page.screenshot({ path: path.join(outputDir, `quality-${step}.png`), fullPage: true }).catch(() => {})
  const parts = []
  for (const frame of page.frames()) {
    const t = await frame.locator('body').innerText({ timeout: 5000 }).catch(() => '')
    if (t && t.trim()) parts.push(`===== FRAME ${frame.url().slice(0, 100)} =====\n${t}`)
  }
  await fs.writeFile(path.join(outputDir, `quality-${step}.txt`), parts.join('\n\n'), 'utf8').catch(() => {})
}

async function dismissPopup() {
  for (let i = 0; i < 3; i += 1) {
    let handled = false
    for (const frame of page.frames()) {
      try {
        const btn = frame.getByRole('button', { name: '忽略', exact: true }).first()
        if ((await btn.count().catch(() => 0)) && (await btn.isVisible().catch(() => false))) {
          await btn.click({ timeout: 4000 }).catch(() => {})
          await page.waitForTimeout(800)
          handled = true
          break
        }
      } catch {}
    }
    if (!handled) break
  }
}

async function clickText(text, timeout = 30000) {
  console.log(`[点击] ${text}`)
  const deadline = Date.now() + timeout
  while (Date.now() < deadline) {
    await dismissPopup()
    for (const frame of page.frames()) {
      try {
        const loc = frame.getByText(text, { exact: true }).first()
        if ((await loc.count().catch(() => 0)) && (await loc.isVisible().catch(() => false))) {
          await loc.scrollIntoViewIfNeeded().catch(() => {})
          await loc.click({ timeout: 5000 })
          await page.waitForTimeout(800)
          await dismissPopup()
          return
        }
      } catch {}
      try {
        const hit = await frame.evaluate((t) => {
          const norm = (s) => (s || '').replace(/\s+/g, '')
          const all = Array.from(document.querySelectorAll('a,span,div,li,button'))
          const c = all.filter((e) => norm(e.textContent) === norm(t))
            .filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 })
          if (!c.length) return ''
          c.sort((a, b) => (a.textContent || '').length - (b.textContent || '').length)
          const el = c[0]
          const target = el.closest('a') || el.closest('li') || el
          target.scrollIntoView({ block: 'center' })
          target.click()
          return 'clicked'
        }, text).catch(() => '')
        if (hit === 'clicked') { await page.waitForTimeout(800); return }
      } catch {}
    }
    await page.waitForTimeout(1000)
  }
  throw new Error(`点击超时: ${text}`)
}

async function waitForText(text, timeout = 60000) {
  const deadline = Date.now() + timeout
  while (Date.now() < deadline) {
    await dismissPopup()
    for (const frame of page.frames()) {
      const t = await frame.locator('body').innerText({ timeout: 3000 }).catch(() => '')
      if (t && t.includes(text)) return
    }
    await page.waitForTimeout(1000)
  }
  throw new Error(`等待超时: ${text}`)
}

const getArg = (n) => (process.argv.find((a) => a.startsWith(`--${n}=`)) || '').slice(n.length + 3)
const rangeArg = getArg('range')
const dateOnly = getArg('date') || new Date(Date.now() - 86400000).toISOString().slice(0, 10)
const startDate = rangeArg ? rangeArg.split(',')[0].trim() : dateOnly
const endDate = rangeArg ? (rangeArg.split(',')[1] || '').trim() || startDate : startDate

try {
  await page.goto('https://saas-retail.ele.me/#/data/home', { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.waitForTimeout(4000)
  await dismissPopup()

  // 阶段一: 左侧导航 闪购仓 -> 门店营运质量
  await clickText('闪购仓')
  await page.waitForTimeout(1200)
  await clickText('门店营运质量')
  await waitForText('门店营运考核指标', 60000)
  console.log('[阶段一] 已进入门店营运质量看板')
  await page.waitForTimeout(2000)

  // 阶段二: 确保选中【日】,设定单日起止为同一天
  try { await clickText('日', 10000) } catch {}
  await page.waitForTimeout(1000)
  console.log(`[阶段二] 设定单日: ${startDate} -> ${endDate}`)

  async function setSingleDay(s, e) {
    // 打开日期面板
    let opened = false
    for (const frame of page.frames()) {
      try {
        const opener = frame.locator('.ant-picker-input input, .ant-picker input, input[placeholder*="日期"], input[value*="2026"]').first()
        if (!(await opener.count().catch(() => 0))) continue
        await opener.scrollIntoViewIfNeeded().catch(() => {})
        await opener.click({ timeout: 8000 }).catch(() => {})
        await page.waitForTimeout(1500)
        opened = true
        break
      } catch {}
    }
    if (!opened) {
      // 兜底: 点击日期文本区域
      for (const frame of page.frames()) {
        const hit = await frame.evaluate(() => {
          const all = Array.from(document.querySelectorAll('input'))
          const t = all.find((i) => /202\d/.test(i.value || ''))
          if (t) { t.scrollIntoView({ block: 'center' }); t.click(); return 'clicked' }
          return ''
        }).catch(() => '')
        if (hit === 'clicked') { opened = true; await page.waitForTimeout(1500); break }
      }
    }
    console.log('[日期] 面板打开:', opened)
    for (const d of [s, e]) {
      let ok = false
      for (const f2 of page.frames()) {
        const res = await f2.evaluate((want) => {
          const cells = Array.from(document.querySelectorAll(`td[title="${want}"]`))
            .filter((c) => { const r = c.getBoundingClientRect(); return r.width > 0 && r.height > 0 })
          if (!cells.length) return ''
          cells[0].scrollIntoView({ block: 'center' })
          cells[0].click()
          return 'clicked:' + cells.length
        }, d).catch(() => '')
        if (res.startsWith('clicked')) { ok = true; break }
      }
      console.log(`[日期] 点选 ${d}:`, ok ? '成功' : '失败')
      await page.waitForTimeout(1000)
    }
    // 点确定(如果有)
    for (const f2 of page.frames()) {
      await f2.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('.ant-picker-dropdown button'))
          .filter((b) => /确定|确认|^OK$/i.test((b.textContent || '').trim()))
          .filter((b) => { const r = b.getBoundingClientRect(); return r.width > 0 && r.height > 0 })
        if (btns.length) btns[btns.length - 1].click()
      }).catch(() => {})
    }
    await page.waitForTimeout(2500)
  }

  await setSingleDay(startDate, endDate)
  // 验证输入框显示
  for (const frame of page.frames()) {
    const t = await frame.locator('body').innerText({ timeout: 3000 }).catch(() => '')
    const m = t.match(/202\d-\d{2}-\d{2}\s*[→\-_>]*\s*202\d-\d{2}-\d{2}/)
    if (m) console.log('[日期] 当前区间:', m[0])
  }
  // 等待表格自动刷新
  await page.waitForTimeout(4000)
  await saveDebug('quality-queried')

  // 阶段三: 点击右上角下载
  console.log('[阶段三] 点击下载')
  const downloadPromise = page.waitForEvent('download', { timeout: 120000 })
  let clickedDl = false
  for (const frame of page.frames()) {
    try {
      const btn = frame.getByRole('button', { name: /下载/ }).first()
      if ((await btn.count().catch(() => 0)) && (await btn.isVisible().catch(() => false))) {
        await btn.scrollIntoViewIfNeeded().catch(() => {})
        await btn.click({ timeout: 8000 })
        clickedDl = true
        break
      }
    } catch {}
  }
  if (!clickedDl) {
    for (const frame of page.frames()) {
      const hit = await frame.evaluate(() => {
        const norm = (s) => (s || '').replace(/\s+/g, '')
        const all = Array.from(document.querySelectorAll('button,span,div,a'))
        const c = all.filter((e) => norm(e.textContent) === '下载')
          .filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 })
        if (!c.length) return ''
        const el = c[0]
        ;(el.closest('button') || el).click()
        return 'clicked'
      }).catch(() => '')
      if (hit === 'clicked') { clickedDl = true; break }
    }
  }
  if (!clickedDl) throw new Error('未找到下载按钮')
  console.log('[下载] 已点击,等待生成(生成进度1/1)...')
  const download = await downloadPromise
  const filename = download.suggestedFilename() || `门店营运考核指标_${startDate}.xlsx`
  const savePath = path.join(downloadDir, filename)
  await download.saveAs(savePath)
  // 另存一份带单日日期的命名便于累计
  const dated = path.join(downloadDir, `门店营运考核指标_${startDate}.xlsx`)
  try { await fs.copyFile(savePath, dated) } catch {}
  console.log(`导出成功: ${savePath}\n单日归档: ${dated}`)
  await saveDebug('quality-success')
} catch (error) {
  console.error('自动导出失败:', error instanceof Error ? error.message : error)
  await saveDebug('quality-failed')
  process.exitCode = 1
} finally {
  console.log('浏览器保持打开,按 Enter 后关闭(加 --auto-close 自动关)。文件在 output/aixiang-quality。')
  if (!process.argv.includes('--auto-close')) {
    await new Promise((resolve) => {
      const timer = setTimeout(resolve, 300000)
      process.stdin.once('data', () => { clearTimeout(timer); resolve() })
    })
  }
  await context.close().catch(() => {})
  await browser.close().catch(() => {})
}
