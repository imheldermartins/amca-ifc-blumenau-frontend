import { useEffect, useState, type ReactNode } from 'react'
import { Icon } from '@iconify/react'

import { Typography } from '@components/Typography'
import { usePageRealtime, type UsePageRealtimeOptions } from '@/hooks/usePageRealtime'
import { i18n } from '@/lib/i18n'
import { databaseService } from '@/services/DatabaseService'

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
  // Os handlers vêm de quem tem o ESTADO da base (o `usePageDatabase` da
  // página) — o shell é quem assina a sala, mas não é quem guarda os dados.
  const { viewers } = usePageRealtime(pageId, realtimeOptions)

  // O flag `active` descarta a resposta de um unmount no meio do caminho —
  // sem ele, o setState cai num componente que já saiu da árvore.
  useEffect(() => {
    if (!pageId) return
    let active = true

    setFailed(false)
    databaseService
      .getPage(pageId)
      .then((page) => {
        if (active) setTitle(page.title)
      })
      .catch(() => {
        if (active) setFailed(true)
      })

    return () => {
      active = false
    }
  }, [pageId])

  return (
    <div className="mx-auto my-0 w-full max-w-5xl p-6">
      <header className="mb-6 flex items-center justify-between gap-4">
        <Typography variant="h1">
          {failed
            ? i18n('pages.app.pagina.indisponivel')
            : (title ?? i18n('pages.app.pagina.sem-titulo'))}
        </Typography>

        {/* Presença: prova visível de que a sala existe e quem mais está nela.
            Só aparece com companhia — sozinho, o contador é ruído. */}
        {viewers > 1 && (
          <span
            className="flex shrink-0 items-center gap-1.5 rounded bg-active px-2 py-1 text-xs"
            title={i18n('pages.app.pagina.espectadores', { count: viewers })}
          >
            <Icon icon="lucide:users" fontSize={14} />
            {viewers}
          </span>
        )}
      </header>

      {children}
    </div>
  )
}
