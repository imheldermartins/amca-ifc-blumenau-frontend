import { createFileRoute } from '@tanstack/react-router'
import { OrganizationsPage } from '@/pages/organizations/OrganizationPages'
export const Route = createFileRoute('/$lang/_private/organizations/')({component: OrganizationsPage})
