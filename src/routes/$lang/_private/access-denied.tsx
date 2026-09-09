import { createFileRoute } from '@tanstack/react-router'

import { AccessDeniedPage } from '@/pages/workspaces/AccessDeniedPage'

export const Route = createFileRoute('/$lang/_private/access-denied')({
  component: AccessDeniedPage,
})
