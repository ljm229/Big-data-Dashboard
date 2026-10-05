import path from 'node:path'
import fs from 'node:fs/promises'
import {
  outputDir,
  openSession,
  saveDebug,
  ensureLogin,
  clickMenu,
  clickText,
} from './lib/nr-session.mjs'

const homeUrl = 'https://nr.ele.me/app/eleme-nr-bfe-newretail/common-next#/pc/homePagePc/'
const downloadDir = path.join(outputDir, 'nr-scrape')
await fs.mkdir(downloadDir, { recursive: true })

const getArg = (n) => {
  const hit = process.argv.find((a) => a.startsWith(`--${n}=`))
  return hit ? hit.slice(n.length + 3) : ''
}
const hasFlag = (n) => process.argv.includes(`--${n}`)

const WAIT_HISTORY = 300000

function frameByUrl(page, keyword) {
  return page.frames().find((f) => f.url().includes(keyword)) || null
}

const dcNow = () => frameByUrl(page, 'ebai-download-center')

function logFrames(tag) {
  const list = page.frames().map((f) => f.url().slice(0, 90))
  console.log(`[frames:${tag}]`, list.join(' | '))
}

async function waitForFrame(page, keyword, timeout = 60000) {
  const deadline = Date.now() + timeout
  while (Date.now() < deadline) {
    const f = frameByUrl(page, keyword)
    if (f) {
      const t = await f.locator('body').innerText({ timeout: 3000 }).catch(() => '')
      if (t && t.length > 50) return f
    }
    await page.waitForTimeout(1000)
  }
  throw new Error(`未等到 iframe: ${keyword}`)
}

// 在 ant-design 控件里点击含指定文本的可点元素
async function clickByText(frame, text, opts = {}) {
  const exact = opts.exact ?? true
  const timeout = opts.timeout ?? 20000
  const deadline = Date.now() + timeout
  while (Date.now() < deadline) {
    const hit = await frame.evaluate(({ t, ex }) => {
      const norm = (s) => (s || '').replace(/\s+/g, '')
      const all = Array.from(document.querySelectorAll('button, span, div, a, label, li, td'))
      let cands = all.filter((e) => (ex ? norm(e.textContent) === norm(t) : norm(e.textContent).includes(norm(t))))
      cands = cands.filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 })
      cands.sort((a, b) => (a.textContent || '').length - (b.textContent || '').length)
      if (!cands.length) return null
      const el = cands[0]
      const clickable = el.closest('label') || el.closest('button') || el.closest('a') || el.closest('li') || el
      clickable.scrollIntoView({ block: 'center' })
      const r = clickable.getBoundingClientRect()
      if (r.width <= 0 || r.height <= 0) return null
      return { x: r.x + r.width / 2, y: r.y + r.height / 2, tag: clickable.tagName }
    }, { t: text, ex: exact }).catch(() => null)
    if (hit) return hit
    await frame.page().waitForTimeout(1000)
  }
  return null
}

// iframe 内的元素坐标是相对 iframe 的，不能直接用 page.mouse.click，
// 这里优先用 Playwright locator（会自动换算偏移），失败再退化为 JS click。
async function clickInFrame(page, frame, text, opts = {}) {
  const exact = opts.exact ?? true
  const timeout = opts.timeout ?? 12000
  const deadline = Date.now() + timeout
  while (Date.now() < deadline) {
    try {
      const loc = frame.getByText(text, { exact }).first()
      if ((await loc.count().catch(() => 0)) && (await loc.isVisible().catch(() => false))) {
        await loc.scrollIntoViewIfNeeded().catch(() => {})
        await loc.click({ timeout: 5000 })
        await page.waitForTimeout(1200)
        return true
      }
    } catch {}
    const res = await frame.evaluate(({ t, ex }) => {
      const norm = (s) => (s || '').replace(/\s+/g, '')
      const all = Array.from(document.querySelectorAll('button, span, div, a, label, li, td'))
      let cands = all.filter((e) => (ex ? norm(e.textContent) === norm(t) : norm(e.textContent).includes(norm(t))))
      cands = cands.filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 })
      cands.sort((a, b) => (a.textContent || '').length - (b.textContent || '').length)
      if (!cands.length) return 'notfound'
      const el = cands[0]
      const clickable = el.closest('label') || el.closest('button') || el.closest('a') || el.closest('li') || el
      clickable.scrollIntoView({ block: 'center' })
      clickable.click()
      if (clickable !== el) el.click()
      return 'clicked:' + clickable.tagName
    }, { t: text, ex: exact }).catch((e) => 'err:' + String(e).slice(0, 80))
    if (String(res).startsWith('clicked')) {
      await page.waitForTimeout(1200)
      return true
    }
    await page.waitForTimeout(800)
  }
  return false
}

async function selectRadio(frame, value) {
  try {
    return await frame.evaluate((v) => {
      const input = Array.from(document.querySelectorAll('input[type="radio"]')).find((i) => i.value === v)
      if (!input) return 'notfound'
      if (input.checked) return 'already'
      const label = input.closest('label')
      if (label) { label.click(); return 'clicked' }
      input.click()
      return 'clicked'
    }, value)
  } catch (e) {
    return 'err:' + String(e).slice(0, 120)
  }
}

async function checkAllMetrics(frame) {
  try {
    return await frame.evaluate(() => {
      const boxes = Array.from(document.querySelectorAll('input[type=checkbox], .ant-checkbox-input'))
      const selectAll = boxes.find((b) => {
        const wrap = b.closest('label') || b.parentElement?.parentElement || b.parentElement
        const t = (wrap?.textContent || '').replace(/\s+/g, '')
        return t.startsWith('全选') && t.length < 30
      })
      if (!selectAll) return 'no-selectall'
      if (selectAll.checked) return 'already'
      selectAll.click()
      return 'clicked'
    })
  } catch (e) {
    return 'err:' + String(e).slice(0, 120)
  }
}

async function generateReport(frame, log = console.log) {
  const btn = frame.getByRole('button', { name: /生成报表/ }).first()
  if (!(await btn.count().catch(() => 0))) { log('[报表] 未找到生成报表按钮'); return null }
  const label = (await btn.innerText().catch(() => '')).replace(/\s+/g, '')
  const disabled = await btn.isDisabled().catch(() => false)
  log(`[报表] 按钮: ${label} disabled=${disabled}`)
  if (disabled) return null
  if (/已选0|已选\(0\)|已选0个/.test(label)) { log('[报表] 未勾选任何指标'); return null }
  try {
    await btn.scrollIntoViewIfNeeded().catch(() => {})
    await btn.click({ timeout: 8000 })
    return true
  } catch (e) {
    log('[报表] 点击失败:', String(e).slice(0, 120))
    const res = await frame.evaluate(() => {
      const b = Array.from(document.querySelectorAll('button')).find((x) => /生成报表/.test(x.textContent || ''))
      if (!b) return 'notfound'
      b.click()
      return 'clicked'
    }).catch(() => 'err')
    return res === 'clicked' ? true : null
  }
}

async function openMenuPath(page, labels, log = console.log) {
  for (let i = 0; i < labels.length; i += 1) {
    const label = labels[i]
    let ok = false
    try { await clickMenu(page, label, log); ok = true } catch {}
    if (!ok) {
      log(`[菜单] ${label} 首次未找到，重新展开「${labels[0]}」后重试`)
      try { await clickMenu(page, labels[0], log) } catch {}
      await page.waitForTimeout(2000)
      try { await clickMenu(page, label, log); ok = true } catch {}
    }
    if (!ok) ok = await clickText(page, label, log, { timeout: 15000 })
    if (!ok) throw new Error(`菜单打开失败：${label}`)
    await page.waitForTimeout(2000)
  }
}

const { context, page } = await openSession()

// 全局捕获下载：某些「下载」会打开新标签页或导致原页面关闭，这里统一兜底保存
const captured = []
async function captureDownload(download) {
  console.log('[下载] 事件触发，suggestedFilename:', download.suggestedFilename())
  try {
    const filename = download.suggestedFilename() || `nr-${Date.now()}.xlsx`
    const savePath = path.join(downloadDir, filename)
    await download.saveAs(savePath)
    captured.push(savePath)
    console.log(`[下载] 文件已保存：${savePath}`)
  } catch (e) {
    console.log('[下载] saveAs 失败，改用 path() 复制:', String(e).slice(0, 120))
    try {
      const tmp = await download.path()
      if (tmp) {
        const filename = download.suggestedFilename() || `nr-${Date.now()}.xlsx`
        const savePath = path.join(downloadDir, filename)
        await fs.copyFile(tmp, savePath)
        captured.push(savePath)
        console.log(`[下载] 文件已复制：${savePath}`)
      } else {
        console.log('[下载] path() 返回空')
      }
    } catch (e2) {
      console.log('[下载] 复制也失败:', String(e2).slice(0, 140))
    }
  }
}
page.on('download', captureDownload)
context.on('page', (p) => {
  console.log('[事件] 新页面:', p.url().slice(0, 110))
  p.on('download', captureDownload)
})
context.on('close', () => console.log('[事件] context 已关闭'))
page.on('close', () => console.log('[事件] 主页面已关闭'))
page.on('crash', () => console.log('[事件] 主页面崩溃'))
page.on('popup', (p) => console.log('[事件] popup:', p.url().slice(0, 110)))
page.on('framedetached', (f) => console.log('[事件] frame 脱离:', f.url().slice(0, 90)))

// 下载地址是 OSS 预签名 URL（带 Expires/Signature），可脱离浏览器直接取文件。
// 页面在点击下载后会自动关闭，所以这里在监听到 URL 时立刻用 Node fetch 落盘。
// 查询最新任务行的状态与时间，避免重复下载别人的任务
async function latestTaskRow(frame) {
  return frame.evaluate(() => {
    const trs = Array.from(document.querySelectorAll('tr'))
    for (const tr of trs) {
      const t = (tr.innerText || '').replace(/\s+/g, ' ').trim()
      if (!t || /^文件名/.test(t)) continue
      const name = (t.match(/^([^\s]+\.xlsx)/) || [])[1] || ''
      return {
        name,
        done: /已生成/.test(t),
        ts: (t.match(/(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})/) || [])[1] || '',
      }
    }
    return null
  }).catch(() => null)
}
let reportFetchPromise = null
let reportFetchResolve = null
function armReportFetch() {
  reportFetchPromise = new Promise((resolve) => { reportFetchResolve = resolve })
}
function disarmReportFetch() {
  reportFetchResolve = null
  reportFetchPromise = null
}

async function fetchReportUrl(url, log = console.log) {
  const nameFromUrl = decodeURIComponent((url.split('?')[0].split('/').pop() || '').trim())
  const filename = /\.xlsx?$/i.test(nameFromUrl) ? nameFromUrl : `nr-${Date.now()}.xlsx`
  const savePath = path.join(downloadDir, filename)
  log(`[取文件] ${filename}`)
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const buf = Buffer.from(await res.arrayBuffer())
  await fs.writeFile(savePath, buf)
  log(`[取文件] 已保存 ${buf.length} bytes -> ${savePath}`)
  return savePath
}

context.on('response', async (res) => {
  try {
    const u = res.url()
    const ct = (res.headers()['content-type'] || '').toLowerCase()
    const cd = (res.headers()['content-disposition'] || '').toLowerCase()
    const isReport = /\.xlsx?(\?|$)/i.test(u) || /attachment/.test(cd)
      || /spreadsheet|excel/i.test(ct)
    if (!isReport) return
    if (/\.(png|jpg|jpeg|ttf|woff2?)(\?|$)/i.test(u)) return
    console.log('[网络] 报表文件响应:', res.status(), '|', u.slice(0, 160))
    if (!reportFetchResolve) return
    const resolve = reportFetchResolve
    disarmReportFetch()
    try {
      const p = await fetchReportUrl(u)
      resolve(p)
    } catch (e) {
      resolve(null)
    }
  } catch {}
})

try {
  await ensureLogin(page, homeUrl)

  if (hasFlag('explore')) {
    const pathArg = getArg('path')
    if (pathArg) {
      for (const step of pathArg.split('>').map((s) => s.trim()).filter(Boolean)) {
        await clickMenu(page, step).catch(async () => { await clickText(page, step) })
        await page.waitForTimeout(2500)
      }
    }
    await page.waitForTimeout(3000)
    const frames = []
    for (const frame of page.frames()) {
      const text = await frame.locator('body').innerText({ timeout: 5000 }).catch(() => '')
      if (!text || text.length < 20) continue
      const inputs = await frame.locator('input').evaluateAll((els) => els.slice(0, 60).map((e) => {
        const r = e.getBoundingClientRect()
        return {
          type: e.type,
          value: e.value,
          placeholder: e.placeholder,
          cls: String(e.className).slice(0, 80),
          visible: r.width > 0 && r.height > 0,
        }
      })).catch(() => [])
      const controls = await frame.locator('body *').evaluateAll((els) => els
        .filter((e) => /btn|radio|picker|select|tab|checkbox/i.test(String(e.className || '')) || e.tagName === 'BUTTON' || e.tagName === 'LABEL')
        .slice(0, 120)
        .map((e) => {
          const r = e.getBoundingClientRect()
          return {
            tag: e.tagName,
            text: (e.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 60),
            cls: String(e.className).slice(0, 90),
            visible: r.width > 0 && r.height > 0,
          }
        })
        .filter((e) => e.visible)).catch(() => [])
      frames.push({ url: frame.url().slice(0, 150), text: text.slice(0, 6000), inputs, controls })
    }
    await fs.writeFile(path.join(outputDir, 'nr-explore.json'), JSON.stringify(frames, null, 2))
    console.log('页面结构已保存到 output/nr-explore.json')
    throw new Error('EXPLORE_DONE')
  }

  // ===== 抓取流程 =====
  const period = getArg('period') || '昨日'
  const rangeArg = getArg('range')
  const timeDim = getArg('timedim') || 'everyDay'
  const category = getArg('category') || '经营数据下载'
  const statDim = getArg('statdim') || 'downLoadShopDetail'
  const dataDim = getArg('datadim') || 'bizDataIndex'

  await openMenuPath(page, ['数据', '数据下载中心'])
  const dc = await waitForFrame(page, 'ebai-download-center')
  console.log('[下载中心] iframe 已就绪')

  await clickInFrame(page, dc, category)
  console.log(`[下载中心] 分类: ${category}`)
  await page.waitForTimeout(2000)
  logFrames('after-category')

  // 时间范围
  if (rangeArg) {
    const [s, e] = rangeArg.split(',').map((x) => x.trim())
    console.log(`[下载中心] 时间范围: 自定义 ${s} ~ ${e}`)
    const sel = dc.locator('.ant-select-selector').first()
    if (await sel.count().catch(() => 0)) {
      await sel.click({ timeout: 8000 }).catch(() => {})
      await page.waitForTimeout(1500)
      const picked = await clickInFrame(page, dc, '自定义', { exact: true, timeout: 8000 })
      if (!picked) {
        const opt = page.getByText('自定义', { exact: true }).last()
        await opt.click({ timeout: 8000 }).catch(() => {})
      }
      await page.waitForTimeout(2000)
      const dateInput = dc.locator('input[placeholder="请选择日期"]').first()
      if (await dateInput.count().catch(() => 0)) {
        await dateInput.click({ timeout: 8000 }).catch(() => {})
        await page.waitForTimeout(1500)
        for (const d of [s, e]) {
          const ok = await page.evaluate((day) => {
            const cells = Array.from(document.querySelectorAll(`td[title="${day}"]`))
              .filter((c) => { const r = c.getBoundingClientRect(); return r.width > 0 && r.height > 0 })
            if (!cells.length) return false
            cells[0].click()
            return true
          }, d).catch(() => false)
          console.log(`[下载中心] 点选 ${d}: ${ok ? 'ok' : 'FAIL'}`)
          await page.waitForTimeout(900)
        }
        await page.waitForTimeout(1500)
      }
    }
  } else {
    console.log(`[下载中心] 时间范围: ${period}`)
    const cur = await dc.locator('.ant-select-selection-item').first().innerText().catch(() => '')
    if (cur.trim() !== period) {
      const sel = dc.locator('.ant-select-selector').first()
      await sel.click({ timeout: 8000 }).catch(() => {})
      await page.waitForTimeout(1500)
      const picked = await clickInFrame(page, dc, period)
      if (!picked) {
        const opt = page.getByText(period, { exact: true }).last()
        await opt.click({ timeout: 8000 }).catch(() => {})
      }
      await page.waitForTimeout(2000)
    }
  }

  console.log(`[下载中心] 统计维度: ${statDim}`)
  console.log('[下载中心] 统计维度结果:', await selectRadio(dcNow(), statDim))
  console.log(`[下载中心] 数据维度: ${dataDim}`)
  console.log('[下载中心] 数据维度结果:', await selectRadio(dcNow(), dataDim))
  console.log(`[下载中心] 时间维度: ${timeDim}`)
  console.log('[下载中心] 时间维度结果:', await selectRadio(dcNow(), timeDim))
  await page.waitForTimeout(1500)

  console.log('[下载中心] 勾选全部指标')
  console.log('[下载中心] 全选结果:', await checkAllMetrics(dcNow()))
  await page.waitForTimeout(2000)

  const btn = await generateReport(dcNow())
  if (!btn) throw new Error('生成报表按钮不可用（可能未勾选指标）')
  console.log('[报表] 已点击生成报表')
  await page.waitForTimeout(4000)
  await saveDebug(page, 'report-generated', outputDir, 'nr')

  // 下载历史
  console.log('[下载历史] 打开')
  await clickInFrame(page, dc, '下载历史', { exact: true, timeout: 8000 })
  await page.waitForTimeout(4000)
  await saveDebug(page, 'history', outputDir, 'nr')

  // 记录点击生成报表的时刻，只认之后产生的新「已生成」行，避免下载到别人的旧任务。
  // 任务日期精确到秒（与表格显示一致），回退 90s 容差防止点击与服务入库之间的时钟差。
  const reportTaskAt = Date.now() - 90000
  const deadline = Date.now() + WAIT_HISTORY
  let saved = null
  while (Date.now() < deadline && !saved) {
    const dc = dcNow()
    if (!dc) { await page.waitForTimeout(3000); continue }

    // 只认本轮任务生成之后产生的新「已生成」行，避免下载到别人的旧任务
    const latest = await latestTaskRow(dc)
    const isFresh = latest && latest.done && (
      !latest.ts || Date.parse(latest.ts.replace(' ', 'T')) >= reportTaskAt
    )
    console.log('[下载历史] 最新:', latest ? `${latest.name.slice(0, 60)} ${latest.done ? '已生成' : '生成中'} ${latest.ts}` : '无任务行')

    if (isFresh) {
      armReportFetch()
      let clicked = 'none'
      try {
        const rowLoc = dc.locator('tr', { hasText: latest.name.slice(0, 30) }).first()
        const btn = rowLoc.getByText(/^\s*下载\s*$/).first()
        await btn.scrollIntoViewIfNeeded().catch(() => {})
        await btn.click({ timeout: 8000 })
        clicked = 'locator-click'
      } catch (e) {
        clicked = 'locator-failed:' + String(e).slice(0, 90)
      }
      console.log('[下载历史] 点击下载:', clicked)

      const got = await Promise.race([
        reportFetchPromise || Promise.resolve(null),
        new Promise((r) => setTimeout(() => r(null), 120000)),
      ])
      if (got) { saved = got; break }
      console.log('[下载历史] 未取到文件，刷新后重试')
    } else {
      console.log('[下载历史] 本轮任务尚未生成，继续等待')
    }

    try {
      await clickInFrame(page, dcNow(), '刷新', { exact: false, timeout: 5000 })
      await page.waitForTimeout(8000)
    } catch (e) {
      console.log('[下载历史] 页面已关闭，等待重开:', String(e).slice(0, 80))
      await new Promise((r) => setTimeout(r, 5000))
    }
  }
  if (!saved) throw new Error('下载历史中未等到可下载的报表')
  console.log(`[完成] 文件：${saved}`)
  await saveDebug(page, 'success', outputDir, 'nr')
} catch (error) {
  const msg = error instanceof Error ? error.message : String(error)
  if (msg !== 'EXPLORE_DONE') {
    console.error('失败：', msg)
    await saveDebug(page, 'failed', outputDir, 'nr')
  }
} finally {
  if (!hasFlag('auto-close')) {
    console.log('浏览器保持打开，按 Enter 后关闭。')
    await new Promise((resolve) => {
      const timer = setTimeout(resolve, 600000)
      process.stdin.once('data', () => { clearTimeout(timer); resolve() })
    })
  }
  await context.close().catch(() => {})
}
