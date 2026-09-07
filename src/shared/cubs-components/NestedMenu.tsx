import { Fragment, useState } from 'react'
import type { ReactNode } from 'react'
import { Icon } from '@iconify/react'

import { Popover } from './Popover'
import { MENU_ROW_CLASSES } from './menuStyles'
import { cn } from './lib/utils'

/**
 * Nó de um menu recursivo. Três formas, decididas pelo que o nó carrega:
 *  - `children` → SUBMENU (chevron-right; abre um sub-Popover à direita);
 *  - `content`  → SEÇÃO custom (renderiza nós React: input, colorpicker, ...);
 *  - `onSelect` → AÇÃO de folha (clique na linha).
 * Um nó pode combinar `name` + `content` (uma seção rotulada).
 */
export interface MenuNode {
  /** Identidade estável opcional; útil quando o array vem de dados externos. */
  id?: string
  name: string
  icon?: string
  content?: ReactNode
  children?: MenuNode[]
  onSelect?: () => void
  /** Realce de perigo (ex.: excluir). */
  danger?: boolean
  /** Linha divisória imediatamente antes deste item. */
  separatorBefore?: boolean
  /** Ação indisponível, mas ainda visível para manter a posição no menu. */
  disabled?: boolean
  /**
   * Confirmação inline em dois passos: o primeiro clique arma a ação e o
   * segundo precisa atingir explicitamente o ícone informado.
   */
  confirm?: {
    icon?: string
    label: string
  }
}

export interface NestedMenuProps {
  nodes: MenuNode[]
  className?: string
}

function MenuRow({ node }: { node: MenuNode }) {
  const [confirming, setConfirming] = useState(false)
  let row: ReactNode

  // 1) Submenu: a própria linha é o gatilho de um Popover à direita, cujo
  //    conteúdo é OUTRO NestedMenu (a recursão).
  if (node.children && node.children.length > 0) {
    row = (
      <Popover
        side="right"
        align="start"
        sideOffset={2}
        className="min-w-44"
        trigger={
          <button type="button" role="menuitem" className={MENU_ROW_CLASSES}>
            {node.icon && <Icon icon={node.icon} fontSize={15} className="shrink-0" />}
            <span className="flex-1 whitespace-nowrap">{node.name}</span>
            <Icon icon="lucide:chevron-right" fontSize={14} className="shrink-0 opacity-60" />
          </button>
        }
      >
        <NestedMenu nodes={node.children} />
      </Popover>
    )
  } else if (node.content !== undefined) {
    // 2) Seção custom: rótulo opcional + os nós React livres.
    row = (
      <div className="px-1 py-1">
        {node.name ? (
          <div className="px-1 pb-1 text-xs uppercase tracking-wide opacity-50">{node.name}</div>
        ) : null}
        {node.content}
      </div>
    )
  } else if (confirming && node.confirm) {
    // 3) Segundo passo destrutivo: só o ícone executa a ação.
    row = (
      <div className={cn(MENU_ROW_CLASSES, 'text-p-red')}>
        {node.icon && <Icon icon={node.icon} fontSize={15} className="shrink-0" />}
        <span className="flex-1 whitespace-nowrap">{node.name}</span>
        <button
          type="button"
          role="menuitem"
          autoFocus
          aria-label={node.confirm.label}
          onClick={node.onSelect}
          className="glow-purple-hover -my-0.5 rounded p-0.5 text-p-red hover:bg-active focus-visible:outline-none"
        >
          <Icon icon={node.confirm.icon ?? 'lucide:triangle-alert'} fontSize={16} />
        </button>
      </div>
    )
  } else {
    // 4) Ação de folha. Quando há `confirm`, o primeiro clique somente arma.
    row = (
      <button
        type="button"
        role="menuitem"
        disabled={node.disabled}
        onClick={node.confirm ? () => setConfirming(true) : node.onSelect}
        className={cn(
          MENU_ROW_CLASSES,
          node.danger && 'text-p-red',
          node.disabled && 'cursor-not-allowed opacity-35 hover:bg-transparent hover:shadow-none',
        )}
      >
        {node.icon && <Icon icon={node.icon} fontSize={15} className="shrink-0" />}
        <span className="flex-1 whitespace-nowrap">{node.name}</span>
      </button>
    )
  }

  return (
    <Fragment>
      {node.separatorBefore ? <div role="separator" className="mx-1 my-1 border-t border-divider" /> : null}
      {row}
    </Fragment>
  )
}

/**
 * Menu recursivo com submenus e conteúdo custom, sobre o `Popover` (glass). O
 * TOPO é só a lista de linhas — quem abre o menu de nível zero é o caller (um
 * Popover ou painel próprio); cada nó com `children` abre o SEU sub-Popover.
 *
 * NÃO usa Radix `DropdownMenu` de propósito: os itens de menu do Radix são
 * roving-focus e hostilizam inputs dentro do `content` (foco escapa a cada
 * tecla). O Popover aninhado deixa o `content` ser conteúdo livre.
 */
export function NestedMenu({ nodes, className }: NestedMenuProps) {
  return (
    <div role="menu" className={cn('min-w-44', className)}>
      {nodes.map((node, index) => (
        <MenuRow key={node.id ?? index} node={node} />
      ))}
    </div>
  )
}
