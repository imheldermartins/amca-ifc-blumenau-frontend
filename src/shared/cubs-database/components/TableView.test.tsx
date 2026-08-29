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

  it('mantém nome e máscara, mas não oferece tipo/reset para a coluna title', () => {
    render(
      <TableView
        columns={[{ ...column, id: 'page_title', key: 'title' }]}
        rows={[]}
        onColumnRename={() => undefined}
        onColumnTypeChange={() => undefined}
        onColumnConfigChange={() => undefined}
        onColumnReset={() => undefined}
        labels={{
          renameColumn: 'Renomear coluna',
          changeType: 'Mudar tipo',
          maskMenu: 'Máscara',
          resetType: 'Resetar tipo',
        }}
      />,
    )

    fireEvent.contextMenu(screen.getByRole('columnheader'))

    expect(screen.getByRole('textbox', { name: 'Renomear coluna' })).not.toBeNull()
    expect(screen.getByText('Máscara')).not.toBeNull()
    expect(screen.queryByText('Mudar tipo')).toBeNull()
    expect(screen.queryByText('Resetar tipo')).toBeNull()
  })
})

describe('TableView — zebra', () => {
  it('usa contrast nas linhas visuais ímpares, começando pela primeira', () => {
    render(
      <TableView
        columns={[{ id: 'column-1', title: 'Nome', type: 'text' }]}
        rows={[
          { id: 'row-1', cells: { 'column-1': { value: 'Primeira' } } },
          { id: 'row-2', cells: { 'column-1': { value: 'Segunda' } } },
        ]}
      />,
    )

    const [, firstRow, secondRow] = screen.getAllByRole('row')

    expect(firstRow.className).toContain('bg-contrast')
    expect(secondRow.className).toContain('bg-background')
  })
})

describe('TableView — adição guiada', () => {
  it('expõe os dois eixos como botões e encaminha os cliques', () => {
    const onAddRow = vi.fn()
    const onAddColumn = vi.fn()

    render(
      <TableView
        columns={[{ id: 'column-1', title: 'Nome', type: 'text' }]}
        rows={[]}
        onAddRow={onAddRow}
        onAddColumn={onAddColumn}
        labels={{ addRow: 'Nova linha', addColumn: 'Nova coluna' }}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Nova linha' }))
    fireEvent.click(screen.getByRole('button', { name: 'Nova coluna' }))

    expect(onAddRow).toHaveBeenCalledOnce()
    expect(onAddColumn).toHaveBeenCalledOnce()
  })

  it('faz o indicador acompanhar e limitar o ponteiro no eixo do trilho', () => {
    render(
      <TableView
        columns={[{ id: 'column-1', title: 'Nome', type: 'text' }]}
        rows={[]}
        onAddRow={() => undefined}
        onAddColumn={() => undefined}
        labels={{ addRow: 'Nova linha', addColumn: 'Nova coluna' }}
      />,
    )

    const rowControl = screen.getByRole('button', { name: 'Nova linha' })
    const columnControl = screen.getByRole('button', { name: 'Nova coluna' })
    const rowIndicator = rowControl.querySelector<HTMLElement>('[data-guided-add-indicator]')
    const columnIndicator = columnControl.querySelector<HTMLElement>('[data-guided-add-indicator]')

    expect(rowControl.className).toContain('dark:hover:bg-contrast')
    expect(columnControl.className).toContain('dark:hover:bg-contrast')
    expect(rowIndicator?.style.left).toBe('14px')
    expect(columnIndicator?.style.top).toBe('14px')

    vi.spyOn(rowControl, 'getBoundingClientRect').mockReturnValue({
      left: 10,
      top: 20,
      width: 200,
      height: 36,
      right: 210,
      bottom: 56,
      x: 10,
      y: 20,
      toJSON: () => ({}),
    })
    vi.spyOn(columnControl, 'getBoundingClientRect').mockReturnValue({
      left: 210,
      top: 20,
      width: 36,
      height: 160,
      right: 246,
      bottom: 180,
      x: 210,
      y: 20,
      toJSON: () => ({}),
    })

    fireEvent(rowControl, new MouseEvent('pointermove', { bubbles: true, clientX: 90, clientY: 38 }))
    fireEvent(
      columnControl,
      new MouseEvent('pointermove', { bubbles: true, clientX: 228, clientY: 999 }),
    )

    expect(rowIndicator?.style.left).toBe('80px')
    expect(columnIndicator?.style.top).toBe('146px')

    fireEvent.pointerLeave(rowControl)
    fireEvent.pointerLeave(columnControl)
    expect(rowIndicator?.style.left).toBe('14px')
    expect(columnIndicator?.style.top).toBe('14px')
  })
})
