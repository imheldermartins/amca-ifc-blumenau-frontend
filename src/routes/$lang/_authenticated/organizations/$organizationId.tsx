import { createFileRoute } from '@tanstack/react-router'
import { OrganizationPage } from '@/pages/organizations/OrganizationPages'
export const Route = createFileRoute('/$lang/_authenticated/organizations/$organizationId')({component: OrganizationRoute})

function OrganizationRoute() {
  const { organizationId } = Route.useParams()
  return <OrganizationPage organizationId={organizationId} />
}
