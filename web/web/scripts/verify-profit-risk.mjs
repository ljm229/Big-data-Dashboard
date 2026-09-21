import { chromium } from 'file:///C:/Users/31776/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs'

const browser = await chromium.launch({
  headless: true,
  executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
})
const page = await browser.newPage({ viewport: { width: 1500, height: 1100 } })
const errs = []
page.on('pageerror', (e) => errs.push(String(e).slice(0, 300)))
await page.goto('http://127.0.0.1:5175/?view=ops&edition=classic&tab=profit', { waitUntil: 'domcontentloaded', timeout: 60000 })
await page.waitForTimeout(2500)
await page.getByRole('tab', { name: /毛利概览/ }).first().click()
await page.waitForTimeout(3000)
const info = await page.evaluate(() => {
  const pick = (label) => document.querySelector(`[aria-label="${label}"]`)
  const trend = pick('负毛利风险趋势双线图')
  const rank = pick('门店负毛利排行横向条形图')
  const describe = (el) => (el ? { w: el.clientWidth, h: el.clientHeight, canvas: el.querySelectorAll('canvas').length } : null)
  const tb = trend ? trend.getBoundingClientRect() : null
  const rb = rank ? rank.getBoundingClientRect() : null
  const overlap = tb && rb ? !(tb.right <= rb.left || rb.right <= tb.left || tb.bottom <= rb.top || rb.bottom <= tb.top) : null
  return { trend: describe(trend), rank: describe(rank), overlap }
})
console.log(JSON.stringify(info, null, 2))
await browser.close()
console.log('errs:' + JSON.stringify(errs))
