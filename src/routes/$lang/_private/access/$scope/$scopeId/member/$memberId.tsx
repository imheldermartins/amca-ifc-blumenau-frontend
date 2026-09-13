import { createFileRoute } from '@tanstack/react-router'
import { MemberPermissionsPage } from '@/pages/access/AccessPages'
export const Route = createFileRoute('/$lang/_private/access/$scope/$scopeId/member/$memberId')({component: MemberPermissionsPage})
