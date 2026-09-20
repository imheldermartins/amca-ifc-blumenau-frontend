import type { ElementType, HTMLAttributes } from 'react'
import { cn } from 'cubs-components'

import { THEME } from '@/lib/theme'

export type TypographyVariant = 'h1' | 'h2' | 'h3' | 'subtitle' | 'body' | 'caption'

interface VariantConfig {
  tag: ElementType
  classes: string
}

/**
 * Hierarquia tipográfica do projeto. A cor base vem do body (foreground);
 * variantes "apagadas" (subtitle/caption) usam o tom muted do tema.
 */
const VARIANTS: Record<TypographyVariant, VariantConfig> = {
  h1: { tag: 'h1', classes: 'text-3xl font-bold tracking-tight' },
  h2: { tag: 'h2', classes: 'text-2xl font-bold tracking-tight' },
  h3: { tag: 'h3', classes: 'text-xl font-bold tracking-tight' },
  subtitle: { tag: 'p', classes: cn('text-sm', THEME.textMuted) },
  body: { tag: 'p', classes: 'text-sm' },
  caption: { tag: 'span', classes: cn('text-xs', THEME.textMuted) },
}

export interface TypographyProps extends HTMLAttributes<HTMLElement> {
  /** Nível/estilo do texto. */
  variant?: TypographyVariant
  /** Sobrescreve a tag HTML mantendo o estilo (ex.: h1 visual num <p>). */
  as?: ElementType
}

/**
 * Texto padronizado do Cub's — todo conteúdo textual das páginas passa por
 * aqui (o conteúdo em si continua vindo do i18n).
 *
 * @example
 * <Typography variant="h2">{i18n('pages.app.ola-mundo')}</Typography>
 * <Typography variant="subtitle">{i18n('pages.app.descricao-outlet')}</Typography>
 */
export function Typography({ variant = 'body', as, className, ...props }: TypographyProps) {
  const config = VARIANTS[variant]
  const Tag = as ?? config.tag

  return <Tag className={cn(config.classes, className)} {...props} />
}
