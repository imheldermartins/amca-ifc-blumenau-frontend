import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { DndContextProps } from '@dnd-kit/core'
import type { HeaderCol, RowData } from '../types'
import { BOARD_UNASSIGNED } from '../boardView'
import { BoardView } from './BoardView'
import type { DatabasePagination } from '../pagination'

const dnd = vi.hoisted(() => ({ props: {} as DndContextProps }))
vi.mock('@dnd-kit/core', async (original) => {
  const module = await original<typeof import('@dnd-kit/core')>()
  return { ...module, DndContext: (props: DndContextProps) => { dnd.props = props; return props.children },
    DragOverlay: ({ children }: { children: React.ReactNode }) => <div data-testid="overlay">{children}</div> }
})
const SELECT = '01KXVZ00000000000000000001'
const FIRST = '01KXVZ00000000000000000002'
const SECOND = '01KXVZ00000000000000000003'
const PROP = '01KXVZ00000000000000000004'
const FLOW = '01KXVZ00000000000000000005'
const columns: HeaderCol[] = [
  { id: 'page_title', key: 'title', title: 'Nome', type: 'text' },
  { id: SELECT, title: 'Tema', type: 'select', options: [{ id: FIRST, label: 'Primeiro', color: 'blue' }, { id: SECOND, label: 'Segundo', color: 'orange' }] },
  { id: PROP, title: 'Descrição', type: 'text' },
  { id: FLOW, title: 'Ação', type: 'flow', flow: { version: 2, trigger: { type: 'manual' }, nodes: [
    { id: 'start', type: 'start', config: {} }, { id: 'callback', type: 'callback', config: {} },
  ] } },
]
const rows: RowData[] = [
  { id: 'one', cells: { page_title: { value: 'Página um' }, [SELECT]: { value: FIRST }, [PROP]: { value: 'Texto' } } },
  { id: 'two', cells: { page_title: { value: 'Página dois' } } },
]
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks() })
function dragStart() {
  const item = { id: 'card:one', data: { current: { kind: 'card', rowId: 'one', optionKey: FIRST, measure: () => ({ width: 302, height: 124 }) } }, rect: { current: { initial: null, translated: { top: 0, height: 124 } } } }
  act(() => dnd.props.onDragStart?.({ active: item } as never))
  return item
}
function dragOver(item: ReturnType<typeof dragStart>, key = SECOND) {
  const target = { id: `column:${key}`, data: { current: { kind: 'column', optionKey: key } }, rect: { top: 0, height: 300 } }
  act(() => dnd.props.onDragOver?.({ active: item, over: target } as never))
  return target
}
describe('BoardView', () => {
  it('does not resurrect a newly created editor after realtime deletion and balances interaction ownership', async () => {
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(320)
    vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(320)
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(320)
    const created = { id: 'created', cells: { page_title: { value: 'Criada' }, [SELECT]: { value: FIRST } } }
    const interactions = vi.fn()
    const pagination: DatabasePagination = { projection: null, streams: {}, loadNext: vi.fn(), loadPrevious: vi.fn(), ensureScope: vi.fn(), setScope: vi.fn(), pinRow: vi.fn(), onInteractionChange: interactions, loading: false }
    const create = vi.fn(async () => created)
    const props = { columns, rows: [], onCreateRow: create, onCellChange: vi.fn(), pagination }
    const { rerender } = render(<BoardView {...props} />)
    expect(interactions).not.toHaveBeenCalled()
    fireEvent.click(screen.getAllByRole('button', { name: 'Adicionar card' })[0])
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Nome' })).toBeTruthy())
    rerender(<BoardView {...props} pagination={{ ...pagination, deletedRowIds: ['created'] }} />)
    await waitFor(() => expect(screen.queryByRole('textbox', { name: 'Nome' })).toBeNull())
    expect(screen.queryByText('Criada')).toBeNull()
    expect(interactions.mock.calls.filter(([active]) => active === true)).toHaveLength(interactions.mock.calls.filter(([active]) => active === false).length)
  })
  it('sends relative anchors rather than a truncated order when moving a paginated card', async () => {
    const move = vi.fn(async () => undefined)
    const pagination: DatabasePagination = {
      projection: { version: 1, kind: 'board', pageId: 'root', viewId: 'board', queryKey: 'q', orderRevision: 1, total: 10000, windows: [],
        groups: [{ key: FIRST, value: FIRST, label: 'Primeiro', color: 'blue', path: [], total: 5000 },
          { key: SECOND, value: SECOND, label: 'Segundo', color: 'orange', path: [], total: 5000 }] },
      streams: {
        [`board:${FIRST}`]: { scope: { type: 'board', optionId: FIRST }, rows: [rows[0]], total: 5000, hasNextPage: true, hasPreviousPage: false, isFetching: false, beforeHeight: 0, afterHeight: 0 },
        [`board:${SECOND}`]: { scope: { type: 'board', optionId: SECOND }, rows: [], total: 5000, hasNextPage: true, hasPreviousPage: false, isFetching: false, beforeHeight: 0, afterHeight: 0 },
      },
      loadNext: vi.fn(), loadPrevious: vi.fn(), ensureScope: vi.fn(), setScope: vi.fn(), pinRow: vi.fn(), onInteractionChange: vi.fn(), loading: false,
    }
    render(<BoardView columns={columns} rows={rows} onMove={move} onCellChange={vi.fn()} pagination={pagination} />)
    const item = dragStart(), target = dragOver(item)
    await act(async () => { dnd.props.onDragEnd?.({ active: item, over: target } as never) })
    expect(move).toHaveBeenCalledExactlyOnceWith({ rowId: 'one', selectColumnId: SELECT, optionId: SECOND,
      previousOptionId: FIRST, beforeId: undefined, afterId: undefined, boundary: 'start' })
    expect(pagination.pinRow).toHaveBeenCalledWith('one', true)
    expect(pagination.pinRow).toHaveBeenCalledWith('one', false)
  })
  it('renames only the selected option by ULID and preserves its color and siblings', () => {
    const change = vi.fn()
    render(<BoardView columns={columns} rows={rows} onColumnOptionsChange={change} />)
    fireEvent.doubleClick(screen.getAllByText('Primeiro')[0]!)
    const input = screen.getByRole('textbox', { name: 'Nome da opção' })
    expect(input).toBe(document.activeElement)
    fireEvent.change(input, { target: { value: 'Novo nome' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(change).toHaveBeenCalledExactlyOnceWith(SELECT, [
      { id: FIRST, label: 'Novo nome', color: 'blue' }, { id: SECOND, label: 'Segundo', color: 'orange' },
    ])
    expect(screen.queryByRole('textbox', { name: 'Nome da opção' })).toBeNull()
  })

  it('changes the selected color while retaining current labels after realtime updates', () => {
    const change = vi.fn()
    const { rerender } = render(<BoardView columns={columns} rows={rows} onColumnOptionsChange={change} />)
    fireEvent.keyDown(screen.getByRole('button', { name: 'Editar opção Primeiro' }), { key: 'Enter' })
    const updated = columns.map((col) => col.id === SELECT ? { ...col, options: col.options!.map((option) => ({ ...option, label: `${option.label} atualizado` })) } : col)
    rerender(<BoardView columns={updated} rows={rows} onColumnOptionsChange={change} />)
    fireEvent.click(screen.getByRole('button', { name: 'Cor da opção' }))
    fireEvent.click(screen.getByRole('button', { name: 'green' }))
    expect(change).toHaveBeenCalledExactlyOnceWith(SELECT, [
      { id: FIRST, label: 'Primeiro atualizado', color: 'green' }, { id: SECOND, label: 'Segundo atualizado', color: 'orange' },
    ])
  })

  it('cancels the option name draft and keeps card double click separate', () => {
    const change = vi.fn()
    render(<BoardView columns={columns} rows={rows} onColumnOptionsChange={change} onCellChange={vi.fn()} />)
    fireEvent.doubleClick(screen.getByText('Página um'))
    expect(screen.queryByRole('textbox', { name: 'Nome da opção' })).toBeNull()
    fireEvent.doubleClick(screen.getAllByText('Primeiro')[0]!)
    const input = screen.getByRole('textbox', { name: 'Nome da opção' })
    fireEvent.change(input, { target: { value: 'Descartar' } })
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(change).not.toHaveBeenCalled()
    expect(screen.queryByRole('textbox', { name: 'Nome da opção' })).toBeNull()
  })

  it('closes an open option editor and color picker when the select becomes locked', () => {
    const change = vi.fn()
    const { rerender } = render(<BoardView columns={columns} rows={rows} onColumnOptionsChange={change} />)
    fireEvent.doubleClick(screen.getAllByText('Primeiro')[0]!)
    fireEvent.change(screen.getByRole('textbox', { name: 'Nome da opção' }), { target: { value: 'Rascunho' } })
    fireEvent.click(screen.getByRole('button', { name: 'Cor da opção' }))
    change.mockClear() // Opening the picker blurs and commits the unlocked name first.
    rerender(<BoardView columns={columns} rows={rows} onColumnOptionsChange={change} lockedColumnKeys={new Set([SELECT])} />)
    expect(screen.queryByRole('textbox', { name: 'Nome da opção' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'green' })).toBeNull()
    fireEvent.doubleClick(screen.getAllByText('Primeiro')[0]!)
    fireEvent.doubleClick(screen.getByText('Sem valor'))
    expect(screen.queryByRole('textbox', { name: 'Nome da opção' })).toBeNull()
    expect(change).not.toHaveBeenCalled()
    rerender(<BoardView columns={columns} rows={rows} onColumnOptionsChange={change} />)
    expect(screen.queryByRole('textbox', { name: 'Nome da opção' })).toBeNull()
  })

  it('discards a focused draft if the option is removed or locked before blur', () => {
    const change = vi.fn()
    const { rerender } = render(<BoardView columns={columns} rows={rows} onColumnOptionsChange={change} />)
    fireEvent.doubleClick(screen.getByRole('button', { name: 'Editar opção Primeiro' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Nome da opção' }), { target: { value: 'Não salvar' } })
    rerender(<BoardView columns={columns} rows={rows} onColumnOptionsChange={change} lockedColumnKeys={new Set([SELECT])} />)
    expect(change).not.toHaveBeenCalled()
    expect(screen.queryByRole('textbox', { name: 'Nome da opção' })).toBeNull()
    rerender(<BoardView columns={columns} rows={rows} onColumnOptionsChange={change} />)
    fireEvent.doubleClick(screen.getByRole('button', { name: 'Editar opção Primeiro' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Nome da opção' }), { target: { value: 'Removida' } })
    rerender(<BoardView columns={columns.map((col) => col.id === SELECT ? { ...col, options: col.options!.filter((option) => option.id !== FIRST) } : col)} rows={rows} onColumnOptionsChange={change} />)
    expect(change).not.toHaveBeenCalled()
    expect(screen.queryByRole('textbox', { name: 'Nome da opção' })).toBeNull()
  })

  it('keeps the original slot when a keyboard drag starts without an arrow key', () => {
    render(<BoardView columns={columns} rows={rows} />)
    const targetId = `column:${FIRST}`
    const collisions = dnd.props.collisionDetection?.({
      active: { id: 'card:one', data: { current: { kind: 'card' } } },
      pointerCoordinates: null, collisionRect: new DOMRect(9, 138, 302, 79),
      droppableContainers: [
        { id: targetId, data: { current: { kind: 'column', optionKey: FIRST } } },
        { id: 'card:one', data: { current: { kind: 'card', optionKey: FIRST } } },
        { id: 'card:two', data: { current: { kind: 'card', optionKey: FIRST } } },
      ],
      droppableRects: new Map([
        [targetId, new DOMRect(0, 80, 320, 280)], ['card:one', new DOMRect(9, 138, 302, 79)], ['card:two', new DOMRect(9, 225, 302, 79)],
      ]),
    } as never)
    expect(collisions?.[0]?.id).toBe('card:one')
  })

  it('targets the upper card when the pointer is in the header and the overlay is above that card', () => {
    render(<BoardView columns={columns} rows={rows} />)
    const targetId = `column:${FIRST}`
    const collisions = dnd.props.collisionDetection?.({
      active: { id: 'card:one', data: { current: { kind: 'card' } } },
      pointerCoordinates: { x: 32, y: 110 }, collisionRect: new DOMRect(9, 89, 302, 79),
      droppableContainers: [
        { id: targetId, data: { current: { kind: 'column', optionKey: FIRST } } },
        { id: 'card:one', data: { current: { kind: 'card', optionKey: FIRST } } },
        { id: 'card:upper', data: { current: { kind: 'card', optionKey: FIRST } } },
      ],
      droppableRects: new Map([
        [targetId, new DOMRect(0, 80, 320, 280)],
        ['card:one', new DOMRect(9, 225, 302, 79)],
        ['card:upper', new DOMRect(9, 138, 302, 79)],
      ]),
    } as never)
    expect(collisions?.[0]?.id).toBe('card:upper')
  })

  it('ignores the moving placeholder and uses the nearest card through gaps', () => {
    render(<BoardView columns={columns} rows={rows} />)
    const targetId = `column:${FIRST}`
    const collisions = dnd.props.collisionDetection?.({
      active: { id: 'card:one', data: { current: { kind: 'card' } } },
      pointerCoordinates: { x: 32, y: 210 }, collisionRect: new DOMRect(9, 198, 302, 79),
      droppableContainers: [
        { id: targetId, data: { current: { kind: 'column', optionKey: FIRST } } },
        { id: 'card:one', data: { current: { kind: 'card', optionKey: FIRST } } },
        { id: 'card:upper', data: { current: { kind: 'card', optionKey: FIRST } } },
      ],
      droppableRects: new Map([
        [targetId, new DOMRect(0, 80, 320, 280)],
        ['card:one', new DOMRect(9, 214, 302, 79)],
        ['card:upper', new DOMRect(9, 130, 302, 79)],
      ]),
    } as never)
    expect(collisions?.[0]?.id).toBe('card:upper')
  })

  it('has no pointer destination outside the Boards even if the overlay overlaps a card', () => {
    render(<BoardView columns={columns} rows={rows} />)
    const targetId = `column:${FIRST}`
    const collisions = dnd.props.collisionDetection?.({
      active: { id: 'card:one', data: { current: { kind: 'card' } } },
      pointerCoordinates: { x: -2, y: 180 }, collisionRect: new DOMRect(-20, 140, 302, 79),
      droppableContainers: [
        { id: targetId, data: { current: { kind: 'column', optionKey: FIRST } } },
        { id: 'card:upper', data: { current: { kind: 'card', optionKey: FIRST } } },
      ],
      droppableRects: new Map([[targetId, new DOMRect(0, 80, 320, 280)], ['card:upper', new DOMRect(9, 138, 302, 79)]]),
    } as never)
    expect(collisions).toEqual([])
  })

  it('updates insertion continuously within the same target using the overlay center', async () => {
    const move = vi.fn(async () => undefined)
    const { container } = render(<BoardView columns={columns} rows={[rows[0]!, { ...rows[1]!, cells: { ...rows[1]!.cells, [SELECT]: { value: FIRST } } }]} onMove={move} onCellChange={vi.fn()} />)
    const item = dragStart()
    const target = { id: 'card:two', data: { current: { kind: 'card', rowId: 'two', optionKey: FIRST } }, rect: { top: 140, height: 124 } }
    const placement = () => Array.from(container.querySelector(`[data-board-column="${FIRST}"]`)!.querySelectorAll('[data-board-card],[data-drag-placeholder]')).map((node) => node.getAttribute('data-board-card') ?? 'placeholder')
    item.rect.current.translated.top = 80
    act(() => dnd.props.onDragOver?.({ active: item, over: target } as never))
    expect(placement()).toEqual(['placeholder', 'two'])
    // Both top edges are still above the target midpoint. Only the overlay
    // center crosses it; the target id does not change during this move.
    item.rect.current.translated.top = 141
    act(() => dnd.props.onDragMove?.({ active: item, over: target } as never))
    expect(placement()).toEqual(['two', 'placeholder'])
    act(() => dnd.props.onDragMove?.({ active: item, over: target } as never))
    expect(placement()).toEqual(['two', 'placeholder'])
    item.rect.current.translated.top = 80
    act(() => dnd.props.onDragMove?.({ active: item, over: target } as never))
    expect(placement()).toEqual(['placeholder', 'two'])
    item.rect.current.translated.top = 141
    act(() => dnd.props.onDragMove?.({ active: item, over: target } as never))
    await act(async () => { dnd.props.onDragEnd?.({ active: item, over: target } as never) })
    expect(move).toHaveBeenCalledWith({ rowId: 'one', selectColumnId: SELECT, optionId: FIRST, orderedRows: ['two', 'one'] })
  })

  it('inserts after the next card on ArrowDown rather than stopping at its midpoint', async () => {
    const move = vi.fn(async () => undefined)
    render(<BoardView columns={columns} rows={[rows[0]!, { ...rows[1]!, cells: { ...rows[1]!.cells, [SELECT]: { value: FIRST } } }]} onMove={move} onCellChange={vi.fn()} />)
    const item = dragStart()
    const targetRect = new DOMRect(0, 140, 302, 124)
    const getter = dnd.props.sensors?.find((sensor) => sensor.sensor.name === 'KeyboardSensor')?.options.coordinateGetter
    const coordinates = getter?.({ code: 'ArrowDown', preventDefault: vi.fn() }, {
      currentCoordinates: { x: 0, y: 0 }, context: {
        droppableRects: new Map([['card:two', targetRect]]), collisionRect: new DOMRect(0, 0, 302, 124),
      },
    })
    expect(coordinates?.y).toBeGreaterThan(140)
    item.rect.current.translated.top = coordinates.y
    const target = { id: 'card:two', data: { current: { kind: 'card', rowId: 'two', optionKey: FIRST } }, rect: targetRect }
    act(() => dnd.props.onDragOver?.({ active: item, over: target } as never))
    await act(async () => { dnd.props.onDragEnd?.({ active: item, over: target } as never) })
    expect(move).toHaveBeenCalledWith({ rowId: 'one', selectColumnId: SELECT, optionId: FIRST, orderedRows: ['two', 'one'] })
  })

  it('uses the nearest keyboard target rather than a distant card when the Board is empty', () => {
    render(<BoardView columns={columns} rows={rows} />)
    const targetId = `column:${SECOND}`
    const containers = [{ id: 'card:one', data: { current: { kind: 'card', optionKey: FIRST } } }, { id: targetId, data: { current: { kind: 'column', optionKey: SECOND } } }]
    const collisions = dnd.props.collisionDetection?.({
      active: { id: 'card:one', data: { current: { kind: 'card' } } }, pointerCoordinates: null,
      droppableContainers: containers,
      droppableRects: new Map([['card:one', new DOMRect(0, 0, 302, 124)], [targetId, new DOMRect(332, 0, 320, 256)]]),
      collisionRect: new DOMRect(332, 0, 302, 124),
    } as never)
    expect(collisions?.[0]?.id).toBe(targetId)
  })

  it('shows empty Boards and places pages without a value in the neutral Board', () => {
    const { container } = render(<BoardView columns={columns} rows={rows} />)
    expect(container.querySelectorAll('[data-board-column]')).toHaveLength(3)
    expect(within(container.querySelector(`[data-board-column="${SECOND}"]`) as HTMLElement).queryByText('Página um')).toBeNull()
    expect(within(container.querySelector(`[data-board-column="${BOARD_UNASSIGNED}"]`) as HTMLElement).getByText('Página dois')).toBeTruthy()
    expect(container.querySelector('[data-board-card="one"]')?.className).toContain('bg-p-blue-500/10')
  })
  it('edits in the card on double click while a separate button opens the page', () => {
    const change = vi.fn(), open = vi.fn()
    render(<BoardView columns={columns} rows={rows} onCellChange={change} onOpenRow={open} />)
    fireEvent.doubleClick(screen.getByText('Página um'))
    const title = screen.getByRole('textbox', { name: 'Nome' })
    fireEvent.focus(title); fireEvent.change(title, { target: { value: 'Renomeada' } }); fireEvent.blur(title)
    expect(change).toHaveBeenCalledWith({ rowId: 'one', columnId: 'page_title', previousValue: 'Página um', value: 'Renomeada' })
    fireEvent.click(screen.getByRole('button', { name: 'Abrir Página um' }))
    expect(open).toHaveBeenCalledWith(rows[0])
  })
  it('creates into the selected Board and retains the filtered-out new page with focused title', async () => {
    const create = vi.fn(async () => ({ id: 'new', cells: { [SELECT]: { value: SECOND } } }))
    const { container } = render(<BoardView columns={columns} rows={rows} onCreateRow={create} onCellChange={vi.fn()} />)
    const board = container.querySelector(`[data-board-column="${SECOND}"]`) as HTMLElement
    fireEvent.click(within(board).getByRole('button', { name: 'Adicionar card' }))
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Nome' })).toBe(document.activeElement))
    expect(create).toHaveBeenCalledWith({ selectColumnId: SELECT, optionId: SECOND })
    fireEvent.click(screen.getByRole('button', { name: 'Concluir edição' }))
    expect(container.querySelector('[data-board-card="new"]')).toBeNull()
  })
  it('relocates a real measured placeholder and renders the same card in the overlay', async () => {
    const move = vi.fn(async () => undefined)
    const { container } = render(<BoardView columns={columns} rows={rows} onMove={move} onCellChange={vi.fn()} />)
    const item = dragStart(), target = dragOver(item)
    const destination = container.querySelector(`[data-board-column="${SECOND}"]`) as HTMLElement
    const placeholder = destination.querySelector('[data-drag-placeholder]')
    expect(placeholder?.parentElement?.parentElement?.style.height).toBe('124px')
    expect(container.querySelectorAll('[data-board-card="one"]')).toHaveLength(0)
    expect(within(screen.getByTestId('overlay')).getByText('Página um')).toBeTruthy()
    expect(within(screen.getByTestId('overlay')).getByText('Texto')).toBeTruthy()
    expect(within(screen.getByTestId('overlay')).getByText('Página um').closest('article')?.hasAttribute('inert')).toBe(true)
    await act(async () => { dnd.props.onDragEnd?.({ active: item, over: target } as never) })
    expect(move).toHaveBeenCalledWith({ rowId: 'one', selectColumnId: SELECT, optionId: SECOND, orderedRows: ['two', 'one'] })
  })
  it('does not persist a canceled drag or a drop outside the Board', async () => {
    const move = vi.fn(async () => undefined)
    render(<BoardView columns={columns} rows={rows} onMove={move} onCellChange={vi.fn()} />)
    dragOver(dragStart())
    act(() => dnd.props.onDragCancel?.({} as never))
    const item = dragStart()
    await act(async () => { dnd.props.onDragEnd?.({ active: item, over: null } as never) })
    expect(move).not.toHaveBeenCalled()
  })
  it('keeps add buttons mounted throughout a pending move and enables the same nodes afterwards', async () => {
    let finishMove!: () => void
    const move = vi.fn(() => new Promise<void>((resolve) => { finishMove = resolve }))
    render(<BoardView columns={columns} rows={rows} onMove={move} onCellChange={vi.fn()} onCreateRow={vi.fn()} />)
    const buttons = screen.getAllByRole('button', { name: 'Adicionar card' })
    const item = dragStart(), target = dragOver(item)
    act(() => { dnd.props.onDragEnd?.({ active: item, over: target } as never) })
    expect(screen.getAllByRole('button', { name: 'Adicionar card' })).toEqual(buttons)
    expect(buttons.every((button) => button.isConnected && (button as HTMLButtonElement).disabled)).toBe(true)
    await act(async () => { finishMove() })
    expect(screen.getAllByRole('button', { name: 'Adicionar card' })).toEqual(buttons)
    expect(buttons.every((button) => button.isConnected && !(button as HTMLButtonElement).disabled)).toBe(true)
  })
  it('prevents transfer and editing when the select/title are locked', async () => {
    const move = vi.fn(async () => undefined), change = vi.fn()
    const { container } = render(<BoardView columns={columns} rows={rows} onMove={move} onCellChange={change} lockedColumnKeys={new Set([SELECT, 'title'])} />)
    fireEvent.doubleClick(screen.getByText('Página um'))
    expect(screen.queryByRole('textbox', { name: 'Nome' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Concluir edição' }))
    dragOver(dragStart())
    expect(container.querySelector(`[data-board-column="${FIRST}"] [data-drag-placeholder]`)).toBeTruthy()
    expect(container.querySelector(`[data-board-column="${SECOND}"] [data-drag-placeholder]`)).toBeNull()
  })
  it('expands a collapsed Board only after 400ms and restores it on cancel', () => {
    vi.useFakeTimers()
    const { container } = render(<BoardView columns={columns} rows={rows} onMove={vi.fn(async () => undefined)} onCellChange={vi.fn()} config={{ collapsedOptionIds: [SECOND] }} />)
    const target = () => container.querySelector(`[data-board-column="${SECOND}"]`)
    dragOver(dragStart())
    act(() => vi.advanceTimersByTime(399)); expect(target()?.getAttribute('data-collapsed')).toBe('true')
    act(() => vi.advanceTimersByTime(1)); expect(target()?.getAttribute('data-collapsed')).toBeNull()
    act(() => dnd.props.onDragCancel?.({} as never)); expect(target()?.getAttribute('data-collapsed')).toBe('true')
  })
  it('hides property labels and renders Flow with and without label', () => {
    const { rerender } = render(<BoardView columns={columns} rows={rows} config={{ propertyIds: [FLOW], showPropertyLabels: false }} onFlowExecute={vi.fn()} />)
    expect(screen.getAllByText('Ação:')[0]?.className).toContain('sr-only')
    expect(screen.getAllByRole('button', { name: 'Executar Ação' })[0]?.className).toContain('rounded-full')
    rerender(<BoardView columns={columns.map((column) => column.id === FLOW ? { ...column, flowButton: { label: 'Enviar', icon: 'lucide:send' } } : column)} rows={rows} onFlowExecute={vi.fn()} />)
    expect(screen.getAllByRole('button', { name: 'Enviar' })[0]?.className).toContain('rounded-md')
  })
})
