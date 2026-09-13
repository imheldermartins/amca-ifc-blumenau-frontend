import { act, fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { DataViewSettings } from '../types'
import { ViewTabsBar } from './ViewTabsBar'

const settings: DataViewSettings = {
  '01KXVZ0000VIEW00000000001': {
    view: 'table',
    name: 'Tabela',
    urlKey: { key: 'tabela', aliases: [] },
    filters: { version: 2, updatedAt: null, clauses: [], groupBy: [], passthrough: [] },
    orderedHeaderCols: [],
  },
}

const viewTypeLabels = {
  table: 'Tabela',
  grid: 'Grade',
  board: 'Quadros',
  calendar: 'Calendário',
  timeline: 'Cronograma',
  graph: 'Grafos',
}

describe('ViewTabsBar — adicionar view', () => {
  it('oferece todos os tipos e envia o tipo escolhido', async () => {
    const onAddView = vi.fn()
    render(
      <ViewTabsBar
        settings={settings}
        activeViewId="01KXVZ0000VIEW00000000001"
        onViewChange={vi.fn()}
        onAddView={onAddView}
        addViewLabel="Adicionar view"
        viewTypeLabels={viewTypeLabels}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Adicionar view' }))
    for (const label of Object.values(viewTypeLabels)) {
      expect(screen.getByRole('menuitem', { name: label })).toBeTruthy()
    }
    await act(async () => {
      fireEvent.click(screen.getByRole('menuitem', { name: 'Calendário' }))
    })
    expect(onAddView).toHaveBeenCalledWith('calendar')
  })

  it('não mostra o botão sem permissão de criação', () => {
    render(
      <ViewTabsBar
        settings={settings}
        activeViewId="01KXVZ0000VIEW00000000001"
        onViewChange={vi.fn()}
      />,
    )
    expect(screen.queryByRole('button', { name: 'Adicionar view' })).toBeNull()
  })
})

describe('ViewTabsBar — renomear view', () => {
  it('edita na própria aba, confirma com Enter e cancela com Escape', () => {
    const onRenameView = vi.fn()
    const props = {
      settings,
      activeViewId: '01KXVZ0000VIEW00000000001',
      onViewChange: vi.fn(),
      onRenameView,
      viewMenuItems: (_viewId: string, actions: { startRename: () => void }) => [
        { id: 'rename', label: 'Renomear', onSelect: actions.startRename },
      ],
    }
    render(<ViewTabsBar {...props} />)
    fireEvent.contextMenu(screen.getByRole('button', { name: 'Tabela' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Renomear' }))
    const input = screen.getByRole('textbox', { name: 'Tabela' })
    fireEvent.change(input, { target: { value: '  Nova tabela  ' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onRenameView).toHaveBeenCalledWith('01KXVZ0000VIEW00000000001', 'Nova tabela')

    fireEvent.contextMenu(screen.getByRole('button', { name: 'Tabela' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Renomear' }))
    const canceled = screen.getByRole('textbox', { name: 'Tabela' })
    fireEvent.change(canceled, { target: { value: 'Cancelar' } })
    fireEvent.keyDown(canceled, { key: 'Escape' })
    expect(onRenameView).toHaveBeenCalledTimes(1)
  })
})
