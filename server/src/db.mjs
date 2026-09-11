import pg from 'pg'
import { config } from './config.mjs'

const { Pool } = pg

export function makePool(database = config.pg.database) {
  return new Pool({ ...config.pg, database })
}

export const pool = makePool()
