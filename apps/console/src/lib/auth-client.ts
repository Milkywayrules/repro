import { env } from '@repro/env/console'
import { createAuthClient } from 'better-auth/react'

export const authClient = createAuthClient({
  baseURL: env.VITE_API_URL,
})
