import { createFileRoute } from '@tanstack/react-router'

import { SchedulePage } from '@/pages/app/schedule/SchedulePage'

export const Route = createFileRoute('/$lang/_authenticated/_app/schedule')({
  component: SchedulePage,
})
