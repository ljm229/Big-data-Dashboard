import express from 'express'
import multer from 'multer'
import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const app = express()
const upload = multer({ dest: path.join(ROOT, '数据源/_incoming/') })
const MOVE = { fact: '翱象', launch: '翱象', profit: '翱象', assess: '翱象', supply: '淘宝闪购商家', product: '淘宝闪购商家', traffic: '淘宝闪购商家' }

app.post('/api/upload', upload.fields(Object.keys(MOVE).map((name) => ({ name, maxCount: 4 }))), (req, res) => {
  try {
    for (const [field, files] of Object.entries(req.files || {})) {
      const dir = path.join(ROOT, '数据源', MOVE[field] || '')
      fs.mkdirSync(dir, { recursive: true })
      for (const f of files || []) {
        const target = path.join(dir, f.originalname)
        fs.renameSync(f.path, target)
      }
    }
    const ran = []
    const run = (cmd) => { execSync(cmd, { cwd: ROOT, stdio: 'inherit' }); ran.push(cmd) }
    if (req.files?.fact || req.files?.launch || req.files?.supply) run('node scripts/sync-source1.mjs')
    if (req.files?.traffic) run('node scripts/sync-traffic-data.node.mjs')
    res.json({ ok: true, ran })
  } catch (e) { res.status(500).json({ ok: false, error: String(e?.message || e) }) }
})
app.listen(8787, () => console.log('upload api :8787'))
