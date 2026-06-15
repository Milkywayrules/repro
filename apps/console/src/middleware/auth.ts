import { createMiddleware } from '@tanstack/react-start'

import { serverAuthClient } from '@/lib/auth-server'

export const authMiddleware = createMiddleware().server(
  async ({ next, request }) => {
    const cookie = request.headers.get('cookie')
    const { data: session } = await serverAuthClient.getSession({
      fetchOptions: cookie ? { headers: { cookie } } : undefined,
    })
    return next({ context: { session } })
  },
)
