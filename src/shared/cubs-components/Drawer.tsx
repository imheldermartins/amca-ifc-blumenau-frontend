import type { ReactNode } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { Icon } from '@iconify/react'

import { Button } from './Button'
import { cn } from './lib/utils'

export interface DrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  accessibleTitle: string
  closeLabel: string
  className?: string
  panelClassName?: string
  side?: 'left' | 'right'
  trigger?: ReactNode
  children: ReactNode
}

/** Drawer lateral controlada, com portal, foco preso e largura personalizável. */
export function Drawer({
  open,
  onOpenChange,
  accessibleTitle,
  closeLabel,
  className,
  panelClassName,
  side = 'right',
  trigger,
  children,
}: DrawerProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      {trigger && <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>}
      <Dialog.Portal>
        <Dialog.Overlay
          className={cn(
            'fixed inset-0 z-50 bg-dark-900/50 backdrop-blur-sm',
            'data-[state=open]:animate-in data-[state=open]:fade-in-0',
            'data-[state=closed]:animate-out data-[state=closed]:fade-out-0',
          )}
        />
        <Dialog.Content
          aria-describedby={undefined}
          data-drawer-content
          className={cn(
            'fixed inset-y-0 z-50 flex w-1/2 flex-col border-divider bg-background shadow-2xl shadow-dark-900/20',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            side === 'left'
              ? 'left-0 border-r data-[state=open]:slide-in-from-left data-[state=closed]:slide-out-to-left'
              : 'right-0 border-l data-[state=open]:slide-in-from-right data-[state=closed]:slide-out-to-right',
            panelClassName,
          )}
        >
          <Dialog.Title className="sr-only">{accessibleTitle}</Dialog.Title>
          <header className="flex shrink-0 items-center justify-end border-b border-divider px-2 py-1">
            <Dialog.Close asChild>
              <Button
                variant="text"
                color="red"
                className="px-1.5 py-1"
                aria-label={closeLabel}
              >
                <Icon aria-hidden="true" icon="lucide:x" fontSize={18} />
              </Button>
            </Dialog.Close>
          </header>
          <div className={cn('min-h-0 flex-1 overflow-auto p-5', className)}>
            {children}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
