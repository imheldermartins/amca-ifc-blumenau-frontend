import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { FormProvider, useForm } from 'react-hook-form'
import { Icon } from '@iconify/react'
import { Button, TextField } from 'cubs-components'
import { Typography } from '@/components/Typography'
import { useAuth } from '@/contexts/AuthContext'
import { useLanguage } from '@/contexts/LanguageContext'
import { i18n } from '@/lib/i18n'
import { validators } from '@/lib/validators'
import { workspaceService } from '@/services/WorkspaceService'
import { Feedback } from '@/pages/access/AccessPages'

export function NewOrganizationPage() {
  const { slug: lang } = useLanguage(), { user } = useAuth(), navigate = useNavigate(), client = useQueryClient()
  const form = useForm({ defaultValues: { name: '' } })
  const create = useMutation({ mutationFn: (input: { name: string }) => workspaceService.createOrganization(input), onSuccess: async (organization) => {
    if (user) client.setQueryData(['organization', user.id, organization.id], organization)
    form.reset(); await client.invalidateQueries({ queryKey: ['organizations'] }); await navigate({ to: '/$lang/organizations/$organizationId', params: { lang, organizationId: organization.id } })
  } })
  return <main className="min-h-dvh bg-background px-5 py-10 text-foreground"><section className="mx-auto max-w-xl">
    <Button variant="text" color="from-theme" onClick={() => void navigate({ to: '/$lang/workspaces', params: { lang }, search: { choose: true, tab: 'workspaces' } })}><Icon icon="lucide:arrow-left" />{i18n('access.back')}</Button>
    <Typography variant="h1" className="mt-8">{i18n('organization.create')}</Typography>
    <Typography variant="body" as="p" className="my-4 text-foreground/65">{i18n('organization.create-help')}</Typography>
    <div className="my-6 rounded-xl bg-contrast p-4"><Typography variant="subtitle" as="p">{user?.name}</Typography><Typography variant="body" as="p">{user?.email}</Typography></div>
    <FormProvider {...form}><form className="flex flex-col gap-5" onSubmit={form.handleSubmit((input) => create.mutate(input))}>
      <TextField name="name" label={i18n('organization.name')} autoComplete="organization" rules={{ ...validators.required(), maxLength: 120 }} />
      <Button type="submit" variant="filled" color="purple" disabled={create.isPending}>{i18n(create.isPending ? 'organization.creating' : 'organization.create')}</Button>
      {create.isError && <Feedback error message={i18n('organization.create-error')} />}
    </form></FormProvider>
  </section></main>
}
