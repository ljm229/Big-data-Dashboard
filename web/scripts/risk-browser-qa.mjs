import { chromium } from 'playwright-core'
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import path from 'node:path'
import assert from 'node:assert/strict'

const out = path.resolve(process.argv[2] || 'browser-qa/risk')
mkdirSync(out, { recursive: true })
const executablePath = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Google/Chrome/Application/chrome.exe'].find(existsSync)
if (!executablePath) throw new Error('Chrome/Edge unavailable')
const browser = await chromium.launch({ executablePath, headless: true })
const results = []; const errors = []
try {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, reducedMotion: 'reduce' })
  page.setDefaultTimeout(15000)
  page.on('pageerror', e => errors.push(String(e)))
  await page.goto(process.argv[3] || 'http://127.0.0.1:5173/', { waitUntil: 'domcontentloaded', timeout: 30000 })
  const panel = page.locator('.risk-panel')
  await panel.waitFor({ state: 'visible' })
  await page.locator('.risk-row').first().waitFor()
  const originalFoot = await page.locator('.screen__foot').innerText()
  const summary = await page.locator('.risk-summary').innerText()
  assert.ok(!await panel.innerText().then(s => s.includes('预估损失')))
  assert.equal(await page.locator('.risk-row').count(), 5)
  for (const viewport of [{ width: 1920, height: 1080 }, { width: 1440, height: 900 }, { width: 1366, height: 768 }]) {
    await page.setViewportSize(viewport)
    await page.waitForTimeout(250)
    const audit = await panel.evaluate(el => ({ text: el.innerText, rect: el.getBoundingClientRect().toJSON(),
      overflow: [...el.querySelectorAll('.risk-body,.risk-summary,.risk-scope,.risk-footer')].filter(n => n.scrollWidth > n.clientWidth + 2 || n.scrollHeight > n.clientHeight + 2).map(n => n.className),
      names: [...el.querySelectorAll('button')].filter(n => !(n.getAttribute('aria-label') || n.textContent || '').trim()).length }))
    assert.deepEqual(audit.overflow, []); assert.equal(audit.names, 0)
    const shot = path.join(out, `risk-${viewport.width}.png`)
    await panel.screenshot({ path: shot })
    results.push({ viewport, audit, screenshot: shot, sha256: createHash('sha256').update(readFileSync(shot)).digest('hex') })
  }
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.locator('.risk-tabs').getByRole('button', { name: '供给', exact: true }).click()
  assert.equal(await page.locator('.screen__foot').innerText(), originalFoot)
  assert.equal(await page.locator('.risk-summary').innerText(), summary)
  await page.locator('.risk-tabs').getByRole('button', { name: '全部', exact: true }).click()
  await page.locator('.risk-row').first().click()
  const dialog = page.locator('.risk-dialog')
  await dialog.waitFor({ state: 'visible' })
  assert.equal(await page.locator('.screen__foot').innerText(), originalFoot)
  assert.match(await dialog.innerText(), /-550.41/)
  assert.match(await dialog.innerText(), /同日门店运营考核/)
  for (let i = 0; i < 12; i++) { await page.keyboard.press('Tab'); assert.ok(await page.evaluate(() => !!document.activeElement?.closest('.risk-dialog'))) }
  await dialog.screenshot({ path: path.join(out, 'risk-detail.png') })
  await page.keyboard.press('Escape')
  assert.equal(await dialog.isVisible(), false)
  assert.ok(await page.evaluate(() => !!document.activeElement?.closest('.risk-panel')))
  await page.locator('.risk-scope').getByRole('button', {name:/筹备/}).click()
  await page.locator('.risk-row').filter({hasText:'汇通市场店'}).click()
  assert.match(await dialog.innerText(), /36.17%/)
  assert.match(await dialog.innerText(), /不计入营业门店异常/)
  await page.keyboard.press('Escape')
  await panel.getByRole('button', {name:'规则与覆盖'}).click()
  assert.match(await dialog.innerText(), /18 \/ 19 店/)
  await dialog.screenshot({ path: path.join(out, 'risk-rules.png') })
  await page.keyboard.press('Escape')
  await page.locator('.risk-scope').getByRole('button', {name:'营业门店',exact:true}).click()
  await page.locator('.risk-row').first().click()
  await dialog.getByRole('button', {name:'在大屏查看此门店'}).click()
  assert.equal(await dialog.isVisible(), false)
  assert.match(await page.locator('.screen__foot').innerText(), /滨江店/)
  assert.match(await page.locator('.map-store-select').innerText(), /滨江店/)
  assert.match(await page.locator('.screen__foot').innerText(), /美团/)
  await page.locator('.risk-tabs').getByRole('button', {name:'供给',exact:true}).click()
  assert.match(await panel.innerText(), /当前平台无供给数据/)
  results.push({ interactions: 'local tabs, summary stability, details, focus trap/Escape/restore, pending exclusion, coverage, explicit store/map, platform supply exclusion', pass: true })
  assert.deepEqual(errors, [])
  writeFileSync(path.join(out, 'report.json'), JSON.stringify({ status:'PASS', results, errors }, null, 2))
  console.log(JSON.stringify({ status:'PASS', output:out, viewports:3, interactions:true }))
} catch (error) {
  writeFileSync(path.join(out, 'report.json'), JSON.stringify({ status:'FAIL', results, errors, failure:String(error) }, null, 2))
  throw error
} finally { await browser.close() }
