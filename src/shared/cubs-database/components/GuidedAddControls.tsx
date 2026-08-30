import type { ReactNode } from 'react'
import { cn } from 'cubs-components'

import { GuidedAddControl } from './GuidedAddControl'

export interface GuidedAddControlsProps {
  children: ReactNode
  onAddRow?: () => void
  onAddColumn?: () => void
  addRowLabel: string
  addColumnLabel: string
  className?: string
}

/**
 * Moldura dos dois Guided. O conteúdo rolável ocupa apenas a primeira célula
 * da grade; os trilhos são irmãos dele e, por isso, nunca são engolidos pelo
 * `overflow-x-auto` da view padrão. O gap mantém cada trilho suspenso da
 * tabela, com sua própria borda, raio e sombra.
 */
export function GuidedAddControls({
  children,
  onAddRow,
  onAddColumn,
  addRowLabel,
  addColumnLabel,
  className,
}: GuidedAddControlsProps) {
  return (
    <div
      data-guided-add-controls
      className={cn(
        'grid min-w-0 items-stretch gap-2',
        onAddColumn ? 'grid-cols-[minmax(0,1fr)_auto]' : 'grid-cols-1',
        className,
      )}
    >
      <div className="col-start-1 row-start-1 min-w-0">{children}</div>

      {onAddColumn && (
        <GuidedAddControl
          axis="vertical"
          label={addColumnLabel}
          onClick={onAddColumn}
          className="col-start-2 row-start-1 rounded-xl border border-divider shadow-sm"
        />
      )}

      {onAddRow && (
        <GuidedAddControl
          axis="horizontal"
          label={addRowLabel}
          onClick={onAddRow}
          className="col-start-1 row-start-2 rounded-xl border border-divider shadow-sm"
        />
      )}
    </div>
  )
}
