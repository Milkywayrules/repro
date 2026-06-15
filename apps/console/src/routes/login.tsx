import { useState } from 'react'

import { createFileRoute, redirect } from '@tanstack/react-router'

import { SignInForm } from '@/components/sign-in-form'
import { SignUpForm } from '@/components/sign-up-form'
import { getUser } from '@/functions/get-user'

export const Route = createFileRoute('/login')({
  component: RouteComponent,
  beforeLoad: async () => {
    const session = await getUser()
    if (session) {
      throw redirect({ to: '/dashboard' })
    }
  },
})

function RouteComponent() {
  const [showSignIn, setShowSignIn] = useState(false)

  return showSignIn ? (
    <SignInForm onSwitchToSignUp={() => setShowSignIn(false)} />
  ) : (
    <SignUpForm onSwitchToSignIn={() => setShowSignIn(true)} />
  )
}
