import type { ReactElement } from 'react'
import type { MenuNode } from 'cubs-components'
import { describe, expect, it, vi } from 'vitest'

import type { HeaderCol } from '../types'
import {
  buildColumnHeaderMenuNodes,
  type ColumnHeaderMenuContext,
} from './columnHeaderMenu.shared'

const COLUMN: HeaderCol = {
  id: 'column-id',
  title: 'Documento',
  type: 'text',
}

function createContext(
  overrides: Partial<ColumnHeaderMenuContext> = {},
): ColumnHeaderMenuContext {
  return {
    column: COLUMN,
    columnType: 'text',
    onClose: vi.fn(),
    renderRenameContent: () => null,
    ...overrides,
  }
}

describe('buildColumnHeaderMenuNodes', () => {
  it('encadeia somente os tratadores habilitados e preserva a ordem do menu', () => {
    const nodes = buildColumnHeaderMenuNodes(
      createContext({
        columnType: 'select',
        onRename: vi.fn(),
        onColumnTypeChange: vi.fn(),
        onColumnOptionsChange: vi.fn(),
        onColumnDelete: vi.fn(),
      }),
    )

    expect(nodes.map((node) => node.id)).toEqual([
      'rename',
      'change-type',
      'select-options',
      'move-to-trash',
    ])
  })

  it('arma a exclusão de coluna como nó destrutivo separado por divider', () => {
    const onColumnDelete = vi.fn()
    const nodes = buildColumnHeaderMenuNodes(
      createContext({ onColumnDelete }),
    )

    expect(nodes).toHaveLength(1)
    expect(nodes[0]).toMatchObject({
      id: 'move-to-trash',
      danger: true,
      separatorBefore: true,
      confirm: { icon: 'lucide:triangle-alert' },
    })
    nodes[0]?.onSelect?.()
    expect(onColumnDelete).toHaveBeenCalledOnce()
  })

  it('delega a troca de tipo e fecha o menu', () => {
    const onClose = vi.fn()
    const onColumnTypeChange = vi.fn()
    const nodes = buildColumnHeaderMenuNodes(
      createContext({
        onClose,
        onColumnTypeChange,
      }),
    )

    const sections = nodes.find((node) => node.id === 'change-type')?.children
    expect(sections?.map((section) => section.id)).toEqual([
      'change-type-section-base',
      'change-type-section-automation',
      'change-type-section-advanced',
    ])

    const baseMenu = sections?.[0]?.content as ReactElement<{ nodes: MenuNode[] }>
    baseMenu.props.nodes.find((node) => node.id === 'change-type-numeric')?.onSelect?.()
    expect(onColumnTypeChange).toHaveBeenCalledWith('numeric')
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('traduz e ordena as seções de tipo usando o catálogo compartilhado', () => {
    const nodes = buildColumnHeaderMenuNodes(
      createContext({
        onColumnTypeChange: vi.fn(),
        labels: {
          columnTypeSections: {
            base: 'Base',
            automation: 'Automação',
            advanced: 'Avançado',
          },
        },
      }),
    )

    const sections = nodes.find((node) => node.id === 'change-type')?.children
    expect(sections?.map((section) => section.name)).toEqual(['Base', 'Automação', 'Avançado'])
    expect(sections?.map((section) => section.separatorBefore)).toEqual([false, true, true])
  })

  it('usa somente o tratador de configuração compatível com o tipo atual', () => {
    const onColumnConfigChange = vi.fn()
    const numericNodes = buildColumnHeaderMenuNodes(
      createContext({
        column: { ...COLUMN, type: 'numeric', format: 'currency', currency: 'BRL' },
        columnType: 'numeric',
        onColumnConfigChange,
      }),
    )
    const textNodes = buildColumnHeaderMenuNodes(
      createContext({ onColumnConfigChange }),
    )

    expect(numericNodes.map((node) => node.id)).toEqual(['numeric-format'])
    expect(textNodes.map((node) => node.id)).toEqual(['text-mask'])

    numericNodes[0]?.children?.[0]?.onSelect?.()
    expect(onColumnConfigChange).toHaveBeenCalledWith({
      format: 'percentage',
      currency: null,
    })
  })
})
