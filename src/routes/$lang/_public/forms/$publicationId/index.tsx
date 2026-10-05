import { createFileRoute } from '@tanstack/react-router'

import { PublicFormPage } from '@/pages/public/PublicFormPage'

export const Route = createFileRoute('/$lang/_public/forms/$publicationId/')({
  component: FormRoute,
})

function FormRoute() {
  const { publicationId } = Route.useParams()
  return <PublicFormPage publicationId={publicationId} />
}
