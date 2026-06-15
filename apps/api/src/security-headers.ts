import { Elysia } from 'elysia'

const HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy':
    'camera=(), microphone=(), geolocation=(), browsing-topics=()',
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
  'Content-Security-Policy':
    "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
}

export function securityHeaders() {
  return new Elysia({ name: 'security-headers' }).onAfterHandle(
    { as: 'global' },
    ({ set }) => {
      for (const [name, value] of Object.entries(HEADERS)) {
        set.headers[name] = value
      }
    },
  )
}
