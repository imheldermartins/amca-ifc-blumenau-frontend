import { Navigate, createFileRoute } from '@tanstack/react-router'
import { useOrganizationSettings } from '@/hooks/useOrganizationSettings'
import { can } from '@/services/AccessService'
export const Route = createFileRoute('/$lang/_authenticated/organizations/$organizationId/')({ component: OrganizationIndex })
function OrganizationIndex() {
  const params = Route.useParams()
  const organization = useOrganizationSettings()
  return can(organization, 'read', 'workspaces') || can(organization, 'write', 'create')
    ? <Navigate to="/$lang/organizations/$organizationId/workspaces" params={params} replace />
    : <Navigate to="/$lang/organizations/$organizationId/variables" params={params} replace />
}
