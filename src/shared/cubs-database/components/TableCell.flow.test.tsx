import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { HeaderCol, RowData } from '../types'
import { TableCell } from './TableCell'

const column: HeaderCol = {
  id: 'flow-column',
  title: 'Aprovação',
  type: 'flow',
  flow: {
    version: 1,
    trigger: { type: 'manual' },
    nodes: [
      { id: 'start', type: 'start', config: { nextNodeId: 'callback' } },
      { id: 'callback', type: 'callback', config: { message: 'Concluído' } },
    ],
  },
}
const row: RowData = { id: 'page-1', cells: {} }

afterEach(() => cleanup())

describe('TableCell — flow', () => {
  it('recorta o preview e abre a execução pelo botão outlined', () => {
    const onFlowOpen = vi.fn()
    render(<TableCell
      column={column}
      row={row}
      columnType="flow"
      onFlowOpen={onFlowOpen}
    />)

    const cell = screen.getByRole('cell')
    const execute = screen.getByRole('button', { name: 'Executar' })
    expect(cell.classList.contains('overflow-clip')).toBe(true)
    expect(execute.classList.contains('border-p-purple')).toBe(true)
    expect(execute.classList.contains('bg-p-purple-500/5')).toBe(true)

    fireEvent.click(execute)
    expect(onFlowOpen).toHaveBeenCalledWith(row, column)
  })

  it('não oferece execução quando a coluna está bloqueada', () => {
    render(<TableCell
      column={column}
      row={row}
      columnType="flow"
      locked
      onFlowOpen={vi.fn()}
    />)

    expect(screen.queryByRole('button', { name: 'Executar' })).toBeNull()
    expect(screen.getByRole('cell').getAttribute('title')).toBe('Coluna bloqueada')
  })
})
