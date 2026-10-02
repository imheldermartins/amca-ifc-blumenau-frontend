import type { ReactNode } from 'react'
import { Icon } from '@iconify/react'

import type { PageContentView } from '@components/PageContentViewSwitcher'
import { Typography } from '@components/Typography'
import { i18n } from '@/lib/i18n'

export type PageContentSlots = Partial<Record<PageContentView, ReactNode>>

export interface PageShellContentProps {
  view: PageContentView
  loading: boolean
  slots?: PageContentSlots
}

function PageContentPlaceholder({ view }: { view: Exclude<PageContentView, 'files'> }) {
  const icon = view === 'document' ? 'lucide:file-text' : 'lucide:workflow'

  return (
    <section
      id={`page-content-${view}`}
      role="tabpanel"
      aria-labelledby={`page-content-tab-${view}`}
      className="flex min-h-72 flex-col items-center justify-center rounded-2xl border border-dashed border-divider bg-contrast/40 px-6 text-center"
    >
      <span className="mb-3 rounded-xl bg-active p-3 text-dark-100 dark:text-light-900">
        <Icon icon={icon} fontSize={28} aria-hidden="true" />
      </span>
      <Typography variant="h3">
        {i18n(`pages.app.pagina.views.${view}.title`)}
      </Typography>
      <Typography variant="subtitle" className="mt-1 max-w-md">
        {i18n(`pages.app.pagina.views.${view}.description`)}
      </Typography>
    </section>
  )
}

function PageContentSkeleton({ view }: { view: PageContentView }) {
  return (
    <div
      id={`page-content-${view}`}
      role="tabpanel"
      aria-labelledby={`page-content-tab-${view}`}
      aria-busy="true"
      data-page-content-skeleton
      className="relative w-full pb-6"
    >
      <div aria-hidden="true" className="w-full space-y-3">
        <div className="h-8 w-48 max-w-full animate-pulse rounded-lg bg-active" />
        <div className="h-10 w-full animate-pulse rounded-xl bg-active" />
        <div className="overflow-hidden rounded-xl border border-divider">
          {[0, 1, 2, 3].map((row) => (
            <div
              key={row}
              className="flex h-10 w-full items-center border-b border-divider px-3 last:border-b-0"
            >
              <span className="block h-3 w-full animate-pulse rounded bg-active" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/**
 * Ponto único de montagem dos conteúdos de uma página. O shell conhece apenas
 * a tab ativa; cada recurso injeta seu renderer por slot e continua dono de
 * seu estado, carregamento e efeitos.
 */
export function PageShellContent({ view, loading, slots }: PageShellContentProps) {
  if (loading) return <PageContentSkeleton view={view} />

  const content = slots?.[view]
  if (content !== undefined && content !== null) {
    return (
      <div
        id={`page-content-${view}`}
        role="tabpanel"
        aria-labelledby={`page-content-tab-${view}`}
      >
        {content}
      </div>
    )
  }

  if (view !== 'files') return <PageContentPlaceholder view={view} />

  return (
    <div
      id="page-content-files"
      role="tabpanel"
      aria-labelledby="page-content-tab-files"
    />
  )
}
