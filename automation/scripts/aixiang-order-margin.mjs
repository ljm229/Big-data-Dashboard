import { chromium } from 'playwright'
import path from 'node:path'
import fs from 'node:fs/promises'

const baseDir = path.resolve('.')
const outputDir = path.join(baseDir, 'output')
const downloadDir = path.join(outputDir, 'aixiang-order-margin')
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
  await page.screenshot({ path: path.join(outputDir, `margin-${step}.png`), fullPage: true }).catch(() => {})
  const text = await page.locator('body').innerText().catch(() => '')
  await fs.writeFile(path.join(outputDir, `margin-${step}.txt`), text, 'utf8').catch(() => {})
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
        const norm = (s) => (s || '').replace(/\s+/g, '')
        const jsHit = await frame.evaluate((t) => {
          const all = Array.from(document.querySelectorAll('button, span, div, a, label'))
          const cands = all.filter((e) => (e.textContent || '').replace(/\s+/g, '') === t.replace(/\s+/g, ''))
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

try {
  await page.goto('https://saas-retail.ele.me/#/data/home', { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.waitForTimeout(4000)
  await dismissMutePopup()

  if (!(await page.locator('body').innerText()).includes('海安闪玩家技术服务有限公司')) {
    throw new Error('未确认翱象企业会话，请先完成登录验证')
  }

  await clickText('数据')
  await page.waitForTimeout(800)
  await dismissMutePopup()
  await clickText('订单毛利分析')
  await dismissMutePopup()
  await waitForText('创建时间', 60000)
  await page.waitForTimeout(2500)

  if (process.argv.includes('--inspect-filters')) {
    const frames = []
    for (const frame of page.frames()) {
      const filters = await frame.locator('body *').evaluateAll((elements) => elements
        .filter((element) => {
          const t = (element.textContent || '').replace(/\s+/g, '')
          return t.includes('创建时间') || t.includes('订单完成时间') || t.includes('导出订单毛利明细') || t.includes('导出记录')
        })
        .slice(0, 12)
        .map((element) => ({
          tag: element.tagName,
          text: (element.textContent || '').slice(0, 400),
          className: (element.className || '').toString().slice(0, 200),
          html: element.outerHTML.slice(0, 1500),
        }))).catch(() => [])
      frames.push({ url: frame.url().slice(0, 120), filters })
    }
    await fs.writeFile(path.join(outputDir, 'margin-filter-frames.json'), JSON.stringify(frames, null, 2))
    throw new Error('筛选器结构已保存到 output/margin-filter-frames.json，本次仅检查')
  }

  const getArg = (n) => (process.argv.find((a) => a.startsWith(`--${n}=`)) || '').slice(n.length + 3)
  const quickArg = getArg('quick') || '昨日'
  const dateArg = getArg('date')
  const rangeArg = getArg('range') || (dateArg ? `${dateArg},${dateArg}` : '')

  // 跨月导航：日历只渲染当前月，过去月份要点上一月翻页（最多14个月）
  async function ensureMonthVisible(f2, dateStr) {
    const [y, m] = dateStr.split('-').map(Number)
    for (let step = 0; step < 14; step += 1) {
      const st = await f2.evaluate((want) => {
        const root = document.querySelector('.ant-picker-dropdown, .ant-calendar-picker-container, .calendar-picker') || document
        const vis = Array.from(root.querySelectorAll(`td[title="${want.d}"]`))
          .filter((c) => { const r = c.getBoundingClientRect(); return r.width > 0 && r.height > 0 })
        if (vis.length) return 'hit'
        const headers = Array.from(root.querySelectorAll('.ant-picker-header, .ant-calendar-header'))
        if (!headers.length) return 'noheader'
        let moved = false
        for (const header of headers) {
          const hm = ((header.textContent || '').match(/(\d{4})年?\s*(\d{1,2})月/))
          if (!hm) continue
          const diff = (want.y - Number(hm[1])) * 12 + (want.m - Number(hm[2]))
          if (diff === 0) continue
          const btn = header.querySelector(diff > 0 ? '.ant-picker-header-next-btn, .ant-calendar-next-month-btn' : '.ant-picker-header-prev-btn, .ant-calendar-prev-month-btn')
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

  async function formItemFor(label) {
    for (const frame of page.frames()) {
      const box = await frame.evaluate((lab) => {
        const labels = Array.from(document.querySelectorAll('label'))
        const hit = labels.find((l) => (l.textContent || '').trim() === lab)
        if (!hit) return ''
        const item = hit.closest('.ant-form-item') || hit.closest('div')
        if (!item) return ''
        item.setAttribute('data-zx-mark', '1')
        return 'marked'
      }, label).catch(() => '')
      if (box === 'marked') return frame
    }
    return null
  }

  // 快捷模式：创建时间/订单完成时间 行内的快捷下拉（今日/昨日/本周/本月）
  async function setQuick(label, option) {
    console.log(`[日期] ${label}快捷: ${option}`)
    for (const frame of page.frames()) {
      try {
        const info = await frame.evaluate((lab) => {
          const labels = Array.from(document.querySelectorAll('label'))
          const hit = labels.find((l) => (l.textContent || '').trim() === lab)
          if (!hit) return 'nolabel'
          const item = hit.closest('.ant-form-item')
          if (!item) return 'noitem'
          const sel = item.querySelector('.next-select, .ant-select, [class*="select"]')
          if (!sel) return 'nosel'
          sel.scrollIntoView({ block: 'center' })
          sel.click()
          return 'opened'
        }, label).catch(() => 'err')
        if (info !== 'opened') continue
        await page.waitForTimeout(1200)
        for (const f2 of page.frames()) {
          try {
            const opt = f2.getByText(option, { exact: true }).first()
            if ((await opt.count().catch(() => 0)) && (await opt.isVisible().catch(() => false))) {
              await opt.click({ timeout: 5000 })
              await page.waitForTimeout(1200)
              console.log(`[日期] 已选${option}`)
              return true
            }
          } catch {}
        }
      } catch {}
    }
    return false
  }

  if (process.argv.includes('--inspect-calendar')) {
    for (const frame of page.frames()) {
      try {
        const info = await frame.evaluate(() => {
          const labels = Array.from(document.querySelectorAll('label'))
          const hit = labels.find((l) => (l.textContent || '').trim() === '创建时间')
          if (!hit) return 'nolabel'
          const item = hit.closest('.ant-form-item')
          const icons = item ? Array.from(item.querySelectorAll('i, svg, span')).filter((e) => /calendar|date/i.test((e.className || '').toString())) : []
          const inputs = item ? Array.from(item.querySelectorAll('input')) : []
          const inputInfo = inputs.map((i) => ({ readonly: i.readOnly, value: i.value, cls: String(i.className).slice(0, 120), html: i.outerHTML.slice(0, 300) }))
          const clickables = item ? Array.from(item.querySelectorAll('span, i, div')).filter((e) => /picker|calendar|date|suffix|addon/i.test((e.className || '').toString())).map((e) => String(e.className).slice(0, 120)) : []
          if (inputs.length) { inputs[inputs.length - 1].scrollIntoView({ block: 'center' }); inputs[inputs.length - 1].click() }
          return JSON.stringify({ icons: icons.map((e) => String(e.className).slice(0, 120)), inputInfo, clickables })
        }).catch(() => 'err')
        console.log('[日历]', info.slice(0, 1200))
      } catch {}
    }
    await page.waitForTimeout(2000)
    const frames = []
    for (const frame of page.frames()) {
      const cals = await frame.locator('body *').evaluateAll((elements) => elements
        .filter((element) => /picker-dropdown|picker-panel|calendar-picker|range-picker/i.test((element.className || '').toString()))
        .slice(0, 4)
        .map((element) => ({ cls: (element.className || '').toString().slice(0, 200), html: element.outerHTML.slice(0, 3000) }))).catch(() => [])
      if (cals.length) frames.push({ url: frame.url().slice(0, 80), cals })
    }
    await fs.writeFile(path.join(outputDir, 'margin-calendar.json'), JSON.stringify(frames, null, 2))
    throw new Error('日历结构已保存到 output/margin-calendar.json，本次仅检查')
  }

  if (!rangeArg) {
    const ok = await setQuick('创建时间', quickArg)
    if (!ok) console.log('[日期] 快捷选择失败，继续用页面默认')
    await page.waitForTimeout(1500)
  } else {
    const [start, end] = rangeArg.split(',').map((s) => s.trim())
    console.log(`[日期] 创建时间自定义: ${start} -> ${end}`)
    for (const frame of page.frames()) {
      try {
        const opener = frame.locator('input[placeholder="开始日期"]').first()
        if (!(await opener.count().catch(() => 0))) continue
        await opener.scrollIntoViewIfNeeded().catch(() => {})
        await opener.click({ timeout: 8000 })
        await page.waitForTimeout(1500)
        break
      } catch {}
    }
    for (const title of [start, end]) {
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
      console.log(`[日期] 点选 ${title}:`, ok ? 'ok' : 'FAIL')
      if (!ok) throw new Error(`[日期] 点选失败 ${title}，已停止（拒绝用默认筛选导出错误日期）`)
      await page.waitForTimeout(800)
    }
    await page.waitForTimeout(2000)
  }

  // 查询 + 导出
  await clickText('查询')
  await page.waitForTimeout(3000)
  for (const frame of page.frames()) {
    try {
      const t = await frame.locator('body').innerText({ timeout: 3000 }).catch(() => '')
      const m = t.match(/实时预计总毛利[:：]\s*¥?([0-9,.]+)/)
      if (m) { console.log('[查询] 实时预计总毛利: ¥' + m[1]); break }
    } catch {}
  }
  await saveDebug('order-margin-queried')

  // --fetch-record：跳过新建导出，直接取导出记录里最新的已完成项（用于任务生成慢、上一轮已提交的场景）
  if (!process.argv.includes('--fetch-record')) {
  await clickText('导出订单毛利明细')
  await page.waitForTimeout(2000)
  for (const frame of page.frames()) {
    try {
      const t = await frame.locator('body').innerText({ timeout: 3000 }).catch(() => '')
      if (/任务已创建|导出.*成功|已提交/.test(t)) { console.log('[导出] 任务已创建（见页面提示）'); break }
    } catch {}
  }
  }

  // 导出记录 → 刷新 → 等待已完成 → 下载
  await clickText('导出记录')
  await page.waitForTimeout(1500)
  try {
    await clickText('刷新列表', { timeout: 10000 })
  } catch {
    console.log('[导出记录] 无刷新列表按钮，继续')
  }
  await page.waitForTimeout(1500)
  const deadline = Date.now() + 180000
  let downloaded = false
  while (Date.now() < deadline && !downloaded) {
    for (const frame of page.frames()) {
      try {
        const rows = await frame.locator('tr').evaluateAll((trs) => trs.map((tr) => ({
          text: (tr.innerText || '').slice(0, 160),
          done: /已完成/.test(tr.innerText || ''),
        })).filter((r) => /订单毛利数据分析/.test(r.text))).catch(() => [])
        if (!rows.length) continue
        console.log('[导出记录] 行:', JSON.stringify(rows.slice(0, 3)))
        if (!rows[0].done) break
        const dl = frame.getByText('下载', { exact: true }).first()
        if (!(await dl.count().catch(() => 0))) continue
        await dl.scrollIntoViewIfNeeded().catch(() => {})
        const downloadPromise = page.waitForEvent('download', { timeout: 120000 })
        await dl.click({ timeout: 8000 })
        const download = await downloadPromise
        const rawName = download.suggestedFilename() || `order-margin-${new Date().toISOString().slice(0, 10)}.xlsx`
        // 文件名盖上查询区间的章，便于入库追溯（fetch-record 模式无区间则保留原名）
        const rangeTag = (rangeArg && !process.argv.includes('--fetch-record')) ? `_${rangeArg.replace(/-/g, '').replace(',', '_')}` : ''
        const filename = rawName.replace(/\.xlsx$/i, `${rangeTag}.xlsx`)
        const savePath = path.join(downloadDir, filename)
        await download.saveAs(savePath)
        console.log(`导出成功：${savePath}`)
        downloaded = true
        break
      } catch (e) {
        console.log('[导出记录] 等待中:', String(e).slice(0, 100))
      }
    }
    if (!downloaded) {
      try {
        await clickText('刷新列表', { timeout: 8000 })
      } catch {}
      await page.waitForTimeout(5000)
    }
  }
  if (!downloaded) throw new Error('导出记录中未等到已完成的下载项')
  await saveDebug('order-margin-success')
} catch (error) {
  console.error('失败：', error instanceof Error ? error.message : error)
  await saveDebug('order-margin-failed')
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
