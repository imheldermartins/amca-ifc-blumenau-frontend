import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
// import { Icon } from '@iconify/react'

import { Typography } from '@components/Typography'
import { usePageRealtime, type UsePageRealtimeOptions } from '@/hooks/usePageRealtime'
import { i18n } from '@/lib/i18n'
import { databaseService } from '@/services/DatabaseService'
import type { PageUpdatedPayload } from '@/services/realtime-contract-v1'
import { cn } from '@/shared/cubs-components/lib/utils'

export interface PageShellProps extends UsePageRealtimeOptions {
  /** Página aberta. `undefined` = ainda resolvendo (ex.: a entrada da workspace). */
  pageId?: string
  /** Conteúdo da página (hoje, a `<CubsDatabase />`). */
  children?: ReactNode
}

/**
 * Moldura padrão de uma página do Cub's: cabeçalho com o título e o conteúdo
 * por `children`. Toda página aberta no app passa por aqui — pela workspace
 * (`/myworkspace/:id`, que resolve a página de entrada) ou direto pelo id
 * (`/page/:id`, o caminho dos cards de "Colaborando").
 *
 * É também o ÚNICO lugar que entra na sala de realtime (`usePageRealtime`), e
 * isso é de propósito: entrar na sala vira consequência de ABRIR A PÁGINA, não
 * um passo que cada tela precisa lembrar de dar. Como a sala é identificada
 * pelo `pageId`, os dois caminhos de entrada caem na mesma — que é o que faz
 * dono e colaborador se enxergarem editando.
 */
export function PageShell({ pageId, children, ...realtimeOptions }: PageShellProps) {
  const [title, setTitle] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  const titleClockRef = useRef<{ pageId: string | undefined; updatedAt: string | null }>({
    pageId,
    updatedAt: null,
  })
  if (titleClockRef.current.pageId !== pageId) {
    titleClockRef.current = { pageId, updatedAt: null }
  }
  const notifyPageUpdated = realtimeOptions.onPageUpdated

  const handlePageUpdated = useCallback(
    (payload: PageUpdatedPayload) => {
      // Na troca de página há um frame entre render e cleanup do channel
      // anterior. A classe já filtra por room, mas este segundo guard impede
      // que um último evento da página antiga atualize o chrome da nova.
      if (payload.pageId !== pageId) return
      const appliedAt = titleClockRef.current.updatedAt
      // Socket.IO preserva a ordem de emissão no processo único; em empate
      // de milissegundo o segundo evento precisa vencer, como no redutor da base.
      if (appliedAt !== null && appliedAt > payload.updatedAt) return
      titleClockRef.current.updatedAt = payload.updatedAt
      setTitle(payload.title)
      setFailed(false)
      notifyPageUpdated?.(payload)
    },
    [notifyPageUpdated, pageId],
  )

  // Os handlers vêm de quem tem o ESTADO da base (o `usePageDatabase` da
  // página) — o shell é quem assina a sala, mas não é quem guarda os dados.
  const { viewers } = usePageRealtime(pageId, {
    ...realtimeOptions,
    onPageUpdated: handlePageUpdated,
  })

  // O flag `active` descarta a resposta de um unmount no meio do caminho —
  // sem ele, o setState cai num componente que já saiu da árvore.
  useEffect(() => {
    if (!pageId) return
    let active = true
    const clockAtStart = titleClockRef.current.updatedAt

    setTitle(null)
    setFailed(false)
    databaseService
      .getPage(pageId)
      .then((page) => {
        // Um `page-updated` posterior ao início do fetch é mais novo que a
        // resposta potencialmente stale e não pode ser desfeito por ela.
        if (active && titleClockRef.current.updatedAt === clockAtStart) {
          setTitle(page.title)
        }
      })
      .catch(() => {
        if (active && titleClockRef.current.updatedAt === clockAtStart) {
          setFailed(true)
        }
      })

    return () => {
      active = false
    }
  }, [pageId])

  return (
    <div className="mx-auto my-0 w-full max-w-6xl p-4">
      <header className="mb-3 flex flex-col-reverse gap-1">
        <Typography variant="h1" className="flex-1">
          {failed
            ? i18n('pages.app.pagina.indisponivel')
            : (title ?? i18n('pages.app.pagina.sem-titulo'))}
        </Typography>
        <div className="flex items-center flex-1" data-viewers={viewers}>
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className={cn(
              'w-7 h-7 rounded-full text-xs flex items-center justify-center bg-purple-400 text-purple-800 ring-4 ring-background',
              i === 0 && 'border-2 border-p-purple-500',
              i !== 0 && '-ml-1'
            )}>
              <span>{"AA"}</span>
            </div>
          ))}
        </div>
        {/* {viewers > 1 && (
          <span
            className="flex shrink-0 items-center gap-1.5 rounded bg-active px-2 py-1 text-xs"
            title={i18n('pages.app.pagina.espectadores', { count: viewers })}
          >
            <Icon icon="lucide:users" fontSize={14} />
            {viewers}
          </span>
        )} */}
      </header>

      {children}
    </div>
  )
}
