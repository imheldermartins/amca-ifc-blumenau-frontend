import { Icon } from '@iconify/react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams } from '@tanstack/react-router'
import { useDeferredValue, useEffect, useState } from 'react'
import { FormProvider, useForm } from 'react-hook-form'
import { Button, RadioGroup, Select, TextField, cn } from 'cubs-components'

import { Typography } from '@/components/Typography'
import { useAuth } from '@/contexts/AuthContext'
import { i18n } from '@/lib/i18n'
import { validators } from '@/lib/validators'
import {
  workspaceService,
  type ApiOrganization,
  type ApiOrganizationWorkspaceUser,
  type ApiWorkspace,
} from '@/services/WorkspaceService'

interface CreateOrganizationValues {
  name: string
  workspaceId: string
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Gestão de organizações vive no seletor /workspaces, não no fluxo por chave. */
export function OrganizationManagement({ onLeave }: { onLeave?: () => void }) {
  const { user } = useAuth()
  const { lang } = useParams({ strict: false })
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const userId = user?.id ?? 'anonymous'
  const [requestedOrganizationId, setRequestedOrganizationId] = useState('')
  const [requestedWorkspaceId, setRequestedWorkspaceId] = useState('')
  const [creatingOrganization, setCreatingOrganization] = useState(false)
  const [search, setSearch] = useState('')
  const deferredEmail = useDeferredValue(search.trim().toLocaleLowerCase())
  const hasCompleteEmail = EMAIL_PATTERN.test(deferredEmail)
  const workspaces = useQuery({
    queryKey: ['workspaces', userId],
    queryFn: () => workspaceService.listMine(),
    enabled: Boolean(user),
  })
  const organizations = useQuery({
    queryKey: ['organizations', userId],
    queryFn: () => workspaceService.listOrganizations(),
    enabled: Boolean(user),
  })
  const standaloneWorkspaces = (workspaces.data ?? []).filter(
    (workspace) => workspace.role === 'superadmin' && !workspace.organizationId,
  )
  const organizationList = organizations.data ?? []
  const organizationId = organizationList.some(
    (organization) => organization.id === requestedOrganizationId,
  ) ? requestedOrganizationId : (organizationList[0]?.id ?? '')
  const selectedOrganization = organizationList.find(
    (organization) => organization.id === organizationId,
  )
  const organizationWorkspaces = (workspaces.data ?? []).filter(
    (workspace) => workspace.organizationId === organizationId,
  )
  const administeredWorkspaces = organizationWorkspaces.filter(
    (workspace) => workspace.role === 'superadmin',
  )
  const canManageOrganization = selectedOrganization?.role === 'superadmin'
  const workspaceId = administeredWorkspaces.some(
    (workspace) => workspace.id === requestedWorkspaceId,
  ) ? requestedWorkspaceId : (administeredWorkspaces[0]?.id ?? '')

  const users = useQuery({
    queryKey: [
      'organization-workspace-users',
      organizationId,
      workspaceId,
      deferredEmail,
    ],
    queryFn: () => workspaceService.searchOrganizationWorkspaceUsers(
      organizationId,
      workspaceId,
      deferredEmail,
    ),
    enabled: Boolean(canManageOrganization && organizationId && workspaceId && hasCompleteEmail),
    select: (candidates) => candidates.find(
      (candidate) => candidate.email.trim().toLocaleLowerCase() === deferredEmail,
    ) ?? null,
  })
  const addUser = useMutation({
    mutationFn: (targetUserId: string) => workspaceService.addOrganizationWorkspaceUser(
      organizationId,
      workspaceId,
      targetUserId,
    ),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['organization-workspace-users', organizationId, workspaceId] }),
        queryClient.invalidateQueries({ queryKey: ['workspaces', userId] }),
        queryClient.invalidateQueries({ queryKey: ['workspace-members', userId, workspaceId] }),
      ])
    },
  })
  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['workspaces', userId] }),
      queryClient.invalidateQueries({ queryKey: ['organizations', userId] }),
    ])
  }

  function selectOrganization(nextOrganizationId: string) {
    setRequestedOrganizationId(nextOrganizationId)
    setRequestedWorkspaceId('')
    setSearch('')
    addUser.reset()
    setCreatingOrganization(false)
  }

  function openWorkspace(workspace: ApiWorkspace) {
    onLeave?.()
    void navigate({
      to: '/$lang/myworkspace/$workspaceId',
      params: { lang: lang ?? 'pt-br', workspaceId: workspace.id },
    })
  }

  function createOrganizationWorkspace() {
    if (!selectedOrganization) return
    onLeave?.()
    void navigate({
      to: '/$lang/workspaces/new',
      params: { lang: lang ?? 'pt-br' },
      search: { tab: 'create', organization: selectedOrganization.id },
    })
  }

  if (workspaces.isPending || organizations.isPending) {
    return <p className="text-sm">{i18n('common.carregando')}</p>
  }
  if (workspaces.isError || organizations.isError) {
    return <p role="alert" className="text-sm text-p-red">{i18n('pages.workspaces.organization.load-error')}</p>
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(15rem,18rem)_minmax(0,1fr)]">
      <aside aria-labelledby="organizations-list-title" className="grid content-start gap-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <Typography id="organizations-list-title" variant="h2">
              {i18n('pages.workspaces.organization.list-title')}
            </Typography>
            <p className="mt-1 text-sm text-dark-100 dark:text-light-900">
              {i18n('pages.workspaces.organization.list-description')}
            </p>
          </div>
          <Button
            type="button"
            variant="text"
            color="purple"
            className="shrink-0 px-2"
            onClick={() => setCreatingOrganization(true)}
          >
            <Icon icon="lucide:plus" className="size-4" />
            {i18n('pages.workspaces.organization.new')}
          </Button>
        </div>

        {organizationList.length === 0 ? (
          <p className="rounded-xl bg-contrast p-4 text-sm text-dark-100 dark:text-light-900">
            {i18n('pages.workspaces.organization.list-empty')}
          </p>
        ) : (
          <ul className="grid gap-2" aria-label={i18n('pages.workspaces.organization.list-label')}>
            {organizationList.map((organization) => (
              <li key={organization.id}>
                <button
                  type="button"
                  aria-current={organization.id === organizationId ? 'true' : undefined}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-xl p-3 text-left transition-colors hover:bg-active',
                    organization.id === organizationId && !creatingOrganization && 'bg-active',
                  )}
                  onClick={() => selectOrganization(organization.id)}
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-contrast">
                    <Icon icon="lucide:building-2" className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{organization.name}</span>
                    <span className="block text-xs text-dark-100 dark:text-light-900">
                      {i18n('pages.workspaces.organization.workspace-count', { count: organization.workspaceCount })}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </aside>

      {creatingOrganization ? (
        <CreateOrganizationForm
          workspaces={standaloneWorkspaces}
          onCancel={() => setCreatingOrganization(false)}
          onCreated={async (organization) => {
            await refresh()
            setRequestedOrganizationId(organization.id)
            setCreatingOrganization(false)
          }}
        />
      ) : selectedOrganization ? (
        <section aria-labelledby="organization-detail-title" className="grid content-start gap-9">
          <header className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <Typography id="organization-detail-title" variant="h1" as="h2">
                {selectedOrganization.name}
              </Typography>
              <p className="mt-1 text-sm text-dark-100 dark:text-light-900">
                {i18n(`pages.workspaces.selector.role-${selectedOrganization.role}`)}
              </p>
            </div>
            {canManageOrganization && (
              <Button type="button" variant="filled" color="purple" onClick={createOrganizationWorkspace}>
                <Icon icon="lucide:plus" className="size-4" />
                {i18n('pages.workspaces.organization.create-workspace')}
              </Button>
            )}
          </header>

          <section aria-labelledby="organization-workspaces-title" className="grid gap-4">
            <div>
              <Typography id="organization-workspaces-title" variant="h2">
                {i18n('pages.workspaces.organization.workspaces-title')}
              </Typography>
              <p className="mt-1 text-sm text-dark-100 dark:text-light-900">
                {i18n('pages.workspaces.organization.workspaces-description')}
              </p>
            </div>
            {organizationWorkspaces.length === 0 ? (
              <p className="text-sm text-dark-100 dark:text-light-900">
                {i18n('pages.workspaces.organization.workspaces-empty')}
              </p>
            ) : (
              <ul className="grid gap-2" aria-label={i18n('pages.workspaces.organization.workspaces-list')}>
                {organizationWorkspaces.map((workspace) => (
                  <li key={workspace.id} className="flex items-center gap-3 rounded-xl bg-contrast p-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-active">
                      <Icon icon={workspace.icon || 'lucide:boxes'} className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {workspace.name ?? i18n('common.workspace.sem-nome')}
                      </p>
                      <p className="text-xs text-dark-100 dark:text-light-900">
                        {i18n(`pages.workspaces.selector.role-${workspace.role}`)}
                      </p>
                    </div>
                    <Button type="button" variant="text" color="from-theme" onClick={() => openWorkspace(workspace)}>
                      {i18n('pages.workspaces.selector.enter')}
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="organization-users-title" className="grid gap-4">
            <div>
              <Typography id="organization-users-title" variant="h2">
                {i18n('pages.workspaces.organization.users-title')}
              </Typography>
              <p className="mt-1 text-sm text-dark-100 dark:text-light-900">
                {i18n('pages.workspaces.organization.users-description')}
              </p>
            </div>

            {!canManageOrganization ? (
              <p className="text-sm text-dark-100 dark:text-light-900">
                {i18n('pages.workspaces.organization.users-no-permission')}
              </p>
            ) : administeredWorkspaces.length === 0 ? (
              <p className="text-sm text-dark-100 dark:text-light-900">
                {i18n('pages.workspaces.organization.users-no-workspace')}
              </p>
            ) : (
              <>
                <Select
                  label={i18n('pages.workspaces.organization.current-workspace')}
                  value={workspaceId}
                  onValueChange={(value) => {
                    setRequestedWorkspaceId(value)
                    setSearch('')
                    addUser.reset()
                  }}
                  placeholder={i18n('pages.workspaces.organization.current-workspace-placeholder')}
                  options={administeredWorkspaces.map(workspaceOption)}
                />
                <div className="grid gap-2">
                  <TextField
                    type="email"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    aria-label={i18n('pages.workspaces.organization.search-users')}
                    placeholder={i18n('pages.workspaces.organization.search-users')}
                    startAdornment={<Icon icon="lucide:search" className="size-4" />}
                    autoComplete="off"
                  />
                  {!hasCompleteEmail && (
                    <p className="text-xs text-dark-100 dark:text-light-900">
                      {i18n('pages.workspaces.organization.search-users-help')}
                    </p>
                  )}
                </div>

                {hasCompleteEmail && (users.isPending || users.isFetching) ? (
                  <p role="status" className="text-sm">{i18n('common.carregando')}</p>
                ) : hasCompleteEmail && users.isError ? (
                  <p role="alert" className="text-sm text-p-red">
                    {i18n('pages.workspaces.organization.users-error')}
                  </p>
                ) : hasCompleteEmail && !users.data ? (
                  <p className="text-sm text-dark-100 dark:text-light-900">
                    {i18n('pages.workspaces.organization.users-empty')}
                  </p>
                ) : hasCompleteEmail && users.data ? (
                  <UserSearchResult
                    candidate={users.data}
                    pending={addUser.isPending && addUser.variables === users.data.id}
                    onAdd={() => users.data && addUser.mutate(users.data.id)}
                  />
                ) : null}
                {addUser.isError && (
                  <p role="alert" className="text-sm text-p-red">
                    {i18n('pages.workspaces.organization.user-add-error')}
                  </p>
                )}
              </>
            )}
          </section>
        </section>
      ) : (
        <section className="grid content-center justify-items-center gap-3 rounded-xl bg-contrast p-8 text-center">
          <Icon icon="lucide:building-2" className="size-7" />
          <Typography variant="h2">{i18n('pages.workspaces.organization.detail-empty-title')}</Typography>
          <p className="max-w-md text-sm text-dark-100 dark:text-light-900">
            {i18n('pages.workspaces.organization.detail-empty-description')}
          </p>
          <Button type="button" variant="filled" color="purple" onClick={() => setCreatingOrganization(true)}>
            {i18n('pages.workspaces.organization.create-title')}
          </Button>
        </section>
      )}
    </div>
  )
}

function UserSearchResult({
  candidate,
  pending,
  onAdd,
}: {
  candidate: ApiOrganizationWorkspaceUser
  pending: boolean
  onAdd: () => void
}) {
  const added = Boolean(candidate.organizationRole && candidate.workspaceRole)

  return (
    <div className="flex items-center gap-3 rounded-xl bg-contrast p-3">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-active">
        <Icon icon="lucide:user-round" className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{candidate.name ?? candidate.email}</p>
        {candidate.name && <p className="truncate text-xs text-dark-100 dark:text-light-900">{candidate.email}</p>}
      </div>
      <Button
        type="button"
        variant={added ? 'text' : 'filled'}
        color={added ? 'from-theme' : 'purple'}
        disabled={added || pending}
        onClick={onAdd}
      >
        {i18n(added
          ? 'pages.workspaces.organization.user-added'
          : pending
            ? 'pages.workspaces.organization.user-adding'
            : 'pages.workspaces.organization.user-add')}
      </Button>
    </div>
  )
}

function CreateOrganizationForm({
  workspaces,
  onCancel,
  onCreated,
}: {
  workspaces: ApiWorkspace[]
  onCancel: () => void
  onCreated: (organization: ApiOrganization) => Promise<void>
}) {
  const form = useForm<CreateOrganizationValues>({
    mode: 'onTouched',
    defaultValues: { name: '', workspaceId: '' },
  })
  const mutation = useMutation({
    mutationFn: (values: CreateOrganizationValues) => workspaceService.createOrganization(values),
    onSuccess: onCreated,
  })
  useEffect(() => {
    if (!form.getValues('workspaceId') && workspaces[0]) {
      form.setValue('workspaceId', workspaces[0].id)
    }
  }, [form, workspaces])

  return (
    <section aria-labelledby="create-organization-title" className="grid content-start gap-4 rounded-xl bg-contrast p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <Typography id="create-organization-title" variant="h2">
            {i18n('pages.workspaces.organization.create-title')}
          </Typography>
          <p className="mt-1 text-sm text-dark-100 dark:text-light-900">
            {i18n('pages.workspaces.organization.create-description')}
          </p>
        </div>
        <Button type="button" variant="text" color="from-theme" className="px-2" onClick={onCancel}>
          <Icon icon="lucide:x" className="size-4" />
          {i18n('common.fechar')}
        </Button>
      </div>
      {workspaces.length === 0 ? (
        <p className="text-sm">{i18n('pages.workspaces.organization.no-workspace')}</p>
      ) : (
        <FormProvider {...form}>
          <form className="flex flex-col gap-4" noValidate onSubmit={form.handleSubmit((values) => mutation.mutate(values))}>
            <TextField
              name="name"
              label={i18n('pages.workspaces.organization.name')}
              placeholder={i18n('pages.workspaces.organization.name-placeholder')}
              rules={validators.required()}
              autoComplete="organization"
            />
            <RadioGroup
              name="workspaceId"
              label={i18n('pages.workspaces.organization.first-workspace')}
              options={workspaces.map(workspaceOption)}
              rules={validators.required()}
            />
            {mutation.isError && <p role="alert" className="text-sm text-p-red">{i18n('pages.workspaces.organization.error')}</p>}
            <Button type="submit" variant="filled" color="purple" disabled={mutation.isPending}>
              {i18n(mutation.isPending ? 'pages.workspaces.organization.creating' : 'pages.workspaces.organization.create')}
            </Button>
          </form>
        </FormProvider>
      )}
    </section>
  )
}

function workspaceOption(workspace: ApiWorkspace) {
  return {
    value: workspace.id,
    label: workspace.name ?? i18n('common.workspace.sem-nome'),
  }
}
