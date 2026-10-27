import { Icon } from '@iconify/react'
import type { UserVisualIdentity } from '@/types/user'
import type { ReactNode } from 'react'

import { Collaborators } from '@components/Collaborators'
import {
  PageContentViewSwitcher,
  type PageContentView,
  type PageContentViewLabels,
} from '@components/PageContentViewSwitcher'
import { PageTitleSkeleton } from '@components/PageTitleSkeleton'
import { Typography } from '@components/Typography'
import { i18n } from '@/lib/i18n'
import { displayMentionText, type MentionInputConfig } from 'cubs-components'
import {PageTitleInput} from './PageTitleInput'

export interface PageShellHeaderProps {
  mentions?: MentionInputConfig
  actions?: ReactNode
  title: string | null
  draftTitle: string
  loading: boolean
  failed: boolean
  editable: boolean
  readOnly: boolean
  saving: boolean
  saveFailed: boolean
  activityLabel: string | null
  activityAt: string | null
  contentView: PageContentView
  contentViewLabels: PageContentViewLabels
  participants: readonly UserVisualIdentity[]
  currentUserId?: string
  viewers: number
  collaboratorsLoading: boolean
  settingsOpen: boolean
  onDraftTitleChange: (title: string) => void
  onSaveTitle: () => void
  onCancelTitle: (cancelBlur: boolean) => void
  onContentViewChange: (view: PageContentView) => void
  onOpenCollaborators?: () => void
}

/** Cabeçalho visual da página; não busca dados nem conhece serviços. */
export function PageShellHeader({
  mentions,
  actions,
  title,
  draftTitle,
  loading,
  failed,
  editable,
  readOnly,
  saving,
  saveFailed,
  activityLabel,
  activityAt,
  contentView,
  contentViewLabels,
  participants,
  currentUserId,
  viewers,
  collaboratorsLoading,
  settingsOpen,
  onDraftTitleChange,
  onSaveTitle,
  onCancelTitle,
  onContentViewChange,
  onOpenCollaborators,
}: PageShellHeaderProps) {
  return (
    <header className="mb-8 flex flex-col-reverse">
      <Typography
        variant="h1"
        className="min-w-0 w-full flex-1 break-words [overflow-wrap:anywhere]"
        aria-busy={!failed && loading && title === null}
      >
        {failed ? (
          i18n('pages.app.pagina.indisponivel')
        ) : title === null && loading ? (
          <PageTitleSkeleton />
        ) : loading ? (
          title
        ) : editable && !readOnly ? (
          <PageTitleInput
            mentions={mentions}
            value={draftTitle}
            readOnly={saving}
            onValueChange={onDraftTitleChange}
            onBlur={onSaveTitle}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
                event.preventDefault()
                event.currentTarget.blur()
              }
              if (event.key === 'Escape') {
                onCancelTitle(event.currentTarget === document.activeElement)
                event.currentTarget.blur()
              }
            }}
          />
        ) : title === null ? (
          <span className="block min-h-[1.2em] min-w-0 w-full whitespace-pre-wrap break-words opacity-50">
            {i18n('pages.app.pagina.sem-titulo')}
          </span>
        ) : (
          <span className="flex min-h-[1.2em] min-w-0 w-full items-center gap-2">
            <span className="min-w-0 whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{displayMentionText(title, mentions?.resolve, mentions?.unavailable)}</span>
            {readOnly && (
              <Icon
                icon="lucide:lock-keyhole"
                className="size-4 shrink-0 opacity-45"
                aria-label={i18n('pages.app.pagina.title-locked')}
              />
            )}
          </span>
        )}
      </Typography>
      {saveFailed && (
        <Typography variant="caption" as="p" role="alert" className="text-p-red">
          {i18n('pages.app.pagina.title-save-error')}
        </Typography>
      )}
      <div className="flex items-center justify-between">
        {activityLabel ? (
          <time dateTime={activityAt ?? undefined} className="text-sm text-dark-100 dark:text-light-900">
            {activityLabel}
          </time>
        ) : (
          <span aria-hidden="true" />
        )}
        <div className="flex items-center gap-3">
          {actions}
          <PageContentViewSwitcher
            value={contentView}
            onValueChange={onContentViewChange}
            labels={contentViewLabels}
          />
          <Collaborators
            participants={participants}
            currentUserId={currentUserId}
            viewers={viewers}
            loading={collaboratorsLoading}
            settingsOpen={settingsOpen}
            onOpenSettings={onOpenCollaborators}
          />
        </div>
      </div>
    </header>
  )
}
