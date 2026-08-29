import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type {
  CellUpdatedPayload,
  ColumnResizingPayload,
  CubsSocket,
} from '@/services/SocketService'
import { usePageRealtime } from './usePageRealtime'

type Listener = (payload: never) => void

const socketState = vi.hoisted(() => ({
  socket: null as CubsSocket | null,
}))

vi.mock('@/hooks/useSocket', () => ({
  useSocket: () => ({ socket: socketState.socket }),
}))

class FakeSocket {
  connected = true
  readonly emitted: Array<{ event: string; payload: unknown }> = []
  private readonly listeners = new Map<string, Set<Listener>>()

  on(event: string, listener: Listener) {
    const listeners = this.listeners.get(event) ?? new Set<Listener>()
    listeners.add(listener)
    this.listeners.set(event, listeners)
    return this
  }

  off(event: string, listener: Listener) {
    this.listeners.get(event)?.delete(listener)
    return this
  }

  emit(event: string, payload: unknown) {
    this.emitted.push({ event, payload })
    return this
  }

  receive(event: string, payload?: unknown) {
    for (const listener of this.listeners.get(event) ?? []) listener(payload as never)
  }
}

const PAGE_ID = '01KXVZ0000PARENT0000000001'
const OTHER_PAGE_ID = '01KXVZ0000PARENT0000000002'

beforeEach(() => {
  socketState.socket = new FakeSocket() as unknown as CubsSocket
})

afterEach(() => cleanup())

describe('usePageRealtime — sala e ressincronização', () => {
  it('ressincroniza somente depois do ACK de entrada na sala', () => {
    const onResync = vi.fn()
    const { result } = renderHook(() => usePageRealtime(PAGE_ID, { onResync }))
    const socket = socketState.socket as unknown as FakeSocket

    expect(socket.emitted).toContainEqual({
      event: 'join-page-database',
      payload: { pageId: PAGE_ID },
    })
    expect(onResync).not.toHaveBeenCalled()

    act(() => socket.receive('joined-page-database', { pageId: OTHER_PAGE_ID }))
    expect(onResync).not.toHaveBeenCalled()
    expect(result.current.joined).toBe(false)

    act(() => socket.receive('joined-page-database', { pageId: PAGE_ID }))
    expect(onResync).toHaveBeenCalledTimes(1)
    expect(result.current.joined).toBe(true)
  })

  it('ignora evento atrasado de outra sala e aplica o da página atual', () => {
    const onEvent = vi.fn()
    renderHook(() => usePageRealtime(PAGE_ID, { onEvent }))
    const socket = socketState.socket as unknown as FakeSocket
    const payload: CellUpdatedPayload = {
      pageId: OTHER_PAGE_ID,
      rowId: '01KXVZ0000ROW000000000001',
      columnId: '01KXVZ0000COLUMN00000001',
      value: 'outro',
      updatedAt: '2026-08-15T20:00:00.000Z',
      originUserId: '01KXVZ0000USER00000000001',
    }

    act(() => socket.receive('cell-updated', payload))
    expect(onEvent).not.toHaveBeenCalled()

    const current = { ...payload, pageId: PAGE_ID, value: 'atual' }
    act(() => socket.receive('cell-updated', current))
    expect(onEvent).toHaveBeenCalledWith({ type: 'cell-updated', payload: current })
  })

  it('encaminha somente o preview de resize da página atual', () => {
    const onColumnResize = vi.fn()
    renderHook(() => usePageRealtime(PAGE_ID, { onColumnResize }))
    const socket = socketState.socket as unknown as FakeSocket
    const payload: ColumnResizingPayload = {
      pageId: OTHER_PAGE_ID,
      viewId: '01KXVZ0000VIEW000000000001',
      columnId: '01KXVZ0000COLUMN00000001',
      width: 360,
      originUserId: '01KXVZ0000USER00000000001',
    }

    act(() => socket.receive('column-resizing', payload))
    expect(onColumnResize).not.toHaveBeenCalled()

    const current = { ...payload, pageId: PAGE_ID }
    act(() => socket.receive('column-resizing', current))
    expect(onColumnResize).toHaveBeenCalledWith(current)
  })
})
