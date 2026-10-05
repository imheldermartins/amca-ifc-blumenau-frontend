import { AccessMembersPage } from '@/pages/access/AccessPages'
import { useWorkspaceSettings } from './useWorkspaceSettings'
import { Typography } from '@/components/Typography'
import { i18n } from '@/lib/i18n'
export function WorkspaceMembersPage() {
  const workspace=useWorkspaceSettings()
  return <section aria-labelledby="workspace-users-title"><Typography variant="h2" id="workspace-users-title" className="mb-5">{i18n('pages.workspaces.settings.members')}</Typography><AccessMembersPage scope="workspace" id={workspace.id} embedded/></section>
}
