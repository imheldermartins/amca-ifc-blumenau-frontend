import { Icon } from '@iconify/react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { Button, Popover, SOFT_SELECTION_CLASSES, cn } from 'cubs-components'
import { Modal } from '@/components/Modal'
import { Typography } from '@/components/Typography'
import { useAuth } from '@/contexts/AuthContext'
import { useLanguage } from '@/contexts/LanguageContext'
import { i18n } from '@/lib/i18n'
import { workspaceQueryKey, workspacesQueryKey } from '@/lib/workspaceQueryKeys'
import { accessService, can, canDelegate, rolePermission, type AccessMember, type AccessScope } from '@/services/AccessService'
import { useScopeData } from './useScopeData'
import { AccessFeedback } from './AccessFeedback'
import { AccessInviteManager } from './AccessInviteManager'
import { AccessInviteHistory } from './AccessInviteHistory'
import { AccessLinkInviteDialog } from './AccessLinkInviteDialog'
import { AccessMemberIdentity } from './AccessMemberIdentity'
import { AccessMemberRoleDialog } from './AccessMemberRoleDialog'

/** Gestão compartilhada pelas configurações dos três escopos e pela PageShell. */
export function AccessMembersPanel({ scope, id, onMembersChanged }: { scope: AccessScope; id: string; onMembersChanged?: () => void }) {
  const { key, access, roles } = useScopeData(scope, id)
  const { user } = useAuth()
  const { slug: lang } = useLanguage()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [showInvites, setShowInvites] = useState(false)
  const [linkOpen, setLinkOpen] = useState(false)
  const [roleMember, setRoleMember] = useState<AccessMember | null>(null)
  const [removeMember, setRemoveMember] = useState<AccessMember | null>(null)
  const canList = can(access.data, 'read', 'members') || ['add_members', 'promote_members', 'remove_members'].some((action) => can(access.data, 'write', action))
  const canInvite = can(access.data, 'write', 'add_members')
  const members = useQuery({ queryKey: [...key, 'members'], queryFn: () => accessService.members(scope, id), enabled: canList })
  const invites = useQuery({ queryKey: [...key, 'invites'], queryFn: () => accessService.invites(scope, id), enabled: canInvite })
  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: key })
    if (scope === 'workspace' && user) await Promise.all([
      queryClient.invalidateQueries({ queryKey: workspaceQueryKey(user.id, id) }),
      queryClient.invalidateQueries({ queryKey: workspacesQueryKey(user.id) }),
    ])
    if (scope === 'organization') await queryClient.invalidateQueries({ queryKey: ['organization', user?.id, id] })
    onMembersChanged?.()
  }
  const remove = useMutation({
    mutationFn: (member: AccessMember) => {
      if (member.id === access.data?.ownerId || !can(access.data, 'write', 'remove_members') || !canDelegate(access.data, member.permissions)) throw new Error('Member cannot be removed')
      return accessService.removeMember(scope, id, member.id)
    }, onSuccess: async () => { await refresh(); setRemoveMember(null) },
  })
  if (access.isPending) return <AccessFeedback />
  if (access.isError || !access.data || !canList) return <AccessFeedback error />
  const grant = access.data
  const ordered = [...(members.data ?? [])].sort((a, b) => Number(b.id === grant.ownerId) - Number(a.id === grant.ownerId))
  const filtered = ordered.filter((member) => member.id === grant.ownerId || (member.name + ' ' + member.email).toLowerCase().includes(search.trim().toLowerCase()))
  return <div>
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <span className="text-xs text-foreground/60">{i18n('access.collaborator-count', { count: ordered.length })}</span>
      <div className="flex flex-wrap items-center gap-1">
        {can(grant, 'write', rolePermission[scope]) && <Button variant="text" color="from-theme" onClick={() => void navigate({ href: `/${lang}/access/${scope}/${id}/roles` })}><Icon icon="lucide:shield-check" className="size-4" />{i18n('access.permissions')}</Button>}
        <Button variant="text" color="from-theme" onClick={() => void navigate({ href: `/${lang}/access/${scope}/${id}/requests` })}>{i18n('access.requests')}</Button>
        {canInvite && <>
          <Button variant="text" color="from-theme" disabled={roles.isPending || roles.isError} onClick={() => setLinkOpen(true)}><Icon icon="lucide:link" className="size-4" />{i18n('access.invite-by-link')}</Button>
          <Button variant="text" color="from-theme" aria-expanded={showInvites} onClick={() => setShowInvites(!showInvites)} className={cn(showInvites && SOFT_SELECTION_CLASSES)}><Icon icon="lucide:mail" className="size-4" />{i18n('access.invites')}{!!invites.data?.filter((invite) => invite.status === 'pending').length && <span className="rounded bg-p-purple/10 px-1.5 text-xs text-p-purple">{invites.data.filter((invite) => invite.status === 'pending').length}</span>}</Button>
        </>}
      </div>
    </div>
    <div className={cn('grid min-w-0 gap-6', showInvites && canInvite && 'lg:grid-cols-[minmax(0,1fr)_16rem]')}>
      <div className="min-w-0">
        <AccessInviteManager scope={scope} id={id} access={grant} roles={roles.data ?? []} onSearchChange={setSearch} onInvited={async () => { await queryClient.invalidateQueries({ queryKey: [...key, 'invites'] }); setShowInvites(true) }} />
        {roles.isError && canInvite && <AccessFeedback error />}
        {members.isPending ? <AccessFeedback /> : members.isError ? <AccessFeedback error /> : <>
          <ul aria-label={i18n('access.members')} className="space-y-1">
            {filtered.map((member) => {
              const owner = member.id === grant.ownerId
              const manageable = !owner && canDelegate(grant, member.permissions)
              const promotable = manageable && can(grant, 'write', 'promote_members')
              const removable = manageable && can(grant, 'write', 'remove_members')
              return <li key={member.id} className="flex flex-wrap items-center gap-3 py-3">
                <AccessMemberIdentity {...member} current={member.id === user?.id} />
                {owner ? <span className="flex items-center gap-1 text-xs text-foreground/60"><Icon icon="lucide:shield-check" className="size-3.5" />{i18n('access.owner')}</span> : <div className="flex items-center gap-1">
                  {promotable ? <Button variant="text" color="from-theme" aria-label={i18n('access.member-permissions', { name: member.name || member.email })} disabled={roles.isPending || roles.isError} onClick={() => setRoleMember(member)}>{member.roleName || i18n('access.no-role')}<Icon icon="lucide:chevron-down" className="size-3.5" /></Button> : <span className="text-xs text-foreground/60">{member.roleName || i18n('access.no-role')}</span>}
                  {removable && <Popover align="end" className="p-1" trigger={<Button variant="text" color="from-theme" aria-label={i18n('access.member-actions', { name: member.name || member.email })} className="p-1.5"><Icon icon="lucide:ellipsis" className="size-4" /></Button>}>
                    <Button variant="text" color="red" onClick={() => { remove.reset(); setRemoveMember(member) }}><Icon icon="lucide:user-minus" className="size-4" />{i18n('access.remove-collaborator')}</Button>
                  </Popover>}
                </div>}
              </li>
            })}
          </ul>
          {!filtered.length && <AccessFeedback message={i18n('access.empty-search')} />}
        </>}
      </div>
      {showInvites && canInvite && <AccessInviteHistory scope={scope} id={id} invites={invites.data ?? []} loading={invites.isPending} failed={invites.isError} onClose={() => setShowInvites(false)} onChanged={async () => { await queryClient.invalidateQueries({ queryKey: [...key, 'invites'] }) }} />}
    </div>
    {linkOpen && canInvite && <AccessLinkInviteDialog scope={scope} id={id} access={grant} roles={roles.data ?? []} onClose={() => setLinkOpen(false)} onInvited={async () => { await queryClient.invalidateQueries({ queryKey: [...key, 'invites'] }); setShowInvites(true) }} />}
    {roleMember && <AccessMemberRoleDialog scope={scope} id={id} access={grant} member={roleMember} roles={roles.data ?? []} onClose={() => setRoleMember(null)} onChanged={refresh} />}
    {removeMember && <Modal open size="sm" onOpenChange={(open) => { if (!open && !remove.isPending) setRemoveMember(null) }} accessibleTitle={i18n('access.remove-collaborator')}>
      <Typography variant="h2">{i18n('access.remove-collaborator')}</Typography>
      <p className="my-4 text-sm text-foreground/60">{i18n('access.remove-confirmation', { name: removeMember.name || removeMember.email })}</p>
      <div className="flex justify-end gap-2"><Button variant="text" color="from-theme" disabled={remove.isPending} onClick={() => setRemoveMember(null)}>{i18n('access.cancel')}</Button><Button variant="filled" color="red" disabled={remove.isPending} onClick={() => { if (!remove.isPending) remove.mutate(removeMember) }}>{i18n('access.remove-collaborator')}</Button></div>
      {remove.isError && <AccessFeedback error />}
    </Modal>}
  </div>
}
