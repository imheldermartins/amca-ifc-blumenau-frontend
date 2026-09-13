import { createFileRoute } from '@tanstack/react-router'
import { OrganizationPage } from '@/pages/organizations/OrganizationPages'
export const Route = createFileRoute('/$lang/_private/organizations/$organizationId')({component: OrganizationPage})
