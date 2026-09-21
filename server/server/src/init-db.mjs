import fs from 'node:fs/promises'
import path from 'node:path'
import { config, serverRoot } from './config.mjs'
import { makePool } from './db.mjs'

if (!/^[a-zA-Z0-9_]+$/.test(config.pg.database)) {
  throw new Error('PG_DATABASE 只能包含字母、数字和下划线')
}

const admin = makePool(config.adminDatabase)
const exists = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [config.pg.database])
if (!exists.rowCount) {
  await admin.query(`CREATE DATABASE "${config.pg.database}" ENCODING 'UTF8'`)
  console.log(`created database: ${config.pg.database}`)
}
await admin.end()

const target = makePool(config.pg.database)
const schema = await fs.readFile(path.join(serverRoot, '..', 'database', 'schema.sql'), 'utf8')
await target.query(schema)
const migrationsDir = path.join(serverRoot, '..', 'database', 'migrations')
for (const file of (await fs.readdir(migrationsDir)).filter((name) => name.endsWith('.sql')).sort()) {
  await target.query(await fs.readFile(path.join(migrationsDir, file), 'utf8'))
}
await target.end()
console.log('database schema is ready')
