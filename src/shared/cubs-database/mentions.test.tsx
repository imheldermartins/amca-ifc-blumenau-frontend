import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { MentionInputConfig } from 'cubs-components'
import { DatabaseMentionColumnsProvider, DatabaseMentionProvider, RowMentionProvider, useDatabaseMentions } from './mentions'
import { mentionId, mentionToken, resolveMentionText } from '@/shared/mentions'
import type { HeaderCol, RowData } from './types'
import { TextCellEditor } from './components/cells/TextCellEditor'
import { BoardCard } from './components/BoardView'
import { GridTile } from './components/GridView'
import { TableView } from './components/TableView'
import { CubsDatabase } from './CubsDatabase'
import { emptyViewFilters } from './viewFilters'
import type { DatabasePagination } from './pagination'

const pageId = '01M00000000000000000000001'
const otherPage = '01M00000000000000000000002'
const property = '01M00000000000000000000003'
const second = '01M00000000000000000000004'
const token = (field: string, page = pageId) => mentionToken(mentionId('pages', page, field))
const columns: HeaderCol[] = [
  { id: 'page_title', key: 'title', title: 'Nome', type: 'text' },
  { id: property, title: 'Cliente', type: 'text' },
  { id: second, title: 'Resumo', type: 'text' },
]
const config: MentionInputConfig = {
  options: [{ id: mentionId('pages', otherPage, 'title'), label: 'Database', value: 'Database', section: 'Página' }],
  resolve: (value) => value.replace('@{workspace:external:name}', 'Equipe'), token: mentionToken,
  label: 'Menções', empty: 'Sem opções', unavailable: 'Indisponível',
}
const row: RowData = { id: pageId, cells: { page_title: { value: 'Projeto' }, [property]: { value: 'Ana' } } }
const lote = '01M00000000000000000000005', relation = '01M00000000000000000000006', total = '01M00000000000000000000007', status = '01M00000000000000000000008'
const option = '01M00000000000000000000009', target = '01M00000000000000000000010', flowId = '01M00000000000000000000011'
const calculatedColumns: HeaderCol[] = [columns[0], columns[1],
  { id: lote, title: 'Lote', type: 'formula' },
  { id: relation, title: 'Projetos', type: 'relation', relationTargets: { [target]: { id: target, title: 'Projeto relacionado' } } },
  { id: total, title: 'Total', type: 'extract_as', rollupResult: { type: 'numeric' } },
  { id: status, title: 'Status', type: 'select', options: [{ id: option, label: 'Ativo', color: 'blue' }] },
  { id: flowId, title: 'Executar Flow', type: 'flow' },
]
const calculatedRow: RowData = { ...row, cells: { ...row.cells,
  [lote]: { value: { kind: 'markup', value: '#0001', color: 'purple' } }, [relation]: { value: [target] }, [total]: { value: 9 }, [status]: { value: option },
} }
afterEach(() => { cleanup(); vi.restoreAllMocks() })

function Probe({ column = columns[1], text = token(`columns.${second}`) }: { column?: HeaderCol; text?: string }) {
  const mentions = useDatabaseMentions(column)!
  return <><output>{mentions.resolve(text)}</output><ul>{mentions.options.map((option) => <li key={option.id}>{option.id}</li>)}</ul></>
}
function paginated(view: 'table' | 'board' | 'grid', rows: RowData[]): DatabasePagination {
  const stream = { scope: { type: 'root' as const }, rows, total: rows.length, hasNextPage: false, hasPreviousPage: false, isFetching: false, beforeHeight: 0, afterHeight: 0 }
  return { projection: { version: 1, kind: view, pageId: 'root', viewId: 'main', queryKey: 'mentions', orderRevision: 1, total: rows.length, windows: [], relationTargets: { [target]: { id: target, title: 'Título da projeção' } } },
    streams: { root: stream, [`board:${option}`]: { ...stream, scope: { type: 'board', optionId: option } } },
    loadNext: vi.fn(), loadPrevious: vi.fn(), setScope: vi.fn(), ensureScope: vi.fn(), loading: false }
}

describe('page mention context', () => {
  it('preserves global @hoje options and resolves old datetime tokens inside row titles', () => {
    const datetime = '2026-10-26T15:04:59.123Z', old = '2026-01-01T01:02:03.004Z'
    const global = { ...config, options: [...config.options, { id: datetime, label: 'hoje', value: '26/10/2026 às 12:04', section: 'Global' }], resolve: (text: string) => resolveMentionText(text, {}) }
    render(<DatabaseMentionProvider value={global}><RowMentionProvider row={{ ...row, cells: { page_title: { value: `Criado ${mentionToken(old)}` } } }} columns={columns}><Probe text={token('title')} /></RowMentionProvider></DatabaseMentionProvider>)
    expect(screen.getByText(datetime)).toBeTruthy()
    expect(screen.getByRole('status').textContent).toBe('Criado 31/12/2025 às 22:02')
  })
  it.each([['table', false], ['board', false], ['grid', false], ['table', true], ['board', true], ['grid', true]] as const)('inserts the row Lote formula in the actual %s view title (paginated=%s)', async (view, usePagination) => {
    const change = vi.fn()
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(320)
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(600)
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
    const rows = [calculatedRow, { ...calculatedRow, id: otherPage, cells: { ...calculatedRow.cells, [lote]: { value: '#0002' } } }]
    const rendered = render(<DatabaseMentionProvider value={config}><CubsDatabase headerCols={calculatedColumns} rows={rows} pagination={usePagination ? paginated(view, rows) : undefined}
      settings={{ main: { name: 'Principal', view, urlKey: { key: 'principal', aliases: [] }, orderedHeaderCols: calculatedColumns.map((column) => column.id), title: { key: 'title', column_name: 'Nome' }, filters: emptyViewFilters(), board: { selectColumnId: status }, gridPropertyIds: [] } }} onCellChange={change} /></DatabaseMentionProvider>)
    if (view === 'board') fireEvent.doubleClick(rendered.container.querySelector(`[data-board-card="${pageId}"]`)!)
    const input = screen.getAllByRole('combobox', { name: 'Nome' })[0] as HTMLInputElement | HTMLTextAreaElement
    act(() => input.focus()); fireEvent.change(input, { target: { value: '@' } })
    expect(screen.getByRole('option', { name: 'Cliente Ana' })).toBeTruthy()
    expect(screen.getByRole('option', { name: usePagination ? 'Projetos Título da projeção' : 'Projetos Projeto relacionado' })).toBeTruthy()
    expect(screen.getByRole('option', { name: 'Total 9' })).toBeTruthy()
    expect(screen.queryByRole('option', { name: 'Executar Flow' })).toBeNull()
    expect(screen.queryByRole('option', { name: 'Lote #0002' })).toBeNull()
    fireEvent.click(screen.getByRole('option', { name: 'Lote #0001' }))
    await act(() => new Promise((resolve) => requestAnimationFrame(resolve)))
    expect(input.value).toBe('#0001')
    act(() => input.blur())
    expect(change).toHaveBeenCalledWith({ rowId: pageId, columnId: 'page_title', previousValue: 'Projeto', value: token(`columns.${lote}`) })
  })

  it('keeps hidden calculated properties available in a row title and follows realtime values', () => {
    const tree = (current: RowData) => <DatabaseMentionProvider value={config}><DatabaseMentionColumnsProvider value={calculatedColumns}><RowMentionProvider row={current} columns={[columns[0]]}><Probe column={columns[0]} text={token(`columns.${lote}`)} /></RowMentionProvider></DatabaseMentionColumnsProvider></DatabaseMentionProvider>
    const view = render(tree(calculatedRow))
    expect(screen.getByText(mentionId('pages', pageId, `columns.${lote}`))).toBeTruthy()
    expect(screen.getByRole('status').textContent).toBe('#0001')
    expect(screen.queryByText(mentionId('pages', pageId, 'title'))).toBeNull()
    view.rerender(tree({ ...calculatedRow, cells: { ...calculatedRow.cells, [lote]: { value: '#0042' } } }))
    expect(screen.getByRole('status').textContent).toBe('#0042')
    view.rerender(tree({ ...calculatedRow, id: otherPage }))
    expect(screen.queryByText(mentionId('pages', pageId, `columns.${lote}`))).toBeNull()
    expect(screen.getByText(mentionId('pages', otherPage, `columns.${lote}`))).toBeTruthy()
  })
  it('replaces the containing page scope, excludes only the edited property and follows row changes', () => {
    const tree = (current: RowData) => <DatabaseMentionProvider value={config}><RowMentionProvider row={current} columns={columns}><Probe /></RowMentionProvider></DatabaseMentionProvider>
    const view = render(tree({ ...row, cells: { ...row.cells, [second]: { value: `Cliente ${token(`columns.${property}`)}` } } }))
    expect(screen.getByRole('status').textContent).toBe('Cliente Ana')
    expect(screen.getAllByRole('listitem').map((item) => item.textContent)).toEqual([mentionId('pages', pageId, 'title'), mentionId('pages', pageId, `columns.${second}`)])
    view.rerender(tree({ ...row, cells: { ...row.cells, [property]: { value: 'Bruno' }, [second]: { value: token(`columns.${property}`) } } }))
    expect(screen.getByRole('status').textContent).toBe('Bruno')
    view.rerender(tree({ ...row, id: otherPage }))
    expect(screen.getAllByRole('listitem').every((item) => item.textContent?.includes(otherPage))).toBe(true)
  })

  it('keeps hidden properties available and bounds property/title cycles', () => {
    const cyclic = { ...row, cells: { page_title: { value: token(`columns.${second}`) }, [second]: { value: token('title') } } }
    render(<DatabaseMentionProvider value={config}><DatabaseMentionColumnsProvider value={columns}><RowMentionProvider row={cyclic} columns={[columns[0]]}><Probe column={columns[0]} /></RowMentionProvider></DatabaseMentionColumnsProvider></DatabaseMentionProvider>)
    expect(screen.getByRole('status').textContent).toBe('Indisponível')
    expect(screen.queryByText(mentionId('pages', pageId, 'title'))).toBeNull()
    expect(screen.getByText(mentionId('pages', pageId, `columns.${property}`))).toBeTruthy()
  })

  it('allows an empty new page to insert another property and commits the token', async () => {
    const commit = vi.fn()
    render(<DatabaseMentionProvider value={config}><RowMentionProvider row={{ id: pageId, cells: {} }} columns={columns}>
      <TextCellEditor rowId={pageId} column={columns[0]} value={null} onCommit={commit} />
    </RowMentionProvider></DatabaseMentionProvider>)
    const input = screen.getByRole('combobox') as HTMLInputElement
    act(() => input.focus()); fireEvent.change(input, { target: { value: '@Cliente' } })
    fireEvent.click(screen.getByRole('option', { name: 'Cliente' }))
    await act(() => new Promise((resolve) => requestAnimationFrame(resolve)))
    expect(input.value).toBe('Sem valor')
    act(() => input.blur())
    expect(commit).toHaveBeenCalledWith(token(`columns.${property}`))
  })

  it('bounds repeated property expansion without changing the stored templates', () => {
    const current = { ...row, cells: { ...row.cells, [property]: { value: 'x'.repeat(10_000) }, [second]: { value: token(`columns.${property}`).repeat(3) } } }
    render(<DatabaseMentionProvider value={config}><RowMentionProvider row={current} columns={columns}><Probe /></RowMentionProvider></DatabaseMentionProvider>)
    expect(screen.getByRole('status').textContent).toBe('Indisponível')
    expect(current.cells[second].value).toBe(token(`columns.${property}`).repeat(3))
  })

  it.each(['cpf', 'email'] as const)('preserves references in a text field with the %s mask', async (mask) => {
    const commit = vi.fn()
    const masked = { ...columns[2], mask }
    render(<DatabaseMentionProvider value={config}><RowMentionProvider row={row} columns={[...columns.slice(0, 2), masked]}>
      <TextCellEditor rowId={pageId} column={masked} value={null} onCommit={commit} />
    </RowMentionProvider></DatabaseMentionProvider>)
    const input = screen.getByRole('combobox') as HTMLInputElement
    act(() => input.focus()); fireEvent.change(input, { target: { value: '@Cliente' } })
    fireEvent.click(screen.getByRole('option', { name: 'Cliente Ana' }))
    await act(() => new Promise((resolve) => requestAnimationFrame(resolve)))
    act(() => input.blur())
    expect(commit).toHaveBeenCalledWith(token(`columns.${property}`))
  })

  it.each(['table', 'board', 'grid'] as const)('binds the %s title editor to its own page', (view) => {
    const change = vi.fn()
    const current = { ...row, cells: { ...row.cells, page_title: { value: token(`columns.${property}`) } } }
    render(<DatabaseMentionProvider value={config}>
      {view === 'table' ? <TableView columns={columns} rows={[current]} onCellChange={change} />
        : view === 'board' ? <BoardCard columns={columns} row={current} color="blue" showLabels editing onCellChange={change} />
          : <GridTile columns={columns} row={current} onCellChange={change} />}
    </DatabaseMentionProvider>)
    const input = screen.getByRole('combobox', { name: 'Nome' }) as HTMLInputElement
    expect(input.value).toBe('Ana')
    act(() => input.focus()); fireEvent.change(input, { target: { value: '@' } })
    expect(screen.getByRole('option', { name: 'Cliente Ana' })).toBeTruthy()
    expect(screen.queryByRole('option', { name: /Título|Database/ })).toBeNull()
  })
})
