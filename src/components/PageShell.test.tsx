import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { UsePageRealtimeOptions } from '@/hooks/usePageRealtime'
import type { ApiPage } from '@/lib/databaseParser'
import { PageShell } from './PageShell'

const dependencies = vi.hoisted(() => ({
  getPage: vi.fn(),
  options: undefined as UsePageRealtimeOptions | undefined,
}))

vi.mock('@/hooks/usePageRealtime', () => ({
  usePageRealtime: (_pageId: string | undefined, options: UsePageRealtimeOptions) => {
    dependencies.options = options
    return { viewers: 2, joined: true }
  },
}))

vi.mock('@/services/DatabaseService', () => ({
  databaseService: { getPage: dependencies.getPage },
}))

vi.mock('@/lib/i18n', () => ({ i18n: (key: string) => key }))

const PAGE_ID = '01KXVZ0000PARENT0000000001'

function page(title: string): ApiPage {
  return {
    id: PAGE_ID,
    title,
    data: null,
    owner_id: '01KXVZ0000USER00000000001',
  }
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  const promise = new Promise<T>((onResolve) => {
    resolve = onResolve
  })
  return { promise, resolve }
}

beforeEach(() => {
  vi.resetAllMocks()
  dependencies.options = undefined
  dependencies.getPage.mockResolvedValue(page('Título inicial'))
})

afterEach(() => cleanup())

describe('PageShell — page-updated', () => {
  it('atualiza o chrome com guarda própria e aceita empate de timestamp', async () => {
    render(<PageShell pageId={PAGE_ID}>conteúdo</PageShell>)
    await screen.findByText('Título inicial')

    act(() => {
      dependencies.options?.onPageUpdated?.({
        pageId: PAGE_ID,
        title: 'Título remoto',
        updatedAt: '2026-08-30T12:00:00.123Z',
        originUserId: 'user-1',
      })
    })
    expect(screen.getByText('Título remoto')).toBeTruthy()

    act(() => {
      dependencies.options?.onPageUpdated?.({
        pageId: '01KXVZ0000PARENT0000000002',
        title: 'Outra página',
        updatedAt: '2026-08-30T13:00:00.000Z',
        originUserId: 'user-2',
      })
    })
    expect(screen.queryByText('Outra página')).toBeNull()

    act(() => {
      dependencies.options?.onPageUpdated?.({
        pageId: PAGE_ID,
        title: 'Evento atrasado',
        updatedAt: '2026-08-30T11:59:59.999Z',
        originUserId: 'user-2',
      })
      dependencies.options?.onPageUpdated?.({
        pageId: PAGE_ID,
        title: 'Segundo no mesmo milissegundo',
        updatedAt: '2026-08-30T12:00:00.123Z',
        originUserId: 'user-3',
      })
    })

    expect(screen.queryByText('Evento atrasado')).toBeNull()
    expect(screen.getByText('Segundo no mesmo milissegundo')).toBeTruthy()
  })

  it('não deixa um fetch iniciado antes apagar um page-updated mais novo', async () => {
    const request = deferred<ApiPage>()
    dependencies.getPage.mockReturnValueOnce(request.promise)
    render(<PageShell pageId={PAGE_ID} />)

    act(() => {
      dependencies.options?.onPageUpdated?.({
        pageId: PAGE_ID,
        title: 'Autoritativo do socket',
        updatedAt: '2026-08-30T12:00:00.000Z',
        originUserId: 'user-1',
      })
    })
    expect(screen.getByText('Autoritativo do socket')).toBeTruthy()

    await act(async () => request.resolve(page('Snapshot stale')))
    await waitFor(() => expect(screen.queryByText('Snapshot stale')).toBeNull())
    expect(screen.getByText('Autoritativo do socket')).toBeTruthy()
  })
})
