import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useReducer,
  type ReactNode,
} from 'react'

import { Toaster } from '@components/Toaster'

/**
 * Feedback efêmero ao usuário — o canal de aviso que faltava. Nasceu para a
 * escrita otimista da tabela: quando um PUT/POST de célula falha, a UI reverte
 * o valor E precisa DIZER que falhou (senão o rollback parece um bug). Mas é
 * genérico — qualquer tela dispara `feedback(...)`.
 *
 * O componente é BURRO: recebe strings JÁ traduzidas. O i18n mora em quem
 * chama (uma tela/hook do app), nunca aqui — mesma regra que mantém a
 * `cubs-components`/`cubs-database` livres do i18n.
 */
export type FeedbackVariant = 'error' | 'success' | 'info' | 'warning'

export interface FeedbackInput {
  title: string
  description?: string
  /** Ícone iconify (ex.: `lucide:users`). Ausente = o default da variante. */
  icon?: string
  /** Cor/semântica. Default `info`. */
  variant?: FeedbackVariant
  /** Milissegundos até sumir sozinho. Default 5000. */
  duration?: number
}

export interface Toast extends FeedbackInput {
  id: string
}

/** Teto de toasts visíveis — os mais antigos caem para não empilhar sem fim. */
export const MAX_VISIBLE = 4

export type FeedbackAction =
  | { type: 'push'; toast: Toast }
  | { type: 'dismiss'; id: string }

/** Exportado para teste — puro, sem React. */
export function feedbackReducer(state: Toast[], action: FeedbackAction): Toast[] {
  switch (action.type) {
    case 'push':
      return [...state, action.toast].slice(-MAX_VISIBLE)
    case 'dismiss':
      return state.filter((toast) => toast.id !== action.id)
  }
}

interface FeedbackContextValue {
  feedback: (input: FeedbackInput) => string
  dismiss: (id: string) => void
}

const FeedbackContext = createContext<FeedbackContextValue | null>(null)

// Sequência de módulo: id único por toast, sem depender de crypto/estado.
let sequence = 0

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [toasts, dispatch] = useReducer(feedbackReducer, [])

  const feedback = useCallback((input: FeedbackInput): string => {
    const id = `toast-${++sequence}`
    dispatch({ type: 'push', toast: { ...input, id } })
    return id
  }, [])

  const dismiss = useCallback((id: string) => dispatch({ type: 'dismiss', id }), [])

  const value = useMemo<FeedbackContextValue>(() => ({ feedback, dismiss }), [feedback, dismiss])

  return (
    <FeedbackContext.Provider value={value}>
      {children}
      <Toaster toasts={toasts} onDismiss={dismiss} />
    </FeedbackContext.Provider>
  )
}

/**
 * A função `feedback(...)` — é o que uma tela chama para avisar algo.
 *
 * @example
 * const feedback = useFeedback()
 * feedback({ title: i18n('...'), description: i18n('...'), variant: 'error' })
 */
export function useFeedback(): (input: FeedbackInput) => string {
  const context = useContext(FeedbackContext)
  if (!context) {
    throw new Error('useFeedback precisa ser usado dentro de <FeedbackProvider>.')
  }
  return context.feedback
}
