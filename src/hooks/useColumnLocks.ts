import { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { useAuth } from '@/contexts/AuthContext'
import { useFeedback } from '@/contexts/FeedbackContext'
import { i18n } from '@/lib/i18n'
import { columnLockService, type ColumnLockConfiguration } from '@/services/ColumnLockService'

export const columnLocksQueryKey = (userId: string, pageId: string) =>
  ['column-locks', userId, pageId] as const

const EMPTY: ColumnLockConfiguration = { locks: {}, canManage: false, editors: [] }

export function columnLockErrorDescription(error: unknown): string {
  if (!(error instanceof Error) || !error.message.trim()) {
    return i18n('pages.app.cubs-database.lock.error-description')
  }
  // AppError inclui método/rota/status antes da mensagem devolvida pela API.
  // O toast mostra a causa acionável, mantendo o contexto completo no console.
  return error.message.match(/→[^:]+:\s*(.+)$/)?.[1] ?? error.message
}

export function useColumnLocks(pageId: string | undefined) {
  const { user } = useAuth()
  const feedback = useFeedback()
  const queryClient = useQueryClient()
  const key = useMemo(
    () => columnLocksQueryKey(user?.id ?? 'anonymous', pageId ?? 'none'),
    [pageId, user?.id],
  )
  const query = useQuery({
    queryKey: key,
    queryFn: () => columnLockService.get(pageId!),
    enabled: Boolean(user && pageId),
    refetchOnWindowFocus: true,
  })
  const mutation = useMutation({
    mutationFn: ({ columnKey, userIds }: { columnKey: string; userIds: string[] }) =>
      columnLockService.save(pageId!, columnKey, userIds),
    onMutate: async ({ columnKey, userIds }) => {
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<ColumnLockConfiguration>(key)
      queryClient.setQueryData<ColumnLockConfiguration>(key, (current = EMPTY) => ({
        ...current,
        locks: userIds.length
          ? { ...current.locks, [columnKey]: { userIds } }
          : Object.fromEntries(Object.entries(current.locks).filter(([key]) => key !== columnKey)),
      }))
      return { previous }
    },
    onError: (error, _input, context) => {
      queryClient.setQueryData(key, context?.previous)
      feedback({
        title: i18n('pages.app.cubs-database.lock.error-title'),
        description: columnLockErrorDescription(error),
        variant: 'error',
      })
    },
    onSuccess: (saved) => queryClient.setQueryData(key, saved),
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  })

  const configuration = query.data ?? EMPTY
  const lockedColumnKeys = useMemo(() => new Set(
    Object.entries(configuration.locks)
      .filter(([, lock]) => !user || !lock.userIds.includes(user.id))
      .map(([columnKey]) => columnKey),
  ), [configuration.locks, user])

  return {
    ...query,
    ...configuration,
    currentUserId: user?.id ?? '',
    lockedColumnKeys,
    save: (columnKey: string, userIds: string[]) => mutation.mutate({ columnKey, userIds }),
    saving: mutation.isPending,
  }
}

export function usePageTitleLock(pageId: string | undefined) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['page-title-lock', user?.id ?? 'anonymous', pageId ?? 'none'],
    queryFn: () => columnLockService.titleStatus(pageId!),
    enabled: Boolean(user && pageId),
    refetchOnWindowFocus: true,
  })
}
