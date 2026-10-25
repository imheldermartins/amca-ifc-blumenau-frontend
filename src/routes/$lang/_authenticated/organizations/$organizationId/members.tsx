import { createFileRoute } from '@tanstack/react-router'
import { OrganizationMembersPage } from '@/pages/organizations/OrganizationSettingsPages'
export const Route = createFileRoute('/$lang/_authenticated/organizations/$organizationId/members')({ component: OrganizationMembersPage })
