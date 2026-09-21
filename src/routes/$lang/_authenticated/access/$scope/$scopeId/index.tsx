import { createFileRoute } from '@tanstack/react-router'
import { AccessMembersPage } from '@/pages/access/AccessPages'
export const Route = createFileRoute('/$lang/_authenticated/access/$scope/$scopeId/')({component: AccessMembersPage})
