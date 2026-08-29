import { useEffect, useState } from 'react'
import { FormProvider, useForm } from 'react-hook-form'
import { Button, PALETTE, TextField, cn } from 'cubs-components'

import { Typography } from '@components/Typography'
import { useSocket, type SocketStatus } from '@/hooks/useSocket'
import { i18n } from '@/lib/i18n'
import { validators } from '@/lib/validators'
import type { EchoReply } from '@/services/SocketService'

interface EchoFormValues {
  message: string
}

const STATUS_STYLES: Record<SocketStatus, { dot: string; labelKey: string }> = {
  connected: { dot: 'bg-emerald-300 dark:bg-emerald-500', labelKey: 'pages.app.exemplo-socket.status-conectado' },
  connecting: { dot: 'bg-amber-300 dark:bg-amber-500', labelKey: 'pages.app.exemplo-socket.status-conectando' },
  disconnected: {
    dot: 'bg-light-900 dark:bg-dark-100',
    labelKey: 'pages.app.exemplo-socket.status-desconectado',
  },
  error: { dot: 'bg-rose-300 dark:bg-rose-500', labelKey: 'pages.app.exemplo-socket.status-erro' },
}

/**
 * Demonstração do socket.io-client: conexão autenticada (handshake com o
 * access token), presença ao vivo e um echo de ida e volta com o backend.
 */
export function SocketExampleSection() {
  const { socket, status, error } = useSocket()
  const [presence, setPresence] = useState<number | null>(null)
  const [reply, setReply] = useState<EchoReply | null>(null)

  const form = useForm<EchoFormValues>({ defaultValues: { message: '' } })

  useEffect(() => {
    if (!socket) return

    const onPresence = (count: number) => setPresence(count)
    const onReply = (payload: EchoReply) => setReply(payload)

    socket.on('presence:count', onPresence)
    socket.on('echo:reply', onReply)
    return () => {
      socket.off('presence:count', onPresence)
      socket.off('echo:reply', onReply)
    }
  }, [socket])

  const statusStyle = STATUS_STYLES[status]

  return (
    <section className="rounded border border-divider bg-contrast p-6">
      <div className="flex items-center justify-between gap-3">
        <Typography variant="h3">{i18n('pages.app.exemplo-socket.titulo')}</Typography>
        <Typography variant="subtitle" as="span" className="inline-flex items-center gap-2">
          <span className={cn('size-2.5 rounded-full', statusStyle.dot)} />
          {i18n(statusStyle.labelKey)}
        </Typography>
      </div>
      <Typography variant="subtitle" className="mt-1">
        {i18n('pages.app.exemplo-socket.descricao')}
      </Typography>

      {status === 'error' && error && (
        <div className={cn('mt-3 rounded border bg-rose-500/10 p-3', PALETTE.red.border)}>
          <Typography variant="body" className={cn('font-medium', PALETTE.red.text)}>
            {i18n('pages.app.exemplo-socket.erro-detalhe', { message: error })}
          </Typography>
          <Typography variant="subtitle" className="mt-1">
            {i18n('pages.app.exemplo-socket.erro-dica')}
          </Typography>
        </div>
      )}

      {presence !== null && (
        <Typography variant="body" className="mt-3">
          {i18n('pages.app.exemplo-socket.conexoes-ativas', { count: presence })}
        </Typography>
      )}

      <FormProvider {...form}>
        <form
          className="mt-4 flex flex-col gap-4"
          onSubmit={form.handleSubmit(({ message }) => {
            socket?.emit('echo:send', message)
            form.reset()
          })}
          noValidate
        >
          <TextField
            name="message"
            label={i18n('pages.app.exemplo-socket.campo-mensagem')}
            placeholder={i18n('pages.app.exemplo-socket.campo-mensagem-placeholder')}
            rules={validators.required()}
          />
          <Button type="submit" variant="outlined" color="purple" disabled={status !== 'connected'}>
            {i18n('pages.app.exemplo-socket.botao-enviar')}
          </Button>
        </form>
      </FormProvider>

      <div className="mt-4 rounded border border-divider bg-background p-4">
        {reply ? (
          <>
            <Typography variant="body" className="font-medium">
              {i18n('pages.app.exemplo-socket.resposta')}
            </Typography>
            <Typography variant="subtitle" className="mt-2">
              "{reply.message}"
            </Typography>
            <Typography variant="caption" as="p" className="mt-1 font-mono">
              userId={reply.userId} · {reply.at}
            </Typography>
          </>
        ) : (
          <Typography variant="subtitle">
            {i18n('pages.app.exemplo-socket.sem-resposta')}
          </Typography>
        )}
      </div>
    </section>
  )
}
