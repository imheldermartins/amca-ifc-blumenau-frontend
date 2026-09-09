import { useMutation, useQueryClient } from '@tanstack/react-query'
import { FormProvider, useForm } from 'react-hook-form'
import { Button, TextField } from 'cubs-components'

import { IconPicker, type IconPickerLabels } from '@/components/IconPicker'
import { Typography } from '@/components/Typography'
import { useAuth } from '@/contexts/AuthContext'
import { i18n } from '@/lib/i18n'
import { validators } from '@/lib/validators'
import { workspaceQueryKey } from '@/lib/workspaceQueryKeys'
import { workspaceService, type WorkspaceIcon } from '@/services/WorkspaceService'
import { useWorkspaceSettings } from './useWorkspaceSettings'

interface SettingsValues {
  name: string
  icon: WorkspaceIcon
}

const iconLabels = (): IconPickerLabels => ({
  choose: i18n('pages.workspaces.icons.choose'),
  search: i18n('pages.workspaces.icons.search'),
  empty: i18n('pages.workspaces.icons.empty'),
  loading: i18n('pages.workspaces.icons.loading'),
  loadMore: i18n('pages.workspaces.icons.load-more'),
})

export function WorkspaceGeneralSettingsPage() {
  const workspace = useWorkspaceSettings()
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const form = useForm<SettingsValues>({
    mode: 'onTouched',
    defaultValues: {
      name: workspace.name ?? '',
      icon: workspace.icon,
    },
  })
  const mutation = useMutation({
    mutationFn: (values: SettingsValues) => workspaceService.update(workspace.id, values),
    onSuccess: (updated) => {
      if (user) queryClient.setQueryData(workspaceQueryKey(user.id, workspace.id), updated)
      form.reset({ name: updated.name ?? '', icon: updated.icon })
    },
  })

  return (
    <section aria-labelledby="workspace-general-title">
      <Typography id="workspace-general-title" variant="h2">
        {i18n('pages.workspaces.settings.general')}
      </Typography>
      <Typography variant="body" as="p" className="mt-1 text-dark-100 dark:text-light-900">
        {i18n('pages.workspaces.settings.general-description')}
      </Typography>

      <FormProvider {...form}>
        <form
          noValidate
          className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2"
          onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
        >
          <TextField
            name="name"
            label={i18n('pages.workspaces.settings.name')}
            rules={validators.required()}
          />
          <IconPicker
            name="icon"
            label={i18n('pages.workspaces.settings.icon')}
            labels={iconLabels()}
            rules={validators.required()}
          />
          <div className="flex items-center gap-3 md:col-span-2">
            <Button type="submit" variant="filled" color="purple" disabled={mutation.isPending}>
              {i18n(mutation.isPending ? 'pages.workspaces.settings.saving' : 'pages.workspaces.settings.save')}
            </Button>
            {mutation.isSuccess && !form.formState.isDirty && (
              <span role="status" className="text-sm text-p-green">{i18n('pages.workspaces.settings.saved')}</span>
            )}
            {mutation.isError && (
              <span role="alert" className="text-sm text-p-red">{i18n('pages.workspaces.settings.save-error')}</span>
            )}
          </div>
        </form>
      </FormProvider>
    </section>
  )
}
