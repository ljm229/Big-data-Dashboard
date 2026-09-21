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
          const textNode = frame.getByText(/指标筛选\s*[（(]\s*\d+\s*[）)]/, { exact: false }).first()
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
  await clickText('昨日')
  await waitForText('经营详情', 60000)
  await clickText('经营详情')
  await waitForText('渠道门店周期趋势', 30000)
  await clickText('渠道门店周期趋势')
  await page.waitForTimeout(2500)

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
  await clickText('指标筛选 (10)', { exact: false, timeout: 60000 })
  await page.waitForTimeout(1000)

  const dialog = page.getByRole('dialog').last()
  const scope = (await dialog.count()) ? dialog : page.locator('body')
  const selectAll = scope.getByText('全选', { exact: true }).last()
  if (await selectAll.count()) {
    await selectAll.click()
  } else {
    const checkboxes = scope.locator('input[type="checkbox"]')
    const count = await checkboxes.count()
    for (let i = 0; i < count; i += 1) {
      if (!(await checkboxes.nth(i).isChecked().catch(() => false))) await checkboxes.nth(i).check().catch(() => {})
    }
  }
  await clickText('确定')
  await page.waitForTimeout(1500)

  await clickText('下载')
  await dismissMutePopup()
  await page.waitForTimeout(500)
  const exportItem = page.getByText('导出格式化数据', { exact: true }).last()
  await exportItem.waitFor({ state: 'visible', timeout: 10000 })
  const downloadPromise = page.waitForEvent('download', { timeout: 120000 })
  await exportItem.click()
  const download = await downloadPromise
  const filename = download.suggestedFilename() || `aixiang-business-detail-${new Date().toISOString().slice(0, 10)}.xlsx`
  const savePath = path.join(downloadDir, filename)
  await download.saveAs(savePath)
  console.log(`导出成功：${savePath}`)
  await saveDebug('business-detail-yesterday-success')
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
