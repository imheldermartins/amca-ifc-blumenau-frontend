import { useMutation } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { SOFT_SELECTION_CLASSES, cn } from 'cubs-components'
import { Modal } from '@/components/Modal'
import { Typography } from '@/components/Typography'
import { i18n } from '@/lib/i18n'
import { accessService, can, canDelegate, type AccessMember, type AccessRole, type AccessScope, type ScopeAccess } from '@/services/AccessService'
import { AccessFeedback } from './AccessFeedback'

export function AccessMemberRoleDialog({ scope, id, access, member, roles, onClose, onChanged }: {
  scope: AccessScope; id: string; access: ScopeAccess; member: AccessMember; roles: AccessRole[]; onClose: () => void; onChanged: () => Promise<void>
}) {
  const form = useForm({ defaultValues: { roleId: member.roleId ?? '' } })
  const selected = form.watch('roleId')
  const available = roles.filter((role) => canDelegate(access, role.roles))
  const assign = useMutation({
    mutationFn: ({ roleId }: { roleId: string }) => {
      if (member.id === access.ownerId || !can(access, 'write', 'promote_members') || !canDelegate(access, member.permissions) || !available.some((role) => role.id === roleId)) throw new Error('Role cannot be assigned')
      return accessService.assign(scope, id, member.id, roleId)
    },
    onSuccess: async () => { await onChanged(); onClose() },
    onError: () => form.reset({ roleId: member.roleId ?? '' }),
  })
  return <Modal open size="sm" onOpenChange={(open) => { if (!open && !assign.isPending) onClose() }} accessibleTitle={i18n('access.permissions')}>
    <Typography variant="h2">{i18n('access.permissions')}</Typography>
    <p className="mt-1 mb-5 truncate text-xs text-foreground/60" title={member.email}>{member.name || member.email}{member.name && ' · ' + member.email}</p>
    <fieldset disabled={assign.isPending} className="grid gap-1"><legend className="sr-only">{i18n('access.role')}</legend>
      {available.map((role) => <label key={role.id} className={cn('flex cursor-pointer items-center justify-between gap-3 rounded-lg px-3 py-3 text-sm font-medium hover:bg-active', selected === role.id && SOFT_SELECTION_CLASSES)}>
        {role.isDefault ? i18n('access.default-role') : role.name}
        <input type="radio" value={role.id} {...form.register('roleId', { onChange: () => { if (!assign.isPending && form.getValues('roleId') !== member.roleId) void form.handleSubmit((values) => assign.mutate(values))() } })} className="accent-p-purple" />
      </label>)}
    </fieldset>
    {!available.length && <AccessFeedback message={i18n('access.create-role-first')} />}
    {assign.isPending && <AccessFeedback />}{assign.isError && <AccessFeedback error />}
  </Modal>
}
