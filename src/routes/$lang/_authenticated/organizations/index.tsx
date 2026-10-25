import { createFileRoute, redirect } from '@tanstack/react-router'
export const Route = createFileRoute('/$lang/_authenticated/organizations/')({ beforeLoad: ({ params }) => { throw redirect({ to: '/$lang/workspaces', params: { lang: params.lang }, search: { choose: true, tab: 'workspaces' }, replace: true }) } })
