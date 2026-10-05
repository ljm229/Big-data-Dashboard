import { chromium } from 'playwright'
import path from 'node:path'
import fs from 'node:fs/promises'
import { readFileSync, existsSync } from 'node:fs'

// 自加载 automation/.env（定时任务/直接运行时 process.env 可能没有注入）
try {
  const envPath = path.resolve('.env')
  if (existsSync(envPath)) {
    for (const line of readFileSync(envPath, 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)\s*$/)
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim()
    }
  }
} catch {}

const baseDir = path.resolve('.')
const outputDir = path.join(baseDir, 'output')
const downloadDir = path.join(outputDir, 'nr-download-center')
await fs.mkdir(downloadDir, { recursive: true })

const userDataDir = path.join(baseDir, '.browser-data', 'nr')
await fs.mkdir(userDataDir, { recursive: true })

const context = await chromium.launchPersistentContext(userDataDir, {
  headless: false,
  channel: 'chrome',
  viewport: { width: 1600, height: 950 },
  acceptDownloads: true,
  // 关键：显式指定下载目录。否则下载进系统临时目录，context.close() 时会被 Playwright 清理，
  // 表现为"脚本内能看到文件、退出后文件消失"。
  downloadsPath: downloadDir,
  args: ['--disable-blink-features=AutomationControlled'],
})
const page = context.pages()[0] ?? await context.newPage()

const account = process.env.NR_ACCOUNT || ''
const password = process.env.NR_PASSWORD || ''
if (!account || !password) {
  throw new Error('缺少账号或密码，请在 automation/.env 中配置 NR_ACCOUNT / NR_PASSWORD（禁止把凭据写进代码提交）')
}
const ROOT_URL = 'https://nr.ele.me/app/eleme-nr-bfe-newretail/common-next#/pc/homePagePc/'

async function saveDebug(step) {
  await page.screenshot({ path: path.join(outputDir, `nr-dc-${step}.png`), fullPage: true }).catch(() => {})
  const parts = []
  for (const frame of page.frames()) {
    const t = await frame.locator('body').innerText({ timeout: 5000 }).catch(() => '')
    if (t && t.trim()) parts.push(`===== FRAME ${frame.url().slice(0, 130)} =====\n${t}`)
  }
  await fs.writeFile(path.join(outputDir, `nr-dc-${step}.txt`), parts.join('\n\n'), 'utf8').catch(() => {})
}

async function handleAgreementDialog() {
  for (const frame of page.frames()) {
    const hit = await frame.evaluate(() => {
      const norm = (s) => (s || '').replace(/\s+/g, '')
      const containers = Array.from(document.querySelectorAll('.ant-modal, .ant-modal-root, [class*="modal"], [class*="dialog"]'))
      const pick = (el) => {
        const r = el.getBoundingClientRect()
        if (r.width <= 0 || r.height <= 0) return null
        return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
      }
      for (const c of containers) {
        const t = c.textContent || ''
        if (!/请先阅读并同意|隐私政策/.test(t)) continue
        const btn = Array.from(c.querySelectorAll('button, .ant-btn, a'))
          .find((b) => /^(同意|确定|继续登录)$/.test(norm(b.textContent)))
        if (!btn) continue
        const p = pick(btn)
        if (p) return p
      }
      return null
    }).catch(() => null)
    if (hit) {
      await page.mouse.click(hit.x, hit.y)
      return true
    }
  }
  return false
}

function loginFrame() {
  for (const frame of page.frames()) {
    if (frame.url().includes('eb_login') || frame.url().includes('login')) return frame
  }
  return null
}

async function ensureLogin() {
  let frame = loginFrame()
  if (!frame) {
    await saveDebug('state')
    return
  }
  console.log('[登录] 填写账号密码')
  const acc = frame.locator('input[placeholder="请输入您的账号"]').first()
  const pwd = frame.locator('input[placeholder="请输入您的密码"]').first()
  await acc.click()
  await acc.fill(account)
  await page.waitForTimeout(400)
  await pwd.click()
  await pwd.fill(password)
  await page.waitForTimeout(600)
  for (const f of page.frames()) {
    const res = await f.evaluate(() => {
      const boxes = Array.from(document.querySelectorAll('input[type="checkbox"]'))
        .filter((e) => e.getBoundingClientRect().width > 0 && !e.checked)
      if (!boxes.length) return 'skip'
      boxes[boxes.length - 1].click()
      return 'checked'
    }).catch(() => '')
    if (res === 'checked') break
  }
  await page.waitForTimeout(600)
  console.log('[登录] 提交')
  const btn = frame.locator('button.eb-login-button, button:has-text("登 录")').first()
  if (await btn.count().catch(() => 0)) await btn.click({ timeout: 10000 })

  const deadline = Date.now() + 180000
  let agree = 0
  while (Date.now() < deadline) {
    await page.waitForTimeout(3000)
    if (agree < 5 && await handleAgreementDialog()) {
      agree += 1
      console.log(`[登录] 协议弹窗，已点击「同意」（第 ${agree} 次）`)
      await page.waitForTimeout(2500)
      const again = loginFrame()
      if (again) {
        const b2 = again.locator('button.eb-login-button, button:has-text("登 录")').first()
        if (await b2.count().catch(() => 0)) await b2.click({ timeout: 8000 }).catch(() => {})
      }
      continue
    }
    if (!loginFrame()) break
  }
  console.log('[登录] 完成')
  await page.waitForTimeout(3000)
}

async function clickMenuItem(text) {
  console.log(`[菜单] ${text}`)
  for (let attempt = 0; attempt < 12; attempt += 1) {
    for (const frame of page.frames()) {
      const hit = await frame.evaluate((t) => {
        const norm = (s) => (s || '').replace(/\s+/g, '')
        const all = Array.from(document.querySelectorAll('a, span, div, li'))
        const cands = all.filter((e) => norm(e.textContent) === norm(t))
        if (!cands.length) return null
        cands.sort((a, b) => (a.textContent || '').length - (b.textContent || '').length)
        const el = cands[0]
        let host = el.parentElement
        while (host && host !== document.body) {
          const st = getComputedStyle(host)
          if (/(auto|scroll)/.test(st.overflowY) && host.scrollHeight > host.clientHeight + 4) {
            host.scrollTop = Math.max(0, el.offsetTop - 200)
            break
          }
          host = host.parentElement
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
      return true
    }
    await page.waitForTimeout(1000)
  }
  throw new Error(`菜单项未找到或不可点：${text}`)
}

async function clickByText(text, opts = {}) {
  const timeout = opts.timeout ?? 20000
  console.log(`[点击] ${text}`)
  const deadline = Date.now() + timeout
  while (Date.now() < deadline) {
    for (const frame of page.frames()) {
      const hit = await frame.evaluate((t) => {
        const norm = (s) => (s || '').replace(/\s+/g, '')
        const all = Array.from(document.querySelectorAll('button, span, div, a, label'))
        const cands = all.filter((e) => norm(e.textContent) === norm(t))
          .filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 })
        if (!cands.length) return null
        cands.sort((a, b) => (a.textContent || '').length - (b.textContent || '').length)
        const el = cands[0]
        const target = el.closest('button') || el.closest('label') || el
        target.scrollIntoView({ block: 'center' })
        const r = target.getBoundingClientRect()
        return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
      }, text).catch(() => null)
      if (hit) {
        await page.mouse.click(hit.x, hit.y)
        await page.waitForTimeout(1200)
        return true
      }
    }
    await page.waitForTimeout(800)
  }
  console.log(`[点击] 未找到：${text}`)
  return false
}

const getArg = (n) => (process.argv.find((a) => a.startsWith(`--${n}=`)) || '').slice(n.length + 3)

async function dcFrame() {
  for (const frame of page.frames()) {
    if (frame.url().includes('ebai-download-center')) return frame
    try {
      const n = await frame.locator('.DownloadCenter_title__KYPyI, [class*="downloadFormModule"]').count().catch(() => 0)
      if (n) return frame
    } catch {}
  }
  return null
}

async function pickTab(frame, tabName) {
  console.log(`[数据类型] ${tabName}`)
  const tab = frame.locator('.ant-tabs-tab', { hasText: tabName }).first()
  if (await tab.count().catch(() => 0)) {
    await tab.scrollIntoViewIfNeeded().catch(() => {})
    await tab.click({ timeout: 8000 })
    await page.waitForTimeout(2500)
    return true
  }
  console.log(`[数据类型] 未找到标签 ${tabName}`)
  return false
}

async function setTimeRange(frame, mode, start, end) {
  console.log(`[时间范围] ${mode}`)
  const sel = frame.locator('.DateSelector_date-selector-container:visible .ant-select, .ant-select:visible').first()
  await sel.scrollIntoViewIfNeeded().catch(() => {})
  await sel.click({ timeout: 10000 })
  await page.waitForTimeout(1800)
  const opt = frame.locator(`.ant-select-dropdown:visible .ant-select-item-option-content`).filter({ hasText: new RegExp(`^${mode}$`) }).first()
  if (!(await opt.count().catch(() => 0))) {
    console.log(`[时间范围] 未找到选项 ${mode}`)
    return false
  }
  await opt.click({ timeout: 8000 })
  await page.waitForTimeout(3000)

  if (mode === '自定义' && start && end) {
    const inputs = frame.locator('.ant-picker:visible input')
    const n = await inputs.count().catch(() => 0)
    console.log('[时间范围] 日历输入框数量:', n)
    if (n) {
      await inputs.first().click({ timeout: 8000 })
      await page.waitForTimeout(1500)
      const pick = async (d) => {
        let ok = false
        for (const fr of page.frames()) {
          const cell = fr.locator(`.ant-picker-dropdown:visible td[title="${d}"], td[title="${d}"]`).first()
          if (await cell.count().catch(() => 0)) {
            try {
              await cell.scrollIntoViewIfNeeded().catch(() => {})
              await cell.click({ timeout: 6000 })
              ok = true
              break
            } catch {}
          }
        }
        console.log(`[时间范围] 点选 ${d}: ${ok ? 'ok' : 'FAIL'}`)
        return ok
      }
      await pick(start)
      await page.waitForTimeout(900)
      await pick(end)
      await page.waitForTimeout(3000)
      const vals = await frame.evaluate(() => Array.from(document.querySelectorAll('.ant-picker input')).map((i) => i.value))
      console.log('[时间范围] 当前值:', JSON.stringify(vals))
    }
  }
  return true
}

async function setRadio(frame, _value, labelText, { required = true } = {}) {
  console.log(`[统计方式] ${labelText}${required ? '' : '（可选）'}`)
  // 先探测该选项是否存在（不同 tab 的数据维度选项不同，如流量=分来源数据，商品=店铺数据）
  const probe = frame.locator('.ant-radio-wrapper:visible').filter({ hasText: new RegExp(`^\\s*${labelText}\\s*$`) }).first()
  if (!(await probe.count().catch(() => 0))) {
    console.log(`[统计方式] 当前 tab 无「${labelText}」选项${required ? '，继续等待' : '，跳过'}`)
    if (!required) return false
  }
  const deadline = Date.now() + 30000
  const pick = () => frame.locator('.ant-radio-wrapper:visible').filter({ hasText: new RegExp(`^\\s*${labelText}\\s*$`) }).first()
  while (Date.now() < deadline) {
    const wrapper = pick()
    if (await wrapper.count().catch(() => 0)) {
      const input = wrapper.locator('input[type="radio"]').first()
      if (await input.isChecked().catch(() => false)) {
        console.log(`[统计方式] ${labelText} 已是选中状态`)
        return true
      }
      try {
        await wrapper.scrollIntoViewIfNeeded().catch(() => {})
        await wrapper.click({ timeout: 8000 })
      } catch {
        await input.click({ force: true, timeout: 8000 }).catch(() => {})
      }
      await page.waitForTimeout(1500)
      if (await input.isChecked().catch(() => false)) {
        console.log(`[统计方式] ${labelText} 选中成功`)
        return true
      }
    }
    await page.waitForTimeout(1500)
  }
  console.log(`[统计方式] ${labelText} 未能选中`)
  return false
}

function metricStats(frame) {
  return frame.evaluate(() => {
    const groups = Array.from(document.querySelectorAll('.ant-checkbox-group'))
    let vis = null
    for (const g of groups) {
      if (g.getBoundingClientRect().width > 0) vis = g
    }
    const boxes = vis ? Array.from(vis.querySelectorAll('input[type="checkbox"]')) : []
    const genBtn = document.querySelector('button[class*="gen-btn"]')
    return {
      total: boxes.length,
      checked: boxes.filter((b) => b.checked).length,
      gen: (genBtn?.textContent || '').replace(/\s+/g, ''),
    }
  })
}

async function clickSelectAll(frame) {
  const label = frame.locator('label.ant-checkbox-wrapper:visible').filter({ hasText: /全选/ }).first()
  if (!(await label.count().catch(() => 0))) {
    console.log('[指标] 未找到全选')
    return false
  }
  const text = (await label.innerText().catch(() => '')).replace(/\s+/g, '')
  await label.scrollIntoViewIfNeeded().catch(() => {})
  console.log(`[指标] 点击 ${text}`)
  await label.click({ timeout: 10000 }).catch(async () => {
    await label.locator('input[type="checkbox"]').first().check({ force: true, timeout: 8000 }).catch(() => {})
  })
  await page.waitForTimeout(2500)
  const st = await metricStats(frame)
  console.log(`[指标] 勾选 ${st.checked}/${st.total}（以复选框实际状态为准，不看按钮文字）`)
  if (!st.checked) {
    await label.click({ timeout: 10000 }).catch(() => {})
    await page.waitForTimeout(2500)
    const st2 = await metricStats(frame)
    console.log(`[指标] 重试后 ${st2.checked}/${st2.total}`)
    return st2.checked
  }
  return st.checked
}

async function generateReport(frame) {
  const btn = frame.locator('button[class*="gen-btn"]:visible, .ant-btn-primary:visible').first()
  if (!(await btn.count().catch(() => 0))) {
    console.log('[生成] 未找到生成报表按钮')
    return false
  }
  const text = (await btn.innerText().catch(() => '')).replace(/\s+/g, '')
  console.log(`[生成] 点击「${text}」`)
  await btn.scrollIntoViewIfNeeded().catch(() => {})
  await btn.click({ timeout: 10000 })
  await page.waitForTimeout(4000)
  return true
}

async function dismissGenerateModal() {
  for (let i = 0; i < 3; i += 1) {
    let acted = false
    for (const fr of page.frames()) {
      const modal = fr.locator('.ant-modal:visible, .ant-modal-root:visible').first()
      if (!(await modal.count().catch(() => 0))) continue
      const hist = modal.locator('button, .ant-btn, a').filter({ hasText: /查看下载历史/ }).first()
      if (await hist.count().catch(() => 0)) {
        await hist.click({ timeout: 8000 }).catch(() => {})
        console.log('[生成] 已点击弹窗「查看下载历史」')
        acted = true
      } else {
        const ok = modal.locator('button, .ant-btn').filter({ hasText: /知道了|关闭|确定/ }).first()
        if (await ok.count().catch(() => 0)) {
          await ok.click({ timeout: 8000 }).catch(() => {})
          console.log('[生成] 已点击弹窗「知道了」')
          acted = true
        }
      }
      await page.waitForTimeout(2500)
    }
    if (!acted) break
  }
}

async function goHistory(frame) {
  console.log('[历史] 切换下载历史')
  for (let i = 0; i < 3; i += 1) {
    const tab = frame.locator('.ant-tabs-tab:visible').filter({ hasText: /下载历史/ }).first()
    if (await tab.count().catch(() => 0)) {
      await tab.click({ timeout: 8000 }).catch(() => {})
      await page.waitForTimeout(3500)
    }
    const txt = await frame.locator('body').innerText({ timeout: 5000 }).catch(() => '')
    if (/任务状态|任务名称|下载时间|已生成/.test(txt)) {
      console.log('[历史] 已进入下载历史')
      return true
    }
    await page.waitForTimeout(1500)
  }
  return false
}

async function dumpHistory(frame) {
  const info = await frame.evaluate(() => {
    const tables = Array.from(document.querySelectorAll('table'))
    const vis = tables.filter((t) => t.getBoundingClientRect().width > 0)
    return vis.map((t) => ({
      headers: Array.from(t.querySelectorAll('th')).map((th) => (th.textContent || '').replace(/\s+/g, '')).slice(0, 12),
      rows: Array.from(t.querySelectorAll('tbody tr')).slice(0, 5).map((tr) => (tr.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 200)),
    }))
  }).catch(() => [])
  console.log('[历史] 表格:', JSON.stringify(info, null, 1).slice(0, 1500))
  return info
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// 从任务行文本解析任务日期 "2026-09-22 11:54:48"，返回毫秒时间戳；解析失败返回 0
function parseTaskTs(rowText) {
  const m = rowText.match(/(\d{4}-\d{2}-\d{2})[ ](\d{2}:\d{2}:\d{2})/)
  if (!m) return 0
  const ts = Date.parse(`${m[1]}T${m[2]}`)
  return Number.isNaN(ts) ? 0 : ts
}

// 归档命名：类型-统计_起止日期.xlsx
function archiveName(typeArg, startArg, endArg, original) {
  const safe = (typeArg || '下载').replace(/[\\/:*?"<>|]/g, '')
  const range = startArg && endArg ? `_${startArg}-${endArg}` : ''
  return `${safe}${range}.xlsx`
}

async function waitAndDownload(frame, timeoutMs = 300000, genStamp = 0, match = '') {
  const deadline = Date.now() + timeoutMs
  let firstPass = true
  let polls = 0
  const MAX_POLLS = 60
  while (Date.now() < deadline && polls < MAX_POLLS) {
    polls += 1
    await dismissGenerateModal()
    if (firstPass) { await dumpHistory(frame); firstPass = false }

    const rows = frame.locator('table:visible tbody tr')
    const rowCount = await rows.count().catch(() => 0)
    let targetBtn = null
    let targetInfo = ''
    for (let i = 0; i < rowCount; i += 1) {
      const row = rows.nth(i)
      const txt = (await row.innerText().catch(() => '')).replace(/\s+/g, ' ').trim()
      if (!/已生成|已完成/.test(txt)) continue
      // 只接受本轮生成任务：任务日期必须 >= 点生成时的时间戳；history-only 用 --match=文件名片段锁定
      if (match ? !txt.includes(match) : (genStamp && parseTaskTs(txt) < genStamp)) continue
      const btn = row.locator('button, a').filter({ hasText: /^下载$/ }).first()
      if (await btn.count().catch(() => 0)) {
        targetBtn = btn
        targetInfo = txt.slice(0, 110)
        break
      }
    }

    if (targetBtn) {
      console.log('[历史] 目标任务行:', targetInfo)
      // 先挂下载监听（事件可能来自新弹出的 tab，所以挂在 context 级别更稳）
      const downloadPromise = page.waitForEvent('download', { timeout: 60000 }).catch(() => null)
      // 读出"下载"链接的 href，用 window.open 在新 tab 打开——直接点会让当前页导航自杀
      const link = await frame.evaluate(() => {
        const rows = Array.from(document.querySelectorAll('table tbody tr'))
        for (const tr of rows) {
          const txt = (tr.innerText || '').replace(/\s+/g, ' ')
          if (!/已生成|已完成/.test(txt)) continue
          const btns = Array.from(tr.querySelectorAll('button, a'))
          const b = btns.find((x) => (x.textContent || '').replace(/\s+/g, '') === '下载')
          if (!b) continue
          const a = b.closest('a') || (b.tagName === 'A' ? b : null)
          return {
            href: a ? a.getAttribute('href') : null,
            tag: b.tagName,
            html: b.outerHTML.slice(0, 300),
          }
        }
        return null
      }).catch(() => null)
      console.log('[历史] 下载链接:', JSON.stringify(link))
      // 抓下载 URL：按钮是 JS 驱动的 ant-btn-link，直接点会导航整页导致下载中断。
      // 先监听 request 捕获真正的下载地址，再用 context.request（带 cookie、不依赖页面存活）拉取。
      let dlUrl = ''
      const onReq = (req) => {
        try {
          const u = req.url()
          if (dlUrl || u.includes('ebai-download-center/index.html')) return
          if (/\.xlsx(\?|$)|download/i.test(u)) {
            dlUrl = u
            console.log('[历史] 捕获下载请求:', u.slice(0, 160))
          }
        } catch {}
      }
      page.on('request', onReq)
      try {
        if (link && link.href && /^https?:|^blob:/.test(link.href)) {
          await frame.evaluate((href) => { window.open(href, '_blank') }, link.href)
          console.log('[历史] 已在新 tab 打开下载链接')
        } else {
          await targetBtn.scrollIntoViewIfNeeded().catch(() => {})
          await targetBtn.click({ timeout: 10000 })
          console.log('[历史] 已真实点击下载按钮')
        }
      } catch (e) {
        console.log('[历史] 点击失败:', String(e).slice(0, 100))
        page.off('request', onReq)
        await sleep(5000)
        continue
      }
      page.off('request', onReq)
      // 通道 A：下载事件 + 立刻 saveAs（页面活着时最快）
      // 通道 B：用捕获到的 URL 走 context.request 拉取（页面已死也能用，只要 context 活着）
      // 立刻等事件（不先做 60s 目录轮询——页面随时会死，saveAs 必须趁页面活着调）
      const download = await Promise.race([
        downloadPromise,
        sleep(25000).then(() => null),
      ])
      if (download) {
        const suggested = download.suggestedFilename() || `nr-download-${Date.now()}.xlsx`
        const dest = path.join(downloadDir, suggested)
        try {
          await download.saveAs(dest)
        } catch (e) {
          console.log('[历史] saveAs 失败（页面已死）:', String(e).slice(0, 120))
        }
        const size = await fs.stat(dest).then((s) => s.size).catch(() => -1)
        console.log(`[历史] saveAs 结果：${dest}（${size} 字节）`)
        if (size > 0) {
          const keepDir = path.join(outputDir, 'nr-download-center-keep')
          await fs.mkdir(keepDir, { recursive: true })
          const keep = path.join(keepDir, suggested)
          await fs.copyFile(dest, keep).catch(() => {})
          console.log(`导出成功：${dest}（备份 ${keep}）`)
          return dest
        }
        console.log('[历史] saveAs 体积异常，转目录兜底')
      } else {
        console.log('[历史] 25s 未收到下载事件，转 URL 直拉 + 目录兜底')
      }
      // 通道 B：URL 直拉（OSS 直链，用 Node 原生 fetch，不依赖页面/context 存活）
      if (dlUrl) {
        await fs.writeFile(path.join(outputDir, 'last-download-url.txt'), dlUrl, 'utf8').catch(() => {})
        try {
          const res = await fetch(dlUrl)
          const buf = res.ok ? Buffer.from(await res.arrayBuffer()) : null
          console.log(`[历史] 直拉状态 ${res.status} 体积 ${buf ? buf.length : -1}`)
          if (buf && buf.length > 1000) {
            const suggested = (targetInfo.match(/[^\s]+\.xlsx/) || [`nr-download-${Date.now()}.xlsx`])[0]
            const dest = path.join(downloadDir, suggested)
            await fs.writeFile(dest, buf)
            const keepDir = path.join(outputDir, 'nr-download-center-keep')
            await fs.mkdir(keepDir, { recursive: true })
            await fs.copyFile(dest, path.join(keepDir, suggested)).catch(() => {})
            console.log(`导出成功（直拉）：${dest}（${buf.length} 字节）`)
            return dest
          }
          console.log('[历史] 直拉内容太小，可能是错误页，转目录兜底')
        } catch (e) {
          console.log('[历史] 直拉失败:', String(e).slice(0, 120))
        }
      } else {
        console.log('[历史] 未捕获到下载 URL，转目录兜底')
      }
      // 目录兜底：用独立时钟，页面关闭也不空转
      const before = new Set(await fs.readdir(downloadDir).catch(() => []))
      const deadline2 = Date.now() + 60000
      let fresh = ''
      while (Date.now() < deadline2) {
        await sleep(2500)
        const now = await fs.readdir(downloadDir).catch(() => [])
        fresh = now.find((n) => !before.has(n) && n.toLowerCase().endsWith('.xlsx')) || ''
        if (fresh) break
      }
      if (fresh) {
        const dest = path.join(downloadDir, fresh)
        // 体积稳定后再认领，防止读到下载中的半成品
        const s1 = await fs.stat(dest).then((s) => s.size).catch(() => -1)
        await sleep(2000)
        const s2 = await fs.stat(dest).then((s) => s.size).catch(() => -2)
        if (s1 <= 0 || s1 !== s2) {
          console.log(`[历史] 文件体积不稳定（${s1} → ${s2}），继续等待`)
        } else {
          const keepDir = path.join(outputDir, 'nr-download-center-keep')
          await fs.mkdir(keepDir, { recursive: true })
          const keep = path.join(keepDir, fresh)
          await fs.copyFile(dest, keep).catch(() => {})
          const ksize = await fs.stat(keep).then((s) => s.size).catch(() => -1)
          console.log(`导出成功：${dest}（${s2} 字节，备份 ${ksize} 字节）`)
          return dest
        }
      }
      // 页面自杀检测：frame 已死或表格消失 → 关掉多余 tab、按入口重进（reload 会落回空白外壳），而不是盲等
      const countNow = await frame.locator('table:visible tbody tr').count().catch(() => -1)
      const dead = frame.isDetached() || countNow <= 0
      if (dead) {
        console.log(`[历史] 页面/表格已失效（detached=${frame.isDetached()} 行数=${countNow}），重进下载中心`)
        for (const p of context.pages()) {
          if (p !== page) await p.close().catch(() => {})
        }
        await page.goto(ROOT_URL, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {})
        await sleep(6000)
        await clickMenuItem('数据').catch(() => {})
        await clickMenuItem('数据下载中心').catch(() => {})
        await sleep(4000)
        const nf = await dcFrame()
        if (nf) {
          frame = nf
          await goHistory(frame).catch(() => {})
          await sleep(3000)
        }
      }
      console.log('[历史] 本轮未拿到文件，继续')
      continue
    }

    let pending = ''
    try {
      pending = await frame.evaluate(() => {
        const txt = document.body.innerText || ''
        const m = txt.match(/生成中|排队中|待生成|生成失败/)
        return m ? m[0] : ''
      }).catch(() => '')
    } catch {}
    if (pending) console.log(`[历史] 任务状态: ${pending}（第 ${polls}/${MAX_POLLS} 轮）`)
    else console.log(`[历史] 等待本轮任务生成（第 ${polls}/${MAX_POLLS} 轮，行数 ${rowCount}）`)
    await sleep(10000)
  }
  return null
}

try {
  await page.goto(ROOT_URL, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.waitForTimeout(7000)
  await ensureLogin(context)
  await page.waitForTimeout(3000)

  await clickMenuItem('数据')
  await page.waitForTimeout(1500)
  await clickMenuItem('数据下载中心')
  await page.waitForTimeout(4000)
  await saveDebug('download-center')

  if (process.argv.includes('--inspect')) {
    const frames = []
    for (const frame of page.frames()) {
      const text = await frame.locator('body').innerText({ timeout: 5000 }).catch(() => '')
      const controls = await frame.locator('body *').evaluateAll((els) => els
        .filter((e) => {
          const t = (e.textContent || '').replace(/\s+/g, '')
          return t.length > 0 && t.length < 30
        })
        .slice(0, 400)
        .map((e) => ({
          tag: e.tagName,
          text: (e.textContent || '').replace(/\s+/g, '').slice(0, 30),
          cls: (e.className || '').toString().slice(0, 120),
          visible: e.getBoundingClientRect().width > 0,
        }))).catch(() => [])
      const inputs = await frame.locator('input').evaluateAll((els) => els.slice(0, 30).map((e) => ({
        type: e.type,
        placeholder: e.placeholder,
        value: e.value,
        cls: String(e.className).slice(0, 100),
      }))).catch(() => [])
      frames.push({ url: frame.url().slice(0, 130), text: text.slice(0, 4000), controls, inputs })
    }
    await fs.writeFile(path.join(outputDir, 'nr-dc-frames.json'), JSON.stringify(frames, null, 2))
    console.log('页面结构已保存到 output/nr-dc-frames.json')
    throw new Error('inspect 模式结束')
  }

  if (process.argv.includes('--inspect-range')) {
    const f = page.frames().find((x) => x.url().includes('ebai-download-center'))
    if (!f) throw new Error('未找到下载中心 iframe')
    const sel = f.locator('.DateSelector_date-selector-container .ant-select, .ant-select').first()
    await sel.scrollIntoViewIfNeeded().catch(() => {})
    await sel.click({ timeout: 8000 })
    console.log('[时间范围] 已点击下拉框（Playwright 定位器）')
    await page.waitForTimeout(2500)
    const opts = await f.evaluate(() => {
      const out = { popups: [], items: [] }
      for (const el of document.querySelectorAll('[class*="dropdown"], [class*="popup"]')) {
        out.popups.push({ cls: String(el.className).slice(0, 110), html: el.outerHTML.slice(0, 1200) })
      }
      for (const el of document.querySelectorAll('[class*="select-item"], [role="option"]')) {
        out.items.push({ t: (el.textContent || '').replace(/\s+/g, ''), cls: String(el.className).slice(0, 90) })
      }
      return out
    })
    console.log('[时间范围] popups:', opts.popups.length, 'items:', JSON.stringify(opts.items))
    await fs.writeFile(path.join(outputDir, 'nr-dc-range-probe.json'), JSON.stringify(opts, null, 2), 'utf8')
    await saveDebug('range-options')
    throw new Error('inspect-range 模式结束')
  }

  const f = await dcFrame()
  if (!f) throw new Error('未进入数据下载中心 iframe')
  console.log('[页面] 数据下载中心 iframe 已就绪')

  const getArg2 = (n) => (process.argv.find((a) => a.startsWith(`--${n}=`)) || '').slice(n.length + 3)
  const typeArg = getArg2('type') || '流量数据下载'
  const startArg = getArg2('start')
  const endArg = getArg2('end')
  // 数据维度随 tab 不同：流量=分来源数据，商品=店铺数据，异常单=逆向单；可用 --data-dim= 覆盖
  const dataDimArg = getArg2('data-dim')
    || (typeArg.includes('商品') ? '店铺数据' : typeArg.includes('流量') ? '分来源数据' : typeArg.includes('异常') ? '逆向单' : '')
  console.log(`[配置] 类型=${typeArg} 时间=${startArg || '昨日'}~${endArg || ''} 数据维度=${dataDimArg || '(跳过)'}`)

  if (process.argv.includes('--inspect-radios')) {
    const info = await f.evaluate(() => {
      const out = []
      for (const r of document.querySelectorAll('input[type="radio"]')) {
        const wrap = r.closest('label')
        const vis = wrap ? wrap.getBoundingClientRect().width > 0 : r.getBoundingClientRect().width > 0
        out.push({ value: r.value, checked: r.checked, visible: vis, label: (wrap?.textContent || '').replace(/\s+/g, '') })
      }
      return out
    })
    console.log('[radio] ', JSON.stringify(info, null, 1))
    throw new Error('inspect-radios 模式结束')
  }

  if (process.argv.includes('--history-only')) {
    console.log('已按 --history-only 直接进入下载历史。')
    await goHistory(f)
    await saveDebug('history')
    const savedPath = await waitAndDownload(f, 300000, 0, getArg2('match'))
    console.log('[历史] 结果:', savedPath || '未获取到文件')
    throw new Error('history-only 模式结束')
  }

  const f2 = f
  await pickTab(f2, typeArg)

  if (startArg && endArg) {
    await setTimeRange(f, '自定义', startArg, endArg)
  } else {
    await setTimeRange(f, '昨日')
  }

  await setRadio(f, 'downLoadShopDetail', '按店铺明细下载')
  if (dataDimArg) {
    const okDim = await setRadio(f, 'dataDim', dataDimArg, { required: false })
    if (!okDim) console.log(`[统计方式] 数据维度「${dataDimArg}」未找到，已跳过（以页面实际选项为准）`)
  }
  // 时间维度：流量/商品 tab 有"按每日统计"（红线，绝不能选"按筛选时间汇总"）；
  // 异常单 tab 是订单明细天然按日，无此选项时跳过
  const okDaily = await setRadio(f, 'everyDay', '按每日统计', { required: false })
  if (!okDaily) {
    // 真红线：明确选中了"按筛选时间汇总"才停；无时间维度选项时放行，靠导出后验日期列（入库 grain 校验兜底）
    const summed = await f.evaluate(() => {
      for (const r of document.querySelectorAll('input[type="radio"]')) {
        const t = (r.closest('label')?.textContent || '').replace(/\s+/g, '')
        if (/按筛选时间汇总/.test(t)) return r.checked
      }
      return false
    }).catch(() => false)
    if (summed) throw new Error('当前选中「按筛选时间汇总」，为防导出汇总数据，已停止')
    console.log('[统计方式] 警告：无「按每日统计」，导出后必须验日期列（拒绝汇总文件）')
  }
  const checkedCount = await clickSelectAll(f)
  await saveDebug('configured')

  const state = await f.evaluate(() => {
    const out = []
    for (const r of document.querySelectorAll('input[type="radio"]')) {
      const wrap = r.closest('label')
      out.push(`${r.value}=${r.checked}(${(wrap?.textContent || '').replace(/\s+/g, '')})`)
    }
    return { radios: out.join(' ') }
  })
  console.log('[状态] radio:', state.radios)
  console.log(`[状态] 指标实际勾选数: ${checkedCount}`)
  if (!checkedCount) throw new Error('指标全选失败（复选框实际勾选数为 0），停止生成')

  if (process.argv.includes('--no-generate')) {
    console.log('已按 --no-generate 停在配置完成。')
    throw new Error('no-generate 模式结束')
  }

  // 点生成前记录时间戳，用于在历史里锁定"这一次"的任务
  const genStamp = Date.now()
  await generateReport(f)
  await page.waitForTimeout(4000)
  await saveDebug('generated')

  await dismissGenerateModal()
  await page.waitForTimeout(2000)
  if (!(await goHistory(f))) await goHistory(f)
  await saveDebug('history')

  const saved = await waitAndDownload(f, 300000, genStamp)
  if (!saved) throw new Error('未能在下载历史中获取文件')
  // 落盘后按类型+日期归档重命名，避免时间戳同名文件堆积
  const archived = path.join(downloadDir, archiveName(typeArg, startArg, endArg, path.basename(saved)))
  if (saved !== archived) {
    await fs.rename(saved, archived).catch(() => {})
    console.log(`[归档] ${archived}`)
  }
  await saveDebug('success')
} catch (error) {
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
