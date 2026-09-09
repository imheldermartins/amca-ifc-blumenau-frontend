import { Icon } from '@iconify/react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useNavigate, useParams } from '@tanstack/react-router'
import { FormProvider, useForm, type RegisterOptions } from 'react-hook-form'
import { Button, Select, TextField, cn } from 'cubs-components'

import { Typography } from '@/components/Typography'
import { useAuth } from '@/contexts/AuthContext'
import { useQueryParams } from '@/hooks/useQueryParams'
import { i18n } from '@/lib/i18n'
import { validators } from '@/lib/validators'
import {
  workspaceService,
  type WorkspaceKeyPurpose,
} from '@/services/WorkspaceService'

interface CreateValues {
  name: string
  key: string
  organizationId: string
}

interface JoinValues {
  key: string
}

type WorkspaceAccessTab = WorkspaceKeyPurpose

function keyRules(purpose: WorkspaceKeyPurpose): RegisterOptions {
  return {
    ...validators.required(),
    validate: {
      validWorkspaceKey: async (value) => {
        if (typeof value !== 'string' || !value) return i18n('validation.campo-obrigatorio')
        try {
          const result = await workspaceService.validateKey(value, purpose)
          return result.valid || i18n('pages.workspaces.access.key-invalid')
        } catch {
          return i18n('pages.workspaces.access.key-invalid')
        }
      },
    },
  }
}

export function WorkspaceAccessPage() {
  const { lang } = useParams({ strict: false })
  const navigate = useNavigate()
  const query = useQueryParams<'tab' | 'organization'>()
  const requestedTab = query.get('tab')
  const requestedOrganizationId = query.get('organization')
  const tab: WorkspaceAccessTab = requestedTab === 'join' ? requestedTab : 'create'

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-5 py-10 text-foreground">
      <section className="w-full max-w-2xl p-6">
        <Button
          type="button"
          variant="text"
          color="from-theme"
          className="mb-5 -ml-2"
          onClick={() => navigate({ to: '/$lang/workspaces', params: { lang: lang ?? 'pt-br' }, search: { choose: true, tab: 'workspaces' } })}
        >
          <Icon icon="lucide:arrow-left" className="size-4" />
          {i18n('pages.workspaces.access.back')}
        </Button>

        <header className="text-center">
          <Typography variant="h1">{i18n('pages.workspaces.access.title')}</Typography>
          <Typography variant="body" as="p" className="mt-2 text-dark-100 dark:text-light-900">
            {i18n('pages.workspaces.access.subtitle')}
          </Typography>
        </header>

        <div
          role="tablist"
          aria-label={i18n('pages.workspaces.access.tabs-label')}
          className="mx-auto mt-6 grid max-w-lg grid-cols-2 rounded-lg bg-active p-1"
        >
          {(['create', 'join'] as const).map((candidate) => (
            <Button
              key={candidate}
              type="button"
              role="tab"
              aria-selected={tab === candidate}
              variant="text"
              color="from-theme"
              className={cn(tab === candidate && 'bg-background shadow-sm')}
              onClick={() => query.set('tab', candidate, { replace: true })}
            >
              {i18n(`pages.workspaces.access.tab-${candidate}`)}
            </Button>
          ))}
        </div>

        <div className="mt-6">
          {tab === 'create' ? (
            <CreateWorkspaceForm
              lang={lang ?? 'pt-br'}
              initialOrganizationId={requestedOrganizationId}
              onCreateOrganization={() => navigate({
                to: '/$lang/workspaces',
                params: { lang: lang ?? 'pt-br' },
                search: { choose: true, tab: 'organization' },
              })}
            />
          ) : (
            <JoinWorkspaceForm lang={lang ?? 'pt-br'} />
          )}
        </div>
      </section>
    </main>
  )
}

function CreateWorkspaceForm({
  lang,
  initialOrganizationId,
  onCreateOrganization,
}: {
  lang: string
  initialOrganizationId?: string
  onCreateOrganization: () => void
}) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const organizations = useQuery({
    queryKey: ['organizations', user?.id ?? 'anonymous'],
    queryFn: () => workspaceService.listOrganizations(),
    enabled: Boolean(user),
  })
  const workspaces = useQuery({
    queryKey: ['workspaces', user?.id ?? 'anonymous'],
    queryFn: () => workspaceService.listMine(),
    enabled: Boolean(user),
  })
  const organizationOptions = (organizations.data ?? [])
    .filter((organization) => organization.role === 'superadmin')
    .map((organization) => ({ value: organization.id, label: organization.name }))
  const requiresOrganization = (workspaces.data ?? [])
    .some((workspace) => workspace.createdByUserId === user?.id)
  const form = useForm<CreateValues>({
    mode: 'onTouched',
    defaultValues: { name: '', key: '', organizationId: initialOrganizationId ?? '' },
  })
  const mutation = useMutation({
    mutationFn: (values: CreateValues) => workspaceService.create({
      name: values.name,
      key: values.key,
      ...(values.organizationId && { organizationId: values.organizationId }),
    }),
    onSuccess: (workspace) => navigate({
      to: '/$lang/workspaces/$workspaceId/settings/general',
      params: { lang, workspaceId: workspace.id },
    }),
  })

  return (
    <FormProvider {...form}>
      <form className="flex flex-col gap-4" noValidate onSubmit={form.handleSubmit((values) => mutation.mutate(values))}>
        <TextField
          name="name"
          label={i18n('pages.workspaces.access.name')}
          placeholder={i18n('pages.workspaces.access.name-placeholder')}
          rules={validators.required()}
          autoComplete="organization"
        />
        <Select
          name="organizationId"
          label={i18n('pages.workspaces.access.organization')}
          placeholder={i18n('pages.workspaces.access.organization-placeholder')}
          options={organizationOptions}
          rules={{
            validate: (value) => (
              (!value && !requiresOrganization)
              || organizationOptions.some((option) => option.value === value)
              || i18n('pages.workspaces.access.organization-required')
            ),
          }}
          disabled={organizations.isPending}
        />
        {requiresOrganization && organizationOptions.length === 0 && !organizations.isPending && (
          <div className="rounded-lg border border-divider bg-background p-3 text-sm">
            <p>{i18n('pages.workspaces.access.organization-missing')}</p>
            <Button
              type="button"
              variant="text"
              color="purple"
              className="mt-2 px-0"
              onClick={onCreateOrganization}
            >
              {i18n('pages.workspaces.access.organization-create-link')}
            </Button>
          </div>
        )}
        <TextField
          name="key"
          label={i18n('pages.workspaces.access.key')}
          placeholder={i18n('pages.workspaces.access.key-placeholder')}
          rules={keyRules('create')}
          autoComplete="off"
        />
        {mutation.isError && <p role="alert" className="text-sm text-p-red">{i18n('pages.workspaces.access.error')}</p>}
        <Button type="submit" variant="filled" color="purple" disabled={mutation.isPending}>
          {i18n(mutation.isPending ? 'pages.workspaces.access.creating' : 'pages.workspaces.access.create')}
        </Button>
      </form>
    </FormProvider>
  )
}

function JoinWorkspaceForm({ lang }: { lang: string }) {
  const navigate = useNavigate()
  const form = useForm<JoinValues>({ mode: 'onTouched', defaultValues: { key: '' } })
  const mutation = useMutation({
    mutationFn: ({ key }: JoinValues) => workspaceService.join(key),
    onSuccess: (workspace) => navigate({
      to: '/$lang/myworkspace/$workspaceId',
      params: { lang, workspaceId: workspace.id },
    }),
  })

  return (
    <FormProvider {...form}>
      <form className="flex flex-col gap-4" noValidate onSubmit={form.handleSubmit((values) => mutation.mutate(values))}>
        <TextField
          name="key"
          label={i18n('pages.workspaces.access.key')}
          placeholder={i18n('pages.workspaces.access.key-placeholder')}
          rules={keyRules('join')}
          autoComplete="off"
        />
        {mutation.isError && <p role="alert" className="text-sm text-p-red">{i18n('pages.workspaces.access.error')}</p>}
        <Button type="submit" variant="filled" color="purple" disabled={mutation.isPending}>
          {i18n(mutation.isPending ? 'pages.workspaces.access.joining' : 'pages.workspaces.access.join')}
        </Button>
      </form>
    </FormProvider>
  )
}
