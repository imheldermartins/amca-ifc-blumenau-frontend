import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { HeaderCol, RowData } from '../types'
import { TableCell } from './TableCell'

const column: HeaderCol = { id: 'approved', title: 'Aprovado', type: 'checkbox' }
const row: RowData = { id: 'page-1', cells: { approved: { value: true } } }

afterEach(() => cleanup())

describe('TableCell — checkbox', () => {
  it('centraliza o mesmo controle nos modos de leitura e edição', () => {
    const { rerender } = render(<TableCell column={column} row={row} columnType="checkbox" />)

    const readCell = screen.getByRole('cell')
    const readValue = readCell.firstElementChild
    expect(readCell.classList.contains('justify-center')).toBe(true)
    expect(readValue?.classList.contains('w-full')).toBe(true)
    expect(readValue?.classList.contains('flex-1')).toBe(true)
    expect(readValue?.classList.contains('justify-center')).toBe(true)

    rerender(<TableCell
      column={column}
      row={row}
      columnType="checkbox"
      onCellChange={vi.fn()}
    />)

    const editCell = screen.getByRole('cell')
    const editorWrapper = screen.getByRole('checkbox', { name: 'Aprovado' }).parentElement
    expect(editCell.classList.contains('justify-center')).toBe(true)
    expect(editorWrapper?.classList.contains('w-full')).toBe(true)
    expect(editorWrapper?.classList.contains('flex-1')).toBe(true)
    expect(editorWrapper?.classList.contains('justify-center')).toBe(true)
  })
})
