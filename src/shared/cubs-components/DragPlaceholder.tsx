import { cn } from './lib/utils'
import { SOFT_SELECTION_CLASSES } from './menuStyles'

/** Alvo visual; o registro e a posição de drop continuam pertencendo ao dnd-kit. */
export function DragPlaceholder({ className }: { className?: string }) {
  return <span
    data-drag-placeholder
    aria-hidden="true"
    className={cn(
      'pointer-events-none absolute inset-0 block rounded-lg border-2 border-dotted border-p-purple/40',
      SOFT_SELECTION_CLASSES,
      className,
    )}
  />
}
