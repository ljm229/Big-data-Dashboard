import path from 'node:path'
import fs from 'node:fs/promises'
import { launchNrContext, ensureLoggedIn, dumpPage, mouseClickByText, outputDir } from './lib/nr-session.mjs'

const getArg = (n) => (process.argv.find((a) => a.startsWith(`--${n}=`)) || '').slice(n.length + 3)

const goUrl = getArg('go')
const clickText = getArg('click')
const stepName = getArg('name') || 'nr-explore'

const { context, page } = await launchNrContext()

try {
  await ensureLoggedIn(page)

  if (goUrl) {
    console.log('[导航]', goUrl)
    await page.goto(goUrl, { waitUntil: 'domcontentloaded', timeout: 60000 })
    await page.waitForTimeout(8000)
  }

  if (clickText) {
    console.log('[点击]', clickText)
    const ok = await mouseClickByText(page, clickText, { exact: true, timeout: 20000 })
    console.log('[点击] 结果:', ok)
    await page.waitForTimeout(8000)
    console.log('[URL]', page.url())
  }

  await dumpPage(page, stepName)

  const report = []
  for (const frame of page.frames()) {
    const anchors = await frame.locator('a[href]').evaluateAll((els) => els
      .map((e) => ({ text: (e.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 60), href: e.getAttribute('href') }))
      .slice(0, 60)).catch(() => [])
    const buttons = await frame.locator('button').evaluateAll((els) => els
      .map((e) => ({
        text: (e.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 60),
        cls: String(e.className).slice(0, 120),
        visible: e.getBoundingClientRect().width > 0 && e.getBoundingClientRect().height > 0,
      }))
      .filter((x) => x.visible)
      .slice(0, 60)).catch(() => [])
    const tabs = await frame.locator('[class*="tab"], [role="tab"]').evaluateAll((els) => els
      .map((e) => (e.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 60))
      .filter(Boolean)
      .slice(0, 40)).catch(() => [])
    const rows = await frame.locator('table tr, [class*="table"] tr, [class*="row"]').evaluateAll((els) => els
      .map((e) => (e.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 200))
      .filter((t) => t.length > 3)
      .slice(0, 25)).catch(() => [])
    if (anchors.length || buttons.length || tabs.length || rows.length) {
      report.push({ url: frame.url().slice(0, 150), anchors, buttons, tabs, rows })
    }
  }
  await fs.writeFile(path.join(outputDir, `${stepName}-controls.json`), JSON.stringify(report, null, 2), 'utf8')
  console.log(`[结构] 已保存 output/${stepName}-controls.json 与 output/${stepName}.txt / .png`)
} catch (error) {
  console.error('失败：', error instanceof Error ? error.message : error)
  await dumpPage(page, `${stepName}-failed`)
  process.exitCode = 1
} finally {
  if (!process.argv.includes('--keep')) await context.close().catch(() => {})
}
