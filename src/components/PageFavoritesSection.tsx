import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { Icon } from '@iconify/react'
import { useId, useMemo, useState } from 'react'
import { cn } from 'cubs-components'
import { useAuth } from '@/contexts/AuthContext'
import { useLanguage } from '@/contexts/LanguageContext'
import { useFavoriteMutation, usePageFavorites } from '@/hooks/usePageFavorites'
import { clientLocalStorage } from '@/lib/clientStorage'
import { currentWorkspaceSession } from '@/lib/currentWorkspaceSession'
import { i18n } from '@/lib/i18n'
import { mentionService } from '@/services/MentionService'
import type { FavoritePage } from '@/services/PageFavoriteService'
import { mentionIds, resolveMentionText } from '@/shared/mentions'

function FavoriteRow({ item, pending, onRemove }: { item: FavoritePage; pending: boolean; onRemove: () => void }) {
  const { slug: lang } = useLanguage(), { user } = useAuth()
  const ids = useMemo(() => mentionIds(item.title ?? ''), [item.title])
  const variables = useQuery({
    queryKey: ['mentions', user?.id, { pageId: item.pageId }, 'favorite-title', ids],
    queryFn: () => mentionService.resolve({ pageId: item.pageId }, ids), enabled: ids.length > 0,
    staleTime: 30_000, refetchInterval: ids.length ? 30_000 : false, retry: false,
  })
  const title = resolveMentionText(item.title || i18n('pages.app.pagina.sem-titulo'), variables.data ?? {}, i18n('mentions.unavailable'))
  return <li className="group flex min-w-0 items-center gap-1 rounded-lg hover:bg-active">
    <Link to="/$lang/page/$pageId" params={{ lang, pageId: item.pageId }} search={{}} className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg px-2 py-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-p-purple/40"
      onClick={(event) => { if (user && item.workspaceId && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) currentWorkspaceSession.set(user.id, item.workspaceId) }}>
      <Icon icon="lucide:file-text" className="size-4 shrink-0 text-foreground/50" />
      <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{title}</span>
        {item.workspaceName && <span className="mt-0.5 block truncate text-[11px] text-foreground/50">{item.workspaceName}</span>}
      </span>
    </Link>
    <button type="button" disabled={pending} onClick={onRemove} aria-label={i18n('favorites.remove-named', { title })} title={i18n('favorites.remove')}
      className="mr-1 shrink-0 rounded-lg p-1.5 text-p-purple/70 hover:bg-p-purple/10 hover:text-p-purple disabled:opacity-30">
      <Icon icon="lucide:star" className="size-3.5 [&_path]:fill-current" />
    </button>
  </li>
}

export function PageFavoritesSection() {
  const { user } = useAuth()
  return user ? <FavoritesContent key={user.id} actor={user.id} /> : null
}
function FavoritesContent({ actor }: { actor: string }) {
  const storageKey = `favoriteSection.${actor}.collapsed`
  const [expanded, setExpanded] = useState(() => clientLocalStorage.get<boolean>(storageKey) !== true)
  const regionId = useId()
  const query = usePageFavorites(expanded), mutation = useFavoriteMutation()
  const items = query.data?.pages.flatMap((page) => page.items) ?? []
  const uniqueItems = [...new Map(items.map((item) => [item.pageId, item])).values()]
  const total = query.data?.pages[0]?.total
  return <section className={cn('flex min-h-0 flex-col', expanded ? 'flex-1' : 'shrink-0')}>
    <h2><button type="button" aria-expanded={expanded} aria-controls={regionId} className="mb-2 flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm font-semibold hover:bg-active"
      onClick={() => { clientLocalStorage.set(storageKey, expanded); setExpanded(!expanded) }}>
      <Icon icon="lucide:star" className="size-4 text-p-purple" /><span className="flex-1">{i18n('favorites.title')}</span>
      {total !== undefined && <span aria-hidden className="text-xs font-normal text-foreground/45">{total}</span>}
      <Icon icon={expanded ? 'lucide:chevron-down' : 'lucide:chevron-right'} className="size-3.5 text-foreground/50" />
    </button></h2>
    {expanded && <div id={regionId} role="region" aria-label={i18n('favorites.title')} className="min-h-0 max-h-80 flex-1 overflow-y-auto overscroll-contain pr-1 lg:max-h-none">
      {query.isPending ? <p role="status" className="px-2 py-3 text-xs text-foreground/55">{i18n('common.carregando')}</p> : <>
        {uniqueItems.length ? <ul>{uniqueItems.map((item) => <FavoriteRow key={item.pageId} item={item} pending={mutation.pending} onRemove={() => mutation.setFavorite(item.pageId, false)} />)}</ul>
          : !query.isError && <p className="px-2 py-3 text-xs leading-relaxed text-foreground/55">{i18n('favorites.empty')}</p>}
        {query.hasNextPage && <button type="button" disabled={query.isFetchingNextPage} className="mt-2 w-full rounded-lg px-2 py-2 text-xs text-p-purple hover:bg-active disabled:opacity-40" onClick={() => void query.fetchNextPage()}>
          {i18n(query.isFetchingNextPage ? 'common.carregando' : 'favorites.more')}
        </button>}
        {query.isError && <div className="px-2 py-3 text-xs"><p role="alert" className="text-p-red">{i18n('favorites.load-error')}</p><button type="button" className="mt-2 text-p-purple" onClick={() => void query.refetch()}>{i18n('favorites.retry')}</button></div>}
      </>}
    </div>}
  </section>
}
