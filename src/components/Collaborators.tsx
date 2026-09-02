import { Icon } from '@iconify/react'
import { Button, cn } from 'cubs-components'

import { Avatar } from '@components/Avatar'
import { i18n } from '@/lib/i18n'
import type { UserVisualIdentity } from '@/types/user'

const MAX_VISIBLE_PARTICIPANTS = 3

export interface CollaboratorsProps {
  /** Audiência já projetada pelo frontend, com o usuário atual primeiro. */
  participants: readonly UserVisualIdentity[]
  currentUserId?: string
  /** Contagem de sockets na room; não altera a lista de acesso. */
  viewers: number
  loading?: boolean
  settingsOpen: boolean
  onOpenSettings: () => void
}

/**
 * Pilha de identidades e trigger das configurações da página.
 *
 * `participants` representa acesso persistido; `viewers` representa presença
 * efêmera. Os dois valores ficam deliberadamente separados.
 */
export function Collaborators({
  participants,
  currentUserId,
  viewers,
  loading = false,
  settingsOpen,
  onOpenSettings,
}: CollaboratorsProps) {
  const visibleParticipants = participants.slice(0, MAX_VISIBLE_PARTICIPANTS)
  const hiddenCount = participants.length - visibleParticipants.length

  return (
    <Button
      variant="text"
      color="from-theme"
      className="flex items-center gap-0 p-0 hover:bg-transparent"
      aria-label={i18n('pages.app.page-settings.open-collaborators', {
        count: participants.length,
      })}
      aria-haspopup="dialog"
      aria-expanded={settingsOpen}
      aria-controls="page-settings-dialog"
      aria-busy={loading}
      data-viewers={viewers}
      data-participants={participants.length}
      title={i18n('pages.app.page-settings.active-connections', { count: viewers })}
      onClick={onOpenSettings}
    >
      {participants.length === 0 ? (
        <Icon icon="lucide:users" fontSize={20} />
      ) : (
        <>
          {visibleParticipants.map((participant, index) => (
            <Avatar
              key={participant.id}
              slug={participant.slug}
              color={participant.color}
              label={participant.name ?? participant.email}
              active={participant.id === currentUserId}
              className={cn(index !== 0 && '-ml-1')}
            />
          ))}
          {hiddenCount > 0 && (
            <span
              aria-hidden="true"
              className="-ml-1 flex h-7 w-7 items-center justify-center rounded-full bg-contrast text-xs font-semibold ring-4 ring-background"
            >
              +{hiddenCount}
            </span>
          )}
        </>
      )}
    </Button>
  )
}
