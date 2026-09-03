import { useEffect, useState } from 'react'
import { Link, useParams } from '@tanstack/react-router'
import { Icon } from '@iconify/react'
import { cn } from 'cubs-components'

import { Typography } from '@components/Typography'
import { PageTitleSkeleton } from '@components/PageTitleSkeleton'
import { i18n } from '@/lib/i18n'
import { createPageNavigationState, normalizePageTitle } from '@/lib/pageNavigation'
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
    <div className="mx-auto my-0 w-full max-w-6xl p-4">
      <Typography variant="h1">{i18n('pages.app.colaborando.titulo')}</Typography>
      <Typography variant="subtitle" as="p" className="mt-2 opacity-70">
        {i18n('pages.app.colaborando.descricao')}
      </Typography>

      {loading ? (
        <div aria-hidden className="mt-5 grid gap-2.5 sm:grid-cols-2">
          {[0, 1, 2].map((skeleton) => (
            <div
              key={skeleton}
              className="h-20 animate-pulse rounded-2xl border border-divider-contrast bg-glass"
            />
          ))}
        </div>
      ) : failed || pages.length === 0 ? (
        <div className="mt-5 flex flex-col items-center gap-2 rounded-2xl border border-dashed border-divider-contrast px-4 py-8 opacity-60">
          <Icon icon={failed ? 'lucide:unplug' : 'lucide:users'} fontSize={22} />
          <span className="text-sm">
            {i18n(failed ? 'pages.app.colaborando.erro' : 'pages.app.colaborando.vazio')}
          </span>
        </div>
      ) : (
        <ul className="mt-5 grid gap-3 grid-cols-6">
          {pages.map((page) => (
            <li key={page.id}>
              <Link
                to="/$lang/page/$pageId"
                params={{ lang: lang ?? 'pt-br', pageId: page.id }}
                state={createPageNavigationState(page.id, page.title)}
                className={cn(
                  'flex h-48 flex-col gap-1.5 rounded-2xl border border-divider-contrast bg-glass p-3.5',
                  'shadow-lg shadow-dark-900/5 backdrop-blur-md transition-[background-color,box-shadow,transform] hover:-translate-y-0.5 hover:bg-active hover:shadow-xl',
                )}
              >
                <div className='flex-1 flex flex-col'>
                  <span className="flex items-center gap-2">
                    <Icon icon="lucide:table" fontSize={16} className="shrink-0 text-p-purple" />
                    <Typography
                      variant="h3"
                      as="span"
                      className="text-md min-w-0 flex-1 whitespace-normal line-clamp-2"
                    >
                      {normalizePageTitle(page.title) ?? <PageTitleSkeleton />}
                    </Typography>
                  </span>
                  <Typography variant="caption" as="span" className="opacity-70">
                    {i18n('pages.app.colaborando.dono', {
                      owner: page.owner_name ?? page.owner_email,
                    })}
                  </Typography>
                </div>
                <Typography variant="caption" as="span" className="opacity-70">
                  Atualizado há 10 dias
                </Typography>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
