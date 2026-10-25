import { Icon } from '@iconify/react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { Trans } from 'react-i18next'
import { Button } from 'cubs-components'

import { Typography } from '@/components/Typography'
import { PageFavoritesSection } from '@/components/PageFavoritesSection'
import { useAuth } from '@/contexts/AuthContext'
import { useLanguage } from '@/contexts/LanguageContext'
import { currentWorkspaceSession } from '@/lib/currentWorkspaceSession'
import { i18n } from '@/lib/i18n'
import { replaceQuery } from '@/lib/queryParams'
import { workspacesQueryKey } from '@/lib/workspaceQueryKeys'
import { workspacePreference } from '@/lib/workspacePreference'
import { useModal } from '@/hooks/useModal'
import { can } from '@/services/AccessService'
import { workspaceService, type ApiWorkspace } from '@/services/WorkspaceService'
import { WorkspacesCards } from '@/routes/$lang/_authenticated/workspaces/-components/WorkspacesCards'

import { WorkspaceCreationDialog } from './WorkspaceCreationDialog'
import { WorkspaceOrganizationsAside, type WorkspaceOrganizationGroup } from './WorkspaceOrganizationsAside'

export function WorkspaceSelectorPage() {
  const { slug: lang } = useLanguage()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [, refreshPreference] = useState(0)
  const { openModal } = useModal()

  const workspaces = useQuery({
    queryKey: workspacesQueryKey(user?.id ?? 'anonymous'),
    queryFn: () => workspaceService.listMine(),
    enabled: Boolean(user),
  })
  const organizations = useQuery({
    queryKey: ['organizations', user?.id ?? 'anonymous'],
    queryFn: () => workspaceService.listOrganizations(),
    enabled: Boolean(user),
  })

  const personalWorkspace = workspaces.data?.find((workspace) => workspace.isPersonal
    && (workspace.owner.id === user?.id || workspace.createdByUserId === user?.id))
  const otherPersonalWorkspaces = workspaces.data?.filter((workspace) => workspace.isPersonal && workspace.id !== personalWorkspace?.id) ?? []
  const groups = useMemo(() => {
    const grouped = new Map<string, WorkspaceOrganizationGroup>()
    for (const organization of organizations.data ?? []) {
      grouped.set(organization.id, { id: organization.id, name: organization.name, canCreate: can(organization, 'write', 'create'), canView: true, workspaces: [] })
    }
    for (const workspace of workspaces.data ?? []) {
      if (workspace.isPersonal || !workspace.organizationId) continue
      // Um convite de workspace pode existir sem membership na organização.
      if (!grouped.has(workspace.organizationId)) grouped.set(workspace.organizationId, {
        id: workspace.organizationId, name: workspace.organizationName ?? i18n('pages.workspaces.access.organization'), canCreate: false, canView: false, workspaces: [],
      })
      grouped.get(workspace.organizationId)!.workspaces.push(workspace)
    }
    return [...grouped.values()].sort((left, right) => left.name.localeCompare(right.name, lang))
  }, [lang, organizations.data, workspaces.data])
  const preferredId = user ? workspacePreference.get(user.id) : undefined
  const firstName = user?.name?.trim().split(/\s+/)[0] || user?.email?.split('@')[0] || ''

  function openWorkspace(workspace: ApiWorkspace) {
    void navigate({
      to: '/$lang/workspace/$workspaceId',
      params: { lang, workspaceId: workspace.id },
      search: (previous) => replaceQuery(previous, {}),
    })
  }

  function openWorkspaceSettings(workspace: ApiWorkspace) {
    if (user) currentWorkspaceSession.set(user.id, workspace.id)
    void navigate({
      to: '/$lang/workspaces/$workspaceId/settings/general',
      params: { lang, workspaceId: workspace.id },
      search: (previous) => replaceQuery(previous, {}),
    })
  }

  function createWorkspace(organizationId?: string) {
    openModal({
      size: 'sm',
      content: ({ closeModal, updateModal }) => <WorkspaceCreationDialog
        lang={lang}
        initialOrganizationId={organizationId}
        onCreated={closeModal}
        onCreateOrganization={() => {
          closeModal()
          void navigate({ to: '/$lang/organizations/new', params: { lang } })
        }}
        onPendingChange={(pending) => updateModal({ dismissible: !pending })}
      />,
    })
  }

  function renderWorkspace(workspace: ApiWorkspace, compact = false) {
    const ownerLabel = workspace.owner.email
      ? `${workspace.owner.name ? `${workspace.owner.name} · ` : ''}${workspace.owner.email}`
      : i18n('pages.workspaces.selector.owner-unknown')
    return <WorkspacesCards
      key={workspace.id}
      workspace={workspace}
      compact={compact}
      headerLabel={workspace.name ?? i18n('pages.workspaces.selector.unnamed')}
      ownerLabel={ownerLabel}
      preferredId={preferredId ?? null}
      user={user}
      refreshPreference={refreshPreference}
      openWorkspace={openWorkspace}
      openWorkspaceSettings={openWorkspaceSettings}
    />
  }

  return <main className="min-h-dvh bg-background text-foreground lg:grid lg:grid-cols-[20rem_minmax(0,1fr)] xl:grid-cols-[22.5rem_minmax(0,1fr)]">
    <aside className="flex min-w-0 flex-col gap-7 border-b border-divider bg-contrast/40 px-6 py-8 lg:sticky lg:top-0 lg:h-dvh lg:overflow-y-auto lg:border-r lg:border-b-0 xl:px-7">
      <Typography variant="h1" className="text-3xl font-medium">
        <Trans i18nKey="pages.workspaces.selector.greeting" values={{ firstName }} components={{ name: <span className="font-semibold text-p-purple" /> }} />
      </Typography>
      <section aria-label={i18n('pages.workspaces.selector.personal-section')}>
        <Typography variant="h2" className="sr-only">{i18n('pages.workspaces.selector.personal-section')}</Typography>
        {workspaces.isPending ? <p className="text-sm text-foreground/60">{i18n('common.carregando')}</p>
          : workspaces.isError ? <p role="alert" className="text-sm text-p-red">{i18n('pages.workspaces.selector.error')}</p>
          : personalWorkspace ? <ul>{renderWorkspace(personalWorkspace, true)}</ul>
          : <p role="alert" className="text-sm text-foreground/60">{i18n('pages.workspaces.selector.personal-missing')}</p>}
      </section>
      <PageFavoritesSection />
    </aside>

    <section className="min-w-0 px-6 py-8 xl:px-11" aria-label={i18n('organization.title')}>
      <header className="mb-7 flex items-center justify-between gap-4">
        <Typography variant="h2" className="text-3xl font-medium">{i18n('organization.title')}</Typography>
        <Button type="button" className="shrink-0 rounded-lg px-4 py-2"
          onClick={() => void navigate({ to: '/$lang/organizations/new', params: { lang } })}>
          <Icon icon="lucide:plus" className="size-4" />{i18n('organization.new')}
        </Button>
      </header>
      {organizations.isPending && !groups.length ? <p className="text-sm text-foreground/60">{i18n('common.carregando')}</p> : <WorkspaceOrganizationsAside groups={groups}
        onSelect={(organizationId) => void navigate({ to: '/$lang/organizations/$organizationId', params: { lang, organizationId } })}
        onCreate={createWorkspace} onEnter={openWorkspace} onSettings={openWorkspaceSettings} preferredId={preferredId}
        onPrefer={(workspace, checked) => { if (!user) return; if (checked) workspacePreference.set(user.id, workspace.id); else workspacePreference.clear(user.id); refreshPreference((revision) => revision + 1) }} />}
      {organizations.isError && <p role="alert" className="mt-3 text-sm text-p-red">{i18n('pages.workspaces.selector.organizations-error')}</p>}
      {organizations.isSuccess && !groups.length && <p className="text-sm text-foreground/60">{i18n('pages.workspaces.organization.list-empty')}</p>}
      {otherPersonalWorkspaces.length > 0 && <section className="mt-10">
        <Typography variant="h2" className="mb-5 text-xl font-medium">{i18n('pages.workspaces.selector.shared-personal')}</Typography>
        <ul className="grid items-start gap-6 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">{otherPersonalWorkspaces.map((workspace) => renderWorkspace(workspace))}</ul>
      </section>}
    </section>
  </main>
}
