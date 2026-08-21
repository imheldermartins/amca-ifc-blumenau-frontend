import { fireEvent, render, screen } from '@testing-library/react'
import { cleanup } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { TableView } from './TableView'

afterEach(() => cleanup())

describe('TableView — menu da coluna', () => {
  const column = { id: 'column-1', title: 'Nome', type: 'text' as const }

  it('abre o ContextMenu com clique simples no drag-handle', () => {
    render(
      <TableView
        columns={[column]}
        rows={[]}
        onColumnOrderChange={() => undefined}
        onColumnRename={() => undefined}
        labels={{ dragColumn: 'Arrastar coluna', renameColumn: 'Renomear coluna' }}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Arrastar coluna' }))

    expect(screen.getByRole('textbox', { name: 'Renomear coluna' })).not.toBeNull()
  })

  it('preserva o menu no primeiro pointerdown externo para o blur confirmar o rename', () => {
    const onRename = vi.fn()
    render(
      <TableView
        columns={[column]}
        rows={[]}
        onColumnOrderChange={() => undefined}
        onColumnRename={onRename}
        labels={{ dragColumn: 'Arrastar coluna', renameColumn: 'Renomear coluna' }}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Arrastar coluna' }))
    const input = screen.getByRole('textbox', { name: 'Renomear coluna' })
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'Nome atualizado' } })

    // `pointerdown` acontece antes do blur no browser. O menu precisa existir
    // até o blur rodar; caso contrário o input é desmontado e o commit some.
    fireEvent.pointerDown(document.body)
    expect(document.body.contains(input)).toBe(true)

    fireEvent.blur(input)

    expect(onRename).toHaveBeenCalledWith('column-1', 'Nome atualizado')
    expect(screen.queryByRole('textbox', { name: 'Renomear coluna' })).toBeNull()
  })

  it('bloqueia somente uma tentativa de fechamento enquanto o blur está pendente', () => {
    render(
      <TableView
        columns={[column]}
        rows={[]}
        onColumnOrderChange={() => undefined}
        onColumnRename={() => undefined}
        labels={{ dragColumn: 'Arrastar coluna', renameColumn: 'Renomear coluna' }}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Arrastar coluna' }))
    const input = screen.getByRole('textbox', { name: 'Renomear coluna' })
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'Em edição' } })

    fireEvent.pointerDown(document.body)
    expect(document.body.contains(input)).toBe(true)

    // Se por algum motivo o alvo não provocar blur, um segundo clique fora
    // ainda fecha o painel: a prioridade é consumida uma única vez.
    fireEvent.pointerDown(document.body)
    expect(screen.queryByRole('textbox', { name: 'Renomear coluna' })).toBeNull()
  })
})
