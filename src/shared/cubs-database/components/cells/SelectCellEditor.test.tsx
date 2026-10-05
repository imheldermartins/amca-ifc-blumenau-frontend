import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

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

afterEach(() => cleanup())

describe('SelectCellEditor — seleção e opções', () => {
  it.each([
    [undefined, FIRST],
    [SECOND, FIRST],
    [FIRST, null],
  ])('alterna a opção clicada quando o valor atual é %s', (value, expected) => {
    const onCommit = vi.fn()
    render(<SelectCellEditor column={column} rowId="row-1" value={value} onCommit={onCommit} />)
    fireEvent.click(screen.getByRole('button', { name: 'Status' }))
    fireEvent.click(screen.getByRole('button', { name: 'Backlog' }))
    expect(onCommit).toHaveBeenCalledExactlyOnceWith(expected)
    expect(screen.queryByRole('button', { name: 'Em andamento' })).toBeNull()
  })

  it('permite adicionar e renomear a primeira opção usando o editor do header', () => {
    const onOptionsChange = vi.fn()
    const onCommit = vi.fn()
    const props = { rowId: 'row-1', value: undefined, onCommit, onOptionsChange }
    const { rerender } = render(<SelectCellEditor {...props} column={{ ...column, options: [] }} />)
    fireEvent.click(screen.getByRole('button', { name: 'Status' }))
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar opção' }))
    const created = onOptionsChange.mock.calls[0][0] as HeaderCol['options']
    expect(created).toEqual([{ id: expect.stringMatching(/^[0-9A-HJKMNP-TV-Z]{26}$/), label: '' }])
    expect(onCommit).not.toHaveBeenCalled()

    rerender(<SelectCellEditor {...props} column={{ ...column, options: created }} />)
    const name = screen.getByRole('textbox', { name: 'Nome da opção' })
    fireEvent.focus(name)
    fireEvent.change(name, { target: { value: 'Nova opção' } })
    fireEvent.blur(name)
    expect(onOptionsChange).toHaveBeenLastCalledWith([{ ...created![0], label: 'Nova opção' }])
    rerender(<SelectCellEditor {...props} column={{ ...column, options: [{ ...created![0], label: 'Nova opção' }] }} />)
    fireEvent.click(screen.getByRole('button', { name: 'Selecionar opção' }))
    fireEvent.click(screen.getByRole('button', { name: 'Nova opção' }))
    expect(onCommit).toHaveBeenCalledExactlyOnceWith(created![0].id)
  })

  it('oferece o mesmo editor para adicionar e excluir opções de uma coluna já configurada', () => {
    const onOptionsChange = vi.fn()
    render(<SelectCellEditor column={column} rowId="row-1" value={FIRST} onCommit={vi.fn()} onOptionsChange={onOptionsChange} />)
    fireEvent.click(screen.getByRole('button', { name: 'Status' }))
    fireEvent.click(screen.getByRole('button', { name: 'Opções' }))
    expect(screen.getAllByRole('textbox', { name: 'Nome da opção' })).toHaveLength(2)
    fireEvent.click(screen.getAllByRole('button', { name: 'Excluir opção' })[0])
    expect(onOptionsChange).toHaveBeenCalledWith([column.options![1]])
  })

  it('não oferece criação de opções sem o handler de configuração da coluna', () => {
    render(<SelectCellEditor column={{ ...column, options: [] }} rowId="row-1" value={undefined} onCommit={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Status' }))
    expect(screen.queryByRole('button', { name: 'Adicionar opção' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Opções' })).toBeNull()
  })
})

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
