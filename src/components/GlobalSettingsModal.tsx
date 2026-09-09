import { Button, cn } from 'cubs-components'

import { Modal } from '@components/Modal'
import { Typography } from '@components/Typography'
import { i18n } from '@/lib/i18n'

export type GlobalSettingsFragment = '#profile' | '#settings'

export interface GlobalSettingsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  fragment: GlobalSettingsFragment
  onFragmentChange: (fragment: GlobalSettingsFragment) => void
}

const SECTIONS: Array<{
  fragment: GlobalSettingsFragment
  labelKey: string
}> = [
  { fragment: '#profile', labelKey: 'pages.app.global-settings.profile' },
  { fragment: '#settings', labelKey: 'pages.app.global-settings.settings' },
]

/**
 * Modal única das configurações globais. O fragmento é controlado pelo caller
 * para que qualquer gatilho do app possa abri-la diretamente na seção certa.
 */
export function GlobalSettingsModal({
  open,
  onOpenChange,
  fragment,
  onFragmentChange,
}: GlobalSettingsModalProps) {
  const activeSection = SECTIONS.find((section) => section.fragment === fragment) ?? SECTIONS[0]

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      size="xl"
      accessibleTitle={i18n('pages.app.global-settings.title')}
      className="p-0"
    >
      <div className="grid min-h-80 grid-cols-[10rem_minmax(0,1fr)]">
        <nav
          role="tablist"
          aria-label={i18n('pages.app.global-settings.navigation')}
          className="flex flex-col gap-1 border-r border-divider p-3"
        >
          {SECTIONS.map((section) => {
            const selected = section.fragment === activeSection.fragment

            return (
              <Button
                key={section.fragment}
                id={`global-settings-tab-${section.fragment.slice(1)}`}
                role="tab"
                aria-selected={selected}
                aria-controls={`global-settings-panel-${section.fragment.slice(1)}`}
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
          id={`global-settings-panel-${activeSection.fragment.slice(1)}`}
          role="tabpanel"
          aria-labelledby={`global-settings-tab-${activeSection.fragment.slice(1)}`}
          className="min-w-0 p-5"
        >
          <Typography variant="h2">{i18n(activeSection.labelKey)}</Typography>
        </section>
      </div>
    </Modal>
  )
}
