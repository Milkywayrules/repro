import { createEnv } from '@t3-oss/env-core'
import { z } from 'zod'

import { getServiceUrls } from './lib/domains.ts'
import { appEnvSchema, deployPlatformSchema } from './lib/schemas.ts'

const parsed = createEnv({
  server: {
    APP_ENV: appEnvSchema,
    DEPLOY_PLATFORM: deployPlatformSchema,
    PORT: z.coerce.number(),
    /** required when DEPLOY_PLATFORM=custom */
    API_URL: z.url().optional(),
    CONSOLE_URL: z.url().optional(),
    DOCS_URL: z.url().optional(),
    MARKETING_URL: z.url().optional(),
  },
  runtimeEnv: {
    APP_ENV: process.env.APP_ENV,
    DEPLOY_PLATFORM: process.env.DEPLOY_PLATFORM,
    PORT: process.env.PORT,
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
  parsed.DEPLOY_PLATFORM === 'custom'
    ? getServiceUrls(parsed.APP_ENV, parsed.DEPLOY_PLATFORM, {
        API_URL: requireForCustom(parsed.API_URL, 'API_URL'),
        CONSOLE_URL: requireForCustom(parsed.CONSOLE_URL, 'CONSOLE_URL'),
        DOCS_URL: requireForCustom(parsed.DOCS_URL, 'DOCS_URL'),
        MARKETING_URL: requireForCustom(parsed.MARKETING_URL, 'MARKETING_URL'),
      })
    : getServiceUrls(parsed.APP_ENV, parsed.DEPLOY_PLATFORM)

export const env = {
  ...parsed,
  ...urls,
  marketingHost: new URL(urls.MARKETING_URL).hostname,
}
