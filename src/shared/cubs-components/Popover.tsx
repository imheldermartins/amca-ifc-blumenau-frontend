import * as RadixPopover from '@radix-ui/react-popover'
import type { ReactNode } from 'react'

import { cn } from './lib/utils'

export interface PopoverProps {
  /** Elemento que abre o popover — recebe os handlers via `asChild`. */
  trigger: ReactNode
  /** Área de conteúdo LIVRE — o popover não impõe layout interno. */
  children: ReactNode
  /** Modo controlado; sem `open`, o Radix controla sozinho. */
  open?: boolean
  onOpenChange?: (open: boolean) => void
  side?: 'top' | 'right' | 'bottom' | 'left'
  align?: 'start' | 'center' | 'end'
  sideOffset?: number
  /** Classe da ÁREA DE CONTEÚDO (o painel flutuante). */
  className?: string
}

/**
 * Popover primitivo — superfície flutuante ancorada num trigger, com conteúdo
 * livre. É o mesmo "glass" do Select/ContextMenu: as superfícies flutuantes do
 * projeto compartilham um único tratamento.
 *
 * Diferença para os irmãos: `Select` tem semântica de escolha (roving focus,
 * typeahead) e `ContextMenu` é menu de ações; o Popover não assume NADA sobre o
 * conteúdo — é a base para painéis compostos (o editor de célula select da
 * `cubs-database`, um filtro, um date picker futuro).
 *
 * Do Radix vêm portal, posicionamento, fechar com Escape/clique-fora e a
 * devolução de focus ao trigger — a mecânica que não vale reimplementar.
 */
export function Popover({
  trigger,
  children,
  open,
  onOpenChange,
  side = 'bottom',
  align = 'start',
  sideOffset = 4,
  className,
}: PopoverProps) {
  return (
    <RadixPopover.Root open={open} onOpenChange={onOpenChange}>
      <RadixPopover.Trigger asChild>{trigger}</RadixPopover.Trigger>
      <RadixPopover.Portal>
        <RadixPopover.Content
          side={side}
          align={align}
          sideOffset={sideOffset}
          className={cn(
            'z-50 rounded-lg border border-divider-contrast p-1 shadow-xl',
            'bg-glass backdrop-blur-md',
            className,
          )}
        >
          {children}
        </RadixPopover.Content>
      </RadixPopover.Portal>
    </RadixPopover.Root>
  )
}
