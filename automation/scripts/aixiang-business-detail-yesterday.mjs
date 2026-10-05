import { chromium } from 'playwright'
import path from 'node:path'
import fs from 'node:fs/promises'

const baseDir = path.resolve('.')
const outputDir = path.join(baseDir, 'output')
const downloadDir = path.join(outputDir, 'aixiang')
await fs.mkdir(downloadDir, { recursive: true })

const userDataDir = path.join(baseDir, '.browser-data', 'aixiang')
const manualStorage = path.join(outputDir, 'aixiang-manual-storage.json')
const browser = await chromium.launch({ headless: false, channel: 'chrome' })
const context = await browser.newContext({
  viewport: { width: 1440, height: 960 },
  acceptDownloads: true,
  storageState: manualStorage,
})
const page = context.pages()[0] ?? await context.newPage()

async function saveDebug(step) {
  await page.screenshot({ path: path.join(outputDir, `aixiang-${step}.png`), fullPage: true }).catch(() => {})
  const text = await page.locator('body').innerText().catch(() => '')
  await fs.writeFile(path.join(outputDir, `aixiang-${step}.txt`), text, 'utf8').catch(() => {})
}

async function dismissMutePopup() {
  for (let i = 0; i < 5; i += 1) {
    let handled = false
    for (const frame of page.frames()) {
      try {
        const muteHint = frame.getByText('消息静音提醒', { exact: true }).first()
        if (!(await muteHint.isVisible().catch(() => false))) continue
        const ignoreBtn = frame.getByRole('button', { name: /忽\s*略/, exact: false }).first()
        if ((await ignoreBtn.count().catch(() => 0)) && (await ignoreBtn.isVisible().catch(() => false))) {
          console.log('[弹窗] 发现消息静音提醒，点击忽略')
          await ignoreBtn.click({ timeout: 5000, force: true }).catch(() => {})
          await page.waitForTimeout(1000)
          handled = true
          break
        }
      } catch {}
    }
    if (handled) continue
    for (const frame of page.frames()) {
      try {
        const muteHint = frame.getByText('消息静音提醒', { exact: true }).first()
        if ((await muteHint.count().catch(() => 0)) && (await muteHint.isVisible().catch(() => false))) {
          const buttons = frame.locator('button')
          const count = await buttons.count().catch(() => 0)
          for (let index = 0; index < count; index += 1) {
            const button = buttons.nth(index)
            const label = (await button.innerText().catch(() => '')).replace(/\s+/g, '')
            if (label === '忽略' && await button.isVisible().catch(() => false)) {
              console.log('[弹窗] 发现消息静音提醒，按按钮位置点击忽略')
              await button.click({ timeout: 5000, force: true }).catch(() => {})
              await page.waitForTimeout(1000)
              handled = true
              break
            }
          }
          if (handled) break
        }
      } catch {}
    }
    if (!handled) break
  }
}

async function waitAndAutoDismiss(timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const before = Date.now()
    await dismissMutePopup()
    await page.waitForTimeout(800)
    if (Date.now() - before < 0) break
    if (Date.now() > deadline - 5000) {
      await dismissMutePopup()
      break
    }
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
        if (text.startsWith('指标筛选')) {
          try {
            const btn = frame.getByRole('button', { name: /指标筛选/ }).first()
            if ((await btn.count().catch(() => 0))) {
              await btn.scrollIntoViewIfNeeded().catch(() => {})
              await btn.click({ timeout: 8000 })
              await page.waitForTimeout(1500)
              const opened = await frame.evaluate(() => document.body.innerText.includes('全选')).catch(() => false)
              console.log('[指标筛选] Playwright按钮点击后弹窗(含全选):', opened)
              if (opened) { await dismissMutePopup(); return }
            }
          } catch (e) {
            lastError = String(e).slice(0, 200)
          }
            const jsClicked = await frame.evaluate((wanted) => {
              const norm = (s) => (s || '').replace(/\s+/g, '')
              const all = Array.from(document.querySelectorAll('button, div, span, a'))
              let cands = all.filter((e) => norm(e.textContent).includes('指标筛选'))
              const exact = cands.filter((e) => norm(e.textContent).includes(norm(wanted)))
              if (exact.length) cands = exact
              cands = cands.filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 })
              if (!cands.length) return 'notfound-len:' + all.length
              cands.sort((a, b) => {
                const ab = a.tagName === 'BUTTON' ? 0 : 1
                const bb = b.tagName === 'BUTTON' ? 0 : 1
                return ab - bb || (a.textContent || '').length - (b.textContent || '').length
              })
              const el = cands[0]
              const target = el.closest('button') || el
              target.scrollIntoView({ block: 'center' })
              const rect = target.getBoundingClientRect()
              target.click()
              if (el !== target) el.click()
              return 'clicked:' + el.tagName + ':' + (el.textContent || '').replace(/\s+/g, '').slice(0, 30) + ':rect=' + Math.round(rect.x) + ',' + Math.round(rect.y)
            }, text).catch((e) => 'err:' + String(e).slice(0, 120))
            console.log('[指标筛选] JS点击结果:', jsClicked)
            if (String(jsClicked).startsWith('clicked')) {
              const m = String(jsClicked).match(/rect=(\d+),(\d+)/)
              if (m) {
                await page.mouse.click(Number(m[1]) + 20, Number(m[2]) + 10).catch(() => {})
                console.log('[指标筛选] 已补鼠标真实点击')
              }
              await page.waitForTimeout(1500)
              await dismissMutePopup()
              const opened = await frame.evaluate(() => document.body.innerText.includes('全选')).catch(() => false)
              console.log('[指标筛选] 弹窗是否打开(含全选):', opened)
              if (opened) return
              console.log('[指标筛选] JS点击未打开弹窗，改用 Playwright 定位点击')
              try {
                const exactNode = frame.getByText('指标筛选(10)', { exact: true }).first()
                if ((await exactNode.count().catch(() => 0))) {
                  await exactNode.scrollIntoViewIfNeeded().catch(() => {})
                  await exactNode.click({ timeout: 8000 })
                  await page.waitForTimeout(1500)
                  const opened2 = await frame.evaluate(() => document.body.innerText.includes('全选')).catch(() => false)
                  console.log('[指标筛选] Playwright点击后弹窗:', opened2)
                  if (opened2) return
                }
              } catch (e) {
                lastError = String(e).slice(0, 200)
              }
            }
          const textNode = frame.getByText(/指标筛选/, { exact: false }).first()
          const candidates = [
            textNode,
            textNode.locator('xpath=ancestor-or-self::*[self::button or @role="button" or contains(@class,"btn") or contains(@class,"button")][1]'),
            textNode.locator('xpath=ancestor::*[self::div or self::span][1]'),
          ]
          let clicked = false
          for (const candidate of candidates) {
            if ((await candidate.count().catch(() => 0)) && (await candidate.isVisible().catch(() => false))) {
              await candidate.click({ timeout: 5000, force: true })
              clicked = true
              break
            }
          }
          if (!clicked) throw new Error('未找到可点击的指标筛选控件')
          await page.waitForTimeout(800)
          await dismissMutePopup()
          return
        }
        let locator = frame.getByText(text, { exact }).first()
        if ((await locator.count().catch(() => 0)) && (await locator.isVisible().catch(() => false))) {
          await locator.click({ timeout: 5000 })
          await page.waitForTimeout(500)
          await dismissMutePopup()
          return
        }
        try {
          const jsClicked = await frame.evaluate((t) => {
            const norm = (s) => (s || '').replace(/\s+/g, '')
            const all = Array.from(document.querySelectorAll('button, div, span, a'))
            const cands = all.filter((e) => norm(e.textContent) === norm(t) || (norm(t).length <= 4 && norm(e.textContent).includes(norm(t))))
            if (!cands.length) return ''
            cands.sort((a, b) => (a.textContent || '').length - (b.textContent || '').length)
            const el = cands[0]
            const target = el.closest('button') || el
            target.scrollIntoView({ block: 'center' })
            target.click()
            if (el !== target) el.click()
            return 'clicked:' + el.tagName
          }, text).catch(() => '')
          if (jsClicked && String(jsClicked).startsWith('clicked')) {
            console.log(`[点击][JS兜底] ${text} ${jsClicked}`)
            await page.waitForTimeout(800)
            await dismissMutePopup()
            return
          }
        } catch {}
      } catch (e) {
        lastError = String(e).slice(0, 200)
      }
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
    throw new Error('未确认翱象企业会话，请先运行 npm.cmd run aixiang:check 完成登录验证')
  }

  await clickText('数据')
  await page.waitForTimeout(800)
  await dismissMutePopup()
  await clickText('经营分析')
  await dismissMutePopup()
  if (process.argv.includes('--inspect')) {
    await page.waitForTimeout(15000)
    const frames = []
    for (const frame of page.frames()) {
      frames.push({
        name: frame.name(),
        origin: (() => { try { return new URL(frame.url()).origin } catch { return '' } })(),
        text: await frame.locator('body').innerText({ timeout: 5000 }).catch(() => ''),
      })
    }
    await fs.writeFile(path.join(outputDir, 'aixiang-report-frames.json'), JSON.stringify(frames, null, 2))
    console.log('页面结构已保存到 output/aixiang-report-frames.json；本次不执行导出。')
  } else {
  await waitForText('昨日', 60000)
  // 时间筛选：支持 快捷(实时/昨日/近7日/近30日) / 按周 / 按月 / 自定义单天或起止区间
  // 用法: --period=昨日|近7日|近30日|实时  --date=YYYY-MM-DD
  //       --range=YYYY-MM-DD,YYYY-MM-DD  --weekdate=YYYY-MM-DD(周内任意一天)
  //       --month=YYYY-MM
  const getArg = (n) => (process.argv.find((a) => a.startsWith(`--${n}=`) ) || '').slice(n.length + 3)
  const rangeArg = getArg('range')
  const dateOnly = getArg('date')
  const weekArg = getArg('weekdate')
  const monthArg = getArg('month')
  const periodArg = getArg('period')
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
  // 跨月导航：面板只渲染当前月，过去月份必须点上一月翻页（最多翻14个月），否则点选必然失败
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
          return 'clicked:' + cells.length
        }, title).catch(() => '')
        if (res.startsWith('clicked')) { ok = true; break }
      }
      if (!ok) {
        let diag = ''
        for (const f2 of page.frames()) {
          diag += await f2.evaluate((d) => {
            const all = Array.from(document.querySelectorAll(`td[title="${d}"]`))
            const vis = all.filter((c) => { const r = c.getBoundingClientRect(); return r.width > 0 && r.height > 0 })
            return `|all:${all.length}/vis:${vis.length}`
          }, title).catch(() => '|err')
        }
        console.log(`[日期] 未点中 ${title} ${diag}`)
        return false
      }
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
  async function openPickerPanel() {
    for (const frame of page.frames()) {
      try {
        const opener = frame.locator('.ant-picker-input input, .ant-picker input').first()
        if (!(await opener.count().catch(() => 0))) continue
        await opener.scrollIntoViewIfNeeded().catch(() => {})
        await opener.click({ timeout: 8000 })
        await page.waitForTimeout(1500)
        let drop = ''
        for (const f2 of page.frames()) {
          drop = await f2.evaluate(() => {
            const d = document.querySelector('.ant-picker-dropdown')
            if (!d) return ''
            return 'drop:tds=' + d.querySelectorAll('td').length + ':titles=' + Array.from(d.querySelectorAll('td[title]')).slice(0, 3).map((c) => c.getAttribute('title')).join(',')
          }).catch(() => '')
          if (drop) break
        }
        console.log('[日期] 面板:', drop || '未找到dropdown', 'openerFrame:', frame.url().slice(0, 80))
        return true
      } catch {}
    }
    console.log('[日期] 未找到日期输入框opener')
    return false
  }
  async function logSelectedTime() {
    for (const frame of page.frames()) {
      try {
        const t = await frame.locator('body').innerText({ timeout: 3000 }).catch(() => '')
        const m = t.match(/已选时间[:：]\s*([^\n]+)/)
        if (m) { console.log('[日期] 已选时间:', m[1].trim()); return }
      } catch {}
    }
  }
  if (process.argv.includes('--inspect-filter')) {
    const frames = []
    for (const frame of page.frames()) {
      const filters = await frame.locator('body *').evaluateAll((elements) => elements
        .filter((element) => (element.textContent || '').replace(/\s+/g, '').includes('自定义'))
        .slice(0, 10)
        .map((element) => ({
          tag: element.tagName,
          text: (element.textContent || '').slice(0, 300),
          className: (element.className || '').toString().slice(0, 200),
          role: element.getAttribute('role'),
          html: element.outerHTML.slice(0, 1500),
        }))).catch(() => [])
      const inputs = await frame.locator('input').evaluateAll((elements) => elements
        .slice(0, 30)
        .map((element) => ({
          type: element.type,
          placeholder: element.placeholder,
          value: element.value,
          className: (element.className || '').toString().slice(0, 200),
          html: element.outerHTML.slice(0, 500),
        }))).catch(() => [])
      frames.push({ url: frame.url().slice(0, 120), filters, inputs })
    }
    await fs.writeFile(path.join(outputDir, 'aixiang-filter-frames.json'), JSON.stringify(frames, null, 2))
    throw new Error('日期筛选器结构已保存到 output/aixiang-filter-frames.json，本次仅检查')
  }
  const periodMap = { '实时': 'real_time', '昨日': 'yesterday', '近7日': 'last7days', '近30日': 'last30days', 'realtime': 'real_time', 'yesterday': 'yesterday', 'last7days': 'last7days', 'last30days': 'last30days' }
  // 编码兜底：ps1 无 BOM 时中文参数会变乱码（曾导致 --period=实时 被当成昨日），乱码/未知 period 直接抛错，拒绝静默用错日期
  if (periodArg && !periodMap[periodArg] && !rangeArg && !dateOnly && !weekArg && !monthArg) {
    throw new Error(`[日期] 未知的 --period=${periodArg}（可能是 ps1 文件编码问题，检查 BOM），已停止`)
  }
  if (rangeArg) {
    const [start, end] = rangeArg.split(',').map((s) => s.trim())
    console.log(`[日期] 自定义区间: ${start} -> ${end}`)
    await clickRadio('custom', '自定义')
    await openPickerPanel()
    const ok = await pickCellsAcrossFrames([start, ...(end && end !== start ? [end] : [start])])
    if (!ok) throw new Error(`[日期] 区间点选失败 ${start} -> ${end}，已停止（拒绝用默认筛选导出错误日期）`)
    await page.waitForTimeout(3000)
    await logSelectedTime()
  } else if (dateOnly) {
    console.log(`[日期] 自定义单天: ${dateOnly}`)
    await clickRadio('custom', '自定义')
    await openPickerPanel()
    const ok = await pickCellsAcrossFrames([dateOnly, dateOnly])
    if (!ok) throw new Error(`[日期] 单天点选失败 ${dateOnly}，已停止（拒绝用默认筛选导出错误日期）`)
    await page.waitForTimeout(3000)
    await logSelectedTime()
  } else if (weekArg) {
    console.log(`[日期] 按周(周内任一天 ${weekArg})`)
    await clickRadio('week', '按周')
    await openPickerPanel()
    const ok = await pickCellsAcrossFrames([weekArg], false)
    if (!ok) console.log('[日期] 周点选失败，继续用当前筛选')
    await page.waitForTimeout(3000)
    await logSelectedTime()
  } else if (monthArg) {
    const [yy, mm] = monthArg.split('-').map((s) => s.trim())
    console.log(`[日期] 按月: ${monthArg}`)
    await clickRadio('month', '按月')
    await openPickerPanel()
    let picked = false
    for (let step = 0; step < 8 && !picked; step += 1) {
      for (const f2 of page.frames()) {
        const res = await f2.evaluate((want) => {
          const root = document.querySelector('.ant-picker-dropdown') || document
          const btns = Array.from(root.querySelectorAll('button'))
          const yearBtn = btns.find((b) => /^\d{4}年$/.test((b.textContent || '').trim()))
          const curYear = yearBtn ? (yearBtn.textContent || '').trim() : ''
          const norm = (s) => (s || '').replace(/\s+/g, '')
          const cells = Array.from(root.querySelectorAll('.ant-picker-cell-inner, td, button'))
            .filter((e) => norm(e.textContent) === `${Number(want.m)}月` || e.getAttribute('title') === `${want.y}-${String(want.m).padStart(2, '0')}`)
            .filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 })
          if (cells.length && (!curYear || curYear === `${want.y}年`)) {
            cells[0].click()
            return 'picked'
          }
          return 'year:' + (curYear || 'unknown')
        }, { y: yy, m: mm }).catch(() => '')
        if (res === 'picked') { picked = true; break }
        if (res.startsWith('year:') && !res.endsWith(`${yy}年`)) {
          await f2.evaluate((wantY) => {
            const root = document.querySelector('.ant-picker-dropdown') || document
            const header = root.querySelector('.ant-picker-header')
            if (!header) return
            const cur = (header.textContent || '').match(/(\d{4})年/)
            if (!cur) return
            const diff = Number(wantY) - Number(cur[1])
            if (diff === 0) return
            const btn = header.querySelector(diff > 0 ? '.ant-picker-header-next-btn, .ant-picker-header-super-next-btn' : '.ant-picker-header-prev-btn, .ant-picker-header-super-prev-btn')
            if (btn) btn.click()
          }, yy).catch(() => {})
          await page.waitForTimeout(800)
        }
      }
    }
    if (!picked) console.log('[日期] 月份点选失败，继续用当前筛选')
    await page.waitForTimeout(3000)
    await logSelectedTime()
  } else if (periodArg && periodMap[periodArg]) {
    console.log(`[日期] 快捷: ${periodArg}`)
    await clickRadio(periodMap[periodArg], periodArg)
    await page.waitForTimeout(2500)
    await logSelectedTime()
  } else {
    await clickText('昨日')
  }
  await waitForText('经营详情', 60000)
  await clickText('经营详情')
  await waitForText('渠道门店周期趋势', 30000)
  await clickText('渠道门店周期趋势')
  await page.waitForTimeout(2500)
  try {
    await waitForText('总计', 30000)
  } catch {
    console.log('[等待] 未见总计行，继续等待表格加载')
  }
  await page.waitForTimeout(4000)

  if (process.argv.includes('--inspect-detail')) {
    const frames = []
    for (const frame of page.frames()) {
      const candidates = await frame.locator('body *').evaluateAll((elements) => elements
        .filter((element) => (element.textContent || '').replace(/\s+/g, '').includes('指标筛选'))
        .slice(0, 20)
        .map((element) => ({
          tag: element.tagName,
          text: element.textContent,
          className: element.className,
          role: element.getAttribute('role'),
          html: element.outerHTML.slice(0, 1000),
        }))).catch(() => [])
      frames.push({ text: await frame.locator('body').innerText({ timeout: 5000 }).catch(() => ''), candidates })
    }
    await fs.writeFile(path.join(outputDir, 'aixiang-detail-frames.json'), JSON.stringify(frames, null, 2))
    throw new Error('经营详情页面结构已保存，本次仅检查，不执行下载')
  }
  try {
    try {
      await clickText('指标筛选(10)', { exact: false, timeout: 8000 })
    } catch {
      await clickText('指标筛选', { exact: false, timeout: 8000 })
    }
  await page.waitForTimeout(1500)
  for (const frame of page.frames()) {
    const btns = await frame.evaluate(() => Array.from(document.querySelectorAll('button, [role="button"]')).map((b) => (b.innerText || b.textContent || '').replace(/\s+/g, '').slice(0, 12)).filter(Boolean).slice(0, 40).join('|')).catch(() => '')
    if (btns) console.log('[弹窗按钮] frame按钮:', btns.slice(0, 400))
  }

  const dialog = page.getByRole('dialog').last()
  const scope = (await dialog.count()) ? dialog : page.locator('body')
  const selectAll = scope.getByText('全选', { exact: true }).last()
  if (await selectAll.count()) {
    await selectAll.click()
    await page.waitForTimeout(1500)
  } else {
    const checkboxes = scope.locator('input[type="checkbox"]')
    const count = await checkboxes.count()
    for (let i = 0; i < count; i += 1) {
      if (!(await checkboxes.nth(i).isChecked().catch(() => false))) await checkboxes.nth(i).check().catch(() => {})
    }
  }
  for (const frame of page.frames()) {
    const boxes = frame.locator('input[type="checkbox"]')
    const n = await boxes.count().catch(() => 0)
    if (!n) continue
    console.log('[指标] 对话框复选框总数:', n)
    for (let i = 0; i < n; i += 1) {
      try {
        const box = boxes.nth(i)
        if (await box.isChecked().catch(() => true)) continue
        await box.scrollIntoViewIfNeeded().catch(() => {})
        await box.check({ timeout: 5000 })
      } catch (e) {
        console.log('[指标] 勾选失败index', i, String(e).slice(0, 80))
      }
    }
    const verify = await frame.evaluate(() => {
      const boxes2 = Array.from(document.querySelectorAll('input[type="checkbox"]'))
      const checked = boxes2.filter((b) => b.checked).length
      const confirm = Array.from(document.querySelectorAll('button')).map((b) => (b.textContent || '').replace(/\s+/g, '').slice(0, 12)).find((t) => t.startsWith('确定'))
      return `checkbox:${checked}/${boxes2.length} confirm:${confirm || 'none'}`
    }).catch(() => '')
    if (verify) console.log('[指标] 逐个勾选后状态:', verify)
  }
  let confirmOk = false
  for (const frame of page.frames()) {
    try {
      const btn = frame.getByRole('button', { name: /^确定/ }).last()
      if (!(await btn.count().catch(() => 0))) continue
      await btn.scrollIntoViewIfNeeded().catch(() => {})
      await btn.click({ timeout: 8000 })
      await page.waitForTimeout(2000)
      const stillOpen = await frame.evaluate(() => document.body.innerText.includes('全选')).catch(() => true)
      console.log('[指标] 确定点击后弹窗仍在:', stillOpen)
      if (!stillOpen) { confirmOk = true; break }
    } catch (e) {
      console.log('[指标] 确定点击失败:', String(e).slice(0, 120))
    }
  }
  if (!confirmOk) await clickText('确定', { exact: false, timeout: 15000 })
  await page.waitForTimeout(2000)
  } catch (e) {
    console.log('[指标] 弹窗未打开或选择失败，跳过全选，直接用默认指标下载:', String(e).slice(0, 160))
  }

  await clickText('下载')
  await dismissMutePopup()
  await page.waitForTimeout(1500)
  for (const frame of page.frames()) {
    try {
      const dl = frame.getByText('下载', { exact: true }).first()
      if ((await dl.count().catch(() => 0))) {
        await dl.scrollIntoViewIfNeeded().catch(() => {})
        await dl.hover().catch(() => {})
        await page.waitForTimeout(800)
        await dl.click({ timeout: 8000 }).catch(() => {})
        await page.waitForTimeout(1500)
      }
    } catch {}
  }
  for (const frame of page.frames()) {
    const btns = await frame.evaluate(() => Array.from(document.querySelectorAll('button, [role="button"], li, a, [class*="menu"], [class*="dropdown"]')).map((b) => (b.innerText || b.textContent || '').replace(/\s+/g, '').slice(0, 20)).filter((t) => t && t.length <= 20).slice(0, 30).join(' | ')).catch(() => '')
    if (btns) console.log('[下载菜单] frame选项:', btns.slice(0, 500))
  }
  let exportClicked = false
  for (const frame of page.frames()) {
    try {
      const item = frame.getByText('导出格式化数据', { exact: true }).last()
      if (!(await item.count().catch(() => 0))) continue
      await item.scrollIntoViewIfNeeded().catch(() => {})
      const downloadPromise = page.waitForEvent('download', { timeout: 120000 })
      await item.click({ timeout: 8000 })
      const download = await downloadPromise
      const filename = download.suggestedFilename() || `aixiang-business-detail-${new Date().toISOString().slice(0, 10)}.xlsx`
      const savePath = path.join(downloadDir, filename)
      await download.saveAs(savePath)
      console.log(`导出成功：${savePath}`)
      await saveDebug('business-detail-yesterday-success')
      exportClicked = true
      break
    } catch (e) {
      console.log('[导出] 该frame尝试失败:', String(e).slice(0, 120))
    }
  }
  if (!exportClicked) {
    for (const frame of page.frames()) {
      const jsHit = await frame.evaluate(() => {
        const norm = (s) => (s || '').replace(/\s+/g, '')
        const all = Array.from(document.querySelectorAll('li, div, span, a, button'))
        const c = all.filter((e) => norm(e.textContent) === '导出格式化数据').sort((a, b) => (a.textContent || '').length - (b.textContent || '').length)
        if (!c.length) return ''
        c[0].scrollIntoView({ block: 'center' })
        c[0].click()
        return 'clicked'
      }).catch(() => '')
      if (jsHit === 'clicked') {
        console.log('[导出] JS兜底已点击，等待下载事件')
        try {
          const download = await page.waitForEvent('download', { timeout: 120000 })
          const filename = download.suggestedFilename() || `aixiang-business-detail-${new Date().toISOString().slice(0, 10)}.xlsx`
          const savePath = path.join(downloadDir, filename)
          await download.saveAs(savePath)
          console.log(`导出成功：${savePath}`)
          await saveDebug('business-detail-yesterday-success')
          exportClicked = true
        } catch (e) {
          console.log('[导出] 等待下载超时:', String(e).slice(0, 120))
        }
        break
      }
    }
  }
  if (!exportClicked) throw new Error('未找到可点击的导出格式化数据菜单项')
  }
} catch (error) {
  console.error('自动导出失败：', error instanceof Error ? error.message : error)
  await saveDebug('business-detail-yesterday-failed')
  process.exitCode = 1
} finally {
  console.log('浏览器保持打开，按 Enter 后关闭。')
  console.log('如果终端直接结束了，浏览器也会随之关闭；导出文件已保存在 output/aixiang。')
  if (!process.argv.includes('--auto-close')) {
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
