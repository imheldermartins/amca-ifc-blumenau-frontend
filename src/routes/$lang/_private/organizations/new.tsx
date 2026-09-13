import { createFileRoute } from '@tanstack/react-router'
import { NewOrganizationPage } from '@/pages/organizations/OrganizationPages'
export const Route = createFileRoute('/$lang/_private/organizations/new')({component: NewOrganizationPage})
