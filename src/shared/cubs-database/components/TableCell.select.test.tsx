import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { PageWriteService } from '@/services/PageWriteService'
import type { CellChange, HeaderCol } from '../types'
import { TableCell } from './TableCell'

const api = vi.hoisted(() => ({ delete: vi.fn(), post: vi.fn(), put: vi.fn() }))
vi.mock('@/services/ApiService', () => ({ apiService: api }))

const column: HeaderCol = { id: 'column-1', title: 'Status', type: 'select', options: [] }
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('TableCell — opções de select e limpeza', () => {
  it('associa a criação de opções ao id da coluna, sem preencher a célula', () => {
    const onColumnOptionsChange = vi.fn()
    const onCellChange = vi.fn()
    render(<TableCell column={column} row={{ id: 'row-1', cells: {} }} onCellChange={onCellChange} onColumnOptionsChange={onColumnOptionsChange} />)
    fireEvent.click(screen.getByRole('button', { name: 'Status' }))
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar opção' }))
    expect(onColumnOptionsChange).toHaveBeenCalledWith(column.id, [{ id: expect.any(String), label: '' }])
    expect(onCellChange).not.toHaveBeenCalled()
  })

  it('clicar na opção atual limpa a célula pelo DELETE existente', () => {
    api.delete.mockResolvedValue(undefined)
    const onCellChange = vi.fn((change: CellChange) => { void new PageWriteService().saveCell(change) })
    render(<TableCell
      column={{ ...column, options: [{ id: 'option-1', label: 'Backlog' }] }}
      row={{ id: 'row-1', cells: { [column.id]: { value: 'option-1' } } }}
      onCellChange={onCellChange}
    />)
    fireEvent.click(screen.getByRole('button', { name: 'Status' }))
    fireEvent.click(screen.getByRole('button', { name: 'Backlog' }))
    expect(onCellChange).toHaveBeenCalledWith({ rowId: 'row-1', columnId: column.id, value: null, previousValue: 'option-1' })
    expect(api.delete).toHaveBeenCalledWith('/pages/row-1/column/column-1/value')
    expect(api.put).not.toHaveBeenCalled()
    expect(api.post).not.toHaveBeenCalled()
  })
})
