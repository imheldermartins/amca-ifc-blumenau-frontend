import { Icon } from '@iconify/react'
import { cn } from 'cubs-components'
import { useFavoriteMutation, usePageFavorite } from '@/hooks/usePageFavorites'
import { i18n } from '@/lib/i18n'

export function PageFavoriteButton({ pageId, title, enabled = true }: { pageId: string; title: string | null; enabled?: boolean }) {
  const state = usePageFavorite(pageId, enabled)
  const mutation = useFavoriteMutation()
  if (!enabled) return null
  const favorite = state.data?.favorite ?? false
  const label = state.isError ? i18n('favorites.retry') : i18n(favorite ? 'favorites.remove-named' : 'favorites.add-named', { title: title || i18n('pages.app.pagina.sem-titulo') })
  return <button type="button" aria-label={label} title={label} aria-pressed={favorite} disabled={state.isPending || mutation.pending}
    onClick={() => state.isError ? void state.refetch() : mutation.setFavorite(pageId, !favorite)}
    className={cn('flex size-8 shrink-0 items-center justify-center rounded-lg transition-colors hover:bg-active focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-p-purple/40 disabled:opacity-40', favorite ? 'text-p-purple' : 'text-foreground/55')}>
    <Icon icon={state.isError ? 'lucide:rotate-cw' : 'lucide:star'} className={cn('size-4', favorite && '[&_path]:fill-current')} />
  </button>
}
