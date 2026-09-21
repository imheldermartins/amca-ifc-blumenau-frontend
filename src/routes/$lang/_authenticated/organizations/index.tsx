import { createFileRoute } from '@tanstack/react-router'
import { OrganizationsPage } from '@/pages/organizations/OrganizationPages'
export const Route = createFileRoute('/$lang/_authenticated/organizations/')({component: OrganizationsPage})
