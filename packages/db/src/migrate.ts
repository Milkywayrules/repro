import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { Pool } from 'pg'

import { resolveSsl } from './ssl'
import { fileURLToPath } from 'node:url'

const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  console.error('[migrate] DATABASE_URL is required')
  process.exit(1)
}

const pool = new Pool({ connectionString, ssl: resolveSsl(connectionString) })
const db = drizzle(pool)
const migrationsFolder = fileURLToPath(new URL('./migrations', import.meta.url))

try {
  await migrate(db, { migrationsFolder })
  console.log('[migrate] complete')
} catch (err) {
  console.error('[migrate] failed', err)
  process.exitCode = 1
} finally {
  await pool.end()
}
