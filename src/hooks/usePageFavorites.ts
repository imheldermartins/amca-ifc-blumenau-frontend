import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRef } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useFeedback } from '@/contexts/FeedbackContext'
import { i18n } from '@/lib/i18n'
import { pageFavoriteService, type PageFavoriteState } from '@/services/PageFavoriteService'

export const favoriteKeys = {
  all: (actor: string) => ['page-favorites', actor] as const,
  list: (actor: string) => ['page-favorites', actor, 'list'] as const,
  page: (actor: string, id: string) => ['page-favorites', actor, 'page', id] as const,
}
export function useFavoriteMutation() {
  const { user } = useAuth()
  const actor = useRef(user?.id); actor.current = user?.id
  const client = useQueryClient(), feedback = useFeedback()
  const mutation = useMutation({
    mutationFn: (input: { actor: string; pageId: string; favorite: boolean }) => pageFavoriteService.set(input.pageId, input.favorite),
    onMutate: async (input) => {
      const key = favoriteKeys.page(input.actor, input.pageId)
      await client.cancelQueries({ queryKey: key, exact: true })
      const previous = client.getQueryData<PageFavoriteState>(key)
      client.setQueryData<PageFavoriteState>(key, { pageId: input.pageId, favorite: input.favorite })
      return { previous }
    },
    onSuccess: async (saved, input) => {
      await client.cancelQueries({ queryKey: favoriteKeys.page(input.actor, input.pageId), exact: true })
      client.setQueryData(favoriteKeys.page(input.actor, input.pageId), saved)
      await client.invalidateQueries({ queryKey: favoriteKeys.list(input.actor) })
    },
    onError: (_error, input, context) => {
      const key = favoriteKeys.page(input.actor, input.pageId)
      if (context?.previous) client.setQueryData(key, context.previous)
      else client.removeQueries({ queryKey: key, exact: true })
      if (actor.current === input.actor) feedback({ title: i18n('favorites.write-error'), variant: 'error' })
    },
  })
  return {
    setFavorite: (pageId: string, favorite: boolean) => { if (user && !mutation.isPending) mutation.mutate({ actor: user.id, pageId, favorite }) },
    pendingPageId: mutation.isPending ? mutation.variables.pageId : null,
    pending: mutation.isPending,
  }
}
export function usePageFavorite(pageId: string, enabled = true) {
  const { user } = useAuth()
  return useQuery({ queryKey: favoriteKeys.page(user?.id ?? 'anonymous', pageId), queryFn: () => pageFavoriteService.state(pageId), enabled: Boolean(user && pageId && enabled), staleTime: 30_000, retry: false })
}
export function usePageFavorites(enabled = true) {
  const { user } = useAuth()
  return useInfiniteQuery({
    queryKey: favoriteKeys.list(user?.id ?? 'anonymous'), initialPageParam: null as string | null,
    queryFn: ({ pageParam }) => pageFavoriteService.list(pageParam), getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled: Boolean(user && enabled), staleTime: 30_000, refetchInterval: enabled ? 30_000 : false, retry: false,
  })
}
