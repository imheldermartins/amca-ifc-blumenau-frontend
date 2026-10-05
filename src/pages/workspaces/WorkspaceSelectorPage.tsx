import { Icon } from '@iconify/react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { Trans } from 'react-i18next'
import { Button, Tooltip } from 'cubs-components'

import { Typography } from '@/components/Typography'
import { useAuth } from '@/contexts/AuthContext'
import { useLanguage } from '@/contexts/LanguageContext'
import { currentWorkspaceSession } from '@/lib/currentWorkspaceSession'
import { i18n } from '@/lib/i18n'
import { replaceQuery } from '@/lib/queryParams'
import { workspacesQueryKey } from '@/lib/workspaceQueryKeys'
import { workspacePreference } from '@/lib/workspacePreference'
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
  const [selectedOrganizationId, setSelectedOrganizationId] = useState<string | null>(null)
  const [creation, setCreation] = useState<{ organizationId?: string } | null>(null)

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
      grouped.set(organization.id, { id: organization.id, name: organization.name, canCreate: can(organization, 'write', 'create'), workspaces: [] })
    }
    for (const workspace of workspaces.data ?? []) {
      if (workspace.isPersonal || !workspace.organizationId) continue
      // Um convite de workspace pode existir sem membership na organização.
      if (!grouped.has(workspace.organizationId)) grouped.set(workspace.organizationId, {
        id: workspace.organizationId, name: workspace.organizationName ?? i18n('pages.workspaces.access.organization'), canCreate: false, workspaces: [],
      })
      grouped.get(workspace.organizationId)!.workspaces.push(workspace)
    }
    return [...grouped.values()].sort((left, right) => left.name.localeCompare(right.name, lang))
  }, [lang, organizations.data, workspaces.data])
  const selectedGroup = groups.find((group) => group.id === selectedOrganizationId) ?? groups[0]
  const canCreate = groups.some((group) => group.canCreate)
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
    setCreation({ organizationId })
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
      <section className="min-w-0" aria-label={i18n('organization.title')}>
        <header className="mb-3 flex items-center gap-1">
          <Typography variant="h2" className="text-xl font-medium">{i18n('organization.title')}</Typography>
          <Tooltip content={i18n('pages.workspaces.selector.organizations-link')}><Button
            type="button" variant="text" color="from-theme" className="size-7 p-1"
            aria-label={i18n('pages.workspaces.selector.organizations-link')}
            onClick={() => { void navigate({ to: '/$lang/organizations', params: { lang } }) }}
          ><Icon icon="lucide:arrow-up-right" className="size-4" /></Button></Tooltip>
        </header>
        {organizations.isPending && groups.length === 0 ? <p className="text-sm text-foreground/60">{i18n('common.carregando')}</p> : <WorkspaceOrganizationsAside
          groups={groups}
          selectedId={selectedGroup?.id}
          onSelect={setSelectedOrganizationId}
          onCreate={createWorkspace}
          onEnter={openWorkspace}
        />}
        {organizations.isError && <p role="alert" className="mt-3 text-sm text-p-red">{i18n('pages.workspaces.selector.organizations-error')}</p>}
        {organizations.isSuccess && !groups.length && <p className="text-sm text-foreground/60">{i18n('pages.workspaces.organization.list-empty')}</p>}
      </section>
    </aside>

    <section className="min-w-0 px-6 py-8 xl:px-11" aria-label={i18n('pages.workspaces.selector.list-label')}>
      <header className="mb-10 flex items-start justify-between gap-4">
        <Typography variant="h2" className="pt-2 text-2xl font-medium">
          {selectedGroup ? <>{i18n('pages.workspaces.selector.organization-workspaces-prefix')} <span className="text-p-purple">{selectedGroup.name}</span></> : i18n('pages.workspaces.selector.organization-section')}
        </Typography>
        {canCreate && <Tooltip content={i18n('pages.workspaces.selector.new')}><Button
          type="button" className="size-12 shrink-0 rounded-full p-3"
          aria-label={i18n('pages.workspaces.selector.new')}
          onClick={() => createWorkspace(selectedGroup?.canCreate ? selectedGroup.id : undefined)}
        ><Icon icon="lucide:plus" className="size-5" /></Button></Tooltip>}
      </header>
      {workspaces.isPending ? <p className="text-sm text-foreground/60">{i18n('common.carregando')}</p>
        : workspaces.isError ? <p role="alert" className="text-sm text-p-red">{i18n('pages.workspaces.selector.error')}</p>
        : selectedGroup?.workspaces.length ? <ul className="grid items-start gap-x-6 gap-y-9 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {selectedGroup.workspaces.map((workspace) => renderWorkspace(workspace))}
        </ul>
        : <p className="text-sm text-foreground/60">{i18n(selectedGroup ? 'pages.workspaces.selector.organization-empty' : 'pages.workspaces.organization.list-empty')}</p>}
      {otherPersonalWorkspaces.length > 0 && <section className="mt-10">
        <Typography variant="h2" className="mb-5 text-xl font-medium">{i18n('pages.workspaces.selector.shared-personal')}</Typography>
        <ul className="grid items-start gap-6 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">{otherPersonalWorkspaces.map((workspace) => renderWorkspace(workspace))}</ul>
      </section>}
    </section>

    {creation && <WorkspaceCreationDialog
        lang={lang}
        initialOrganizationId={creation.organizationId}
        onClose={() => setCreation(null)}
        onCreated={(workspace) => { setSelectedOrganizationId(workspace.organizationId); setCreation(null) }}
        onCreateOrganization={() => { void navigate({ to: '/$lang/organizations/new', params: { lang } }) }}
      />}
  </main>
}
