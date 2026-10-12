import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { DatabasePagination } from '../pagination'
import type { HeatmapConfig } from '../types'
import { pageViewScopeKey } from '../pageViewQueryContract'
import { HeatmapView } from './HeatmapView'

afterEach(cleanup)

const config: HeatmapConfig = {
  version: 1,
  dateColumnId: 'date',
  checkboxColumnId: 'done',
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
  it('usa roxo proporcional à porcentagem e diferencia dias vazios de 0% concluído', () => {
    const data = pagination()
    const rendered = render(<HeatmapView config={config} pagination={data} columns={[]} />)

    const empty = screen.getByRole('button', { name: /^1 de outubro.+0 concluídas de 0, 0%$/i })
    const zero = screen.getByRole('button', { name: /^2 de outubro.+0 concluídas de 2, 0%$/i })
    const half = screen.getByRole('button', { name: /^3 de outubro.+1 concluídas de 2, 50%$/i })
    const complete = screen.getByRole('button', { name: /^4 de outubro.+2 concluídas de 2, 100%$/i })

    expect(empty.className).toContain('bg-foreground/5')
    expect(zero.className).toContain('bg-p-purple-500')
    expect(zero.className).toContain('rounded-[4px]')
    expect(zero.style.opacity).toBe('0.14')
    expect(half.style.opacity).toBe('0.61')
    expect(Number(complete.style.opacity)).toBeCloseTo(1)

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
})
