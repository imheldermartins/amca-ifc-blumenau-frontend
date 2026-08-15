import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { HeaderCol } from '../../types'
import { SelectCellEditor } from './SelectCellEditor'

const FIRST = '01KXVZ0000OPTION0000000001'
const SECOND = '01KXVZ0000OPTION0000000002'
const column: HeaderCol = {
  id: '01KXVZ0000COLUMN00000001',
  title: 'Status',
  type: 'select',
  options: [
    { id: FIRST, label: 'Backlog' },
    { id: SECOND, label: 'Em andamento' },
  ],
}

describe('SelectCellEditor — receiver autoritativo', () => {
  it('fecha o select aberto e não commita a seleção stale quando o valor externo muda', async () => {
    const onCommit = vi.fn()
    const onExternalConflict = vi.fn()
    const props = {
      column,
      rowId: '01KXVZ0000ROW000000000001',
      onCommit,
      onExternalConflict,
    }
    const view = render(<SelectCellEditor {...props} value={FIRST} />)

    fireEvent.click(screen.getByRole('button', { name: 'Status' }))
    expect(screen.getAllByRole('button', { name: 'Arrastar option' })).toHaveLength(2)

    view.rerender(<SelectCellEditor {...props} value={SECOND} />)

    await waitFor(() => expect(onExternalConflict).toHaveBeenCalledTimes(1))
    await waitFor(() =>
      expect(screen.queryAllByRole('button', { name: 'Arrastar option' })).toHaveLength(0),
    )
    expect(screen.getByRole('button', { name: 'Status' }).textContent).toContain('Em andamento')
    expect(onCommit).not.toHaveBeenCalled()
  })
})
