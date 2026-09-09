import { createFileRoute } from '@tanstack/react-router'

import { CollaboratingPage } from '@/pages/app/CollaboratingPage'

export const Route = createFileRoute('/$lang/_private/_app/colaborando')({
  component: CollaboratingPage,
})
