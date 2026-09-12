import fs from 'node:fs'
import path from 'node:path'
import { chromium } from 'playwright-core'

const root = path.resolve(import.meta.dirname, '..')
const outDir = path.join(root, '原型设计')
const url = process.argv[2] || 'http://127.0.0.1:5173/'
const edge = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const chrome = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const executablePath = [edge, chrome].find((file) => fs.existsSync(file))

if (!executablePath) throw new Error('未找到可用于截图的 Edge 或 Chrome。')
fs.mkdirSync(outDir, { recursive: true })

const browser = await chromium.launch({
  headless: true,
  executablePath,
  args: ['--disable-gpu', '--no-sandbox'],
})
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 })
await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 })
await page.waitForSelector('.ops-tabs__nav nav button', { timeout: 30000 })
const tabButtons = page.locator('.ops-tabs__nav nav button')

async function capture(name) {
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.waitForTimeout(1800)
  await page.screenshot({ path: path.join(outDir, name), fullPage: false })
}

await tabButtons.nth(1).click()
await capture('Tab看板-v2-老板视角-经营结果.png')

await page.getByRole('button', { name: '主管视角' }).click()
await tabButtons.nth(2).click()
await capture('Tab看板-v2-主管视角-流量漏斗.png')

await page.getByRole('button', { name: '按月' }).click()
await page.waitForTimeout(800)
await tabButtons.nth(3).click()
await capture('Tab看板-v2-主管视角-推广活动.png')

await tabButtons.nth(4).click()
await capture('Tab看板-v2-主管视角-商品供给.png')

await tabButtons.nth(5).click()
await capture('Tab看板-v2-主管视角-逆向客诉.png')

await page.getByRole('button', { name: '老板视角' }).click()
await tabButtons.nth(0).click()
await capture('Tab看板-v2-保留门店运营质量.png')

await browser.close()
