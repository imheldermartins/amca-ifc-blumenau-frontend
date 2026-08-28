import { clientLocalStorage } from '@/lib/clientStorage'

/**
 * Aliases de classe prontos para compor com `cn`, apontando para os tokens
 * de cor registrados em `src/index.css`.
 *
 * FONTE ÚNICA são as variáveis CSS do index.css — como cada alias usa o
 * utilitário do token (bg-background, bg-active, ...), mudar o valor lá
 * reflete aqui automaticamente, sem duplicar a paleta clássica. Exceção:
 * `textMuted`, que usa diretamente os degraus neutros históricos.
 */
export const THEME = {
  /** Fundo base da aplicação (light-100 / dark-900). */
  background: 'bg-background',
  /** Superfície de contraste — painéis, inputs (light-200 / dark-800). */
  contrast: 'bg-contrast',
  /** Fundo de item ativo/hover (light-300 / dark-600). */
  active: 'bg-active',
  /** Cor de divisores/bordas neutras (light-300 / dark-700). */
  divider: 'border-divider',
  /** Cor padrão de texto (dark-700 / light-300). */
  text: 'text-foreground',
  /** Texto secundário/apagado — sem token próprio (dark-100 / light-900). */
  textMuted: 'text-dark-100 dark:text-light-900',
} as const

export type ThemeToken = keyof typeof THEME

export type ThemePreference = 'light' | 'dark'

const THEME_KEY = 'theme'

export function getStoredTheme(): ThemePreference | null {
  const stored = clientLocalStorage.get<ThemePreference>(THEME_KEY)
  return stored === 'light' || stored === 'dark' ? stored : null
}

/** Tema salvo, ou a preferência do sistema como fallback. */
export function resolveInitialTheme(): ThemePreference {
  return (
    getStoredTheme() ??
    (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
  )
}

/** Aplica no <html> e persiste. */
export function setTheme(theme: ThemePreference): void {
  document.documentElement.classList.toggle('dark', theme === 'dark')
  clientLocalStorage.set(THEME_KEY, theme)
}
