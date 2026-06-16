import 'dotenv/config'
import { createEnv } from '@t3-oss/env-core'
import { z } from 'zod'

import {
  defaultCookieDomain,
  deriveCorsOrigins,
  getServiceUrls,
} from './lib/domains.ts'
import { appEnvSchema, deployPlatformSchema } from './lib/schemas.ts'

const serverEnv = createEnv({
  server: {
    PORT: z.coerce.number(),

    DATABASE_URL: z.url(),

    BETTER_AUTH_SECRET: z.string().min(32),
    /** required when DEPLOY_PLATFORM=custom; otherwise derived from topology */
    AUTH_COOKIE_DOMAIN: z.string().min(1).optional(),

    RESEND_API_KEY: z.string().optional(),

    NODE_ENV: z
      .enum(['development', 'production', 'test'])
      .default('production'),
    APP_ENV: appEnvSchema,
    DEPLOY_PLATFORM: deployPlatformSchema,

    /** required when DEPLOY_PLATFORM=custom */
    API_URL: z.url().optional(),
    CONSOLE_URL: z.url().optional(),
    DOCS_URL: z.url().optional(),
    MARKETING_URL: z.url().optional(),
  },
  runtimeEnv: {
    PORT: process.env.PORT,
    DATABASE_URL: process.env.DATABASE_URL,
    BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
    AUTH_COOKIE_DOMAIN: process.env.AUTH_COOKIE_DOMAIN,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    NODE_ENV: process.env.NODE_ENV,
    APP_ENV: process.env.APP_ENV,
    DEPLOY_PLATFORM: process.env.DEPLOY_PLATFORM,
    API_URL: process.env.API_URL,
    CONSOLE_URL: process.env.CONSOLE_URL,
    DOCS_URL: process.env.DOCS_URL,
    MARKETING_URL: process.env.MARKETING_URL,
  },
  emptyStringAsUndefined: true,
})

function requireForCustom(value: string | undefined, name: string): string {
  if (!value) {
    throw new Error(`DEPLOY_PLATFORM=custom requires ${name}`)
  }
  return value
}

const urls =
  serverEnv.DEPLOY_PLATFORM === 'custom'
    ? getServiceUrls(serverEnv.APP_ENV, serverEnv.DEPLOY_PLATFORM, {
        API_URL: requireForCustom(serverEnv.API_URL, 'API_URL'),
        CONSOLE_URL: requireForCustom(serverEnv.CONSOLE_URL, 'CONSOLE_URL'),
        DOCS_URL: requireForCustom(serverEnv.DOCS_URL, 'DOCS_URL'),
        MARKETING_URL: requireForCustom(
          serverEnv.MARKETING_URL,
          'MARKETING_URL',
        ),
      })
    : getServiceUrls(serverEnv.APP_ENV, serverEnv.DEPLOY_PLATFORM)

const derivedCookieDomain = defaultCookieDomain(serverEnv.DEPLOY_PLATFORM)
const cookieDomain =
  serverEnv.AUTH_COOKIE_DOMAIN ??
  derivedCookieDomain ??
  requireForCustom(undefined, 'AUTH_COOKIE_DOMAIN')

export const env = {
  ...serverEnv,
  ...urls,
  BETTER_AUTH_URL: urls.API_URL,
  AUTH_COOKIE_DOMAIN: cookieDomain,
  CORS_ORIGINS: deriveCorsOrigins(urls),
}
