import { Navigate } from '@tanstack/react-router'
import { ScopeVariablesEditor } from '@/components/ScopeVariablesEditor'
import { AccessRouteProvider } from '@/contexts/AccessRouteContext'
import { useLanguage } from '@/contexts/LanguageContext'
import { useOrganizationSettings } from '@/hooks/useOrganizationSettings'
import { AccessMembersPage, RolesPage } from '@/pages/access/AccessPages'
import { can } from '@/services/AccessService'

export function OrganizationVariablesPage() {
  const organization = useOrganizationSettings()
  return <ScopeVariablesEditor scope="organization" entity={organization} canEdit={can(organization, 'write', 'update')} />
}
export function OrganizationMembersPage() {
  const organization = useOrganizationSettings()
  const { slug: lang } = useLanguage()
  if (!can(organization, 'read', 'members') && !can(organization, 'write', 'add_members')) return <Navigate to="/$lang/access-denied" params={{ lang }} replace />
  return <AccessMembersPage scope="organization" id={organization.id} embedded />
}
export function OrganizationPermissionsPage() {
  const organization = useOrganizationSettings()
  const { slug: lang } = useLanguage()
  if (!can(organization, 'read', 'roles') && !can(organization, 'write', 'create_org_roles')) return <Navigate to="/$lang/access-denied" params={{ lang }} replace />
  return <AccessRouteProvider value={{ scope: 'organization', id: organization.id }}><RolesPage embedded /></AccessRouteProvider>
}
