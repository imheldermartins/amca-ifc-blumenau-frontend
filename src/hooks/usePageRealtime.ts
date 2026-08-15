import { useEffect, useState } from 'react'

import { useSocket } from '@/hooks/useSocket'
import type {
  CellUpdatedPayload,
  ColumnUpdatedPayload,
  PresencePayload,
  RowPayload,
  RowUpdatedPayload,
  ViewUpdatedPayload,
} from '@/services/SocketService'
import type { DatabaseRealtimeEvent } from '@/lib/databaseRealtime'

export interface UsePageRealtimeOptions {
  /** Uma edição confirmada chegou (de outro usuário ou eco do próprio autor). */
  onEvent?: (event: DatabaseRealtimeEvent) => void
  /** Uma LINHA nasceu ou morreu — a base precisa ser relida por inteiro. */
  onRowsChanged?: () => void
  /**
   * O socket (re)conectou depois de já estar na sala. Reconexão NÃO reenvia o
   * que passou, então o caminho seguro e barato é recarregar a base — mais
   * simples que tentar reconstruir um replay de eventos perdidos.
   */
  onResync?: () => void
}

export interface UsePageRealtimeResult {
  /** Quantos estão com esta página aberta (inclui você). 0 = ainda entrando. */
  viewers: number
  /** Entrou na sala? `false` enquanto conecta — ou se o acesso foi negado. */
  joined: boolean
}

/**
 * Assina a sala de uma página. **A sala É a página** (`page-database:{pageId}`
 * do lado do servidor): quem abre a mesma página cai na mesma sala, não
 * importa por onde entrou — a workspace do dono ou o `/page/:id` do
 * colaborador. É isso que faz os dois se enxergarem editando.
 *
 * A CONEXÃO tem vida longa (o `useSocket` mantém uma por sessão, com
 * acquire/release); a MEMBRESIA é curta e segue o componente: o efeito depende
 * de `pageId`, então navegar de uma página para outra sai da sala antiga e
 * entra na nova sozinho, sem derrubar o socket. Sala sem ninguém não custa
 * nada — o socket.io limpa as vazias.
 *
 * Quem chama é o `PageShell`, e só ele: entrar na sala é consequência de abrir
 * a página, não um passo que cada tela precisa lembrar de dar.
 */
export function usePageRealtime(
  pageId: string | undefined,
  options: UsePageRealtimeOptions = {},
): UsePageRealtimeResult {
  const { socket } = useSocket()
  const [viewers, setViewers] = useState(0)
  const [joined, setJoined] = useState(false)

  const { onEvent, onRowsChanged, onResync } = options

  useEffect(() => {
    if (!socket || !pageId) return

    const join = () => socket.emit('join-page-database', { pageId })

    const handleJoined = (payload: { pageId: string }) => {
      if (payload.pageId !== pageId) return
      setJoined(true)
      // Só depois do ACK a membresia existe. Recarregar antes dele abre uma
      // janela em que o fetch termina, uma edição acontece e o evento ainda
      // não tem para onde ser entregue (especialmente perceptível na LAN).
      onResync?.()
    }
    const handleDenied = (payload: { pageId: string }) => {
      if (payload.pageId === pageId) setJoined(false)
    }
    const handlePresence = (payload: PresencePayload) => {
      if (payload.pageId === pageId) setViewers(payload.count)
    }
    // Um socket vive além da página e pode receber o fim da sala anterior
    // durante uma navegação. Todo evento de conteúdo precisa validar a sala,
    // não só presence/rows.
    const handleCell = (payload: CellUpdatedPayload) => {
      if (payload.pageId === pageId) onEvent?.({ type: 'cell-updated', payload })
    }
    const handleRowTitle = (payload: RowUpdatedPayload) => {
      if (payload.pageId === pageId) onEvent?.({ type: 'row-updated', payload })
    }
    const handleColumn = (payload: ColumnUpdatedPayload) => {
      if (payload.pageId === pageId) onEvent?.({ type: 'column-updated', payload })
    }
    const handleView = (payload: ViewUpdatedPayload) => {
      if (payload.pageId === pageId) onEvent?.({ type: 'view-updated', payload })
    }
    // Linha nova/removida muda a FORMA da base (as células vêm de outra
    // leitura), então recarregar é mais honesto que remendar meia linha.
    const handleRows = (payload: RowPayload) => {
      if (payload.pageId === pageId) onRowsChanged?.()
    }
    // `connect` também dispara em RECONEXÃO: reentra na sala (a membresia
    // morreu junto com a conexão). A ressincronização espera o ACK acima.
    const handleConnect = () => {
      join()
    }

    if (socket.connected) join()

    socket.on('connect', handleConnect)
    socket.on('joined-page-database', handleJoined)
    socket.on('page-database-denied', handleDenied)
    socket.on('page-presence', handlePresence)
    socket.on('cell-updated', handleCell)
    socket.on('row-updated', handleRowTitle)
    socket.on('column-updated', handleColumn)
    socket.on('view-updated', handleView)
    socket.on('row-created', handleRows)
    socket.on('row-deleted', handleRows)

    return () => {
      socket.off('connect', handleConnect)
      socket.off('joined-page-database', handleJoined)
      socket.off('page-database-denied', handleDenied)
      socket.off('page-presence', handlePresence)
      socket.off('cell-updated', handleCell)
      socket.off('row-updated', handleRowTitle)
      socket.off('column-updated', handleColumn)
      socket.off('view-updated', handleView)
      socket.off('row-created', handleRows)
      socket.off('row-deleted', handleRows)
      if (socket.connected) socket.emit('leave-page-database', { pageId })
      setJoined(false)
      setViewers(0)
    }
  }, [socket, pageId, onEvent, onRowsChanged, onResync])

  return { viewers, joined }
}
