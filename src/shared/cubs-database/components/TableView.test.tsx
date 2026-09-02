import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { cleanup } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { TableView } from './TableView'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

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

    const dragHandle = screen.getByRole('button', { name: 'Arrastar coluna' })
    const tableContent = screen.getByRole('table').firstElementChild as HTMLElement

    expect(dragHandle.className).toContain('px-2')
    expect(dragHandle.className).toContain('py-1')
    expect(tableContent.className).not.toContain('pt-3')

    fireEvent.click(dragHandle)

    expect(screen.getByRole('textbox', { name: 'Renomear coluna' })).not.toBeNull()
  })

  it('mantém o handle sobreposto alinhado durante o scroll horizontal', () => {
    render(
      <TableView
        columns={[column]}
        rows={[]}
        onColumnOrderChange={() => undefined}
        labels={{ dragColumn: 'Arrastar coluna' }}
      />,
    )

    const table = screen.getByRole('table')
    const dragHandle = screen.getByRole('button', { name: 'Arrastar coluna' })

    expect(dragHandle.style.left).toBe('0px')
    fireEvent.scroll(table, { target: { scrollLeft: 40 } })
    expect(dragHandle.style.left).toBe('-40px')
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

describe('TableView — agrupamento e seleção visível', () => {
  const columns = [
    { id: 'name', title: 'Nome', type: 'text' as const },
    { id: 'area', title: 'Área', type: 'text' as const },
  ]

  it('indenta linhas agrupadas e não ativa sortable de linha', () => {
    render(
      <TableView
        columns={columns}
        rows={[
          { id: '1', cells: { name: { value: 'Ana' }, area: { value: 'Admin' } } },
        ]}
        groupBy={['area']}
        onRowOrderChange={() => undefined}
      />,
    )

    const row = screen.getAllByRole('row')[1]
    const controlCell = row.querySelector('[role="cell"]') as HTMLElement
    const drag = screen.getByRole('button', { name: 'Arrastar linha' })
    expect(controlCell.style.paddingLeft).toBe('10px')
    expect(drag.hasAttribute('aria-describedby')).toBe(false)
  })

  it('remove da seleção ids que um filtro tirou da lista visível', async () => {
    const onSelectionChange = vi.fn()
    const rows = [
      { id: '1', cells: { name: { value: 'Ana' }, area: { value: 'Admin' } } },
      { id: '2', cells: { name: { value: 'Bia' }, area: { value: 'Tech' } } },
    ]
    const { rerender } = render(
      <TableView
        columns={columns}
        rows={rows}
        onSelectionChange={onSelectionChange}
      />,
    )
    fireEvent.click(screen.getAllByRole('checkbox', { name: 'Selecionar linha' })[0])
    await waitFor(() => expect(onSelectionChange).toHaveBeenLastCalledWith(['1']))

    rerender(
      <TableView
        columns={columns}
        rows={[rows[1]]}
        onSelectionChange={onSelectionChange}
      />,
    )
    await waitFor(() => expect(onSelectionChange).toHaveBeenLastCalledWith([]))
  })

  it('usa a ordem visual achatada dos grupos na seleção com Shift', async () => {
    const onSelectionChange = vi.fn()
    render(
      <TableView
        columns={columns}
        rows={[
          { id: '1', cells: { name: { value: 'Ana' }, area: { value: 'A' } } },
          { id: '2', cells: { name: { value: 'Bia' }, area: { value: 'B' } } },
          { id: '3', cells: { name: { value: 'Caio' }, area: { value: 'A' } } },
        ]}
        groupBy={['area']}
        onSelectionChange={onSelectionChange}
      />,
    )

    const checkboxes = screen.getAllByRole('checkbox', { name: 'Selecionar linha' })
    fireEvent.click(checkboxes[0])
    fireEvent.click(checkboxes[1], { shiftKey: true })

    await waitFor(() => expect(onSelectionChange).toHaveBeenLastCalledWith(['1', '3']))
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

describe('TableView — resize suave', () => {
  it('coalesce previews por frame e persiste a última largura no pointerup', () => {
    const onColumnWidthPreview = vi.fn()
    const onColumnWidthChange = vi.fn()
    const frames: FrameRequestCallback[] = []
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      frames.push(callback)
      return frames.length
    })
    const cancelFrame = vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined)

    render(
      <TableView
        columns={[{ id: 'column-1', title: 'Nome', type: 'text' }]}
        rows={[]}
        onColumnWidthPreview={onColumnWidthPreview}
        onColumnWidthChange={onColumnWidthChange}
        labels={{ resizeColumn: 'Redimensionar coluna' }}
      />,
    )

    const handle = screen.getByRole('separator', { name: 'Redimensionar coluna' })
    Object.defineProperties(handle, {
      setPointerCapture: { value: vi.fn() },
      releasePointerCapture: { value: vi.fn() },
    })

    fireEvent(handle, new MouseEvent('pointerdown', { bubbles: true, clientX: 100 }))
    fireEvent(handle, new MouseEvent('pointermove', { bubbles: true, clientX: 140 }))
    fireEvent(handle, new MouseEvent('pointermove', { bubbles: true, clientX: 180 }))

    expect(onColumnWidthPreview).not.toHaveBeenCalled()
    expect(frames).toHaveLength(1)
    frames[0](0)
    expect(onColumnWidthPreview).toHaveBeenLastCalledWith('column-1', 256)

    fireEvent(handle, new MouseEvent('pointermove', { bubbles: true, clientX: 200 }))
    fireEvent(handle, new MouseEvent('pointerup', { bubbles: true, clientX: 200 }))

    expect(cancelFrame).toHaveBeenCalledWith(2)
    expect(onColumnWidthPreview).toHaveBeenLastCalledWith('column-1', 276)
    expect(onColumnWidthChange).toHaveBeenCalledWith({ 'column-1': 276 })
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
    expect(
      screen.getByRole('table').contains(screen.getByRole('button', { name: 'Nova linha' })),
    ).toBe(false)
    expect(
      screen.getByRole('table').contains(screen.getByRole('button', { name: 'Nova coluna' })),
    ).toBe(false)

    const guidedControls = screen
      .getByRole('button', { name: 'Nova linha' })
      .closest<HTMLElement>('[data-guided-add-controls]')
    if (!guidedControls) throw new Error('Moldura dos controles guiados não renderizada')
    expect(guidedControls.className).toContain('gap-2')
    expect(screen.getByRole('table').className).toContain('rounded-xl')
    expect(screen.getByRole('button', { name: 'Nova linha' }).className).toContain('rounded-xl')
    expect(screen.getByRole('button', { name: 'Nova coluna' }).className).toContain('rounded-xl')
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

describe('TableView — virtual scroller', () => {
  it('sincroniza o scroll flutuante e some quando a barra real chega à viewport', () => {
    let tableBottom = 900
    const frames: FrameRequestCallback[] = []

    vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(500)
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      frames.push(callback)
      return frames.length
    })
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(function (
      this: HTMLElement,
    ) {
      return this.hasAttribute('data-table-scroll-viewport') ? 300 : 0
    })
    vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockImplementation(function (
      this: HTMLElement,
    ) {
      return this.hasAttribute('data-table-scroll-viewport') || this.classList.contains('w-max')
        ? 700
        : 0
    })
    vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockImplementation(function (
      this: HTMLElement,
    ) {
      return this.classList.contains('w-max') ? 700 : 0
    })
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: HTMLElement,
    ) {
      if (this.hasAttribute('data-table-scroll-viewport')) {
        return {
          left: 80,
          top: 100,
          width: 300,
          height: tableBottom - 100,
          right: 380,
          bottom: tableBottom,
          x: 80,
          y: 100,
          toJSON: () => ({}),
        }
      }
      return {
        left: 0,
        top: 0,
        width: 0,
        height: 0,
        right: 0,
        bottom: 0,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }
    })

    render(
      <TableView
        columns={[
          { id: 'column-1', title: 'Nome', type: 'text' },
          { id: 'column-2', title: 'Descrição', type: 'text' },
        ]}
        rows={[]}
      />,
    )

    const table = screen.getByRole('table') as HTMLDivElement
    const virtualScroller = document.querySelector<HTMLDivElement>('[data-virtual-scroller]')
    expect(virtualScroller).not.toBeNull()
    expect(virtualScroller?.style.left).toBe('80px')
    expect(virtualScroller?.style.width).toBe('300px')

    if (!virtualScroller) throw new Error('Virtual scroller não renderizado')
    fireEvent.scroll(virtualScroller, { target: { scrollLeft: 120 } })
    expect(table.scrollLeft).toBe(120)

    fireEvent.scroll(table, { target: { scrollLeft: 48 } })
    expect(virtualScroller.scrollLeft).toBe(48)

    tableBottom = 480
    fireEvent(window, new Event('resize'))
    act(() => frames.shift()?.(0))

    expect(document.querySelector('[data-virtual-scroller]')).toBeNull()
  })
})
