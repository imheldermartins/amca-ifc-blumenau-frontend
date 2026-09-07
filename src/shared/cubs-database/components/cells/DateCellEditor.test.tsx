import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { HeaderCol } from '../../types'
import { DateCellEditor } from './DateCellEditor'

afterEach(() => cleanup())

const column: HeaderCol = {
  id: '01KXVZ0000COLUMN00000002',
  title: 'Prazo',
  type: 'date',
}

describe('DateCellEditor', () => {
  it('commita o wire confirmado pelo date picker', () => {
    const onCommit = vi.fn()
    render(
      <DateCellEditor
        column={column}
        rowId="01KXVZ0000ROW000000000001"
        value={null}
        onCommit={onCommit}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Prazo' }))
    fireEvent.change(screen.getByLabelText('Data'), { target: { value: '04092026' } })
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar' }))

    expect(onCommit).toHaveBeenCalledWith('2026-09-04T00:00:00.000Z')
  })

  it('fecha o calendário e descarta o rascunho quando o receiver muda o valor', async () => {
    const onCommit = vi.fn()
    const onExternalConflict = vi.fn()
    const props = {
      column,
      rowId: '01KXVZ0000ROW000000000001',
      onCommit,
      onExternalConflict,
    }
    const view = render(
      <DateCellEditor {...props} value="2026-09-04T00:00:00.000Z" />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Prazo' }))
    fireEvent.change(screen.getByLabelText('Data'), { target: { value: '10092026' } })

    view.rerender(
      <DateCellEditor {...props} value="2026-09-06T00:00:00.000Z" />,
    )

    await waitFor(() => expect(onExternalConflict).toHaveBeenCalledOnce())
    await waitFor(() => expect(screen.queryByRole('grid')).toBeNull())
    expect(screen.getByRole('button', { name: 'Prazo' }).textContent).toContain('06/09/2026')
    expect(onCommit).not.toHaveBeenCalled()
  })
})
