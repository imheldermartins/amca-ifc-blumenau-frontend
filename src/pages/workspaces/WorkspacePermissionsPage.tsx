import { Navigate } from '@tanstack/react-router'
import { AccessRouteProvider } from '@/contexts/AccessRouteContext'
import { useLanguage } from '@/contexts/LanguageContext'
import { defineWorkspaceAbility } from '@/lib/workspaceAbility'
import { RolesPage } from '@/pages/access/AccessPages'
import { useWorkspaceSettings } from './useWorkspaceSettings'

export function WorkspacePermissionsPage() {
  const workspace = useWorkspaceSettings()
  const { slug: lang } = useLanguage()
  if (!defineWorkspaceAbility(workspace).can('manage', 'WorkspacePermissions')) return <Navigate to="/$lang/access-denied" params={{ lang }} replace />
  return <AccessRouteProvider value={{ scope: 'workspace', id: workspace.id }}><RolesPage embedded /></AccessRouteProvider>
}
