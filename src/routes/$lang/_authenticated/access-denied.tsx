import { createFileRoute } from '@tanstack/react-router'

import { AccessDeniedPage } from '@/pages/workspaces/AccessDeniedPage'

export const Route = createFileRoute('/$lang/_authenticated/access-denied')({
  component: AccessDeniedPage,
})
