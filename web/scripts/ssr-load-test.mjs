import { createServer } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'
import { fileURLToPath } from 'url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const server = await createServer({
  root,
  plugins: [vue()],
  server: { middlewareMode: true },
  appType: 'custom',
})

const t0 = Date.now()
console.log('loading App.vue ...')
try {
  const mod = await Promise.race([
    server.ssrLoadModule('/src/App.vue'),
    new Promise((_, rej) => setTimeout(() => rej(new Error('timeout 15s')), 15000)),
  ])
  console.log('loaded', Object.keys(mod), 'ms=', Date.now() - t0)
} catch (e) {
  console.error('FAIL', String(e), 'ms=', Date.now() - t0)
}
await server.close()
