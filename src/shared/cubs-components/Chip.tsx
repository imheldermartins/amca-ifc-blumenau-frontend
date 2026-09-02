import type { ComponentProps, ReactNode } from 'react'
import { Icon } from '@iconify/react'

import { cn } from './lib/utils'

export interface ChipProps extends Omit<ComponentProps<'span'>, 'children'> {
  children: ReactNode
  /** Ação opcional de remoção; ausente mantém o chip somente informativo. */
  onRemove?: () => void
  removeLabel?: string
}

/**
 * Chip compacto e removível. O componente só define a primitiva visual; texto,
 * significado e cor contextual continuam sendo responsabilidade do domínio.
 */
export function Chip({
  children,
  onRemove,
  removeLabel = 'Remover',
  className,
  ...props
}: ChipProps) {
  return (
    <span
      {...props}
      className={cn(
        'inline-flex min-h-7 max-w-full items-center gap-1 rounded-lg border px-2 py-0.5 text-sm',
        className,
      )}
    >
      <span className="inline-flex min-w-0 items-center gap-1 truncate">{children}</span>
      {onRemove ? (
        <button
          type="button"
          aria-label={removeLabel}
          onClick={onRemove}
          className="grid size-5 shrink-0 place-items-center rounded opacity-60 transition-colors hover:bg-active hover:opacity-100"
        >
          <Icon icon="lucide:x" fontSize={13} />
        </button>
      ) : null}
    </span>
  )
}
