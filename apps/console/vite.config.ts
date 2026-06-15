import {
  appEnvSchema,
  deployPlatformSchema,
  deriveUrls,
  getHostConfig,
} from '@repro/env/topology'
import tailwindcss from '@tailwindcss/vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import { z } from 'zod'

// biome-ignore lint/style/noDefaultExport: Vite requires a default export
export default defineConfig(({ mode }) => {
  const raw = loadEnv(mode, process.cwd(), '')
  const appEnv = appEnvSchema.parse(raw.VITE_APP_ENV)
  const deployPlatform = deployPlatformSchema.parse(raw.VITE_DEPLOY_PLATFORM)
  const port = z.coerce.number().parse(raw.PORT)
  const consoleUrl =
    raw.VITE_CONSOLE_URL ??
    deriveUrls(getHostConfig(appEnv, deployPlatform)).CONSOLE_URL
  const { hostname } = new URL(consoleUrl)
  const baseDomain = hostname.split('.').slice(-2).join('.')

  return {
    server: {
      port,
      host: true,
      strictPort: true,
      allowedHosts: [hostname, `.${baseDomain}`],
      hmr: {
        protocol: 'wss',
        host: hostname,
        clientPort: 443,
      },
    },
    resolve: {
      tsconfigPaths: true,
    },
    plugins: [tailwindcss(), tanstackStart(), viteReact()],
  }
})
