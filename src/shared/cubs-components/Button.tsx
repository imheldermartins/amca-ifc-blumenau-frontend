import type { ComponentProps } from 'react'

import { PALETTE, type PaletteColor, type PaletteEntry } from './lib/palette'
import { cn } from './lib/utils'

export type ButtonVariant = 'filled' | 'outlined' | 'text'

/**
 * Cor do botão: qualquer cor da paleta (./lib/palette) OU `from-theme`,
 * que não usa um hue e sim os tokens neutros do tema — `foreground` no texto
 * e `active` no fundo (escala histórica light/dark do Cub's).
 */
export type ButtonColor = PaletteColor | 'from-theme'

export interface ButtonProps extends ComponentProps<'button'> {
  /** Estilo visual do botão. */
  variant?: ButtonVariant
  /** Cor da paleta, ou `from-theme` (neutro, base light/dark). Padrão: purple. */
  color?: ButtonColor
}

/**
 * Entrada de cor do `from-theme`, montada com os tokens do tema em vez de um
 * hue: texto em `foreground`, fundo em `active`. As classes ficam literais
 * (o Tailwind só gera o que vê escrito) — este arquivo é a fonte delas.
 */
const THEME_ENTRY: PaletteEntry = {
  bg: 'bg-active',
  bgHover: 'hover:bg-contrast',
  bgSoft: 'hover:bg-active',
  text: 'text-foreground',
  textOnFilled: 'text-foreground',
  border: 'border-divider',
  shadow: 'shadow-xl shadow-divider/20',
}

function resolveColor(color: ButtonColor): PaletteEntry {
  return color === 'from-theme' ? THEME_ENTRY : PALETTE[color]
}

const BASE_CLASSES =
  'inline-flex items-center justify-center gap-1.5 rounded px-3 py-1.5 text-sm font-semibold cursor-pointer ' +
  'transition-[color,background-color,border-color,box-shadow,transform] active:translate-y-px ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-p-purple-500/25 ' +
  'disabled:pointer-events-none disabled:opacity-50'

function variantClasses(variant: ButtonVariant, c: PaletteEntry): string {
  switch (variant) {
    case 'filled':
      return cn(c.bg, c.textOnFilled, c.bgHover, c.shadow)
    case 'outlined':
      return cn('border bg-transparent', c.border, c.text, c.bgSoft)
    case 'text':
      // Em repouso, só a cor do texto; o fundo aparece no hover.
      return cn('bg-transparent', c.text, c.bgSoft)
  }
}

export function Button({
  variant = 'filled',
  color = 'purple',
  type = 'button',
  className,
  ...props
}: ButtonProps) {
  const classes = variantClasses(variant, resolveColor(color))
  // O glow clássico pertence somente ao CTA roxo preenchido. Variantes text
  // (fechar, triggers da topbar etc.) preservam apenas a própria palette.
  const glow = variant === 'filled' && color === 'purple'

  return (
    <button
      type={type}
      className={cn(BASE_CLASSES, glow && 'glow-purple-hover', classes, className)}
      {...props}
    />
  )
}
