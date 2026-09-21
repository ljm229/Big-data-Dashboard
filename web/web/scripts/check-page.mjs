import { chromium } from 'file:///C:/Users/31776/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs'
import fs from 'fs'

const edge = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const chrome = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const exe = fs.existsSync(edge) ? edge : chrome

const browser = await chromium.launch({
  headless: true,
  executablePath: exe,
  args: ['--disable-gpu', '--no-sandbox'],
})
const page = await browser.newPage()
const url = process.argv[2] || 'http://127.0.0.1:5173/'

const reqs = []
const logs = []

page.on('request', (req) => {
  reqs.push({ t: Date.now(), event: 'start', url: req.url(), type: req.resourceType() })
})
page.on('requestfinished', (req) => {
  reqs.push({ t: Date.now(), event: 'done', url: req.url(), type: req.resourceType() })
})
page.on('requestfailed', (req) => {
  reqs.push({
    t: Date.now(),
    event: 'fail',
    url: req.url(),
    type: req.resourceType(),
    error: req.failure()?.errorText,
  })
})
page.on('console', (msg) => logs.push({ type: msg.type(), text: msg.text() }))
page.on('pageerror', (err) => logs.push({ type: 'pageerror', text: String(err?.stack || err) }))

// Don't wait for full load — race a timeout
const nav = page.goto(url, { waitUntil: 'commit', timeout: 15000 })
await nav
await page.waitForTimeout(8000)

const pending = []
const started = new Map()
for (const r of reqs) {
  if (r.event === 'start') started.set(r.url, r)
  if (r.event === 'done' || r.event === 'fail') started.delete(r.url)
}
for (const [u, r] of started) pending.push({ url: u, type: r.type })

const html = await page.evaluate(() => ({
  readyState: document.readyState,
  title: document.title,
  appHtmlLen: (document.querySelector('#app')?.innerHTML || '').length,
  scripts: [...document.scripts].map((s) => s.src || s.type).slice(0, 20),
  bodyText: (document.body?.innerText || '').slice(0, 300),
})).catch((e) => ({ evalError: String(e) }))

const summary = {
  url,
  html,
  logs,
  pendingCount: pending.length,
  pending: pending.slice(0, 40),
  failed: reqs.filter((r) => r.event === 'fail').slice(0, 20),
  totalEvents: reqs.length,
  sampleDone: reqs.filter((r) => r.event === 'done').slice(0, 30).map((r) => r.url),
}
console.log(JSON.stringify(summary, null, 2))
await browser.close()
