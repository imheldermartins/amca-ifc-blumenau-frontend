import type { ReactNode } from 'react'
import { Icon } from '@iconify/react'

import { Popover } from './Popover'
import { cn } from './lib/utils'

/**
 * Nó de um menu recursivo. Três formas, decididas pelo que o nó carrega:
 *  - `children` → SUBMENU (chevron-right; abre um sub-Popover à direita);
 *  - `content`  → SEÇÃO custom (renderiza nós React: input, colorpicker, ...);
 *  - `onSelect` → AÇÃO de folha (clique na linha).
 * Um nó pode combinar `name` + `content` (uma seção rotulada).
 */
export interface MenuNode {
  name: string
  icon?: string
  content?: ReactNode
  children?: MenuNode[]
  onSelect?: () => void
  /** Realce de perigo (ex.: excluir). */
  danger?: boolean
}

export interface NestedMenuProps {
  nodes: MenuNode[]
  className?: string
}

const ROW =
  'flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm transition-colors hover:bg-active'

function MenuRow({ node }: { node: MenuNode }) {
  // 1) Submenu: a própria linha é o gatilho de um Popover à direita, cujo
  //    conteúdo é OUTRO NestedMenu (a recursão).
  if (node.children && node.children.length > 0) {
    return (
      <Popover
        side="right"
        align="start"
        sideOffset={2}
        className="min-w-44"
        trigger={
          <button type="button" role="menuitem" className={ROW}>
            {node.icon && <Icon icon={node.icon} fontSize={15} className="shrink-0" />}
            <span className="flex-1 whitespace-nowrap">{node.name}</span>
            <Icon icon="lucide:chevron-right" fontSize={14} className="shrink-0 opacity-60" />
          </button>
        }
      >
        <NestedMenu nodes={node.children} />
      </Popover>
    )
  }

  // 2) Seção custom: rótulo opcional + os nós React livres.
  if (node.content !== undefined) {
    return (
      <div className="px-1 py-1">
        {node.name ? (
          <div className="px-1 pb-1 text-xs uppercase tracking-wide opacity-50">{node.name}</div>
        ) : null}
        {node.content}
      </div>
    )
  }

  // 3) Ação de folha.
  return (
    <button
      type="button"
      role="menuitem"
      onClick={node.onSelect}
      className={cn(ROW, node.danger && 'text-p-red')}
    >
      {node.icon && <Icon icon={node.icon} fontSize={15} className="shrink-0" />}
      <span className="flex-1 whitespace-nowrap">{node.name}</span>
    </button>
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
        <MenuRow key={index} node={node} />
      ))}
    </div>
  )
}
