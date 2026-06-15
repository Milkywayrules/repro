import {
  appEnvSchema,
  deployPlatformSchema,
  deriveUrls,
  getHostConfig,
} from '@repro/env/topology'
import { defineConfig } from 'astro/config'
import { loadEnv } from 'vite'
import { z } from 'zod'

/** Astro/Vite build mode — from `--mode` or NODE_ENV (not NODE_ENV alone). */
function getViteMode(): string {
  const modeIndex = process.argv.indexOf('--mode')
  if (modeIndex >= 0) {
    const next = process.argv[modeIndex + 1]
    if (next && !next.startsWith('-')) {
      return next
    }
  }
  return process.env.NODE_ENV === 'production' ? 'production' : 'development'
}

const raw = loadEnv(getViteMode(), process.cwd(), '')
const appEnv = appEnvSchema.parse(raw.APP_ENV)
const deployPlatform = deployPlatformSchema.parse(raw.DEPLOY_PLATFORM)
const port = z.coerce.number().parse(raw.PORT)
const hostConfig = getHostConfig(appEnv, deployPlatform)
const marketingHost = hostConfig.base
const marketingSite = deriveUrls(hostConfig).MARKETING_URL

// biome-ignore lint/style/noDefaultExport: Astro requires a default export
export default defineConfig({
  site: marketingSite,
  server: {
    port,
    host: true,
  },
  vite: {
    server: {
      strictPort: true,
      allowedHosts: [
        marketingHost,
        `.${marketingHost}`,
        `www.${marketingHost}`,
      ],
      hmr: {
        protocol: 'wss',
        host: marketingHost,
        clientPort: 443,
      },
    },
  },
})
