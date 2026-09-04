import type { DatabaseRealtimeEvent } from '@/lib/databaseRealtime'
import type { CubsSocket } from '@/services/SocketService'
import type {
  CellUpdatedPayload,
  ColumnCreatedPayload,
  ColumnPayload,
  ColumnResizingPayload,
  ColumnUpdatedPayload,
  PageUpdatedPayload,
  RowPayload,
  RowUpdatedPayload,
  ViewUpdatedPayload,
} from '@/services/realtime-contract-v1'

export type PageStructureEvent =
  | { type: 'row-created'; payload: RowPayload }
  | { type: 'row-deleted'; payload: RowPayload }
  | { type: 'column-deleted'; payload: ColumnPayload }

export interface PageRealtimeChannelCallbacks {
  onEvent?: (event: DatabaseRealtimeEvent) => void
  onStructureChanged?: (event: PageStructureEvent) => void
  onPageUpdated?: (payload: PageUpdatedPayload) => void
  onColumnResize?: (payload: ColumnResizingPayload) => void
  onPresenceChanged?: (viewers: number) => void
  onJoinedChanged?: (joined: boolean) => void
  onResync?: () => void
}

export interface ColumnResizePreview {
  viewId: string
  columnId: string
  width: number
}

/**
 * Canal de uma página aberta.
 *
 * A classe concentra o protocolo de membresia, a filtragem por `pageId`, os
 * listeners e seu cleanup. Ela não guarda estado React nem conhece um tipo de
 * view: table, board e calendar observam o mesmo estado canônico da página.
 */
export class PageRealtimeChannel {
  private subscribed = false
  private readonly socket: CubsSocket
  readonly pageId: string
  private readonly callbacks: PageRealtimeChannelCallbacks

  constructor(
    socket: CubsSocket,
    pageId: string,
    callbacks: PageRealtimeChannelCallbacks = {},
  ) {
    this.socket = socket
    this.pageId = pageId
    this.callbacks = callbacks
  }

  /** Registra os listeners uma única vez e entra assim que houver conexão. */
  subscribe(): void {
    if (this.subscribed) return
    this.subscribed = true

    this.socket.on('connect', this.handleConnect)
    this.socket.on('disconnect', this.handleDisconnect)
    this.socket.on('joined-page-database', this.handleJoined)
    this.socket.on('page-database-denied', this.handleDenied)
    this.socket.on('page-presence', this.handlePresence)
    this.socket.on('cell-updated', this.handleCellUpdated)
    this.socket.on('row-updated', this.handleRowUpdated)
    this.socket.on('page-updated', this.handlePageUpdated)
    this.socket.on('column-updated', this.handleColumnUpdated)
    this.socket.on('column-resizing', this.handleColumnResize)
    this.socket.on('view-updated', this.handleViewUpdated)
    this.socket.on('row-created', this.handleRowCreated)
    this.socket.on('row-deleted', this.handleRowDeleted)
    this.socket.on('column-created', this.handleColumnCreated)
    this.socket.on('column-deleted', this.handleColumnDeleted)

    if (this.socket.connected) this.join()
  }

  /**
   * Sai da sala e remove exatamente os listeners registrados por esta
   * instância. Chamadas repetidas são seguras.
   */
  dispose(): void {
    if (!this.subscribed) return
    this.subscribed = false

    this.socket.off('connect', this.handleConnect)
    this.socket.off('disconnect', this.handleDisconnect)
    this.socket.off('joined-page-database', this.handleJoined)
    this.socket.off('page-database-denied', this.handleDenied)
    this.socket.off('page-presence', this.handlePresence)
    this.socket.off('cell-updated', this.handleCellUpdated)
    this.socket.off('row-updated', this.handleRowUpdated)
    this.socket.off('page-updated', this.handlePageUpdated)
    this.socket.off('column-updated', this.handleColumnUpdated)
    this.socket.off('column-resizing', this.handleColumnResize)
    this.socket.off('view-updated', this.handleViewUpdated)
    this.socket.off('row-created', this.handleRowCreated)
    this.socket.off('row-deleted', this.handleRowDeleted)
    this.socket.off('column-created', this.handleColumnCreated)
    this.socket.off('column-deleted', this.handleColumnDeleted)

    if (this.socket.connected) {
      this.socket.emit('leave-page-database', { pageId: this.pageId })
    }
    this.callbacks.onJoinedChanged?.(false)
    this.callbacks.onPresenceChanged?.(0)
  }

  /** Publica apenas o frame efêmero; o snapshot HTTP continua autoritativo. */
  previewColumnResize(payload: ColumnResizePreview): void {
    if (!this.subscribed || !this.socket.connected) return
    this.socket.volatile.emit('resize-column', { pageId: this.pageId, ...payload })
  }

  private readonly join = () => {
    this.socket.emit('join-page-database', { pageId: this.pageId })
  }

  private readonly belongsHere = (payload: { pageId: string }) =>
    payload.pageId === this.pageId

  private readonly handleConnect = () => {
    this.join()
  }

  private readonly handleDisconnect = () => {
    this.callbacks.onJoinedChanged?.(false)
    this.callbacks.onPresenceChanged?.(0)
  }

  private readonly handleJoined = (payload: { pageId: string }) => {
    if (!this.belongsHere(payload)) return
    this.callbacks.onJoinedChanged?.(true)
    // A membresia só existe depois do ACK. O refetch neste ponto fecha a
    // janela de eventos perdida entre a leitura anterior e o novo join.
    this.callbacks.onResync?.()
  }

  private readonly handleDenied = (payload: { pageId: string }) => {
    if (!this.belongsHere(payload)) return
    this.callbacks.onJoinedChanged?.(false)
    this.callbacks.onPresenceChanged?.(0)
  }

  private readonly handlePresence = (payload: { pageId: string; count: number }) => {
    if (this.belongsHere(payload)) this.callbacks.onPresenceChanged?.(payload.count)
  }

  private readonly handleCellUpdated = (payload: CellUpdatedPayload) => {
    if (this.belongsHere(payload)) {
      this.callbacks.onEvent?.({ type: 'cell-updated', payload })
    }
  }

  private readonly handleRowUpdated = (payload: RowUpdatedPayload) => {
    if (this.belongsHere(payload)) {
      this.callbacks.onEvent?.({ type: 'row-updated', payload })
    }
  }

  private readonly handlePageUpdated = (payload: PageUpdatedPayload) => {
    if (this.belongsHere(payload)) this.callbacks.onPageUpdated?.(payload)
  }

  private readonly handleColumnUpdated = (payload: ColumnUpdatedPayload) => {
    if (this.belongsHere(payload)) {
      this.callbacks.onEvent?.({ type: 'column-updated', payload })
    }
  }

  private readonly handleColumnResize = (payload: ColumnResizingPayload) => {
    if (this.belongsHere(payload)) this.callbacks.onColumnResize?.(payload)
  }

  private readonly handleViewUpdated = (payload: ViewUpdatedPayload) => {
    if (this.belongsHere(payload)) {
      this.callbacks.onEvent?.({ type: 'view-updated', payload })
    }
  }

  private readonly handleRowCreated = (payload: RowPayload) => {
    if (this.belongsHere(payload)) {
      this.callbacks.onStructureChanged?.({ type: 'row-created', payload })
    }
  }

  private readonly handleRowDeleted = (payload: RowPayload) => {
    if (this.belongsHere(payload)) {
      this.callbacks.onStructureChanged?.({ type: 'row-deleted', payload })
    }
  }

  private readonly handleColumnCreated = (payload: ColumnCreatedPayload) => {
    if (this.belongsHere(payload)) {
      this.callbacks.onEvent?.({ type: 'column-created', payload })
    }
  }

  private readonly handleColumnDeleted = (payload: ColumnPayload) => {
    if (this.belongsHere(payload)) {
      this.callbacks.onStructureChanged?.({ type: 'column-deleted', payload })
    }
  }
}
