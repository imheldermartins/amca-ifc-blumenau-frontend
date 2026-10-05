import { createFileRoute } from '@tanstack/react-router'

import { PublicFormReviewPage } from '@/pages/public/PublicFormReviewPage'

export const Route = createFileRoute('/$lang/_public/forms/$publicationId/review')({
  component: ReviewRoute,
})

function ReviewRoute() {
  const { publicationId } = Route.useParams()
  return <PublicFormReviewPage publicationId={publicationId} />
}
