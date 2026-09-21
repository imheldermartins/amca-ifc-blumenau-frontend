import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { FormProvider, useForm } from 'react-hook-form'
import { Icon } from '@iconify/react'
import { Button, TextField, Select, Tooltip } from 'cubs-components'
import { Typography } from '@/components/Typography'
import { useAuth } from '@/contexts/AuthContext'
import { useLanguage } from '@/contexts/LanguageContext'
import { i18n } from '@/lib/i18n'
import { validators } from '@/lib/validators'
import { workspaceService, type ApiOrganization } from '@/services/WorkspaceService'
import { apiService } from '@/services/ApiService'
import { accessService, can } from '@/services/AccessService'
import { Feedback } from '@/pages/access/AccessPages'

export function OrganizationsPage() {
  const { slug: lang } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();
  const organizations = useQuery({
    queryKey: ['organizations', user?.id],
    queryFn: () => workspaceService.listOrganizations()
  });

  return (
    <main className="min-h-dvh bg-background px-6 py-10 text-foreground">
      <section className="mx-auto max-w-4xl">
        <Button
          variant="text"
          color="from-theme"
          onClick={() => navigate({ href: '/' + lang + '/workspaces?choose=true' })}>
          <Icon icon="mdi:arrow-left" />
          {i18n('organization.workspaces-back')}
        </Button>
        <header className="flex flex-wrap items-center justify-between gap-5 pb-6">
          <div>
            <Typography variant="h1">
              {i18n('organization.title')}
            </Typography>
          </div>
          <Tooltip align='center' side='top' content={i18n('organization.create')}>
            <Button
              variant="filled"
              color="purple"
              className="p-4 rounded-full"
              onClick={() => navigate({ href: '/' + lang + '/organizations/new' })}
              >
              {/* {i18n('organization.create')} */}
              <Icon icon="lucide:plus" className="size-5" />
            </Button>
          </Tooltip>
        </header>
        {organizations.isPending ? <Feedback /> : organizations.isError ? <Feedback error /> : <ul className="divide-y divide-divider">
          {organizations.data.map(org => (
            <li key={org.id} className="bg-contrast flex items-center justify-between gap-4 px-4 py-3 rounded-lg border border-divider">
              <div>
                <Typography variant="h3">
                  {org.name}
                </Typography>
                <Typography variant="caption" as="p" className="mt-1 text-foreground/60">
                  {org.isOwner ? i18n('access.owner') : org.roleName || i18n('access.member')}
                  {can(org, 'read', 'workspaces') ? ' · ' + i18n('organization.workspace-count', { count: org.workspaceCount }) : ''}
                </Typography>
              </div>
              <Button
                variant="text"
                color="purple"
                onClick={() => navigate({ href: '/' + lang + '/organizations/' + org.id })}>
                {i18n('organization.open')}
              </Button>
            </li>
          ))}

          {!organizations.data.length && <Feedback message={i18n('organization.empty')} />}
        </ul>}
      </section>
    </main>
  );
}

export function NewOrganizationPage() {
  const { slug: lang } = useLanguage(); const { user } = useAuth(); const navigate = useNavigate(); const queryClient = useQueryClient()
  const form = useForm({ defaultValues: { name: '' } })
  const create = useMutation({
    mutationFn: (value: { name: string }) => workspaceService.createOrganization(value),
    onSuccess: async org => { form.reset(); await queryClient.invalidateQueries({ queryKey: ['organizations'] }); await navigate({ href: '/' + lang + '/organizations/' + org.id }) }
  })
  return <main className="min-h-dvh bg-background px-5 py-10 text-foreground"><section className="mx-auto max-w-xl">
    <Button variant="text" color="from-theme" onClick={() => navigate({ href: '/' + lang + '/organizations' })}>
      <Icon icon="lucide:arrow-left" />
      {i18n('access.back')}
    </Button>
    <Typography variant="h1" className="mt-8">{i18n('organization.create')}</Typography>
    <Typography variant="body" as="p" className="my-4 text-foreground/65">{i18n('organization.create-help')}</Typography>
    <div className="my-6 rounded-xl bg-contrast p-4"><Typography variant="subtitle" as="p">{user?.name}</Typography><Typography variant="body" as="p">{user?.email}</Typography></div>
    <FormProvider {...form}><form className="flex flex-col gap-5" onSubmit={form.handleSubmit(value => create.mutate(value))}>
      <TextField name="name" label={i18n('organization.name')} autoComplete="organization" rules={{ ...validators.required(), maxLength: 120 }} />
      <Button type="submit" variant="filled" color="purple" disabled={create.isPending}>{i18n(create.isPending ? 'organization.creating' : 'organization.create')}</Button>
      {create.isError && <Feedback error message={i18n('organization.create-error')} />}
    </form></FormProvider>
  </section></main>
}
export function OrganizationPage({ organizationId }: { organizationId: string }) {
  const { slug: lang } = useLanguage(); const id = organizationId; const { user } = useAuth(); const navigate = useNavigate()
  const organization = useQuery({ queryKey: ['organization', user?.id, id], queryFn: () => apiService.get<ApiOrganization>('/organizations/' + id) })
  const workspaces = useQuery({ queryKey: ['organization-workspaces', user?.id, id], queryFn: () => apiService.get<{ id: string; name: string; icon: string; canEnter: boolean; isMember: boolean }[]>('/organizations/' + id + '/workspaces'), enabled: can(organization.data, 'read', 'workspaces') })
  const request = useMutation({ mutationFn: (workspaceId: string) => accessService.request('workspace', workspaceId) })
  return <main className="min-h-dvh bg-background px-6 py-10 text-foreground"><section className="mx-auto max-w-5xl">
    <Button variant="text" color="from-theme" onClick={() => navigate({ href: '/' + lang + '/organizations' })}>{i18n('organization.title')}</Button>
    {organization.isPending ? <Feedback /> : organization.isError ? <Feedback error /> : <>
      <header className="mt-8 border-b border-divider pb-6"><Typography variant="caption" as="p" className="mb-2 text-foreground/60">{i18n('organization.single')}</Typography>
        <Typography variant="h1">{organization.data.name}</Typography>
        <div className="mt-6 flex flex-wrap gap-2">
          {(can(organization.data, 'read', 'members') || can(organization.data, 'write', 'add_members')) && <Button variant="text" color="from-theme" onClick={() => navigate({ href: '/' + lang + '/access/organization/' + id })}>{i18n('access.members')}</Button>}
          {(can(organization.data, 'read', 'roles') || can(organization.data, 'write', 'create_org_roles')) && <Button variant="text" color="from-theme" onClick={() => navigate({ href: '/' + lang + '/access/organization/' + id + '/roles' })}>{i18n('access.roles')}</Button>}
          {can(organization.data, 'write', 'add_members') && <Button variant="text" color="from-theme" onClick={() => navigate({ href: '/' + lang + '/access/organization/' + id + '/requests' })}>{i18n('access.requests')}</Button>}
          {can(organization.data, 'write', 'create') && <Button variant="filled" color="purple" onClick={() => navigate({ to: '/$lang/workspaces/new', params: { lang }, search: { organization: id } })}>{i18n('organization.new-workspace')}</Button>}
        </div>
      </header>
      {can(organization.data, 'read', 'workspaces') && <section className="mt-8"><Typography variant="h2">{i18n('organization.workspaces')}</Typography>
        {workspaces.isPending ? <Feedback /> : workspaces.isError ? <Feedback error /> : <ul className="mt-4 grid gap-4 sm:grid-cols-2">
          {workspaces.data.map(workspace => <li key={workspace.id} className="flex items-center justify-between gap-3 rounded-xl border border-divider p-5">
            <div className="flex min-w-0 items-center gap-3"><Icon icon={workspace.icon} className="size-6 shrink-0" /><Typography variant="subtitle" as="p" className="truncate">{workspace.name}</Typography></div>
            <Button variant="text" color="purple" disabled={request.isPending || (!workspace.canEnter && request.isSuccess && request.variables === workspace.id)} onClick={() => workspace.canEnter ? navigate({ to: '/$lang/workspace/$workspaceId', params: { lang, workspaceId: workspace.id } }) : request.mutate(workspace.id)}>{i18n(workspace.canEnter ? 'organization.enter' : request.isSuccess && request.variables === workspace.id ? 'organization.requested' : 'organization.request')}</Button>
          </li>)}{!workspaces.data.length && <Feedback message={i18n('organization.empty-workspaces')} />}
        </ul>}
      </section>}
      {request.isError && <Feedback error />}{request.data?.notificationPending && <Feedback message={i18n('organization.notification-pending')} />}
      {can(organization.data, 'write', 'update') && <OrganizationNameForm key={organization.data.name} organization={organization.data} />}
      {can(organization.data, 'write', 'create') && <LinkWorkspaceForm organizationId={id} />}
    </>}
  </section></main>
}
function OrganizationNameForm({ organization }: { organization: ApiOrganization }) {
  const form = useForm({ defaultValues: { name: organization.name } }); const queryClient = useQueryClient()
  const save = useMutation({ mutationFn: (value: { name: string }) => apiService.put('/organizations/' + organization.id, value), onSuccess: () => queryClient.invalidateQueries({ queryKey: ['organization'] }) })
  return <FormProvider {...form}><form className="mt-10 max-w-xl border-t border-divider pt-6" onSubmit={form.handleSubmit(value => save.mutate(value))}>
    <TextField name="name" label={i18n('organization.name')} rules={{ ...validators.required(), maxLength: 120 }} />
    <Button type="submit" className="mt-3" variant="text" color="purple" disabled={save.isPending}>{i18n('access.save')}</Button>
    {save.isError && <Feedback error />}{save.isSuccess && <Feedback message={i18n('access.saved')} />}
  </form></FormProvider>
}
function LinkWorkspaceForm({ organizationId }: { organizationId: string }) {
  const { user } = useAuth(); const queryClient = useQueryClient(); const form = useForm({ defaultValues: { workspaceId: '' } })
  const available = useQuery({ queryKey: ['workspaces', user?.id], queryFn: () => workspaceService.listMine() })
  const link = useMutation({ mutationFn: (value: { workspaceId: string }) => workspaceService.linkWorkspace(organizationId, value.workspaceId), onSuccess: async () => { form.reset(); await queryClient.invalidateQueries({ queryKey: ['organization-workspaces'] }); await queryClient.invalidateQueries({ queryKey: ['workspaces'] }) } })
  const options = (available.data ?? []).filter(w => w.isOwner && w.isPersonal).map(w => ({ value: w.id, label: w.name ?? w.id }))
  if (!options.length) return null
  return <FormProvider {...form}><form className="mt-8 max-w-xl border-t border-divider pt-6" onSubmit={form.handleSubmit(value => link.mutate(value))}>
    <Select name="workspaceId" label={i18n('organization.link-workspace')} options={options} rules={validators.required()} />
    <Typography variant="caption" as="p" className="my-3 text-foreground/60">{i18n('organization.link-help')}</Typography>
    <Button type="submit" variant="text" color="purple" disabled={link.isPending}>{i18n('organization.link')}</Button>{link.isError && <Feedback error />}
  </form></FormProvider>
}
