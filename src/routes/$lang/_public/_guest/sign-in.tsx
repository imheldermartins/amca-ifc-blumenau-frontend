import { createFileRoute } from '@tanstack/react-router'

import { SignInPage } from '@/pages/sign-in/SignInPage'

export const Route = createFileRoute('/$lang/_public/_guest/sign-in')({
  component: SignInPage,
})
