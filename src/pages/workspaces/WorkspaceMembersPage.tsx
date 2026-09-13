import { AccessMembersPage } from '@/pages/access/AccessPages'
import { useWorkspaceSettings } from './useWorkspaceSettings'
export function WorkspaceMembersPage() {
  const workspace=useWorkspaceSettings()
  return <AccessMembersPage scope="workspace" id={workspace.id} embedded/>
}
