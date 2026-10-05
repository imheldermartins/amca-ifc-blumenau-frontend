import { Icon } from '@iconify/react'
import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { Button, SOFT_SELECTION_CLASSES, cn } from 'cubs-components'
import { Typography } from '@/components/Typography'
import { i18n } from '@/lib/i18n'
import { accessService, type AccessInvite, type AccessScope } from '@/services/AccessService'
import { AccessFeedback } from './AccessFeedback'

export function AccessInviteHistory({ scope, id, invites, loading, failed, onChanged, onClose }: {
  scope: AccessScope; id: string; invites: AccessInvite[]; loading: boolean; failed: boolean; onChanged: () => Promise<void>; onClose: () => void
}) {
  const [filter, setFilter] = useState('pending')
  const expire = useMutation({ mutationFn: (inviteId: string) => accessService.removeInvite(scope, id, inviteId), onSuccess: onChanged })
  const visible = invites.filter((invite) => filter === 'all' || invite.status === filter)
  return <aside aria-label={i18n('access.invites')} className="min-w-0 border-t border-divider pt-5 lg:border-t-0 lg:border-l lg:pl-5 lg:pt-0">
    <div className="mb-3 flex items-center justify-between"><Typography variant="h3">{i18n('access.invites')}</Typography><Button variant="text" color="from-theme" aria-label={i18n('common.fechar')} onClick={onClose} className="p-1"><Icon icon="lucide:x" className="size-4" /></Button></div>
    <div role="group" aria-label={i18n('access.invite-status')} className="mb-4 flex flex-wrap gap-1">
      {['pending', 'accepted', 'all'].map((status) => <Button key={status} variant="text" color="from-theme" aria-pressed={filter === status} onClick={() => setFilter(status)} className={cn('px-2 py-1 text-xs', filter === status && SOFT_SELECTION_CLASSES)}>{i18n(status === 'all' ? 'access.all-invites' : 'access.status.' + status)}</Button>)}
    </div>
    {loading ? <AccessFeedback /> : failed ? <AccessFeedback error /> : <>
      <ul className="space-y-5">{visible.map((invite) => <li key={invite.id} className="min-w-0">
        <Typography variant="subtitle" as="p" className="truncate text-sm" title={invite.recipientEmail ?? undefined}>{invite.recipientEmail ?? i18n('access.generic-link')}</Typography>
        <p className="mt-1 text-xs text-foreground/60">{invite.roleName} · {i18n('access.status.' + invite.status)}</p>
        <p className="mt-1 text-xs text-foreground/60">{i18n('access.acceptance-count', { count: invite.acceptanceCount, limit: invite.acceptanceLimit ?? '∞' })}</p>
        {invite.expiresAt && <p className="mt-1 text-xs text-foreground/60">{i18n('access.expires-at', { date: new Date(invite.expiresAt).toLocaleString('pt-BR') })}</p>}
        {invite.status === 'pending' && <Button variant="text" color="red" disabled={expire.isPending} onClick={() => expire.mutate(invite.id)} className="mt-1 px-0 text-xs">{i18n('access.expire-link')}</Button>}
      </li>)}</ul>
      {!visible.length && <AccessFeedback message={i18n('access.empty-invites')} />}
    </>}
    {expire.isError && <AccessFeedback error />}
  </aside>
}
