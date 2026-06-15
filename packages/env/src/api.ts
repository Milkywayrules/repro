import 'dotenv/config'
import { createEnv } from '@t3-oss/env-core'
import { z } from 'zod'

import {
  defaultCookieDomain,
  deriveCorsOrigins,
  deriveUrls,
  getHostConfig,
} from './lib/domains.ts'
import { appEnvSchema, deployPlatformSchema } from './lib/schemas.ts'

const serverEnv = createEnv({
  server: {
    PORT: z.coerce.number(),

    DATABASE_URL: z.url(),

    BETTER_AUTH_SECRET: z.string().min(32),
    /** optional override — defaults from DEPLOY_PLATFORM via defaultCookieDomain() */
    AUTH_COOKIE_DOMAIN: z.string().min(1).optional(),

    RESEND_API_KEY: z.string().optional(),

    NODE_ENV: z
      .enum(['development', 'production', 'test'])
      .default('production'),
    APP_ENV: appEnvSchema,
    DEPLOY_PLATFORM: deployPlatformSchema,
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
  },
  emptyStringAsUndefined: true,
})

const hostConfig = getHostConfig(serverEnv.APP_ENV, serverEnv.DEPLOY_PLATFORM)
const urls = deriveUrls(hostConfig)

export const env = {
  ...serverEnv,
  ...urls,
  BETTER_AUTH_URL: urls.API_URL,
  AUTH_COOKIE_DOMAIN:
    serverEnv.AUTH_COOKIE_DOMAIN ??
    defaultCookieDomain(serverEnv.DEPLOY_PLATFORM),
  CORS_ORIGINS: deriveCorsOrigins(hostConfig),
}
