import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

const webRoot = fileURLToPath(new URL('.', import.meta.url))
const candidates = [
  path.resolve(webRoot, 'node_modules/xlsx'),
  path.resolve(webRoot, '../../node_modules/xlsx'),
  path.resolve(webRoot, '../node_modules/xlsx'),
]
const repoXlsx = candidates.find((p) => fs.existsSync(p)) ?? candidates[0]

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [vue()],
  resolve: {
    alias: {
      xlsx: repoXlsx,
    },
  },
  server: {
    proxy: {
      '/api': 'http://127.0.0.1:8787',
    },
    watch: {
      ignored: ['**/tmp-*.png'],
    },
  },
})
