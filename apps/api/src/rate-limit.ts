import { db } from '@repro/db'
import { rateLimit } from '@repro/db/schema/rate-limit'
import { sql } from '@repro/db/sql'
import { Elysia } from 'elysia'

interface PgRateLimitOptions {
  max: number
  prefixes: string[]
  /** number of trusted reverse-proxy hops in X-Forwarded-For (nginx/Traefik = 1) */
  trustedProxyHops?: number
  windowMs: number
}

function clientIp(request: Request, hops: number): string {
  const xff = request.headers.get('x-forwarded-for')
  if (!xff) {
    return 'unknown'
  }
  const parts = xff
    .split(',')
    .map(p => p.trim())
    .filter(Boolean)
  if (parts.length === 0) {
    return 'unknown'
  }
  const idx = Math.max(0, parts.length - hops)
  return parts[idx] ?? parts[0] ?? 'unknown'
}

export function pgRateLimit(options: PgRateLimitOptions) {
  const hops = options.trustedProxyHops ?? 1
  return new Elysia({ name: 'pg-rate-limit' }).onBeforeHandle(
    { as: 'global' },
    async ({ request, set }) => {
      const { pathname } = new URL(request.url)
      if (!options.prefixes.some(prefix => pathname.startsWith(prefix))) {
        return
      }
      const ip = clientIp(request, hops)
      const now = Date.now()
      const windowStart = Math.floor(now / options.windowMs) * options.windowMs
      const expiresAt = windowStart + options.windowMs
      const key = `${ip}:${pathname.startsWith('/api/auth') ? 'auth' : pathname}`
      try {
        const rows = await db
          .insert(rateLimit)
          .values({ key, windowStart, count: 1, expiresAt })
          .onConflictDoUpdate({
            target: [rateLimit.key, rateLimit.windowStart],
            set: { count: sql`${rateLimit.count} + 1` },
          })
          .returning({ count: rateLimit.count })
        const count = rows[0]?.count ?? 1
        if (count > options.max) {
          set.status = 429
          return 'Too Many Requests'
        }
      } catch (err) {
        // fail-open: never let rate-limit storage errors take down auth
        console.error('[rate-limit] store error', err)
      }
    },
  )
}
