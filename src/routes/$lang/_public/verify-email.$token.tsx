import { createFileRoute } from '@tanstack/react-router'
import { VerifyEmailPage } from '@/pages/sign-up/VerifyEmailPage'

export const Route = createFileRoute('/$lang/_public/verify-email/$token')({ component: VerifyEmailPage })
