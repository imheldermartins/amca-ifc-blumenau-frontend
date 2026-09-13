import { createFileRoute } from '@tanstack/react-router'
import { RolesPage } from '@/pages/access/AccessPages'
export const Route = createFileRoute('/$lang/_private/access/$scope/$scopeId/roles')({component: RolesPage})
