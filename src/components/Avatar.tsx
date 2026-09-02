import type { ComponentProps } from 'react'

import { OPTION_COLOR_SWATCH, cn } from 'cubs-components'

import type { UserColor } from '@/types/user'

export interface AvatarProps
  extends Omit<ComponentProps<'span'>, 'children' | 'color'> {
  /** Iniciais calculadas para a audiência atual da página. */
  slug: string
  /** Cor calculada no frontend sem repetir enquanto houver paleta livre. */
  color: UserColor
  /** Nome/e-mail anunciado e exibido no tooltip. */
  label?: string
  /** Destaque do usuário autenticado. */
  active?: boolean
}

/** Renderização reutilizável da projeção visual calculada no frontend. */
export function Avatar({ slug, color, label, active = false, className, ...props }: AvatarProps) {
  return (
    <span
      {...props}
      {...(label
        ? { role: 'img', 'aria-label': label, title: label }
        : { 'aria-hidden': true })}
      className={cn(
        'flex h-7 w-7 shrink-0 select-none items-center justify-center rounded-full text-xs font-semibold ring-4 ring-background',
        OPTION_COLOR_SWATCH[color],
        color === 'yellow' ? 'text-dark-900' : 'text-light-100',
        active && 'border-2 outline-2 outline-p-purple-500',
        className,
      )}
    >
      {slug}
    </span>
  )
}
