import { env } from '@repro/env/console'
import { localDevPorts } from '@repro/env/topology'
import { createAuthClient } from 'better-auth/react'

/** loopback in local dev — Node SSR cannot verify mkcert TLS on *.userepro.test */
const serverApiUrl =
  env.VITE_DEPLOY_PLATFORM === 'local'
    ? `http://127.0.0.1:${localDevPorts.api}`
    : env.VITE_API_URL

export const serverAuthClient = createAuthClient({
  baseURL: serverApiUrl,
})
