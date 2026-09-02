import * as RadixTooltip from '@radix-ui/react-tooltip'
import type { ReactElement, ReactNode } from 'react'

import { cn } from './lib/utils'

export interface TooltipProps {
  /** O elemento que recebe hover/foco. Radix preserva suas props com `asChild`. */
  children: ReactElement
  /** Conteúdo completo, sem truncamento. Vazio desliga o tooltip. */
  content?: ReactNode
  side?: 'top' | 'right' | 'bottom' | 'left'
  align?: 'start' | 'center' | 'end'
  sideOffset?: number
  delayDuration?: number
  className?: string
}

/**
 * Tooltip acessível e reutilizável. O Radix liga o conteúdo ao trigger via
 * `aria-describedby`, abre por teclado/hover e cuida de portal/posicionamento.
 */
export function Tooltip({
  children,
  content,
  side = 'top',
  align = 'center',
  sideOffset = 6,
  delayDuration = 350,
  className,
}: TooltipProps) {
  if (content == null || content === '') return children

  return (
    <RadixTooltip.Provider delayDuration={delayDuration} skipDelayDuration={150}>
      <RadixTooltip.Root>
        <RadixTooltip.Trigger asChild>{children}</RadixTooltip.Trigger>
        <RadixTooltip.Portal>
          <RadixTooltip.Content
            side={side}
            align={align}
            sideOffset={sideOffset}
            className={cn(
              'z-[70] max-w-80 rounded-md bg-foreground px-2 py-1 text-xs leading-snug text-background shadow-lg',
              'select-none data-[state=closed]:animate-out data-[state=delayed-open]:animate-in',
              'data-[state=closed]:fade-out-0 data-[state=delayed-open]:fade-in-0',
              className,
            )}
          >
            {content}
            <RadixTooltip.Arrow className="fill-foreground" />
          </RadixTooltip.Content>
        </RadixTooltip.Portal>
      </RadixTooltip.Root>
    </RadixTooltip.Provider>
  )
}
