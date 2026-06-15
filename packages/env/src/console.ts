import { createEnv } from '@t3-oss/env-core'
import { z } from 'zod'

import { deriveUrls, getHostConfig } from './lib/domains.ts'
import { appEnvSchema, deployPlatformSchema } from './lib/schemas.ts'

const parsed = createEnv({
  clientPrefix: 'VITE_',
  client: {
    VITE_CONSOLE_URL: z.url().optional(),
    VITE_API_URL: z.url().optional(),
    VITE_APP_ENV: appEnvSchema,
    VITE_DEPLOY_PLATFORM: deployPlatformSchema,
  },
  runtimeEnv: {
    VITE_CONSOLE_URL: import.meta.env.VITE_CONSOLE_URL,
    VITE_API_URL: import.meta.env.VITE_API_URL,
    VITE_APP_ENV: import.meta.env.VITE_APP_ENV,
    VITE_DEPLOY_PLATFORM: import.meta.env.VITE_DEPLOY_PLATFORM,
  },
  emptyStringAsUndefined: true,
})

const hostConfig = getHostConfig(
  parsed.VITE_APP_ENV,
  parsed.VITE_DEPLOY_PLATFORM,
)
const urls = deriveUrls(hostConfig)

export const env = {
  ...parsed,
  VITE_API_URL: parsed.VITE_API_URL ?? urls.API_URL,
  VITE_CONSOLE_URL: parsed.VITE_CONSOLE_URL ?? urls.CONSOLE_URL,
}
