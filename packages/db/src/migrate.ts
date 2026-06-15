import dotenv from 'dotenv'
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { Pool } from 'pg'

import { resolveSsl } from './ssl'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const moduleDir = path.dirname(fileURLToPath(import.meta.url))

if (!process.env.DATABASE_URL) {
  const apiEnvPath = path.resolve(moduleDir, '../../../apps/api/.env')
  if (existsSync(apiEnvPath)) {
    dotenv.config({ path: apiEnvPath })
  }
}

const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  console.error('[migrate] DATABASE_URL is required')
  process.exit(1)
}

const migrationsFolder =
  process.env.MIGRATIONS_DIR ?? path.join(moduleDir, 'migrations')

const pool = new Pool({
  connectionString,
  ssl: resolveSsl(connectionString, process.env.DEPLOY_PLATFORM === 'local'),
})
const db = drizzle(pool)

try {
  await migrate(db, { migrationsFolder })
  console.log('[migrate] complete')
} catch (err) {
  console.error('[migrate] failed', err)
  process.exitCode = 1
} finally {
  await pool.end()
}
