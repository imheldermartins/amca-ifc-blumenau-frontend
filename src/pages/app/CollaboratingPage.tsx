import { useEffect, useState } from 'react'
import { Link, useParams } from '@tanstack/react-router'
import { Icon } from '@iconify/react'
import { cn } from 'cubs-components'

import { Typography } from '@components/Typography'
import { i18n } from '@/lib/i18n'
import { sharedPagesService, type ApiSharedPage } from '@/services/SharedPagesService'

/**
 * Páginas que outras pessoas dividiram comigo (sou colaborador em
 * `page_collaborators`, não dono). Cada card leva para `/page/:id` — a MESMA
 * view que o dono vê pela workspace dele, o que coloca os dois na mesma sala
 * de realtime.
 */
export function CollaboratingPage() {
  const { lang } = useParams({ strict: false })
  const [pages, setPages] = useState<ApiSharedPage[]>([])
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)

  // O flag `active` descarta a resposta de um unmount no meio do caminho.
  useEffect(() => {
    let active = true

    sharedPagesService
      .listShared()
      .then((shared) => {
        if (active) setPages(shared)
      })
      .catch(() => {
        if (active) setFailed(true)
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [])

  return (
    <div className="mx-auto my-0 w-full max-w-5xl p-6">
      <Typography variant="h1">{i18n('pages.app.colaborando.titulo')}</Typography>
      <Typography variant="subtitle" as="p" className="mt-2 opacity-70">
        {i18n('pages.app.colaborando.descricao')}
      </Typography>

      {loading ? (
        <div aria-hidden className="mt-8 grid gap-3 sm:grid-cols-2">
          {[0, 1, 2].map((skeleton) => (
            <div
              key={skeleton}
              className="h-24 animate-pulse rounded-lg border border-divider-contrast bg-contrast"
            />
          ))}
        </div>
      ) : failed || pages.length === 0 ? (
        <div className="mt-8 flex flex-col items-center gap-2 rounded-lg border border-dashed border-divider-contrast px-4 py-10 opacity-60">
          <Icon icon={failed ? 'lucide:unplug' : 'lucide:users'} fontSize={22} />
          <span className="text-sm">
            {i18n(failed ? 'pages.app.colaborando.erro' : 'pages.app.colaborando.vazio')}
          </span>
        </div>
      ) : (
        <ul className="mt-8 grid gap-3 sm:grid-cols-2">
          {pages.map((page) => (
            <li key={page.id}>
              <Link
                to="/$lang/page/$pageId"
                params={{ lang: lang ?? 'pt-br', pageId: page.id }}
                className={cn(
                  'flex h-full flex-col gap-2 rounded-lg border border-divider-contrast bg-contrast p-4',
                  'shadow-sm transition-colors hover:bg-active',
                )}
              >
                <span className="flex items-center gap-2">
                  <Icon icon="lucide:table" fontSize={16} className="shrink-0 text-p-purple" />
                  <Typography variant="h3" as="span" className="truncate">
                    {page.title ?? i18n('pages.app.pagina.sem-titulo')}
                  </Typography>
                </span>
                <Typography variant="caption" as="span" className="opacity-70">
                  {i18n('pages.app.colaborando.dono', {
                    owner: page.owner_name ?? page.owner_email,
                  })}
                </Typography>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
