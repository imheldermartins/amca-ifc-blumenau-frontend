import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { FormProvider, useForm } from 'react-hook-form'
import { Button, Select, TextField } from 'cubs-components'

import { useAuth } from '@/contexts/AuthContext'
import { currentWorkspaceSession } from '@/lib/currentWorkspaceSession'
import { i18n } from '@/lib/i18n'
import { validators } from '@/lib/validators'
import { workspaceQueryKey, workspacesQueryKey } from '@/lib/workspaceQueryKeys'
import { can } from '@/services/AccessService'
import { workspaceService, type ApiOrganization, type ApiOrganizationWorkspace, type ApiWorkspace } from '@/services/WorkspaceService'

interface CreateValues {
  name: string
  organizationId: string
}

export function CreateWorkspaceForm({ lang, initialOrganizationId, organization, onCreateOrganization, onCreated, onPendingChange }: {
  lang: string
  initialOrganizationId?: string
  organization?: ApiOrganization
  onCreateOrganization: () => void
  onCreated?: (workspace: ApiWorkspace) => void
  onPendingChange?: (pending: boolean) => void
}) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const organizations = useQuery({
    queryKey: ['organizations', user?.id ?? 'anonymous'],
    queryFn: () => workspaceService.listOrganizations(),
    enabled: Boolean(user) && !organization,
  })
  const organizationsPending = !organization && organizations.isPending
  const organizationOptions = (organization ? [organization] : organizations.data ?? [])
    .filter((organization) => can(organization, 'write', 'create'))
    .map((organization) => ({ value: organization.id, label: organization.name }))
  const form = useForm<CreateValues>({
    mode: 'onTouched',
    defaultValues: { name: '', organizationId: organization?.id ?? initialOrganizationId ?? '' },
  })
  const mutation = useMutation({
    mutationFn: (values: CreateValues) => workspaceService.create({
      name: values.name.trim(),
      organizationId: organization?.id ?? values.organizationId,
    }),
    onMutate: () => onPendingChange?.(true),
    onSuccess: (workspace) => {
      if (user) {
        queryClient.setQueryData<ApiWorkspace[]>(workspacesQueryKey(user.id), (current) => current
          ? [...current.filter((item) => item.id !== workspace.id), workspace]
          : undefined)
        queryClient.setQueryData(workspaceQueryKey(user.id, workspace.id), workspace)
        const catalogKey = ['organization-workspaces', user.id, workspace.organizationId]
        queryClient.setQueryData<ApiOrganizationWorkspace[]>(catalogKey, (current) => current
          ? [...current.filter((item) => item.id !== workspace.id), {
            id: workspace.id, name: workspace.name, icon: workspace.icon,
            canEnter: can(workspace, 'read', 'view'), isMember: workspace.isMember ?? false,
          }]
          : undefined)
        void queryClient.invalidateQueries({ queryKey: workspacesQueryKey(user.id), refetchType: 'none' })
        void queryClient.invalidateQueries({ queryKey: ['organizations', user.id] })
        void queryClient.invalidateQueries({ queryKey: ['organization', user.id, workspace.organizationId] })
        void queryClient.invalidateQueries({ queryKey: catalogKey, refetchType: 'none' })
      }
      if (onCreated) {
        onCreated(workspace)
        return
      }
      if (user) currentWorkspaceSession.set(user.id, workspace.id)
      return navigate({
        to: '/$lang/workspaces/$workspaceId/settings/general',
        params: { lang, workspaceId: workspace.id },
      })
    },
    onSettled: () => onPendingChange?.(false),
  })

  return <FormProvider {...form}>
    <form className="flex flex-col gap-4" noValidate onSubmit={form.handleSubmit((values) => mutation.mutate(values))}>
      <TextField
        name="name"
        label={i18n('pages.workspaces.access.name')}
        placeholder={i18n('pages.workspaces.access.name-placeholder')}
        rules={{ ...validators.required(), validate: (value) => Boolean(String(value).trim()) || i18n('validation.campo-obrigatorio') }}
        maxLength={120}
        disabled={mutation.isPending}
        autoComplete="organization"
      />
      <Select
        name="organizationId"
        label={i18n('pages.workspaces.access.organization')}
        placeholder={i18n('pages.workspaces.access.organization-placeholder')}
        options={organizationOptions}
        rules={{ validate: (value) => organizationOptions.some((option) => option.value === value) || i18n('pages.workspaces.access.organization-required') }}
        disabled={Boolean(organization) || organizationsPending || mutation.isPending}
      />
      {!organization && organizations.isError ? <p role="alert" className="text-sm text-p-red">{i18n('pages.workspaces.selector.organizations-error')}</p>
        : organizationOptions.length === 0 && !organizationsPending && <div className="rounded-lg border border-divider bg-background p-3 text-sm">
          <p>{i18n('pages.workspaces.access.organization-missing')}</p>
          <Button type="button" variant="text" color="purple" className="mt-2 px-0" onClick={onCreateOrganization}>
            {i18n('pages.workspaces.access.organization-create-link')}
          </Button>
        </div>}
      {mutation.isError && <p role="alert" className="text-sm text-p-red">{i18n('pages.workspaces.access.error')}</p>}
      <Button type="submit" variant="filled" color="purple" disabled={mutation.isPending || organizationsPending || organizationOptions.length === 0}>
        {i18n(mutation.isPending ? 'pages.workspaces.access.creating' : 'pages.workspaces.access.create')}
      </Button>
    </form>
  </FormProvider>
}
