import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const bundled = path.join(homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe')
const python = process.env.TRAFFIC_PYTHON || (existsSync(bundled) ? bundled : 'python')
const script = fileURLToPath(new URL('./sync-traffic-data.py', import.meta.url))
const run = spawnSync(python, ['-X', 'utf8', script, ...process.argv.slice(2)], { stdio: 'inherit', windowsHide: true })
if (run.error) console.error('请安装 Python + openpyxl，或设置 TRAFFIC_PYTHON。', run.error.message)
process.exit(run.status ?? 1)
