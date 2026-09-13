import { createFileRoute } from '@tanstack/react-router'
import { InvitePage } from '@/pages/sign-up/InvitePage'

export const Route = createFileRoute('/$lang/_public/invite/$token')({ component: InvitePage })
