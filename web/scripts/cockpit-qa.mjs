import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { chromium } from 'playwright-core'

const target = process.argv[2] || 'http://127.0.0.1:5173/'
const outDir = path.resolve(process.argv[3] || 'browser-qa')
const candidates = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
]
const executablePath = candidates.find((file) => fs.existsSync(file))
if (!executablePath) throw new Error('未找到 Edge/Chrome 浏览器')

const allViewports = [
  { name: 'full-hd', width: 1920, height: 1080 },
  { name: 'desktop-16x10', width: 1440, height: 900 },
  { name: 'laptop', width: 1366, height: 768 },
]
const viewports = process.argv[4] ? allViewports.filter((item) => item.name === process.argv[4]) : allViewports
fs.mkdirSync(outDir, { recursive: true })

const browser = await chromium.launch({ headless: true, executablePath, args: ['--disable-gpu', '--no-sandbox'] })
const results = []
for (const viewport of viewports) {
  const page = await browser.newPage({
    viewport: { width: viewport.width, height: viewport.height },
    reducedMotion: 'reduce',
  })
  const errors = []
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push({ type: 'console', text: message.text() })
  })
  page.on('pageerror', (error) => errors.push({ type: 'page', text: String(error) }))

  await page.goto(target, { waitUntil: 'networkidle', timeout: 60_000 })
  await page.waitForSelector('.screen .body', { timeout: 20_000 })
  await page.waitForTimeout(900)

  const audit = await page.evaluate(() => {
    const visible = (el) => {
      const style = getComputedStyle(el)
      const rect = el.getBoundingClientRect()
      return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0
    }
    const interactive = [...document.querySelectorAll('button,a[href],input,select,[tabindex]:not([tabindex="-1"])')]
      .filter(visible)
      .filter((el) => !el.disabled && el.getAttribute('aria-hidden') !== 'true')
    const accessibleName = (el) => (el.getAttribute('aria-label') || el.getAttribute('title') || el.textContent || '').trim()
    const matchedHeightRules = (el) => [...document.styleSheets].flatMap((sheet) => {
      try {
        return [...sheet.cssRules]
          .filter((rule) => rule.selectorText && el.matches(rule.selectorText) && rule.style?.height)
          .map((rule) => `${rule.selectorText} => ${rule.style.height}`)
      } catch {
        return []
      }
    })
    const panelOverflows = [...document.querySelectorAll('.panel__content')]
      .map((el, index) => ({
        index,
        title: el.closest('.panel')?.querySelector('.panel__title')?.textContent?.trim() || '',
        scrollHeight: el.scrollHeight,
        clientHeight: el.clientHeight,
        scrollWidth: el.scrollWidth,
        clientWidth: el.clientWidth,
        children: [...el.children].map((child) => ({
          className: child.className,
          attributes: [...child.attributes].map((attribute) => `${attribute.name}=${attribute.value}`),
          height: child.getBoundingClientRect().height,
          cssHeight: getComputedStyle(child).height,
          overflow: getComputedStyle(child).overflow,
          descendants: [...child.children].map((descendant) => ({
            tag: descendant.tagName,
            className: descendant.className,
            attributes: [...descendant.attributes].map((attribute) => `${attribute.name}=${attribute.value}`),
            height: descendant.getBoundingClientRect().height,
            cssHeight: getComputedStyle(descendant).height,
            matchedHeightRules: matchedHeightRules(descendant),
          })),
        })),
      }))
      .filter((item) => item.scrollHeight > item.clientHeight + 2 || item.scrollWidth > item.clientWidth + 2)
    const screen = document.querySelector('.screen')?.getBoundingClientRect()
    const footer = document.querySelector('.screen__foot')?.getBoundingClientRect()
    const heads = [...document.querySelectorAll('.body .panel__head')]
    const headerHeights = heads.map((head) => Number.parseFloat(getComputedStyle(head).height))
    const surfaces = [...document.querySelectorAll('.body .panel')].map((panel) => {
      const css = getComputedStyle(panel)
      return { background: css.backgroundColor, filter: css.backdropFilter, opacity: css.opacity }
    })
    return {
      document: {
        scrollWidth: document.documentElement.scrollWidth,
        scrollHeight: document.documentElement.scrollHeight,
        clientWidth: document.documentElement.clientWidth,
        clientHeight: document.documentElement.clientHeight,
      },
      screen: screen ? { left: screen.left, top: screen.top, right: screen.right, bottom: screen.bottom } : null,
      panelCount: document.querySelectorAll('.body > .mod').length,
      panelOverflows,
      footer: footer ? { top: footer.top, bottom: footer.bottom } : null,
      headerHeights,
      surfaces,
      interactiveCount: interactive.length,
      unnamedControls: interactive.filter((el) => !accessibleName(el)).map((el) => el.tagName.toLowerCase()),
      bodyText: (document.body.innerText || '').slice(0, 300),
    }
  })

  // 记录初始视图，避免键盘巡检滚动榜单后改变交付截图。
  const screenshot = path.join(outDir, `${viewport.name}.png`)
  await page.screenshot({ path: screenshot, fullPage: true })
  const sha256 = `sha256:${crypto.createHash('sha256').update(fs.readFileSync(screenshot)).digest('hex')}`

  const focus = []
  for (let i = 0; i < Math.min(audit.interactiveCount, 36); i++) {
    await page.keyboard.press('Tab')
    const state = await page.evaluate(() => {
      const el = document.activeElement
      if (!el || el === document.body) return null
      const style = getComputedStyle(el)
      return {
        tag: el.tagName.toLowerCase(),
        name: (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 30),
        indicator: style.outlineStyle !== 'none' && Number.parseFloat(style.outlineWidth || '0') > 0,
      }
    })
    if (state) focus.push(state)
  }

  const interactions = []
  if (viewport.name === 'full-hd') {
    for (const label of ['按周', '按日']) {
      const button = page.getByRole('button', { name: label, exact: true }).first()
      if (await button.count()) {
        await button.click()
        await page.waitForTimeout(180)
        interactions.push({ action: label, ok: true })
      }
    }
    if (await page.getByRole('button', { name: '经营态势', exact: true }).count()) throw new Error('无效地图切换未删除')
    const initialKpis = await page.locator('.kpi').innerText()
    await page.locator('.map-city-select button').click()
    await page.getByRole('option', { name: '上海', exact: true }).click()
    await page.waitForTimeout(220)
    if (await page.locator('.city-detail h4').innerText() !== '上海') throw new Error('城市筛选未联动详情')
    if (await page.locator('.kpi').innerText() === initialKpis) throw new Error('城市筛选未联动 KPI')
    await page.locator('.map-store-select button').click()
    const storeOption = page.getByRole('option').filter({ hasNotText: '全部门店' }).first()
    const storeName = await storeOption.innerText()
    await storeOption.click()
    if (!(await page.locator('.map-store-select button').innerText()).includes(storeName)) throw new Error('门店选择未应用')
    await page.getByRole('button', { name: '重置地图', exact: true }).click()
    await page.waitForTimeout(220)
    if (await page.locator('.city-detail').count()) throw new Error('地图重置后仍有城市详情')
    if ((await page.locator('.map-store-select button').innerText()).trim() !== '全部门店') throw new Error('地图重置未清除门店')
    interactions.push({ action: '地图标题区城市、门店筛选联动与重置', ok: true })

    const echartsUrl = await page.evaluate(() => performance.getEntriesByType('resource').map((r) => r.name).find((name) => /\/echarts\.js\?/.test(name)))
    if (!echartsUrl) throw new Error('未找到已加载的图表模块，无法验证地图命中位置')
    const mapPoint = await page.evaluate(async (url) => {
      const echarts = await import(url)
      const el = document.querySelector('.map-body .chart')
      const chart = echarts.getInstanceByDom(el)
      const series = chart.getOption().series.find((s) => s.name === '经营城市')
      const point = series.data.find((r) => r.name === '武汉') || series.data[0]
      const pixel = chart.convertToPixel({ geoIndex: 0 }, point.value.slice(0, 2))
      const rect = el.getBoundingClientRect()
      return { name: point.name, x: rect.left + pixel[0] * rect.width / el.clientWidth, y: rect.top + pixel[1] * rect.height / el.clientHeight }
    }, echartsUrl)
    await page.mouse.click(mapPoint.x, mapPoint.y)
    await page.waitForTimeout(220)
    if (await page.locator('.city-detail h4').innerText() !== mapPoint.name) throw new Error('地图气泡点击未联动')
    await page.screenshot({ path: path.join(outDir, 'city-selected.png'), fullPage: true })
    interactions.push({ action: '真实鼠标点击地图气泡并展示城市详情', ok: true })
    await page.getByRole('button', { name: '放大地图', exact: true }).click()
    const zoom = await page.evaluate(async (url) => (await import(url)).getInstanceByDom(document.querySelector('.map-body .chart')).getOption().geo[0].zoom, echartsUrl)
    if (zoom <= 1) throw new Error('地图放大失效')
    await page.getByRole('button', { name: '重置地图', exact: true }).click()
    interactions.push({ action: '地图缩放与重置', ok: true })
    await page.waitForTimeout(220)
    const provincePoint = await page.evaluate(async (url) => {
      const el = document.querySelector('.map-body .chart')
      const chart = (await import(url)).getInstanceByDom(el)
      const pixel = chart.convertToPixel({ geoIndex: 0 }, [89, 33])
      const rect = el.getBoundingClientRect()
      return { x: rect.left + pixel[0] * rect.width / el.clientWidth, y: rect.top + pixel[1] * rect.height / el.clientHeight }
    }, echartsUrl)
    await page.mouse.click(provincePoint.x, provincePoint.y)
    await page.waitForTimeout(180)
    if (!(await page.locator('.city-shortcuts').innerText()).includes('该区域暂无数据')) throw new Error('无数据省域反馈失效')
    await page.getByRole('button', { name: '重置地图', exact: true }).click()
    interactions.push({ action: '省域背景点击与无数据反馈', ok: true })
    const channelButton = page.locator('.channel__legend button').first()
    if (await channelButton.count()) {
      await channelButton.click()
      await page.waitForTimeout(180)
      if (await channelButton.getAttribute('aria-pressed') !== 'true') throw new Error('渠道未选中')
      await channelButton.click()
      if (await channelButton.getAttribute('aria-pressed') !== 'false') throw new Error('渠道未恢复')
      interactions.push({ action: '渠道筛选切换与恢复', ok: true })
    }
  }

  const failures = []
  if (errors.length) failures.push({ code: 'RUNTIME_ERROR', detail: errors })
  if (audit.document.scrollWidth > audit.document.clientWidth + 1) {
    failures.push({ code: 'HORIZONTAL_OVERFLOW', detail: audit.document })
  }
  if (!audit.screen || Math.abs(audit.screen.left) > 1 || Math.abs(audit.screen.right - audit.document.clientWidth) > 1) failures.push({ code: 'SCREEN_NOT_FULL_WIDTH', detail: audit.screen })
  if (audit.document.scrollHeight > Math.max(viewport.height, viewport.width * 1200 / 1920) + 2) failures.push({ code: 'EXCESS_VERTICAL_SCROLL', detail: audit.document })
  if (audit.panelCount !== 8) failures.push({ code: 'PANEL_COUNT', detail: audit.panelCount })
  if (audit.panelOverflows.length) failures.push({ code: 'PANEL_CONTENT_OVERFLOW', detail: audit.panelOverflows })
  if (!audit.footer || audit.footer.bottom > audit.document.scrollHeight + 1 || audit.footer.top < 0) failures.push({ code: 'FOOTER_NOT_REACHABLE' })
  if (new Set(audit.headerHeights).size !== 1 || audit.headerHeights.some((height) => height !== 46)) failures.push({ code: 'HEADER_HEIGHT_INCONSISTENT', detail: audit.headerHeights })
  if (audit.surfaces.some((surface) => surface.filter !== 'none' || surface.opacity !== '1' || !surface.background.startsWith('rgb('))) failures.push({ code: 'NON_SOLID_SURFACE', detail: audit.surfaces })
  if (audit.unnamedControls.length) failures.push({ code: 'INTERACTIVE_NAME_MISSING', detail: audit.unnamedControls })
  if (!focus.some((item) => item.indicator)) failures.push({ code: 'FOCUS_INDICATOR_MISSING' })
  results.push({
    viewport: viewport.name,
    dimensions: { width: viewport.width, height: viewport.height },
    status: failures.length ? 'FAIL' : 'PASS',
    audit,
    focus: { sampled: focus.length, withIndicator: focus.filter((item) => item.indicator).length },
    interactions,
    failures,
    screenshot,
    screenshot_sha256: sha256,
  })
  await page.close()
}
await browser.close()

const report = {
  schema: 'light.frontend.browser_qa.v1',
  target,
  status: results.some((item) => item.status === 'FAIL') ? 'FAIL' : 'PASS',
  viewports: results,
  coverage: {
    real_chromium: true,
    checks: ['console/page errors', 'document/panel overflow', 'accessible control names', 'keyboard focus indicator', 'key filter interactions', 'screenshots'],
  },
}
fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2))
console.log(JSON.stringify(report, null, 2))
process.exitCode = report.status === 'PASS' ? 0 : 1
