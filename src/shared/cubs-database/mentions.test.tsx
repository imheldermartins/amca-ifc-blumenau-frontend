import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { MentionInputConfig } from 'cubs-components'
import { DatabaseMentionColumnsProvider, DatabaseMentionProvider, RowMentionProvider, useDatabaseMentions } from './mentions'
import { mentionId, mentionToken } from '@/shared/mentions'
import type { HeaderCol, RowData } from './types'
import { TextCellEditor } from './components/cells/TextCellEditor'
import { BoardCard } from './components/BoardView'
import { GridTile } from './components/GridView'
import { TableView } from './components/TableView'

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
afterEach(cleanup)

function Probe({ column = columns[1] }: { column?: HeaderCol }) {
  const mentions = useDatabaseMentions(column)!
  return <><output>{mentions.resolve(token(`columns.${second}`))}</output><ul>{mentions.options.map((option) => <li key={option.id}>{option.id}</li>)}</ul></>
}

describe('page mention context', () => {
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
    expect(input.value).toBe(token(`columns.${property}`))
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
