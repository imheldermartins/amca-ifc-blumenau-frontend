import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { Icon } from '@iconify/react'
import { useState } from 'react'
import { Button, Select, Switch } from 'cubs-components'
import { FormProvider, useForm } from 'react-hook-form'
import { useAuth } from '@/contexts/AuthContext'
import { useLanguage } from '@/contexts/LanguageContext'
import { useOrganizationSettings } from '@/hooks/useOrganizationSettings'
import { useModal } from '@/hooks/useModal'
import { currentWorkspaceSession } from '@/lib/currentWorkspaceSession'
import { workspacePreference } from '@/lib/workspacePreference'
import { i18n } from '@/lib/i18n'
import { validators } from '@/lib/validators'
import { workspaceService } from '@/services/WorkspaceService'
import { accessService, can } from '@/services/AccessService'
import { WorkspaceCreationDialog } from '@/pages/workspaces/WorkspaceCreationDialog'

export function OrganizationWorkspacesPage() {
  const organization = useOrganizationSettings()
  const { user } = useAuth()
  const { slug: lang } = useLanguage()
  const navigate = useNavigate(), { openModal } = useModal()
  const [, refreshPreference] = useState(0)
  const mayRead = can(organization, 'read', 'workspaces'), mayCreate = can(organization, 'write', 'create')
  const catalog = useQuery({ queryKey: ['organization-workspaces', user?.id, organization.id], queryFn: () => workspaceService.organizationWorkspaces(organization.id), enabled: Boolean(user && mayRead) })
  const mine = useQuery({ queryKey: ['workspaces', user?.id], queryFn: () => workspaceService.listMine(), enabled: Boolean(user && (mayRead || mayCreate)) })
  const request = useMutation({ mutationFn: (id: string) => accessService.request('workspace', id) })
  const preferred = user ? workspacePreference.get(user.id) : undefined
  const openCreate = () => openModal({
    size: 'sm', content: ({ closeModal, updateModal }) => <WorkspaceCreationDialog lang={lang} organization={organization} onCreated={closeModal}
      onCreateOrganization={() => { closeModal(); void navigate({ to: '/$lang/organizations/new', params: { lang } }) }}
      onPendingChange={(pending) => updateModal({ dismissible: !pending })} />,
  })
  return <section aria-label={i18n('organization.settings.workspaces')}>
    {mayRead && (catalog.isPending ? <p role="status" className="py-4 text-sm opacity-60">{i18n('common.carregando')}</p>
      : catalog.isError ? <p role="alert" className="text-sm text-p-red">{i18n('pages.workspaces.selector.error')}</p>
        : !catalog.data.length ? <p className="py-4 text-sm opacity-60">{i18n('organization.empty-workspaces')}</p> : null)}
    <ul className="space-y-3">{(mayRead ? catalog.data ?? [] : []).map((workspace) => {
            const available = workspace.canEnter ? mine.data?.find((item) => item.id === workspace.id) : undefined
            return <li key={workspace.id} data-organization-workspace={workspace.id} className="relative flex min-w-0 items-center gap-3 rounded-xl border border-divider bg-contrast/20 p-4 transition-colors hover:bg-active">
              <button type="button" disabled={!workspace.canEnter} aria-label={i18n('organization.settings.enter-workspace', { name: workspace.name ?? i18n('pages.workspaces.selector.unnamed') })}
                onClick={() => void navigate({ to: '/$lang/workspace/$workspaceId', params: { lang, workspaceId: workspace.id } })}
                className="absolute inset-0 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-p-purple/40 disabled:cursor-default" />
              <Icon icon={workspace.icon ?? 'lucide:boxes'} className="pointer-events-none size-5 shrink-0 text-p-purple" />
              <span className="pointer-events-none min-w-0 flex-1 truncate text-sm font-medium">{workspace.name ?? i18n('pages.workspaces.selector.unnamed')}</span>
              <div className="relative z-10 flex shrink-0 items-center gap-3">
              {available && user && <Switch aria-label={i18n('organization.settings.preferred', { name: workspace.name })} checked={preferred === workspace.id}
                onCheckedChange={(checked) => { if (checked) workspacePreference.set(user.id, workspace.id); else workspacePreference.clear(user.id); refreshPreference((value) => value + 1) }} />}
              {available && can(available, 'write', 'update') && <button type="button" aria-label={i18n('organization.settings.workspace-settings', { name: workspace.name })} className="rounded-lg p-2 opacity-60 hover:bg-active hover:opacity-100"
                onClick={() => { if (user) currentWorkspaceSession.set(user.id, workspace.id); void navigate({ to: '/$lang/workspaces/$workspaceId/settings/general', params: { lang, workspaceId: workspace.id } }) }}><Icon icon="lucide:settings-2" className="size-4" /></button>}
              {!workspace.canEnter && <Button type="button" variant="text" color="purple" disabled={request.isPending || (request.isSuccess && request.variables === workspace.id)} onClick={() => request.mutate(workspace.id)}>
                {i18n(request.isSuccess && request.variables === workspace.id ? 'organization.requested' : 'organization.request')}
              </Button>}
              </div>
              {workspace.canEnter && <Icon icon="lucide:chevron-right" className="pointer-events-none size-4 shrink-0 opacity-50" />}
            </li>
          })}
      {mayCreate && <li><button type="button" onClick={openCreate} className="flex w-full items-center gap-3 rounded-xl border border-dashed border-divider p-4 text-left text-sm font-medium text-p-purple transition-colors hover:bg-p-purple/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-p-purple/40">
        <Icon icon="lucide:plus" className="size-5 shrink-0" />{i18n('organization.new-workspace')}
      </button></li>}
    </ul>
    {request.isError && <p role="alert" className="mt-4 text-sm text-p-red">{i18n('access.error')}</p>}
    {request.data?.notificationPending && <p role="status" className="mt-4 text-sm opacity-60">{i18n('organization.notification-pending')}</p>}
    {mayCreate && <LinkWorkspaceForm organizationId={organization.id} />}
  </section>
}

function LinkWorkspaceForm({ organizationId }: { organizationId: string }) {
  const { user } = useAuth(), client = useQueryClient()
  const form = useForm({ defaultValues: { workspaceId: '' } })
  const mine = useQuery({ queryKey: ['workspaces', user?.id], queryFn: () => workspaceService.listMine(), enabled: Boolean(user) })
  const mutation = useMutation({ mutationFn: (input: { workspaceId: string }) => workspaceService.linkWorkspace(organizationId, input.workspaceId), onSuccess: async () => {
    form.reset(); await Promise.all([client.invalidateQueries({ queryKey: ['organization-workspaces', user?.id, organizationId] }), client.invalidateQueries({ queryKey: ['workspaces', user?.id] }), client.invalidateQueries({ queryKey: ['organizations', user?.id] })])
  } })
  const options = (mine.data ?? []).filter((item) => item.isOwner && item.isPersonal).map((item) => ({ value: item.id, label: item.name ?? item.id }))
  if (!options.length) return null
  return <FormProvider {...form}><form className="mt-8 space-y-3 border-t border-divider pt-6" onSubmit={form.handleSubmit((input) => mutation.mutate(input))}>
    <Select name="workspaceId" label={i18n('organization.link-workspace')} options={options} rules={validators.required()} />
    <p className="text-xs opacity-60">{i18n('organization.link-help')}</p>
    <Button type="submit" variant="text" color="purple" disabled={mutation.isPending}>{i18n('organization.link')}</Button>
    {mutation.isError && <p role="alert" className="text-sm text-p-red">{i18n('access.error')}</p>}
  </form></FormProvider>
}
