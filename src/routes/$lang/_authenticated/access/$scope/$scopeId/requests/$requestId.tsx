import { createFileRoute } from '@tanstack/react-router'
import { RequestsPage } from '@/pages/access/AccessPages'
export const Route = createFileRoute('/$lang/_authenticated/access/$scope/$scopeId/requests/$requestId')({component: RequestRoute})

function RequestRoute() {
  const { requestId } = Route.useParams()
  return <RequestsPage requestId={requestId} />
}
