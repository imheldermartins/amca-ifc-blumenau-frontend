import type { ApiOrganization, ApiWorkspace } from '@/services/WorkspaceService'

import { CreateWorkspaceForm } from './CreateWorkspaceForm'

export function WorkspaceCreationDialog({ lang, initialOrganizationId, organization, onCreated, onCreateOrganization, onPendingChange }: {
  lang: string
  initialOrganizationId?: string
  organization?: ApiOrganization
  onCreated: (workspace: ApiWorkspace) => void
  onCreateOrganization: () => void
  onPendingChange?: (pending: boolean) => void
}) {
  return <>
    <CreateWorkspaceForm
      lang={lang}
      initialOrganizationId={initialOrganizationId}
      organization={organization}
      onCreated={onCreated}
      onCreateOrganization={onCreateOrganization}
      onPendingChange={onPendingChange}
    />
  </>
}
