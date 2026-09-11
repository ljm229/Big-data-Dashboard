throw new Error('旧文件监视导入已停用。持续采集请运行 node collector/run-pipeline.mjs --watch。')
import fs from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { projectRoot, serverRoot } from './config.mjs'

const sourceDir = process.argv[2] ? path.resolve(process.argv[2]) : path.join(projectRoot, '数据采集', 'raw')
let timer = null
let importing = false
let pending = false

function runImport() {
  if (importing) {
    pending = true
    return
  }
  importing = true
  const child = spawn(process.execPath, [path.join(serverRoot, 'src', 'import-september.mjs'), sourceDir], {
    cwd: serverRoot,
    stdio: 'inherit',
  })
  child.on('exit', (code) => {
    importing = false
    if (code !== 0) console.error(`data import failed with exit code ${code}`)
    if (pending) {
      pending = false
      runImport()
    }
  })
}

fs.watch(sourceDir, { recursive: true }, (_eventType, filename) => {
  if (!filename || !String(filename).toLowerCase().endsWith('.xlsx') || String(filename).startsWith('~$')) return
  clearTimeout(timer)
  timer = setTimeout(runImport, 1200)
})

console.log(`watching Excel updates: ${sourceDir}`)
