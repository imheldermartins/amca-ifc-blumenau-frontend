import { Icon } from '@iconify/react'
import { Button, cn } from 'cubs-components'

export type PageContentView = 'files' | 'document' | 'workflow'

export interface PageContentViewLabels {
  navigation: string
  files: string
  document: string
  workflow: string
}

export interface PageContentViewSwitcherProps {
  value: PageContentView
  onValueChange: (value: PageContentView) => void
  labels: PageContentViewLabels
}

const VIEWS: ReadonlyArray<{ id: PageContentView; icon: string }> = [
  { id: 'files', icon: 'lucide:files' },
  { id: 'document', icon: 'lucide:file-text' },
  { id: 'workflow', icon: 'lucide:workflow' },
]

/** Alterna somente o conteúdo da página; o PageShell permanece montado. */
export function PageContentViewSwitcher({
  value,
  onValueChange,
  labels,
}: PageContentViewSwitcherProps) {
  return (
    <div
      role="tablist"
      aria-label={labels.navigation}
      className="flex items-center gap-1 rounded-xl bg-contrast p-1.5"
    >
      {VIEWS.map((view) => {
        const active = value === view.id
        return (
          <Button
            key={view.id}
            variant="text"
            color="from-theme"
            role="tab"
            aria-selected={active}
            aria-controls={`page-content-${view.id}`}
            id={`page-content-tab-${view.id}`}
            title={labels[view.id]}
            className={cn(
              'h-7 w-7 rounded-lg p-1 hover:bg-active focus-visible:bg-active',
              active && 'bg-active',
            )}
            onClick={() => onValueChange(view.id)}
          >
            <Icon icon={view.icon} fontSize={20} aria-hidden="true" />
            <span className="sr-only">{labels[view.id]}</span>
          </Button>
        )
      })}
    </div>
  )
}
