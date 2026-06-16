import { createEnv } from '@t3-oss/env-core'
import { z } from 'zod'

import { getServiceUrls } from './lib/domains.ts'
import { appEnvSchema, deployPlatformSchema } from './lib/schemas.ts'

const parsed = createEnv({
  clientPrefix: 'VITE_',
  client: {
    VITE_APP_ENV: appEnvSchema,
    VITE_DEPLOY_PLATFORM: deployPlatformSchema,
    /** required when VITE_DEPLOY_PLATFORM=custom */
    VITE_API_URL: z.url().optional(),
    VITE_CONSOLE_URL: z.url().optional(),
    VITE_DOCS_URL: z.url().optional(),
    VITE_MARKETING_URL: z.url().optional(),
  },
  runtimeEnv: {
    VITE_APP_ENV: import.meta.env.VITE_APP_ENV,
    VITE_DEPLOY_PLATFORM: import.meta.env.VITE_DEPLOY_PLATFORM,
    VITE_API_URL: import.meta.env.VITE_API_URL,
    VITE_CONSOLE_URL: import.meta.env.VITE_CONSOLE_URL,
    VITE_DOCS_URL: import.meta.env.VITE_DOCS_URL,
    VITE_MARKETING_URL: import.meta.env.VITE_MARKETING_URL,
  },
  emptyStringAsUndefined: true,
})

function requireForCustom(value: string | undefined, name: string): string {
  if (!value) {
    throw new Error(`VITE_DEPLOY_PLATFORM=custom requires ${name}`)
  }
  return value
}

const urls =
  parsed.VITE_DEPLOY_PLATFORM === 'custom'
    ? getServiceUrls(parsed.VITE_APP_ENV, parsed.VITE_DEPLOY_PLATFORM, {
        API_URL: requireForCustom(parsed.VITE_API_URL, 'VITE_API_URL'),
        CONSOLE_URL: requireForCustom(
          parsed.VITE_CONSOLE_URL,
          'VITE_CONSOLE_URL',
        ),
        DOCS_URL: requireForCustom(parsed.VITE_DOCS_URL, 'VITE_DOCS_URL'),
        MARKETING_URL: requireForCustom(
          parsed.VITE_MARKETING_URL,
          'VITE_MARKETING_URL',
        ),
      })
    : getServiceUrls(parsed.VITE_APP_ENV, parsed.VITE_DEPLOY_PLATFORM)

export const env = {
  ...parsed,
  VITE_API_URL: urls.API_URL,
  VITE_CONSOLE_URL: urls.CONSOLE_URL,
  VITE_DOCS_URL: urls.DOCS_URL,
  VITE_MARKETING_URL: urls.MARKETING_URL,
}
