import { db } from '@repro/db'
import { account, session, user, verification } from '@repro/db/schema/auth'
import { env } from '@repro/env/api'
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'

const authSchema = { user, session, account, verification }

export function createAuth() {
  return betterAuth({
    database: drizzleAdapter(db, {
      provider: 'pg',

      schema: authSchema,
    }),
    trustedOrigins: env.CORS_ORIGINS,
    emailAndPassword: {
      enabled: true,
    },
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    advanced: {
      defaultCookieAttributes: {
        sameSite: 'lax',
        secure: true,
        httpOnly: true,
        domain: env.AUTH_COOKIE_DOMAIN,
      },
    },
    plugins: [],
  })
}

export const auth = createAuth()
