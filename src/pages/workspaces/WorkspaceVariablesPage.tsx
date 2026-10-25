import { ScopeVariablesEditor } from '@/components/ScopeVariablesEditor'
import { useWorkspaceSettings } from '@/hooks/useWorkspaceSettings'
import { defineWorkspaceAbility } from '@/lib/workspaceAbility'

export function WorkspaceVariablesPage() {
  const workspace = useWorkspaceSettings()
  return <ScopeVariablesEditor scope="workspace" entity={workspace} canEdit={defineWorkspaceAbility(workspace).can('manage', 'WorkspaceSettings')} />
}
