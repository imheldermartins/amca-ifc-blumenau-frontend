import { Navigate, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/$lang/_private/workspaces/$workspaceId/settings/')({
  component: SettingsIndex,
})

function SettingsIndex() {
  const { lang, workspaceId } = Route.useParams()
  return (
    <Navigate
      to="/$lang/workspaces/$workspaceId/settings/general"
      params={{ lang, workspaceId }}
      replace
    />
  )
}
