import type { ComponentProps } from 'react'

import { NestedMenu, type MenuNode } from './NestedMenu'
import { FLOATING_SURFACE_CLASSES } from './menuStyles'
import { cn } from './lib/utils'

export interface MenuProps extends Omit<ComponentProps<'div'>, 'children'> {
  /** Definição completa do menu; submenus são apenas novos arrays em children. */
  items: MenuNode[]
}

/**
 * Menu visual do Cub's. O caller passa somente um array de objetos; esta
 * primitiva fornece painel glass, blur, sombra, glow e a recursão dos submenus.
 * Posicionamento e ciclo de abertura continuam sob controle de quem o usa.
 */
export function Menu({ items, className, ...props }: MenuProps) {
  return (
    <div className={cn(FLOATING_SURFACE_CLASSES, className)} {...props}>
      <NestedMenu nodes={items} />
    </div>
  )
}
