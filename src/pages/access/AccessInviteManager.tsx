import { Icon } from '@iconify/react'
import { useMutation } from '@tanstack/react-query'
import { useEffect } from 'react'
import { FormProvider, useForm } from 'react-hook-form'
import { Button, Select, TextField } from 'cubs-components'
import { i18n } from '@/lib/i18n'
import { validators } from '@/lib/validators'
import { accessService, can, canDelegate, type AccessRole, type AccessScope, type ScopeAccess } from '@/services/AccessService'
import { AccessMemberIdentity } from './AccessMemberIdentity'
import { AccessFeedback } from './AccessFeedback'

import { normalizeEmail, roleOptions, expirationOptions } from './accessInviteOptions'

interface InviteValues { query: string; roleId: string; expiresIn: '24h' | '7d' | 'never' }

/** A mesma busca filtra os vínculos e resolve um e-mail exato para o convite. */
export function AccessInviteManager({ scope, id, access, roles, onSearchChange, onInvited }: {
  scope: AccessScope; id: string; access: ScopeAccess; roles: AccessRole[]; onSearchChange: (query: string) => void; onInvited: () => Promise<void>
}) {
  const form = useForm<InviteValues>({ defaultValues: { query: '', roleId: '', expiresIn: '24h' } })
  const query = form.watch('query')
  const available = roles.filter((role) => canDelegate(access, role.roles))
  const defaultId = available.find((role) => role.isDefault)?.id ?? available[0]?.id ?? ''
  const selectedId = form.watch('roleId')
  useEffect(() => { if (selectedId !== defaultId && !available.some((role) => role.id === selectedId)) form.setValue('roleId', defaultId) }, [defaultId, selectedId, available, form])
  const search = useMutation({ mutationFn: async (email: string) => ({ email, ...await accessService.searchEmail(scope, id, email) }) })
  const recipient = search.data?.email === normalizeEmail(query) ? search.data : undefined
  const create = useMutation({
    mutationFn: (values: InviteValues) => {
      if (!can(access, 'write', 'add_members') || !recipient || recipient.email !== normalizeEmail(values.query) || recipient.isMember || !available.some((role) => role.id === values.roleId)) throw new Error('Invitation requires a current recipient and delegatable role')
      return accessService.createInvite(scope, id, { recipientEmail: recipient.email, roleId: values.roleId, expiresIn: values.expiresIn, acceptanceLimit: 1 })
    },
    onSuccess: async () => { search.reset(); await onInvited() },
  })
  const find = () => {
    const email = normalizeEmail(form.getValues('query'))
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      form.setError('query', { message: i18n('access.exact-email-help') })
      return
    }
    if (!search.isPending && !create.isPending) { create.reset(); search.mutate(email) }
  }
  const change = (value: string) => { form.setValue('query', value); form.clearErrors('query'); onSearchChange(value); search.reset(); create.reset() }
  const canInvite = can(access, 'write', 'add_members')
  return <FormProvider {...form}>
    <form onSubmit={(event) => { event.preventDefault(); if (canInvite) find() }} className="mb-4">
      <div className="flex items-start gap-2">
        <TextField name="query" type="search" aria-label={i18n('access.search-collaborators')} placeholder={i18n('access.search-placeholder')} className="min-w-0 flex-1"
          startAdornment={<Icon icon="lucide:search" className="size-4 text-foreground/60" />}
          disabled={create.isPending} onChange={(event) => change(event.target.value)}
          endAdornment={query && <Button type="button" variant="text" color="from-theme" aria-label={i18n('access.clear-search')} disabled={create.isPending} onClick={() => change('')} className="p-0.5"><Icon icon="lucide:x" className="size-4" /></Button>} />
        {canInvite && <Button type="submit" variant="outlined" color="from-theme" disabled={!query.trim() || search.isPending || create.isPending}>{i18n('access.search-email')}</Button>}
      </div>
      {canInvite && <p className="mt-2 text-xs text-foreground/60">{i18n('access.exact-email-help')}</p>}
    </form>
    {search.isPending && <AccessFeedback />}
    {recipient && (recipient.isMember ? <AccessFeedback message={i18n('access.already-member')} /> : <div className="mb-6">
      <p className="mb-3 text-xs text-foreground/60">{i18n(recipient.found ? 'access.account-found' : 'access.unregistered-email')}</p>
      <div className="flex flex-wrap items-center gap-3">
        <AccessMemberIdentity id={recipient.user?.id ?? recipient.email} name={recipient.user?.name ?? null} email={recipient.email} />
        <div className="flex w-full flex-wrap items-end gap-2 sm:w-auto">
          <Select name="roleId" aria-label={i18n('access.role')} className="w-36" options={roleOptions(available)} rules={validators.required()} disabled={create.isPending} />
          <Select name="expiresIn" aria-label={i18n('access.expiration')} className="w-32" options={expirationOptions()} disabled={create.isPending} />
          <Button type="button" variant="filled" color="purple" disabled={create.isPending || !available.some((role) => role.id === selectedId)} onClick={() => { if (!create.isPending) void form.handleSubmit((values) => create.mutate(values))() }}><Icon icon="lucide:mail" className="size-4" />{i18n('access.send-invite')}</Button>
        </div>
      </div>
      <p className="mt-2 text-xs text-foreground/60">{i18n('access.invite-accept-help')}</p>
      {!available.length && <AccessFeedback message={i18n('access.create-role-first')} />}
    </div>)}
    {(search.isError || create.isError) && <AccessFeedback error />}
    {create.isSuccess && <AccessFeedback message={i18n(create.data.notificationPending ? 'access.notification-pending' : 'access.invite-created')} />}
  </FormProvider>
}
