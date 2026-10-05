import { Button, cn, SOFT_SELECTION_CLASSES } from 'cubs-components'

import { AccessMembersPanel } from '@/pages/access/AccessMembersPanel'
import { Modal } from '@components/Modal'
import { Typography } from '@components/Typography'
import { PageTitleSkeleton } from '@components/PageTitleSkeleton'
import { i18n } from '@/lib/i18n'

export type PageSettingsFragment = '#general' | '#collaborators'

export interface PageSettingsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  fragment: PageSettingsFragment
  onFragmentChange: (fragment: PageSettingsFragment) => void
  pageId?: string
  pageTitle: string | null
  onMembersChanged?: () => void
}

const SECTIONS: Array<{ fragment: PageSettingsFragment; labelKey: string }> = [
  { fragment: '#general', labelKey: 'pages.app.page-settings.general' },
  { fragment: '#collaborators', labelKey: 'pages.app.page-settings.collaborators' },
]

/** Configurações locais da página, deep-linkadas por fragmento. */
export function PageSettingsModal({
  open,
  onOpenChange,
  fragment,
  onFragmentChange,
  pageId,
  pageTitle,
  onMembersChanged,
}: PageSettingsModalProps) {
  const activeSection = SECTIONS.find((section) => section.fragment === fragment) ?? SECTIONS[0]

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      size="xl"
      accessibleTitle={i18n('pages.app.page-settings.title')}
      className="p-0"
    >
      <div id="page-settings-dialog" className="grid min-h-80 grid-cols-1 sm:grid-cols-[10rem_minmax(0,1fr)]">
        <nav
          role="tablist"
          aria-label={i18n('pages.app.page-settings.navigation')}
          className="flex flex-col gap-1 p-3"
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
                  selected && SOFT_SELECTION_CLASSES,
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
                <dd className="mt-1 wrap-break-word font-medium">
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

          {activeSection.fragment === '#collaborators' && pageId && (
            <div className="mt-5 pb-4">
              <AccessMembersPanel key={pageId} scope="page" id={pageId} onMembersChanged={onMembersChanged} />
            </div>
          )}
        </section>
      </div>
    </Modal>
  )
}
