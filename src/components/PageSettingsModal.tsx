import { Button, cn } from 'cubs-components'

import { Avatar } from '@components/Avatar'
import { Modal } from '@components/Modal'
import { Typography } from '@components/Typography'
import { PageTitleSkeleton } from '@components/PageTitleSkeleton'
import { i18n } from '@/lib/i18n'
import type { UserVisualIdentity } from '@/types/user'

export type PageSettingsFragment = '#general' | '#collaborators'

export interface PageSettingsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  fragment: PageSettingsFragment
  onFragmentChange: (fragment: PageSettingsFragment) => void
  pageId?: string
  pageTitle: string | null
  currentUser: UserVisualIdentity | null
  /** Somente os vínculos; o usuário atual é exibido separadamente. */
  collaborators: readonly UserVisualIdentity[]
  loading: boolean
  failed: boolean
}

const SECTIONS: Array<{ fragment: PageSettingsFragment; labelKey: string }> = [
  { fragment: '#general', labelKey: 'pages.app.page-settings.general' },
  { fragment: '#collaborators', labelKey: 'pages.app.page-settings.collaborators' },
]

function IdentityRow({ user, current = false }: { user: UserVisualIdentity; current?: boolean }) {
  return (
    <li className="flex items-center gap-3 rounded-lg border border-divider p-2.5">
      <Avatar
        slug={user.slug}
        color={user.color}
        label={user.name ?? user.email}
        active={current}
      />
      <div className="min-w-0 flex-1">
        <Typography variant="body" as="p" className="truncate font-semibold">
          {user.name ?? user.email}
          {current && (
            <span className="ml-1.5 text-xs font-normal text-muted-foreground">
              {i18n('pages.app.page-settings.you')}
            </span>
          )}
        </Typography>
        {user.name && (
          <Typography variant="caption" as="p" className="truncate">
            {user.email}
          </Typography>
        )}
      </div>
    </li>
  )
}

/** Configurações locais da página, deep-linkadas por fragmento. */
export function PageSettingsModal({
  open,
  onOpenChange,
  fragment,
  onFragmentChange,
  pageId,
  pageTitle,
  currentUser,
  collaborators,
  loading,
  failed,
}: PageSettingsModalProps) {
  const activeSection = SECTIONS.find((section) => section.fragment === fragment) ?? SECTIONS[0]

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      accessibleTitle={i18n('pages.app.page-settings.title')}
      className="p-0"
    >
      <div id="page-settings-dialog" className="grid min-h-80 grid-cols-[10rem_minmax(0,1fr)]">
        <nav
          role="tablist"
          aria-label={i18n('pages.app.page-settings.navigation')}
          className="flex flex-col gap-1 border-r border-divider p-3"
        >
          {SECTIONS.map((section) => {
            const selected = section.fragment === activeSection.fragment
            const slug = section.fragment.slice(1)
            return (
              <Button
                key={section.fragment}
                id={`page-settings-tab-${slug}`}
                role="tab"
                aria-selected={selected}
                aria-controls={`page-settings-panel-${slug}`}
                variant="text"
                color="from-theme"
                className={cn(
                  'w-full justify-start px-2 py-1.5 font-medium',
                  selected && 'bg-active text-foreground',
                )}
                onClick={() => onFragmentChange(section.fragment)}
              >
                {i18n(section.labelKey)}
              </Button>
            )
          })}
        </nav>

        <section
          id={`page-settings-panel-${activeSection.fragment.slice(1)}`}
          role="tabpanel"
          aria-labelledby={`page-settings-tab-${activeSection.fragment.slice(1)}`}
          className="min-w-0 p-5"
        >
          <Typography variant="h2">{i18n(activeSection.labelKey)}</Typography>

          {activeSection.fragment === '#general' && (
            <dl className="mt-5 grid gap-4 text-sm">
              <div>
                <dt className="text-muted-foreground">
                  {i18n('pages.app.page-settings.page-name')}
                </dt>
                <dd className="mt-1 break-words font-medium">
                  {pageTitle ? pageTitle : <PageTitleSkeleton />}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">
                  {i18n('pages.app.page-settings.page-id')}
                </dt>
                <dd className="mt-1 break-all font-mono text-xs">{pageId ?? '—'}</dd>
              </div>
            </dl>
          )}

          {activeSection.fragment === '#collaborators' && (
            <div className="mt-5 grid gap-5">
              {currentUser && (
                <section aria-labelledby="page-settings-current-user">
                  <Typography
                    id="page-settings-current-user"
                    variant="caption"
                    as="h3"
                    className="mb-2"
                  >
                    {i18n('pages.app.page-settings.current-user')}
                  </Typography>
                  <ul>
                    <IdentityRow user={currentUser} current />
                  </ul>
                </section>
              )}

              <section aria-labelledby="page-settings-access-list">
                <Typography
                  id="page-settings-access-list"
                  variant="caption"
                  as="h3"
                  className="mb-2"
                >
                  {i18n('pages.app.page-settings.people-with-access')}
                </Typography>

                {loading ? (
                  <p role="status" className="text-sm text-muted-foreground">
                    {i18n('common.carregando')}
                  </p>
                ) : failed ? (
                  <p role="alert" className="text-sm text-p-red">
                    {i18n('pages.app.page-settings.collaborators-error')}
                  </p>
                ) : collaborators.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {i18n('pages.app.page-settings.collaborators-empty')}
                  </p>
                ) : (
                  <ul className="grid gap-2">
                    {collaborators.map((collaborator) => (
                      <IdentityRow key={collaborator.id} user={collaborator} />
                    ))}
                  </ul>
                )}
              </section>
            </div>
          )}
        </section>
      </div>
    </Modal>
  )
}
