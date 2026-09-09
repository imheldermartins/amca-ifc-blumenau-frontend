import { createFileRoute } from '@tanstack/react-router'

import { PageRoutePage } from '@/pages/app/PageRoutePage'

export const Route = createFileRoute('/$lang/_private/_app/page/$pageId')({
  component: PageRoutePage,
})
