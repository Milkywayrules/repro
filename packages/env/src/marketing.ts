import { createEnv } from '@t3-oss/env-core'
import { z } from 'zod'

import { deriveUrls, getHostConfig } from './lib/domains.ts'
import { appEnvSchema, deployPlatformSchema } from './lib/schemas.ts'

const parsed = createEnv({
  server: {
    APP_ENV: appEnvSchema,
    DEPLOY_PLATFORM: deployPlatformSchema,
    PORT: z.coerce.number(),
  },
  runtimeEnv: {
    APP_ENV: process.env.APP_ENV,
    DEPLOY_PLATFORM: process.env.DEPLOY_PLATFORM,
    PORT: process.env.PORT,
  },
  emptyStringAsUndefined: true,
})

const hostConfig = getHostConfig(parsed.APP_ENV, parsed.DEPLOY_PLATFORM)
const urls = deriveUrls(hostConfig)

export const env = {
  ...parsed,
  ...urls,
  marketingHost: hostConfig.base,
}
