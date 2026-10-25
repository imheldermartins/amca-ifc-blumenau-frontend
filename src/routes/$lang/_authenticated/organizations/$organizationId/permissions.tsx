import { createFileRoute } from '@tanstack/react-router'
import { OrganizationPermissionsPage } from '@/pages/organizations/OrganizationSettingsPages'
export const Route = createFileRoute('/$lang/_authenticated/organizations/$organizationId/permissions')({ component: OrganizationPermissionsPage })
