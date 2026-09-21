import { spawn } from 'node:child_process'
import path from 'node:path'
import { serverRoot } from './config.mjs'

const children = [
  spawn(process.execPath, [path.join(serverRoot, 'src', 'server.mjs')], { cwd: serverRoot, stdio: 'inherit' }),
]

function stop() {
  for (const child of children) if (!child.killed) child.kill()
}
process.on('SIGINT', stop)
process.on('SIGTERM', stop)
for (const child of children) child.on('exit', (code) => {
  if (code && code !== 0) process.exitCode = code
})
