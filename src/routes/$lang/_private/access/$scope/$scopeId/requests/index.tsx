import { createFileRoute } from '@tanstack/react-router'
import { RequestsPage } from '@/pages/access/AccessPages'
export const Route = createFileRoute('/$lang/_private/access/$scope/$scopeId/requests/')({component: RequestsPage})
