import { useEffect, useRef, useState } from 'react'

import { useSocket } from '@/hooks/useSocket'
import type { DatabaseRealtimeEvent } from '@/lib/databaseRealtime'
import {
  PageRealtimeChannel,
  type PageStructureEvent,
} from '@/services/PageRealtimeChannel'
import type {
  ColumnResizingPayload,
  PageUpdatedPayload,
} from '@/services/realtime-contract-v1'

export interface UsePageRealtimeOptions {
  /** Uma edição confirmada chegou, inclusive o eco do próprio autor. */
  onEvent?: (event: DatabaseRealtimeEvent) => void
  /** Título/chrome da própria página aberta mudou. */
  onPageUpdated?: (payload: PageUpdatedPayload) => void
  /** Linha nasceu/morreu ou coluna morreu; criação de coluna já é incremental. */
  onStructureChanged?: (event: PageStructureEvent) => void
  /**
   * Compatibilidade com consumidores v1 anteriores. Chamado apenas para
   * `row-created`/`row-deleted`; novos consumidores usam `onStructureChanged`.
   */
  onRowsChanged?: () => void
  /** Frame efêmero de resize vindo de outro socket da mesma sala. */
  onColumnResize?: (payload: ColumnResizingPayload) => void
  /** Refetch autoritativo depois do ACK de cada entrada/reentrada na sala. */
  onResync?: () => void
  /** Liga o produtor de previews ao channel ativo sem expor o socket. */
  onChannelChange?: (channel: PageRealtimeChannel | null) => void
}

export interface UsePageRealtimeResult {
  /** Quantos estão com esta página aberta (inclui você). 0 = entrando. */
  viewers: number
  /** Entrou na sala? `false` enquanto conecta — ou se o acesso foi negado. */
  joined: boolean
}

/**
 * Adapta o channel imperativo ao ciclo de vida React.
 *
 * A conexão continua sendo compartilhada pelo `useSocket`; esta assinatura
 * cria apenas a membresia curta da página. Os callbacks vivem num ref para
 * mudanças de render não causarem leave/join nem duplicarem listeners.
 */
export function usePageRealtime(
  pageId: string | undefined,
  options: UsePageRealtimeOptions = {},
): UsePageRealtimeResult {
  const { socket } = useSocket()
  const [viewers, setViewers] = useState(0)
  const [joined, setJoined] = useState(false)
  const subscriptionRef = useRef({ pageId, options })
  subscriptionRef.current = { pageId, options }

  useEffect(() => {
    if (!socket || !pageId) return

    // Durante uma navegação, o render com o novo pageId antecede o cleanup do
    // channel antigo. Ignorar callbacks desse pequeno intervalo impede que um
    // último frame da página anterior atinja o estado/callbacks da nova.
    const currentOptions = () =>
      subscriptionRef.current.pageId === pageId
        ? subscriptionRef.current.options
        : undefined

    const channel = new PageRealtimeChannel(socket, pageId, {
      onEvent: (event) => currentOptions()?.onEvent?.(event),
      onPageUpdated: (payload) => currentOptions()?.onPageUpdated?.(payload),
      onStructureChanged: (event) => {
        const current = currentOptions()
        current?.onStructureChanged?.(event)
        if (event.type === 'row-created' || event.type === 'row-deleted') {
          current?.onRowsChanged?.()
        }
      },
      onColumnResize: (payload) => currentOptions()?.onColumnResize?.(payload),
      onPresenceChanged: (count) => {
        if (currentOptions()) setViewers(count)
      },
      onJoinedChanged: (nextJoined) => {
        if (currentOptions()) setJoined(nextJoined)
      },
      onResync: () => currentOptions()?.onResync?.(),
    })

    setJoined(false)
    setViewers(0)
    currentOptions()?.onChannelChange?.(channel)
    channel.subscribe()

    return () => {
      channel.dispose()
      currentOptions()?.onChannelChange?.(null)
    }
  }, [socket, pageId])

  return { viewers, joined }
}
