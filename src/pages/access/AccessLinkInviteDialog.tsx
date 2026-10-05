import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { FormProvider, useForm } from 'react-hook-form'
import { Button, Select, TextField } from 'cubs-components'
import { Modal } from '@/components/Modal'
import { Typography } from '@/components/Typography'
import { i18n } from '@/lib/i18n'
import { validators } from '@/lib/validators'
import { accessService, can, canDelegate, type AccessRole, type AccessScope, type ScopeAccess } from '@/services/AccessService'
import { AccessFeedback } from './AccessFeedback'
import { expirationOptions, roleOptions } from './accessInviteOptions'

interface LinkValues { roleId: string; expiresIn: '24h' | '7d' | 'never'; limitMode: string; customLimit: string }
export function AccessLinkInviteDialog({ scope, id, access, roles, onClose, onInvited }: {
  scope: AccessScope; id: string; access: ScopeAccess; roles: AccessRole[]; onClose: () => void; onInvited: () => Promise<void>
}) {
  const available = roles.filter((role) => canDelegate(access, role.roles))
  const form = useForm<LinkValues>({ defaultValues: { roleId: available.find((role) => role.isDefault)?.id ?? available[0]?.id ?? '', expiresIn: '24h', limitMode: 'one', customLimit: '2' } })
  const [copy, setCopy] = useState<'idle' | 'copied' | 'error'>('idle')
  const create = useMutation({
    mutationFn: (values: LinkValues) => {
      if (!can(access, 'write', 'add_members') || !available.some((role) => role.id === values.roleId)) throw new Error('Role cannot be delegated')
      return accessService.createInvite(scope, id, { recipientEmail: null, roleId: values.roleId, expiresIn: values.expiresIn, acceptanceLimit: values.limitMode === 'unlimited' ? null : values.limitMode === 'custom' ? Number(values.customLimit) : 1 })
    }, onSuccess: onInvited,
  })
  return <Modal open size="sm" onOpenChange={(open) => { if (!open && !create.isPending) onClose() }} accessibleTitle={i18n('access.invite-by-link')}>
    <Typography variant="h2" className="mb-5">{i18n('access.invite-by-link')}</Typography>
    {create.data?.inviteUrl ? <div className="grid gap-3">
      <TextField value={create.data.inviteUrl} readOnly aria-label={i18n('access.generic-link')} />
      <Button variant="filled" color="purple" onClick={async () => { try { await navigator.clipboard.writeText(create.data!.inviteUrl!); setCopy('copied') } catch { setCopy('error') } }}>{i18n('access.copy-link')}</Button>
      {copy === 'copied' && <AccessFeedback message={i18n('access.link-copied')} />}{copy === 'error' && <AccessFeedback error />}
    </div> : <FormProvider {...form}><form className="grid gap-4" onSubmit={form.handleSubmit((values) => { if (!create.isPending) create.mutate(values) })}>
      <Select name="roleId" label={i18n('access.role')} options={roleOptions(available)} rules={validators.required()} disabled={create.isPending} />
      <Select name="expiresIn" label={i18n('access.expiration')} options={expirationOptions()} disabled={create.isPending} />
      <Select name="limitMode" label={i18n('access.acceptance-limit')} options={[{ value: 'one', label: '1' }, { value: 'unlimited', label: i18n('access.unlimited') }, { value: 'custom', label: i18n('access.custom') }]} disabled={create.isPending} />
      {form.watch('limitMode') === 'custom' && <TextField name="customLimit" type="number" label={i18n('access.custom-limit')} min={1} max={100000} disabled={create.isPending} rules={{ ...validators.required(), min: 1, max: 100000, validate: (value) => Number.isInteger(Number(value)) }} />}
      {!available.length && <AccessFeedback message={i18n('access.create-role-first')} />}
      <Button type="submit" variant="filled" color="purple" disabled={create.isPending || !available.length}>{i18n('access.create-link')}</Button>
      {create.isError && <AccessFeedback error />}
    </form></FormProvider>}
  </Modal>
}
