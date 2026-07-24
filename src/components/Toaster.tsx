import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from '@iconify/react'
import { cn } from 'cubs-components'

import { Typography } from '@components/Typography'
import { i18n } from '@/lib/i18n'
import type { FeedbackVariant, Toast } from '@contexts/FeedbackContext'

/**
 * Pilha de toasts no canto da tela. Renderiza via portal no `body` para ficar
 * acima de tudo (modais, popovers) sem depender de onde o provider mora na
 * árvore. Sem toast, não renderiza nada.
 *
 * Cada card cuida do PRÓPRIO auto-dismiss (um `useEffect` com timer que se
 * limpa no unmount) — o provider só guarda a lista, não gerencia timers.
 */

/** Cor e ícone por variante — classes por EXTENSO (o Tailwind não gera runtime). */
const VARIANTS: Record<FeedbackVariant, { accent: string; icon: string }> = {
  error: { accent: 'text-p-red', icon: 'lucide:circle-alert' },
  success: { accent: 'text-p-green', icon: 'lucide:circle-check' },
  info: { accent: 'text-p-blue', icon: 'lucide:info' },
  warning: { accent: 'text-p-yellow', icon: 'lucide:triangle-alert' },
}

const BORDER: Record<FeedbackVariant, string> = {
  error: 'border-l-p-red',
  success: 'border-l-p-green',
  info: 'border-l-p-blue',
  warning: 'border-l-p-yellow',
}

const DEFAULT_DURATION = 5000

function ToastCard({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  const variant = toast.variant ?? 'info'
  const { accent, icon } = VARIANTS[variant]

  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), toast.duration ?? DEFAULT_DURATION)
    return () => clearTimeout(timer)
  }, [toast.id, toast.duration, onDismiss])

  return (
    <div
      role="status"
      aria-live={variant === 'error' ? 'assertive' : 'polite'}
      className={cn(
        'pointer-events-auto flex w-80 items-start gap-2.5 rounded border border-l-4 border-divider-contrast bg-contrast p-3 shadow-xl',
        BORDER[variant],
      )}
    >
      <Icon icon={toast.icon ?? icon} className={cn('mt-0.5 shrink-0', accent)} fontSize={18} />
      <div className="min-w-0 flex-1">
        <Typography variant="body" className="font-medium">
          {toast.title}
        </Typography>
        {toast.description && (
          <Typography variant="subtitle" className="mt-0.5 break-words">
            {toast.description}
          </Typography>
        )}
      </div>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        aria-label={i18n('common.fechar')}
        className="shrink-0 rounded p-0.5 opacity-60 transition-opacity hover:bg-active hover:opacity-100"
      >
        <Icon icon="lucide:x" fontSize={16} />
      </button>
    </div>
  )
}

export interface ToasterProps {
  toasts: Toast[]
  onDismiss: (id: string) => void
}

export function Toaster({ toasts, onDismiss }: ToasterProps) {
  if (toasts.length === 0) return null

  return createPortal(
    <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex flex-col gap-2">
      {toasts.map((toast) => (
        <ToastCard key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>,
    document.body,
  )
}
