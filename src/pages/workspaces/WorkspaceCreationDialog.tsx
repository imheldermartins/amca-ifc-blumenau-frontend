import { useState } from 'react'

import { Modal } from '@/components/Modal'
import { Typography } from '@/components/Typography'
import { i18n } from '@/lib/i18n'
import type { ApiOrganization, ApiWorkspace } from '@/services/WorkspaceService'

import { CreateWorkspaceForm } from './CreateWorkspaceForm'

export function WorkspaceCreationDialog({ lang, initialOrganizationId, organization, onCreated, onClose, onCreateOrganization }: {
  lang: string
  initialOrganizationId?: string
  organization?: ApiOrganization
  onCreated: (workspace: ApiWorkspace) => void
  onClose: () => void
  onCreateOrganization: () => void
}) {
  const [creating, setCreating] = useState(false)
  return <Modal open size="sm" accessibleTitle={i18n('pages.workspaces.access.title')} onOpenChange={(open) => { if (!open && !creating) onClose() }}>
    <Typography variant="h2" className="mb-5 text-xl">{i18n('pages.workspaces.access.title')}</Typography>
    <CreateWorkspaceForm
      lang={lang}
      initialOrganizationId={initialOrganizationId}
      organization={organization}
      onPendingChange={setCreating}
      onCreated={onCreated}
      onCreateOrganization={onCreateOrganization}
    />
  </Modal>
}
