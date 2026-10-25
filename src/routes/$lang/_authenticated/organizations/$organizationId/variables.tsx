import { createFileRoute } from '@tanstack/react-router'
import { OrganizationVariablesPage } from '@/pages/organizations/OrganizationSettingsPages'
export const Route = createFileRoute('/$lang/_authenticated/organizations/$organizationId/variables')({ component: OrganizationVariablesPage })
