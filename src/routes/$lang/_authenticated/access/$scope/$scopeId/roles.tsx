import { createFileRoute } from '@tanstack/react-router'
import { RolesPage } from '@/pages/access/AccessPages'
export const Route = createFileRoute('/$lang/_authenticated/access/$scope/$scopeId/roles')({component: RolesPage})
