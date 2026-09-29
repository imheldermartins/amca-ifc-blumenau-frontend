import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { PinnedSchedulePageDto } from '@/pages/app/schedule/types'

const doubles = vi.hoisted(() => ({
  list: vi.fn(),
  pin: vi.fn(),
  unpin: vi.fn(),
  feedback: vi.fn(),
}))

vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'user-1' } }) }))
vi.mock('@/contexts/FeedbackContext', () => ({ useFeedback: () => doubles.feedback }))
vi.mock('@/hooks/useSocket', () => ({ useSocket: () => ({ socket: null }) }))
vi.mock('@/services/ScheduleService', () => ({
  scheduleService: { list: doubles.list, pin: doubles.pin, unpin: doubles.unpin },
}))

import { scheduleQueryKey, useSchedule } from './useSchedule'

const pin = (workspaceId: string, pageId = 'page-1'): PinnedSchedulePageDto => ({
  id: `pin-${workspaceId}`,
  workspaceId,
  pageId,
  sourcePageId: 'source-1',
  sourceTitle: 'Projetos',
  title: 'Entrega',
  dateColumnId: 'date-1',
  colorColumnId: 'status-1',
  start: '2026-09-28T00:00:00.000Z',
  end: '2026-09-29T00:00:00.000Z',
  allDay: true,
  color: 'purple',
  properties: [],
  pinnedAt: '2026-09-28T12:00:00.000Z',
})

describe('useSchedule', () => {
  let client: QueryClient
  let wrapper: ({ children }: { children: ReactNode }) => ReactNode

  beforeEach(() => {
    vi.clearAllMocks()
    client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
    wrapper = ({ children }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>
    doubles.list.mockImplementation(async (workspaceId: string) => [pin(workspaceId)])
  })

  it('isolates the cache by user and workspace', async () => {
    const { result, rerender } = renderHook(({ workspaceId }) => useSchedule(workspaceId, { realtime: false }), { wrapper, initialProps: { workspaceId: 'workspace-1' } })
    await waitFor(() => expect(result.current.pins[0]?.workspaceId).toBe('workspace-1'))
    rerender({ workspaceId: 'workspace-2' })
    await waitFor(() => expect(result.current.pins[0]?.workspaceId).toBe('workspace-2'))
    expect(client.getQueryData(scheduleQueryKey('user-1', 'workspace-1'))).toEqual([pin('workspace-1')])
    expect(doubles.list).toHaveBeenCalledWith('workspace-2')
  })

  it('removes optimistically and rolls back with feedback on failure', async () => {
    doubles.unpin.mockRejectedValueOnce(new Error('offline'))
    const { result } = renderHook(() => useSchedule('workspace-1', { realtime: false }), { wrapper })
    await waitFor(() => expect(result.current.pins).toHaveLength(1))
    let saved = true
    await act(async () => { saved = await result.current.unpin('page-1') })
    expect(saved).toBe(false)
    expect(result.current.pins).toHaveLength(1)
    expect(doubles.feedback).toHaveBeenCalledWith(expect.objectContaining({ variant: 'error' }))
  })
})
