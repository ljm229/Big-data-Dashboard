const port = process.argv[2] || '9223'
const targetUrl = process.argv[3] || 'http://127.0.0.1:5173/'

const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()
let page = list.find((p) => p.type === 'page' && String(p.url || '').includes('517'))
if (!page) page = list.find((p) => p.type === 'page')
if (!page) {
  console.error('no page', JSON.stringify(list.map((p) => ({ type: p.type, url: p.url, title: p.title })), null, 2))
  process.exit(1)
}

const ws = new WebSocket(page.webSocketDebuggerUrl)
let id = 0
const pending = new Map()
const consoleMsgs = []

function send(method, params = {}) {
  const msgId = ++id
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(msgId)
      reject(new Error(`timeout ${method}`))
    }, 20000)
    pending.set(msgId, {
      resolve: (v) => {
        clearTimeout(timer)
        resolve(v)
      },
      reject: (e) => {
        clearTimeout(timer)
        reject(e)
      },
    })
    ws.send(JSON.stringify({ id: msgId, method, params }))
  })
}

ws.addEventListener('message', (ev) => {
  const msg = JSON.parse(String(ev.data))
  if (msg.method === 'Runtime.exceptionThrown') {
    consoleMsgs.push({
      type: 'exception',
      text: msg.params?.exceptionDetails?.exception?.description || msg.params?.exceptionDetails?.text || JSON.stringify(msg.params),
    })
  }
  if (msg.method === 'Runtime.consoleAPICalled') {
    consoleMsgs.push({
      type: msg.params?.type,
      text: (msg.params?.args || []).map((a) => a.value ?? a.description ?? '').join(' '),
    })
  }
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id)
    pending.delete(msg.id)
    if (msg.error) reject(new Error(JSON.stringify(msg.error)))
    else resolve(msg.result)
  }
})

await new Promise((resolve, reject) => {
  ws.addEventListener('open', resolve)
  ws.addEventListener('error', reject)
})

await send('Runtime.enable')
await send('Page.enable')
await send('Page.navigate', { url: targetUrl })
await new Promise((r) => setTimeout(r, 8000))

const evalResult = await send('Runtime.evaluate', {
  expression: `(() => ({
    readyState: document.readyState,
    title: document.title,
    appHtmlLen: (document.querySelector('#app')?.innerHTML || '').length,
    childCount: document.querySelector('#app')?.childElementCount || 0,
    hasOps: !!document.querySelector('.ops-page'),
    hasViewSwitch: !!document.querySelector('.view-switch'),
    bodyText: (document.body?.innerText || '').slice(0, 800),
  }))()`,
  returnByValue: true,
  awaitPromise: true,
})

console.log(JSON.stringify({ url: targetUrl, pageUrl: page.url, title: page.title, evalResult, consoleMsgs }, null, 2))
ws.close()
