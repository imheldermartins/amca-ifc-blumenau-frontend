import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { DataViewSettings } from '../types'
import { ViewTabsBar } from './ViewTabsBar'
import { reorderViewIds } from './viewOrder'

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
  form: 'Formulário',
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

  it('oculta Form quando o contexto não possui coluna Flow', () => {
    render(
      <ViewTabsBar
        settings={settings}
        activeViewId="01KXVZ0000VIEW00000000001"
        onViewChange={vi.fn()}
        onAddView={vi.fn()}
        addViewLabel="Adicionar view"
        viewTypeLabels={viewTypeLabels}
        availableViewKinds={['table', 'grid', 'board', 'calendar', 'timeline', 'graph']}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Adicionar view' }))
    expect(screen.queryByRole('menuitem', { name: 'Formulário' })).toBeNull()
    expect(screen.getByRole('menuitem', { name: 'Tabela' })).not.toBeNull()
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

describe('ViewTabsBar — ordem sortable', () => {
  it('reserva as dimensões da aba e cancela sem persistir a ordem', async () => {
    const firstId = '01KXVZ0000VIEW00000000001'
    const secondId = '01KXVZ0000VIEW00000000002'
    const onViewOrderChange = vi.fn()
    render(<ViewTabsBar
      settings={{ ...settings, [secondId]: { ...settings[firstId], name: 'Outra aba' } }}
      activeViewId={firstId}
      onViewChange={vi.fn()}
      onViewOrderChange={onViewOrderChange}
    />)
    const tab = screen.getByRole('button', { name: 'Tabela' })
    const source = tab.parentElement!
    vi.spyOn(source, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 98, 30))
    tab.focus()
    fireEvent.keyDown(tab, { key: ' ', code: 'Space' })
    await waitFor(() => expect(document.querySelector('[data-view-drag-overlay]')).not.toBeNull())
    expect(source.querySelector('[data-drag-placeholder]')).not.toBeNull()
    expect(source.style.width).toBe('98px')
    expect(source.style.height).toBe('30px')
    fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' })
    await waitFor(() => expect(document.querySelector('[data-view-drag-overlay]')).toBeNull())
    expect(source.querySelector('[data-drag-placeholder]')).toBeNull()
    expect(source.style.width).toBe('')
    expect(source.style.height).toBe('')
    expect(onViewOrderChange).not.toHaveBeenCalled()
  })

  it('ordena a renderização pelo campo persistido e só habilita drag com callback', () => {
    const secondId = '01KXVZ0000VIEW00000000002'
    const orderedSettings: DataViewSettings = {
      ...settings,
      [secondId]: {
        ...settings['01KXVZ0000VIEW00000000001'],
        name: 'Grafo',
        view: 'graph',
        order: 0,
      },
      '01KXVZ0000VIEW00000000001': {
        ...settings['01KXVZ0000VIEW00000000001'],
        order: 1,
      },
    }
    const { rerender } = render(
      <ViewTabsBar
        settings={orderedSettings}
        activeViewId={secondId}
        onViewChange={vi.fn()}
        onViewOrderChange={vi.fn()}
      />,
    )
    expect(document.querySelectorAll('[data-sortable-view]')[0]?.textContent).toContain('Grafo')
    expect(screen.getByRole('button', { name: 'Grafo' }).className).toContain('cursor-grab')

    rerender(<ViewTabsBar settings={orderedSettings} activeViewId={secondId} onViewChange={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Grafo' }).className).not.toContain('cursor-grab')
  })

  it('insere a view no índice do drop e desloca as intermediárias sem fazer swap', () => {
    const firstId = '01KXVZ0000VIEW00000000001'
    const secondId = '01KXVZ0000VIEW00000000002'
    const thirdId = '01KXVZ0000VIEW00000000003'
    const fourthId = '01KXVZ0000VIEW00000000004'
    const original = [firstId, secondId, thirdId, fourthId]

    expect(reorderViewIds(original, thirdId, firstId)).toEqual([
      thirdId,
      firstId,
      secondId,
      fourthId,
    ])
    expect(reorderViewIds(original, firstId, thirdId)).toEqual([
      secondId,
      thirdId,
      firstId,
      fourthId,
    ])
    expect(reorderViewIds(original, 'ausente', secondId)).toBe(original)
  })
})
