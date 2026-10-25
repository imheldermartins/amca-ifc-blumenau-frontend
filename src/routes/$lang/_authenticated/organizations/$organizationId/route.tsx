import { createFileRoute } from '@tanstack/react-router'
import { OrganizationSettingsLayout } from '@/pages/organizations/Layout/OrganizationSettingsLayout'
export const Route = createFileRoute('/$lang/_authenticated/organizations/$organizationId')({ component: OrganizationRoute })
function OrganizationRoute() { const { organizationId } = Route.useParams(); return <OrganizationSettingsLayout organizationId={organizationId} /> }
