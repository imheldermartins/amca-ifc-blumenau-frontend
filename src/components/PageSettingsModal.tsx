import { useState } from 'react'
import { Icon } from '@iconify/react'
import { Button, cn, SOFT_SELECTION_CLASSES } from 'cubs-components'

import { AccessMembersPanel } from '@/pages/access/AccessMembersPanel'
import { Typography } from '@components/Typography'
import { PageTitleSkeleton } from '@components/PageTitleSkeleton'
import { i18n } from '@/lib/i18n'

export type PageSettingsFragment = '#general' | '#collaborators'

export interface PageSettingsContentProps {
  initialFragment: PageSettingsFragment
  onFragmentChange?: (fragment: PageSettingsFragment) => void
  pageId?: string
  pageTitle: string | null
  onMembersChanged?: () => void
  showCollaborators?: boolean
  pdfAction?: { label: string; onSelect: () => void }
}

const SECTIONS: Array<{ fragment: PageSettingsFragment; labelKey: string }> = [
  { fragment: '#general', labelKey: 'pages.app.page-settings.general' },
  { fragment: '#collaborators', labelKey: 'pages.app.page-settings.collaborators' },
]

/** Configurações locais da página, deep-linkadas por fragmento. */
export function PageSettingsContent({
  initialFragment,
  onFragmentChange,
  pageId,
  pageTitle,
  onMembersChanged,
  showCollaborators = true,
  pdfAction,
}: PageSettingsContentProps) {
  const [fragment, setFragment] = useState(initialFragment)
  const sections = SECTIONS.filter((section) => showCollaborators || section.fragment !== '#collaborators')
  const activeSection = sections.find((section) => section.fragment === fragment) ?? sections[0]

  return (
    <>
      <div id="page-settings-dialog" className="grid min-h-80 grid-cols-1 sm:grid-cols-[10rem_minmax(0,1fr)]">
        <nav className="flex flex-col gap-1 p-3" aria-label={i18n('pages.app.page-settings.navigation')}>
          <div role="tablist" aria-label={i18n('pages.app.page-settings.navigation')} className="flex flex-col gap-1">
            {sections.map((section) => {
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
                  onClick={() => {
                    setFragment(section.fragment)
                    onFragmentChange?.(section.fragment)
                  }}
                >
                  {i18n(section.labelKey)}
                </Button>
              )
            })}
          </div>
          {pdfAction && (
            <Button
              type="button"
              variant="text"
              color="from-theme"
              className="mt-3 w-full justify-start gap-2 px-2 py-1.5 font-medium"
              onClick={pdfAction.onSelect}
            >
              <Icon icon="lucide:download" aria-hidden="true" className="size-4 shrink-0" />
              {pdfAction.label}
            </Button>
          )}
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
    </>
  )
}
