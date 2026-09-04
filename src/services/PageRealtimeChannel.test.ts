import { describe, expect, it, vi } from 'vitest'

import { PageRealtimeChannel } from '@/services/PageRealtimeChannel'
import type { CubsSocket } from '@/services/SocketService'
import { REALTIME_SERVER_TO_CLIENT_EVENT_NAMES } from '@/services/realtime-contract-v1'

type Listener = (...args: never[]) => void

class FakeSocket {
  connected = true
  readonly emitted: Array<{ event: string; payload: unknown; volatile: boolean }> = []
  private readonly listeners = new Map<string, Set<Listener>>()

  readonly volatile = {
    emit: (event: string, payload: unknown) => {
      this.emitted.push({ event, payload, volatile: true })
      return this
    },
  }

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
    this.emitted.push({ event, payload, volatile: false })
    return this
  }

  receive(event: string, payload?: unknown) {
    for (const listener of this.listeners.get(event) ?? []) {
      listener(payload as never)
    }
  }

  listenerCount(event: string) {
    return this.listeners.get(event)?.size ?? 0
  }
}

const PAGE_ID = '01KXVZ0000PARENT0000000001'
const OTHER_PAGE_ID = '01KXVZ0000PARENT0000000002'
const META = {
  updatedAt: '2026-08-30T12:00:00.000Z',
  originUserId: '01KXVZ0000USER00000000001',
}
const SYSTEM_SERVER_EVENTS = new Set(['presence:count', 'echo:reply'])
const PAGE_PROTOCOL_EVENT_NAMES = REALTIME_SERVER_TO_CLIENT_EVENT_NAMES.filter(
  (event) => !SYSTEM_SERVER_EVENTS.has(event),
)
const PAGE_LISTENER_NAMES = [
  'connect',
  'disconnect',
  ...PAGE_PROTOCOL_EVENT_NAMES,
] as const

describe('PageRealtimeChannel', () => {
  it('centraliza join, filtros, eventos duráveis, estrutura e preview efêmero', () => {
    const socket = new FakeSocket()
    const onEvent = vi.fn()
    const onPageUpdated = vi.fn()
    const onStructureChanged = vi.fn()
    const onColumnResize = vi.fn()
    const channel = new PageRealtimeChannel(socket as unknown as CubsSocket, PAGE_ID, {
      onEvent,
      onPageUpdated,
      onStructureChanged,
      onColumnResize,
    })

    channel.subscribe()
    channel.subscribe()

    expect(socket.emitted.filter(({ event }) => event === 'join-page-database')).toEqual([
      {
        event: 'join-page-database',
        payload: { pageId: PAGE_ID },
        volatile: false,
      },
    ])
    expect(socket.listenerCount('cell-updated')).toBe(1)
    for (const event of PAGE_PROTOCOL_EVENT_NAMES) {
      expect(socket.listenerCount(event), `evento sem consumer: ${event}`).toBe(1)
    }

    const cell = {
      pageId: PAGE_ID,
      rowId: 'row-1',
      columnId: 'column-1',
      value: false,
      ...META,
    }
    socket.receive('cell-updated', { ...cell, pageId: OTHER_PAGE_ID })
    socket.receive('cell-updated', cell)
    expect(onEvent).toHaveBeenCalledWith({ type: 'cell-updated', payload: cell })
    expect(onEvent).toHaveBeenCalledTimes(1)

    const page = { pageId: PAGE_ID, title: 'Novo título', ...META }
    socket.receive('page-updated', page)
    expect(onPageUpdated).toHaveBeenCalledWith(page)

    const column = {
      pageId: PAGE_ID,
      columnId: 'column-1',
      column: { id: 'column-1', name: 'Coluna', type: 'text', data: {} },
      ...META,
    }
    socket.receive('column-created', column)
    expect(onEvent).toHaveBeenCalledWith({ type: 'column-created', payload: column })
    expect(onEvent).toHaveBeenCalledTimes(2)

    const deleted = { pageId: PAGE_ID, columnId: 'column-1', ...META }
    socket.receive('column-deleted', deleted)
    expect(onStructureChanged).toHaveBeenCalledWith({
      type: 'column-deleted',
      payload: deleted,
    })
    expect(onStructureChanged).toHaveBeenCalledTimes(1)

    const resize = {
      pageId: PAGE_ID,
      viewId: 'view-1',
      columnId: 'column-1',
      width: 320,
      originUserId: META.originUserId,
    }
    socket.receive('column-resizing', resize)
    expect(onColumnResize).toHaveBeenCalledWith(resize)

    channel.previewColumnResize({ viewId: 'view-1', columnId: 'column-1', width: 360 })
    expect(socket.emitted).toContainEqual({
      event: 'resize-column',
      payload: { pageId: PAGE_ID, viewId: 'view-1', columnId: 'column-1', width: 360 },
      volatile: true,
    })
  })

  it('reentra na reconexão, ressincroniza só apó ACK e limpa tudo no dispose', () => {
    const socket = new FakeSocket()
    const onResync = vi.fn()
    const onJoinedChanged = vi.fn()
    const onPresenceChanged = vi.fn()
    const onEvent = vi.fn()
    const channel = new PageRealtimeChannel(socket as unknown as CubsSocket, PAGE_ID, {
      onResync,
      onJoinedChanged,
      onPresenceChanged,
      onEvent,
    })

    channel.subscribe()
    socket.receive('joined-page-database', { pageId: OTHER_PAGE_ID })
    expect(onResync).not.toHaveBeenCalled()

    socket.receive('joined-page-database', { pageId: PAGE_ID })
    expect(onJoinedChanged).toHaveBeenLastCalledWith(true)
    expect(onResync).toHaveBeenCalledTimes(1)

    socket.receive('page-presence', { pageId: PAGE_ID, count: 2 })
    expect(onPresenceChanged).toHaveBeenLastCalledWith(2)

    socket.receive('disconnect')
    expect(onJoinedChanged).toHaveBeenLastCalledWith(false)
    expect(onPresenceChanged).toHaveBeenLastCalledWith(0)

    socket.receive('connect')
    expect(socket.emitted.filter(({ event }) => event === 'join-page-database')).toHaveLength(2)

    channel.dispose()
    channel.dispose()
    expect(socket.emitted.filter(({ event }) => event === 'leave-page-database')).toHaveLength(1)
    for (const event of PAGE_LISTENER_NAMES) {
      expect(socket.listenerCount(event), `listener residual de ${event}`).toBe(0)
    }

    socket.receive('cell-updated', {
      pageId: PAGE_ID,
      rowId: 'row-1',
      columnId: 'column-1',
      value: 'depois',
      ...META,
    })
    expect(onEvent).not.toHaveBeenCalled()
  })
})
