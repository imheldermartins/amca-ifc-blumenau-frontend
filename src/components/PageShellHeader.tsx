import { Icon } from '@iconify/react'
import type { UserVisualIdentity } from '@/types/user'

import { Collaborators } from '@components/Collaborators'
import {
  PageContentViewSwitcher,
  type PageContentView,
  type PageContentViewLabels,
} from '@components/PageContentViewSwitcher'
import { PageTitleSkeleton } from '@components/PageTitleSkeleton'
import { Typography } from '@components/Typography'
import { i18n } from '@/lib/i18n'

export interface PageShellHeaderProps {
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
        className="w-full flex-1"
        aria-busy={!failed && loading && title === null}
      >
        {failed ? (
          i18n('pages.app.pagina.indisponivel')
        ) : title === null && loading ? (
          <PageTitleSkeleton />
        ) : loading ? (
          title
        ) : editable && !readOnly ? (
          <input
            value={draftTitle}
            readOnly={saving}
            aria-label={i18n('pages.app.pagina.title-label')}
            placeholder={i18n('pages.app.pagina.sem-titulo')}
            className="min-h-[1.2em] w-full border-0 bg-transparent p-0 text-inherit shadow-none outline-none ring-0 focus:border-0 focus:outline-none focus:ring-0"
            style={{ font: 'inherit' }}
            onChange={(event) => onDraftTitleChange(event.target.value)}
            onBlur={onSaveTitle}
            onKeyDown={(event) => {
              if (event.key === 'Enter') event.currentTarget.blur()
              if (event.key === 'Escape') {
                onCancelTitle(event.currentTarget === document.activeElement)
                event.currentTarget.blur()
              }
            }}
          />
        ) : title === null ? (
          <span className="block min-h-[1.2em] opacity-50">
            {i18n('pages.app.pagina.sem-titulo')}
          </span>
        ) : (
          <span className="flex items-center gap-2">
            {title}
            {readOnly && (
              <Icon
                icon="lucide:lock-keyhole"
                className="size-4 opacity-45"
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
