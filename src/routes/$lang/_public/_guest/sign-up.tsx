import { createFileRoute } from '@tanstack/react-router'

import { SignUpPage } from '@/pages/sign-up/SignUpPage'

export const Route = createFileRoute('/$lang/_public/_guest/sign-up')({
  component: SignUpPage,
})
