import { useEffect, useState } from 'react'

import { socketService, type CubsSocket } from '@/services/SocketService'

export type SocketStatus = 'connecting' | 'connected' | 'disconnected' | 'error'

export interface UseSocketResult {
  socket: CubsSocket | null
  status: SocketStatus
  /** Mensagem do último erro de conexão (null quando conectado). */
  error: string | null
}

/**
 * Conecta o socket do Cub's enquanto o componente estiver montado
 * (acquire/release no SocketService) e expõe status + erro ao vivo.
 *
 * @example
 * const { socket, status, error } = useSocket()
 * useEffect(() => {
 *   if (!socket) return
 *   socket.on('presence:count', setCount)
 *   return () => { socket.off('presence:count', setCount) }
 * }, [socket])
 */
export function useSocket(enabled = true): UseSocketResult {
  const [socket, setSocket] = useState<CubsSocket | null>(null)
  const [status, setStatus] = useState<SocketStatus>('connecting')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!enabled) { setSocket(null); return }
    const acquired = socketService.acquire()
    setSocket(acquired)
    setStatus(acquired.connected ? 'connected' : 'connecting')

    const onConnect = () => {
      setStatus('connected')
      setError(null)
    }
    const onDisconnect = () => setStatus('disconnected')
    const onError = (connectError: Error) => {
      setStatus('error')
      setError(connectError.message)
    }

    acquired.on('connect', onConnect)
    acquired.on('disconnect', onDisconnect)
    acquired.on('connect_error', onError)

    return () => {
      acquired.off('connect', onConnect)
      acquired.off('disconnect', onDisconnect)
      acquired.off('connect_error', onError)
      socketService.release()
    }
  }, [enabled])

  return { socket, status, error }
}
