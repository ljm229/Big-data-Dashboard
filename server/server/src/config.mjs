import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
export const serverRoot = path.resolve(currentDir, '..')
export const projectRoot = path.resolve(serverRoot, '..')

function loadEnvFile(file) {
  if (!fs.existsSync(file)) return
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const text = line.trim()
    if (!text || text.startsWith('#')) continue
    const i = text.indexOf('=')
    if (i < 1) continue
    const key = text.slice(0, i).trim()
    const value = text.slice(i + 1).trim().replace(/^['"]|['"]$/g, '')
    if (process.env[key] == null) process.env[key] = value
  }
}

loadEnvFile(path.join(serverRoot, '.env'))

export const config = {
  pg: {
    host: process.env.PG_HOST || '127.0.0.1',
    port: Number(process.env.PG_PORT || 5432),
    database: process.env.PG_DATABASE || 'retail_dashboard',
    user: process.env.PG_USER || 'postgres',
    password: process.env.PG_PASSWORD || '',
    max: 10,
  },
  adminDatabase: process.env.PG_ADMIN_DATABASE || 'postgres',
  apiHost: process.env.API_HOST || '127.0.0.1',
  apiPort: Number(process.env.API_PORT || 8787),
}
