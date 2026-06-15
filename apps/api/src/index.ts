import { cors } from '@elysiajs/cors'
import { auth } from '@repro/auth'
import { checkDbConnection, closeDb } from '@repro/db'
import { env } from '@repro/env/api'
import { Elysia } from 'elysia'
import { initLogger } from 'evlog'
import {
  type BetterAuthInstance,
  createAuthMiddleware,
} from 'evlog/better-auth'
import { evlog } from 'evlog/elysia'

import { pgRateLimit } from './rate-limit'
import { securityHeaders } from './security-headers'

initLogger({
  env: { service: 'repro-api' },
})

const identifyUser = createAuthMiddleware(auth as BetterAuthInstance, {
  exclude: ['/api/auth/**', '/health', '/ready'],
  maskEmail: true,
})

const server = new Elysia()
  .use(evlog())
  .derive(async ({ request, log }) => {
    await identifyUser(log, request.headers, new URL(request.url).pathname)
    return {}
  })
  .use(securityHeaders())
  .use(
    cors({
      origin: env.CORS_ORIGINS,
      methods: ['GET', 'POST', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      credentials: true,
    }),
  )
  .use(
    pgRateLimit({
      windowMs: 60_000,
      max: 60,
      prefixes: ['/api/auth'],
      trustedProxyHops: 1,
    }),
  )
  .get('/health', () => ({ status: 'ok' }))
  .get('/ready', async ({ set }) => {
    const ready = await checkDbConnection()
    if (!ready) {
      set.status = 503
      return { status: 'not ready' }
    }
    return { status: 'ready' }
  })
  .all('/api/auth/*', context => {
    const { request, status } = context
    if (['POST', 'GET'].includes(request.method)) {
      return auth.handler(request)
    }
    return status(405)
  })
  .get('/', () => 'OK')
  .listen(env.PORT, () => {
    console.log(`API listening on :${env.PORT} (public: ${env.API_URL})`)
  })

async function shutdown(signal: string): Promise<void> {
  try {
    server.stop()
    await closeDb()
    process.exit(0)
  } catch (err) {
    console.error(`[api] shutdown failed (${signal})`, err)
    process.exit(1)
  }
}

for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(signal, () => {
    shutdown(signal).catch((err: unknown) => {
      console.error(`[api] shutdown failed (${signal})`, err)
      process.exit(1)
    })
  })
}
