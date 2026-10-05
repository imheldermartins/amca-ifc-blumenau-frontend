import { Icon } from '@iconify/react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { useEffect, useRef } from 'react'
import { FormProvider, useForm } from 'react-hook-form'
import { Button } from 'cubs-components'

import { IconPicker, type IconPickerLabels } from '@/components/IconPicker'
import { Typography } from '@/components/Typography'
import { useAuth } from '@/contexts/AuthContext'
import { useLanguage } from '@/contexts/LanguageContext'
import { i18n } from '@/lib/i18n'
import { validators } from '@/lib/validators'
import { workspaceQueryKey, workspacesQueryKey } from '@/lib/workspaceQueryKeys'
import { can } from '@/services/AccessService'
import { workspaceService, type ApiOrganizationWorkspace, type ApiWorkspace, type WorkspaceIcon } from '@/services/WorkspaceService'
import { useWorkspaceSettings } from './useWorkspaceSettings'

interface IdentityValues { name: string; icon: WorkspaceIcon }
type IdentityChange = { field: 'name'; value: string } | { field: 'icon'; value: WorkspaceIcon }
const iconLabels = (): IconPickerLabels => ({
  choose: i18n('pages.workspaces.icons.choose'), search: i18n('pages.workspaces.icons.search'),
  empty: i18n('pages.workspaces.icons.empty'), loading: i18n('pages.workspaces.icons.loading'), loadMore: i18n('pages.workspaces.icons.load-more'),
})

/** Cabeçalho exclusivo das configurações; o cache alimenta também o shell. */
export function WorkspaceSettingsHeader({ section }: { section: string }) {
  const workspace = useWorkspaceSettings()
  const { user } = useAuth()
  const { slug: lang } = useLanguage()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const editable = can(workspace, 'write', 'update')
  const form = useForm<IdentityValues>({ mode: 'onTouched', defaultValues: { name: workspace.name ?? '', icon: workspace.icon } })
  const confirmed = useRef<IdentityValues>({ name: workspace.name ?? '', icon: workspace.icon })
  const saving = useRef(false)
  const cancelBlur = useRef(false)
  const mutation = useMutation({
    mutationFn: (change: IdentityChange) => workspaceService.update(workspace.id, { ...confirmed.current, [change.field]: change.value }),
    onSuccess: (updated, change) => {
      confirmed.current = { name: updated.name ?? '', icon: updated.icon }
      if (user) {
        queryClient.setQueryData(workspaceQueryKey(user.id, workspace.id), updated)
        queryClient.setQueryData<ApiWorkspace[]>(workspacesQueryKey(user.id), (current) => current?.map((item) => item.id === updated.id ? updated : item))
        if (updated.organizationId) queryClient.setQueryData<ApiOrganizationWorkspace[]>(['organization-workspaces', user.id, updated.organizationId], (current) => current?.map((item) => item.id === updated.id ? { ...item, name: updated.name, icon: updated.icon } : item))
      }
      if (change.field === 'name') form.resetField('name', { defaultValue: updated.name ?? '' })
      else form.resetField('icon', { defaultValue: updated.icon })
    },
    onSettled: () => { saving.current = false },
  })
  useEffect(() => {
    confirmed.current = { name: workspace.name ?? '', icon: workspace.icon }
    if (!form.formState.isDirty) form.reset({ name: workspace.name ?? '', icon: workspace.icon })
  }, [workspace.name, workspace.icon, form])

  const save = async (change: IdentityChange) => {
    if (!editable || saving.current) return
    if (change.field === 'name') {
      if (cancelBlur.current) { cancelBlur.current = false; return }
      change = { ...change, value: change.value.trim() }
      form.setValue('name', change.value, { shouldDirty: true })
    }
    if (change.value === confirmed.current[change.field]) {
      if (change.field === 'name') form.resetField('name', { defaultValue: confirmed.current.name })
      return
    }
    saving.current = true
    if (!await form.trigger(change.field)) { saving.current = false; return }
    mutation.mutate(change)
  }
  const nameField = form.register('name', { validate: (value) => Boolean(value.trim()) || i18n('pages.workspaces.settings.name-required') })
  return <header className="mb-8">
    <nav aria-label={i18n('pages.workspaces.settings.breadcrumb')} className="mb-7 flex flex-wrap items-center gap-2 text-xs text-foreground/60">
      <span>{i18n('pages.workspaces.settings.workspace')}</span><Icon icon="lucide:chevron-right" className="size-3" aria-hidden="true" />
      <span>{i18n('pages.workspaces.settings.navigation')}</span><Icon icon="lucide:chevron-right" className="size-3" aria-hidden="true" />
      <span aria-current="page" className="text-foreground">{section}</span>
    </nav>
    <FormProvider {...form}><form noValidate autoComplete="off" onSubmit={(event) => event.preventDefault()}>
      <div className="flex flex-wrap items-center justify-between gap-5">
        <div className="flex min-w-0 flex-1 items-center gap-5">
          <IconPicker name="icon" label={i18n('pages.workspaces.settings.icon')} labels={iconLabels()} rules={validators.required()} variant="icon" disabled={!editable || mutation.isPending} onValueChange={(value) => void save({ field: 'icon', value })} />
          <div className="min-w-0 flex-1">
            <Typography variant="caption" as="p" className="mb-1 text-foreground/60">{workspace.isPersonal ? i18n('pages.workspaces.settings.personal') : workspace.organizationName || i18n('pages.workspaces.settings.organization-space')}</Typography>
            <Typography variant="h1" className="min-w-0">
              <input {...nameField} autoComplete="off"
                aria-label={i18n('pages.workspaces.settings.name')} aria-invalid={Boolean(form.formState.errors.name)}
                readOnly={!editable || mutation.isPending} placeholder={i18n('common.workspace.sem-nome')}
                className="min-h-[1.2em] w-full border-0 bg-transparent p-0 text-inherit shadow-none outline-none ring-0 focus:border-0 focus:outline-none focus:ring-0" style={{ fontFamily: 'inherit', fontSize: 'inherit', fontWeight: 'inherit', lineHeight: 'inherit', letterSpacing: 'inherit' }}
                onBlur={(event) => { void nameField.onBlur(event); void save({ field: 'name', value: event.currentTarget.value }) }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') { event.preventDefault(); event.currentTarget.blur() }
                  if (event.key === 'Escape' && !saving.current) { event.preventDefault(); cancelBlur.current = true; form.resetField('name', { defaultValue: confirmed.current.name }); mutation.reset(); event.currentTarget.blur() }
                }} />
            </Typography>
            {form.formState.errors.name && <p role="alert" className="mt-1 text-xs text-p-red">{form.formState.errors.name.message}</p>}
          </div>
        </div>
        <Button type="button" variant="outlined" color="from-theme" onClick={() => navigate({ to: '/$lang/workspace/$workspaceId', params: { lang, workspaceId: workspace.id }, search: {} })}>
          {i18n('pages.workspaces.settings.open')}<Icon icon="lucide:arrow-up-right" className="size-4" />
        </Button>
      </div>
      {mutation.isError && <p role="alert" className="mt-3 text-sm text-p-red">{i18n('pages.workspaces.settings.save-error')}</p>}
      {mutation.isPending && <p role="status" className="mt-3 text-xs text-foreground/60">{i18n('pages.workspaces.settings.saving')}</p>}
      {mutation.isSuccess && !form.formState.isDirty && <p role="status" className="mt-3 text-xs text-p-green">{i18n('pages.workspaces.settings.saved')}</p>}
    </form></FormProvider>
  </header>
}
