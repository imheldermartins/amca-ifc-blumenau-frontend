import { useCallback, useState } from 'react'
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react'
import { Icon } from '@iconify/react'
import { cn } from 'cubs-components'

export interface GuidedAddControlProps {
  axis: 'horizontal' | 'vertical'
  label: string
  onClick: () => void
  className?: string
}

const INDICATOR_RADIUS = 14

/**
 * Trilho de adição que ocupa um eixo inteiro da tabela. O alvo clicável é o
 * trilho todo; o círculo é apenas o indicador visual e acompanha o ponteiro
 * no eixo útil, sem escapar pelas extremidades. Em repouso, ambos os eixos
 * começam no `start`, independentemente do tamanho atual da base.
 */
export function GuidedAddControl({ axis, label, onClick, className }: GuidedAddControlProps) {
  const [position, setPosition] = useState(INDICATOR_RADIUS)

  const handlePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      const rect = event.currentTarget.getBoundingClientRect()
      const pointerPosition =
        axis === 'horizontal' ? event.clientX - rect.left : event.clientY - rect.top
      const trackLength = axis === 'horizontal' ? rect.width : rect.height
      if (!Number.isFinite(pointerPosition) || !Number.isFinite(trackLength)) return
      const max = Math.max(INDICATOR_RADIUS, trackLength - INDICATOR_RADIUS)

      setPosition(Math.min(Math.max(pointerPosition, INDICATOR_RADIUS), max))
    },
    [axis],
  )

  const indicatorStyle: CSSProperties =
    axis === 'horizontal'
      ? { left: position, top: '50%', transform: 'translate(-50%, -50%)' }
      : { left: '50%', top: position, transform: 'translate(-50%, -50%)' }

  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      onPointerMove={handlePointerMove}
      onPointerLeave={() => setPosition(INDICATOR_RADIUS)}
      className={cn(
        'group/guided-add relative block cursor-pointer overflow-hidden bg-background text-p-purple transition-colors hover:bg-p-purple-50 dark:hover:bg-contrast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-p-purple-500/30',
        axis === 'horizontal' ? 'h-9 w-full border-t border-divider' : 'h-full w-9 border-l border-divider',
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          'pointer-events-none absolute bg-divider transition-colors group-hover/guided-add:bg-p-purple-200',
          axis === 'horizontal'
            ? 'inset-x-3 top-1/2 h-px -translate-y-1/2'
            : 'inset-y-3 left-1/2 w-px -translate-x-1/2',
        )}
      />
      <span
        data-guided-add-indicator
        aria-hidden
        style={indicatorStyle}
        className="pointer-events-none absolute z-10 grid size-7 place-items-center rounded-full border border-p-purple/40 bg-contrast text-p-purple shadow-sm transition-[background-color,box-shadow] group-hover/guided-add:bg-p-purple-500 group-hover/guided-add:text-light-100 group-hover/guided-add:shadow-md group-hover/guided-add:shadow-p-purple/30"
      >
        <Icon icon="lucide:plus" fontSize={16} />
      </span>
    </button>
  )
}
