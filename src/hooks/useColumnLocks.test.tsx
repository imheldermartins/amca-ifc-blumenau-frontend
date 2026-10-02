import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ColumnLockConfiguration } from '@/services/ColumnLockService'

const doubles = vi.hoisted(() => ({
  get: vi.fn(),
  save: vi.fn(),
  titleStatus: vi.fn(),
  feedback: vi.fn(),
}))

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'user-1' } }),
}))
vi.mock('@/contexts/FeedbackContext', () => ({
  useFeedback: () => doubles.feedback,
}))
vi.mock('@/services/ColumnLockService', () => ({
  columnLockService: {
    get: doubles.get,
    save: doubles.save,
    titleStatus: doubles.titleStatus,
  },
}))

import { columnLocksQueryKey, useColumnLocks } from './useColumnLocks'

const initialConfiguration: ColumnLockConfiguration = {
  locks: {
    title: { userIds: ['user-1'] },
    'status-column': { userIds: ['user-2'] },
  },
  canManage: true,
  editors: [
    { id: 'user-1', name: 'Ana Lima', email: 'ana@example.com' },
    { id: 'user-2', name: 'Bruno Reis', email: 'bruno@example.com' },
  ],
}

describe('useColumnLocks', () => {
  let client: QueryClient
  let wrapper: ({ children }: { children: ReactNode }) => ReactNode

  beforeEach(() => {
    vi.clearAllMocks()
    client = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    })
    wrapper = ({ children }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    )
    doubles.get.mockResolvedValue(initialConfiguration)
  })

  it('deriva as colunas bloqueadas para o usuário e isola o cache por página', async () => {
    const { result } = renderHook(() => useColumnLocks('page-1'), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.canManage).toBe(true)
    expect([...result.current.lockedColumnKeys]).toEqual(['status-column'])
    expect(client.getQueryData(columnLocksQueryKey('user-1', 'page-1')))
      .toEqual(initialConfiguration)
    expect(doubles.get).toHaveBeenCalledWith('page-1')
  })

  it('atualiza a allowlist de forma otimista e reconcilia a resposta do servidor', async () => {
    let resolveSave!: (value: ColumnLockConfiguration) => void
    doubles.save.mockReturnValue(new Promise<ColumnLockConfiguration>((resolve) => {
      resolveSave = resolve
    }))
    const { result } = renderHook(() => useColumnLocks('page-1'), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    act(() => result.current.save('status-column', ['user-1', 'user-2']))

    await waitFor(() => {
      expect(result.current.locks['status-column']?.userIds)
        .toEqual(['user-1', 'user-2'])
    })
    expect(result.current.lockedColumnKeys.has('status-column')).toBe(false)

    const canonical: ColumnLockConfiguration = {
      ...initialConfiguration,
      locks: {
        ...initialConfiguration.locks,
        'status-column': { userIds: ['user-1', 'user-2'] },
      },
    }
    doubles.get.mockResolvedValue(canonical)
    await act(async () => resolveSave(canonical))

    await waitFor(() => expect(result.current.saving).toBe(false))
    expect(doubles.save).toHaveBeenCalledWith(
      'page-1',
      'status-column',
      ['user-1', 'user-2'],
    )
    expect(client.getQueryData(columnLocksQueryKey('user-1', 'page-1')))
      .toEqual(canonical)
  })

  it('restaura o cache e emite feedback quando o save falha', async () => {
    doubles.save.mockRejectedValueOnce(new Error('PUT /pages/page-1/column-locks → 403: Acesso não permitido'))
    const { result } = renderHook(() => useColumnLocks('page-1'), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    act(() => result.current.save('status-column', ['user-1', 'user-2']))

    await waitFor(() => expect(doubles.feedback).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: 'error',
        description: 'Acesso não permitido',
      }),
    ))
    expect(result.current.locks).toEqual(initialConfiguration.locks)
    expect([...result.current.lockedColumnKeys]).toEqual(['status-column'])
  })
})
