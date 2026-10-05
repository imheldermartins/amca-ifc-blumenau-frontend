import { Avatar } from '@/components/Avatar'
import { Typography } from '@/components/Typography'
import { assignUserVisualIdentities } from '@/lib/userVisualIdentity'
import { i18n } from '@/lib/i18n'

export function AccessMemberIdentity({ id, name, email, current = false }: { id: string; name: string | null; email: string; current?: boolean }) {
  const avatar = assignUserVisualIdentities([{ id, name, email }])[0]
  return <div className="flex min-w-0 flex-1 items-center gap-3">
    <Avatar slug={avatar.slug} color={avatar.color} label={name || email} className="size-8 shrink-0 ring-0" />
    <div className="min-w-0">
      <Typography variant="subtitle" as="p" className="truncate text-sm">{name || email}{current && <span className="ml-1 text-xs font-normal text-foreground/60">{i18n('pages.app.page-settings.you')}</span>}</Typography>
      <Typography variant="caption" as="p" className="truncate text-foreground/60" title={email}>{email}</Typography>
    </div>
  </div>
}
