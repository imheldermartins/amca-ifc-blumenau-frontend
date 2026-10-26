import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { VirtualInfiniteList } from './VirtualInfiniteList'
import type { DatabasePagination, DatabasePageStream } from '../pagination'
import type { RowData } from '../types'

const rows: RowData[] = Array.from({ length: 100 }, (_, index) => ({ id: `row-${index}`, cells: {} }))
const scope = { type: 'board', optionId: 'first' } as const
function bridge(): DatabasePagination {
  return { projection: null, streams: {}, loadNext: vi.fn(), loadPrevious: vi.fn(), ensureScope: vi.fn(), setScope: vi.fn(),
    reportWindow: vi.fn(), pinRow: vi.fn(), onInteractionChange: vi.fn(), loading: false }
}
function stream(overrides: Partial<DatabasePageStream> = {}): DatabasePageStream {
  return { scope, rows, total: 10000, hasNextPage: true, hasPreviousPage: false, isFetching: false,
    beforeHeight: 0, afterHeight: 0, ...overrides }
}
const rowKey = (row: RowData) => row.id
const renderRow = (row: RowData) => <span>{row.id}</span>

beforeEach(() => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(function (this: HTMLElement) {
    return this.hasAttribute('data-page-scroll') ? 320 : 80
  })
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(800)
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    const parent = this.closest<HTMLElement>('[data-page-scroll]')
    const top = this.hasAttribute('data-infinite-list') ? 200 - (parent?.scrollTop ?? window.scrollY) : 0
    return { top, bottom: top + 320, left: 0, right: 800, width: 800, height: 320, x: 0, y: top, toJSON: () => ({}) }
  })
})
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

describe('page scroll pagination', () => {
  it('shares the page scroll between columns and loads only columns whose retained end is near the viewport', async () => {
    const first = bridge(), second = bridge()
    const { container } = render(<main data-page-scroll style={{ overflowY: 'auto' }}>
      <div style={{ overflowX: 'auto', overflowY: 'hidden' }}>
        <VirtualInfiniteList items={rows.slice(0, 20)} itemKey={rowKey} renderItem={renderRow}
          pagination={first} scope={scope} stream={stream()} scrollMode="page" />
        <VirtualInfiniteList items={rows} itemKey={rowKey} renderItem={renderRow}
          pagination={second} scope={{ type: 'board', optionId: 'second' }} stream={stream()} scrollMode="page" />
      </div>
    </main>)
    const page = container.querySelector('[data-page-scroll]')!
    const list = container.querySelector('[data-infinite-list]')!
    expect(list.className).not.toContain('max-h-')
    expect(list.className).not.toContain('overflow-y-auto')
    expect(first.loadNext).not.toHaveBeenCalled()
    expect(second.loadNext).not.toHaveBeenCalled()
    fireEvent.wheel(list, { deltaY: 100 })
    expect(first.loadNext).not.toHaveBeenCalled()
    fireEvent.scroll(page, { target: { scrollTop: 500 } })
    expect(first.loadNext).not.toHaveBeenCalled()
    expect(second.loadNext).not.toHaveBeenCalled()
    fireEvent.scroll(page, { target: { scrollTop: 1300 } })
    await waitFor(() => expect(first.loadNext).toHaveBeenCalledWith(scope))
    expect(second.loadNext).not.toHaveBeenCalled()
    expect(first.reportWindow).toHaveBeenLastCalledWith('board:first', expect.objectContaining({ firstId: 'row-13', lastId: 'row-17' }))
    fireEvent.scroll(page, { target: { scrollTop: 7900 } })
    await waitFor(() => expect(second.loadNext).toHaveBeenCalledWith({ type: 'board', optionId: 'second' }))
    expect(container.querySelectorAll('[data-list-row]').length).toBeLessThan(30)
  })

  it('retains evicted space and loads the previous cursor when the shared page scroll returns above it', async () => {
    const pagination = bridge()
    const { container } = render(<main data-page-scroll style={{ overflowY: 'auto' }}>
      <VirtualInfiniteList items={rows} itemKey={rowKey} renderItem={renderRow} pagination={pagination}
        scope={scope} stream={stream({ beforeHeight: 1000, afterHeight: 600, hasPreviousPage: true })} scrollMode="page" />
    </main>)
    const list = container.querySelector('[data-infinite-list]')!
    expect((list.firstElementChild as HTMLElement).style.height).toBe('9600px')
    fireEvent.scroll(container.querySelector('[data-page-scroll]')!, { target: { scrollTop: 1700 } })
    expect(pagination.loadPrevious).not.toHaveBeenCalled()
    expect((container.querySelector('[data-list-row="row-1"]') as HTMLElement).style.transform).toBe('translateY(1080px)')
    fireEvent.scroll(container.querySelector('[data-page-scroll]')!, { target: { scrollTop: 1200 } })
    await waitFor(() => expect(pagination.loadPrevious).toHaveBeenCalledWith(scope))
    expect(pagination.loadNext).not.toHaveBeenCalled()
  })

  it('uses window scrolling when there is no scrollable ancestor', async () => {
    const pagination = bridge()
    vi.stubGlobal('scrollY', 0)
    render(<VirtualInfiniteList items={rows} itemKey={rowKey} renderItem={renderRow} pagination={pagination}
      scope={scope} stream={stream()} scrollMode="page" />)
    expect(pagination.loadNext).not.toHaveBeenCalled()
    vi.stubGlobal('scrollY', 7900)
    fireEvent.scroll(window)
    await waitFor(() => expect(pagination.loadNext).toHaveBeenCalledWith(scope))
    expect(await screen.findByText('row-99')).toBeTruthy()
  })

  it('preserves an already scrolled page when a column mounts', async () => {
    const pagination = bridge()
    const scrollTo = vi.fn()
    const { container } = render(<main data-page-scroll style={{ overflowY: 'auto' }} ref={(element) => {
      if (element) { element.scrollTop = 2400; element.scrollTo = scrollTo }
    }}>
      <VirtualInfiniteList items={rows} itemKey={rowKey} renderItem={renderRow} pagination={pagination}
        scope={scope} stream={stream()} scrollMode="page" />
    </main>)
    await waitFor(() => expect(pagination.reportWindow).toHaveBeenLastCalledWith('board:first',
      expect.objectContaining({ firstId: 'row-27', lastId: 'row-31' })))
    expect(container.querySelector('[data-page-scroll]')!.scrollTop).toBe(2400)
    expect(scrollTo).toHaveBeenCalledWith(expect.objectContaining({ top: 2400 }))
    expect(scrollTo).not.toHaveBeenCalledWith(expect.objectContaining({ top: 0 }))
    expect(pagination.loadNext).not.toHaveBeenCalled()
  })

  it('loads a short initial batch from a page scroll gesture outside the cards', async () => {
    const pagination = bridge()
    const { container } = render(<main data-page-scroll style={{ overflowY: 'auto' }}>
      <h1>Board</h1>
      <VirtualInfiniteList items={rows.slice(0, 2)} itemKey={rowKey} renderItem={renderRow} pagination={pagination}
        scope={scope} stream={stream()} scrollMode="page" />
    </main>)
    expect(pagination.loadNext).not.toHaveBeenCalled()
    fireEvent.wheel(container.querySelector('h1')!, { deltaY: 100 })
    await waitFor(() => expect(pagination.loadNext).toHaveBeenCalledWith(scope))
  })

  it('suspends automatic page scroll loading during a fetch or after an error and keeps explicit retry', async () => {
    const pagination = bridge()
    pagination.retry = vi.fn()
    const props = { items: rows, itemKey: rowKey, renderItem: renderRow, pagination, scope, scrollMode: 'page' as const }
    const { container, rerender } = render(<main data-page-scroll style={{ overflowY: 'auto' }}>
      <VirtualInfiniteList {...props} stream={stream({ isFetching: true })} />
    </main>)
    fireEvent.scroll(container.querySelector('[data-page-scroll]')!, { target: { scrollTop: 7900 } })
    expect(pagination.loadNext).not.toHaveBeenCalled()
    rerender(<main data-page-scroll style={{ overflowY: 'auto' }}>
      <VirtualInfiniteList {...props} stream={stream({ error: new Error('failed') })} />
    </main>)
    expect(pagination.loadNext).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Não foi possível carregar. Tentar novamente' }))
    expect(pagination.retry).toHaveBeenCalledExactlyOnceWith(scope)
  })
})
