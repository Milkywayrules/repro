import { env } from '@repro/env/api'
import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'

// biome-ignore lint/performance/noNamespaceImport: x
import * as schema from './schema'
import { resolveSsl } from './ssl'

const ssl = resolveSsl(env.DATABASE_URL, env.DEPLOY_PLATFORM === 'local')

export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  ssl,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
})

export const db = drizzle(pool, { schema })

export async function closeDb(): Promise<void> {
  await pool.end()
}

export async function checkDbConnection(): Promise<boolean> {
  try {
    await db.execute(sql`SELECT 1`)
    return true
  } catch (err) {
    console.error('[db] readiness check failed', err)
    return false
  }
}
