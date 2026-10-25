import { createFileRoute } from '@tanstack/react-router'
import { OrganizationWorkspacesPage } from '@/pages/organizations/OrganizationWorkspacesPage'
export const Route = createFileRoute('/$lang/_authenticated/organizations/$organizationId/workspaces')({ component: OrganizationWorkspacesPage })
