import { createFileRoute } from '@tanstack/react-router'
import { MemberPermissionsPage } from '@/pages/access/AccessPages'
export const Route = createFileRoute('/$lang/_authenticated/access/$scope/$scopeId/member/$memberId')({component: MemberRoute})

function MemberRoute() {
  const { memberId } = Route.useParams()
  return <MemberPermissionsPage memberId={memberId} />
}
