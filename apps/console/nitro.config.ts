import { buildDocumentAppCsp } from '@repro/env/topology'
import evlog from 'evlog/nitro/v3'
import { defineConfig } from 'nitro'

const documentAppCsp = buildDocumentAppCsp()

// biome-ignore lint/style/noDefaultExport: Nitro requires a default export
export default defineConfig({
  experimental: {
    asyncContext: true,
  },
  modules: [
    evlog({
      env: { service: 'repro-console' },
    }),
  ],
  routeRules: {
    '/**': {
      headers: {
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'Permissions-Policy':
          'camera=(), microphone=(), geolocation=(), browsing-topics=()',
        'Strict-Transport-Security':
          'max-age=63072000; includeSubDomains; preload',
        'Content-Security-Policy': documentAppCsp,
      },
    },
  },
})
