import { Icon } from '@iconify/react'
import { Button, Drawer } from '@/shared/cubs-components'
import { i18n } from '@/lib/i18n'
import Sidebar, { type SidebarProps } from './Sidebar'

export function MobileSidebar({ open, onOpenChange, ...sidebarProps }: Omit<SidebarProps, 'collapsed' | 'mobile' | 'onNavigate'> & {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      side="left"
      accessibleTitle={i18n('common.expandir-menu')}
      closeLabel={i18n('common.recolher-menu')}
      panelClassName="w-2/3"
      className="flex overflow-hidden p-0 pb-[env(safe-area-inset-bottom)]"
      trigger={
        <Button
          variant="text"
          color="from-theme"
          className="fixed left-3 top-2 z-30 size-11 rounded-xl border border-divider-contrast bg-background p-0 shadow-sm active:translate-y-0"
          aria-label={i18n('common.expandir-menu')}
        >
          <Icon aria-hidden="true" icon="lucide:menu" className="pointer-events-none size-5" />
        </Button>
      }
    >
      <Sidebar {...sidebarProps} collapsed={false} mobile onNavigate={() => onOpenChange(false)} />
    </Drawer>
  )
}
