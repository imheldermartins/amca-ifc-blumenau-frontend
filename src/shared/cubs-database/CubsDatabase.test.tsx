import { fireEvent, render, screen, within } from '@testing-library/react'
import { cleanup } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { CubsDatabase } from './CubsDatabase'
import { emptyViewFilters } from './viewFilters'

const VIEW_ID = '01KXVZ0000VIEW00000000001'

afterEach(() => cleanup())

describe('CubsDatabase — coluna mestra title', () => {
  it('usa o column_name da view e envia o rename para o snapshot', () => {
    const onPageTitleColumnChange = vi.fn()
    const onColumnRename = vi.fn()

    render(
      <CubsDatabase
        settings={{
          [VIEW_ID]: {
            view: 'table',
            name: 'Tabela',
            urlKey: { key: 'tabela', aliases: [] },
            filters: emptyViewFilters(),
            title: {
              key: 'title',
              column_name: 'Docente',
              mask: 'cpf',
              publicKey: { key: 'docente', aliases: ['nome'] },
            },
            orderedHeaderCols: ['page_title'],
          },
        }}
        headerCols={[
          { id: 'page_title', key: 'title', title: 'Título', type: 'text' },
        ]}
        rows={[]}
        onColumnRename={onColumnRename}
        onPageTitleColumnChange={onPageTitleColumnChange}
        labels={{ renameColumn: 'Renomear coluna' }}
      />,
    )

    expect(screen.getByRole('columnheader').textContent).toContain('Docente')
    fireEvent.contextMenu(screen.getByRole('columnheader'))

    const input = screen.getByRole('textbox', { name: 'Renomear coluna' })
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'Professor' } })
    fireEvent.blur(input)

    expect(onPageTitleColumnChange).toHaveBeenCalledWith(VIEW_ID, {
      key: 'title',
      column_name: 'Professor',
      mask: 'cpf',
      publicKey: { key: 'docente', aliases: ['nome'] },
    })
    expect(onColumnRename).not.toHaveBeenCalled()
  })
})

describe('CubsDatabase — preview de largura', () => {
  it('sobrepõe a largura persistida somente na view correspondente', () => {
    render(
      <CubsDatabase
        settings={{
          [VIEW_ID]: {
            view: 'table',
            name: 'Tabela',
            urlKey: { key: 'tabela', aliases: [] },
            filters: emptyViewFilters(),
            orderedHeaderCols: ['column-1'],
            columnWidths: { 'column-1': 180 },
          },
        }}
        headerCols={[{ id: 'column-1', title: 'Nome', type: 'text' }]}
        rows={[]}
        columnWidthPreviews={{ [VIEW_ID]: { 'column-1': 333 } }}
      />,
    )

    expect(screen.getByRole('columnheader').style.width).toBe('333px')
  })
})

describe('CubsDatabase — espaçamento das views', () => {
  it('reserva o espaço mínimo comum entre as tabs e qualquer view', () => {
    render(
      <CubsDatabase
        settings={{
          [VIEW_ID]: {
            view: 'table',
            name: 'Tabela',
            urlKey: { key: 'tabela', aliases: [] },
            filters: emptyViewFilters(),
            orderedHeaderCols: ['column-1'],
          },
        }}
        headerCols={[{ id: 'column-1', title: 'Nome', type: 'text' }]}
        rows={[]}
      />,
    )

    const viewContainer = screen.getByRole('table').closest('[data-database-view-container]')
    expect(viewContainer?.className).toContain('mt-3.5')
  })
})

describe('CubsDatabase — filtros e agrupamentos', () => {
  const columns = [
    { id: 'name', title: 'Nome', type: 'text' as const },
    { id: 'area', title: 'Área', type: 'text' as const },
  ]

  it('filtra antes de agrupar e recolhe a faixa roxa como accordion', () => {
    const filters = {
      ...emptyViewFilters(),
      groupBy: ['area'],
      clauses: [{ columnId: 'name', condition: 'contains' as const, values: ['Ana'] }],
    }
    render(
      <CubsDatabase
        settings={{
          [VIEW_ID]: {
            view: 'table',
            name: 'Tabela',
            urlKey: { key: 'tabela', aliases: [] },
            filters,
            orderedHeaderCols: ['name', 'area'],
          },
        }}
        headerCols={columns}
        rows={[
          { id: '1', cells: { name: { value: 'Ana' }, area: { value: 'Administração' } } },
          { id: '2', cells: { name: { value: 'Bruno' }, area: { value: 'Tecnologia' } } },
        ]}
      />,
    )

    const group = screen.getByRole('button', { name: /Área: Administração 1 linha/ })
    expect(group.className).toContain('bg-contrast')
    expect(group.querySelector('.bg-p-purple')).not.toBeNull()
    expect(within(screen.getAllByRole('row')[1]).getByText('Ana')).not.toBeNull()
    expect(screen.queryByText('Bruno')).toBeNull()

    fireEvent.click(group)
    expect(group.getAttribute('aria-expanded')).toBe('false')
    expect(screen.getAllByRole('row')).toHaveLength(1)
  })

  it('move a linha de grupo ao receber novas células pelas props', () => {
    const settings = {
      [VIEW_ID]: {
        view: 'table' as const,
        name: 'Tabela',
        urlKey: { key: 'tabela', aliases: [] },
        filters: { ...emptyViewFilters(), groupBy: ['area'] },
        orderedHeaderCols: ['name', 'area'],
      },
    }
    const { rerender } = render(
      <CubsDatabase
        settings={settings}
        headerCols={columns}
        rows={[
          { id: '1', cells: { name: { value: 'Ana' }, area: { value: 'Administração' } } },
          { id: '2', cells: { name: { value: 'Bruno' }, area: { value: 'Tecnologia' } } },
        ]}
      />,
    )
    expect(screen.getByRole('button', { name: /Área: Administração 1 linha/ })).not.toBeNull()

    rerender(
      <CubsDatabase
        settings={settings}
        headerCols={columns}
        rows={[
          { id: '1', cells: { name: { value: 'Ana' }, area: { value: 'Tecnologia' } } },
          { id: '2', cells: { name: { value: 'Bruno' }, area: { value: 'Tecnologia' } } },
        ]}
      />,
    )

    expect(screen.queryByRole('button', { name: /Área: Administração/ })).toBeNull()
    expect(screen.getByRole('button', { name: /Área: Tecnologia 2 linhas/ })).not.toBeNull()
  })

  it('encaminha o estado de sincronização da view ativa para a toolbar', () => {
    const onAction = vi.fn()
    render(
      <CubsDatabase
        settings={{
          [VIEW_ID]: {
            view: 'table',
            name: 'Tabela',
            urlKey: { key: 'tabela', aliases: [] },
            filters: emptyViewFilters(),
            orderedHeaderCols: [],
          },
        }}
        headerCols={[]}
        rows={[]}
        filterSyncStatus={{
          state: 'error',
          label: 'Falha ao salvar',
          actionLabel: 'Tentar novamente',
          onAction,
        }}
      />,
    )

    expect(screen.getByRole('alert').textContent).toContain('Falha ao salvar')
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }))
    expect(onAction).toHaveBeenCalledOnce()
  })

  it('reutiliza a mesma criação no CTA Nova e no controle guiado', () => {
    const onAddRow = vi.fn()
    render(
      <CubsDatabase
        settings={{
          [VIEW_ID]: {
            view: 'table',
            name: 'Tabela',
            urlKey: { key: 'tabela', aliases: [] },
            filters: emptyViewFilters(),
            orderedHeaderCols: [],
          },
        }}
        headerCols={[]}
        rows={[]}
        onAddRow={onAddRow}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Nova' }))
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar linha' }))

    expect(onAddRow).toHaveBeenCalledTimes(2)
  })
})
