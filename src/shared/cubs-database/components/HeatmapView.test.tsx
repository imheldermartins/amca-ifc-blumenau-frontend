import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { DatabasePagination } from '../pagination'
import type { HeatmapConfig } from '../types'
import { pageViewScopeKey } from '../pageViewQueryContract'
import { HeatmapView } from './HeatmapView'

afterEach(cleanup)

const config: HeatmapConfig = {
  version: 2,
  dateColumnId: 'date',
  checkboxColumnIds: ['done'],
  period: { mode: 'months', monthCount: 1 },
}

function pagination(): DatabasePagination {
  return {
    projection: {
      version: 1,
      kind: 'heatmap',
      pageId: 'database',
      viewId: 'view',
      queryKey: 'query',
      orderRevision: 0,
      total: 3,
      windows: [],
      heatmapDays: {
        '2026-10-01': { total: 0, checked: 0 },
        '2026-10-02': { total: 2, checked: 0 },
        '2026-10-03': { total: 2, checked: 1 },
        '2026-10-04': { total: 2, checked: 2 },
      },
    },
    streams: {},
    loadNext: vi.fn(),
    loadPrevious: vi.fn(),
    setScope: vi.fn(),
    ensureScope: vi.fn(),
    loading: false,
  }
}

describe('HeatmapView', () => {
  it('usa o máximo semanal e carrega as páginas do dia selecionado', () => {
    const data = pagination()
    const rendered = render(<HeatmapView config={config} pagination={data} columns={[]} />)

    const empty = screen.getByRole('button', { name: /^1 de outubro.+0 marcadas em 0 páginas, máximo semanal 1, intensidade 0%$/i })
    const zero = screen.getByRole('button', { name: /^2 de outubro.+0 marcadas em 2 páginas, máximo semanal 1, intensidade 0%$/i })
    const half = screen.getByRole('button', { name: /^3 de outubro.+1 marcadas em 2 páginas, máximo semanal 1, intensidade 100%$/i })
    const complete = screen.getByRole('button', { name: /^4 de outubro.+2 marcadas em 2 páginas, máximo semanal 2, intensidade 100%$/i })

    expect(empty.className).toContain('bg-foreground/5')
    expect(zero.className).toContain('bg-foreground/5')
    expect(zero.className).toContain('rounded-[4px]')
    expect(half.getAttribute('style')).toContain('100%')
    expect(complete.getAttribute('style')).toContain('100%')

    fireEvent.click(half)
    const scope = { type: 'heatmap', from: '2026-10-01', to: '2026-10-04', day: '2026-10-03' } as const
    expect(data.setScope).toHaveBeenCalledWith(scope)
    data.streams[pageViewScopeKey(scope)] = {
      scope,
      rows: [{ id: 'row-1', cells: { page_title: { value: 'Entrega' } } }],
      total: 51,
      hasNextPage: true,
      hasPreviousPage: false,
      isFetching: false,
      beforeHeight: 0,
      afterHeight: 0,
    }
    rendered.rerender(<HeatmapView config={config} pagination={data} columns={[]} />)
    fireEvent.click(screen.getByRole('button', { name: 'Carregar mais' }))
    expect(data.loadNext).toHaveBeenCalledWith(scope)
  })

  it('mostra erro recuperável e páginas sem duplicar ou esconder o mapa', () => {
    const data = pagination()
    data.retry = vi.fn()
    const onOpenRow = vi.fn()
    const view = render(<HeatmapView config={config} pagination={data} columns={[]} onOpenRow={onOpenRow} />)
    fireEvent.click(screen.getByRole('button', { name: /^3 de outubro/i }))
    const scope = { type: 'heatmap', from: '2026-10-01', to: '2026-10-04', day: '2026-10-03' } as const
    data.streams[pageViewScopeKey(scope)] = { scope, rows: [], total: 0, hasNextPage: false, hasPreviousPage: false, isFetching: false, beforeHeight: 0, afterHeight: 0, error: new Error('offline') }
    view.rerender(<HeatmapView config={config} pagination={data} columns={[]} onOpenRow={onOpenRow} />)
    expect(screen.getByRole('alert').textContent).toContain('Não foi possível')
    expect(screen.queryByText('Carregando páginas…')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }))
    expect(data.retry).toHaveBeenCalledWith(scope)
    const row = { id: 'row', cells: { page_title: { value: 'Página selecionada' } } }
    data.streams[pageViewScopeKey(scope)] = { ...data.streams[pageViewScopeKey(scope)]!, error: undefined, rows: [row] }
    view.rerender(<HeatmapView config={config} pagination={data} columns={[]} onOpenRow={onOpenRow} />)
    fireEvent.click(screen.getByRole('button', { name: 'Página selecionada' }))
    expect(onOpenRow).toHaveBeenCalledWith(row)
    expect(screen.getByRole('button', { name: /^3 de outubro/i }).getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(screen.getByRole('button', { name: /^1 de outubro/i }))
    expect(screen.queryByText('Página selecionada')).toBeNull()
  })
})
