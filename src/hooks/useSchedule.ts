import { useEffect, useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { useAuth } from '@/contexts/AuthContext'
import { useFeedback } from '@/contexts/FeedbackContext'
import { useSocket } from '@/hooks/useSocket'
import { i18n } from '@/lib/i18n'
import { PageRealtimeChannel } from '@/services/PageRealtimeChannel'
import { scheduleService, type PinSchedulePageInput } from '@/services/ScheduleService'
import type { PinnedSchedulePageDto } from '@/pages/app/schedule/types'

const EMPTY_PINS: PinnedSchedulePageDto[] = []

export const scheduleQueryKey = (userId: string, workspaceId: string) =>
  ['schedule', userId, workspaceId] as const

export interface SchedulePinInput extends PinSchedulePageInput {
  pageId: string
  optimisticItem?: PinnedSchedulePageDto
}

export function useSchedule(workspaceId: string | null, options: { enabled?: boolean; realtime?: boolean } = {}) {
  const { user } = useAuth()
  const feedback = useFeedback()
  const queryClient = useQueryClient()
  const { socket } = useSocket()
  const key = useMemo(() => scheduleQueryKey(user?.id ?? 'anonymous', workspaceId ?? 'none'), [user?.id, workspaceId])
  const enabled = (options.enabled ?? true) && Boolean(user && workspaceId)
  const query = useQuery({
    queryKey: key,
    queryFn: () => scheduleService.list(workspaceId!),
    enabled,
    refetchOnWindowFocus: true,
  })

  const fail = () => feedback({
    title: i18n('pages.app.schedule.writeErrorTitle'),
    description: i18n('pages.app.schedule.writeErrorDescription'),
    variant: 'error',
  })

  const pinMutation = useMutation({
    mutationFn: ({ pageId, dateColumnId, colorColumnId }: SchedulePinInput) =>
      scheduleService.pin(workspaceId!, pageId, { dateColumnId, colorColumnId }),
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<PinnedSchedulePageDto[]>(key)
      if (input.optimisticItem) {
        queryClient.setQueryData<PinnedSchedulePageDto[]>(key, (current = []) => [
          ...current.filter((item) => item.pageId !== input.pageId),
          input.optimisticItem!,
        ])
      }
      return { previous }
    },
    onError: (_error, _input, context) => {
      queryClient.setQueryData(key, context?.previous)
      fail()
    },
    onSuccess: (saved) => queryClient.setQueryData<PinnedSchedulePageDto[]>(key, (current = []) => [
      ...current.filter((item) => item.pageId !== saved.pageId),
      saved,
    ]),
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  })

  const unpinMutation = useMutation({
    mutationFn: (pageId: string) => scheduleService.unpin(workspaceId!, pageId),
    onMutate: async (pageId) => {
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<PinnedSchedulePageDto[]>(key)
      queryClient.setQueryData<PinnedSchedulePageDto[]>(key, (current = []) => current.filter((item) => item.pageId !== pageId))
      return { previous }
    },
    onError: (_error, _pageId, context) => {
      queryClient.setQueryData(key, context?.previous)
      fail()
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  })

  const sourcePageIds = useMemo(
    () => [...new Set((query.data ?? []).map((item) => item.sourcePageId))].sort(),
    [query.data],
  )
  useEffect(() => {
    if (!socket || !enabled || options.realtime === false) return
    const invalidate = () => { void queryClient.invalidateQueries({ queryKey: key }) }
    const channels = sourcePageIds.map((pageId) => new PageRealtimeChannel(socket, pageId, {
      onEvent: invalidate,
      onPageUpdated: invalidate,
      onDatabaseUpdated: invalidate,
      onStructureChanged: invalidate,
      onResync: invalidate,
    }))
    channels.forEach((channel) => channel.subscribe())
    return () => channels.forEach((channel) => channel.dispose())
  }, [enabled, key, options.realtime, queryClient, socket, sourcePageIds])

  const pins = query.data ?? EMPTY_PINS
  return {
    ...query,
    pins,
    pinnedByPageId: useMemo(() => new Map(pins.map((pin) => [pin.pageId, pin])), [pins]),
    pin: async (input: SchedulePinInput) => {
      try { await pinMutation.mutateAsync(input); return true } catch { return false }
    },
    unpin: async (pageId: string) => {
      try { await unpinMutation.mutateAsync(pageId); return true } catch { return false }
    },
    pendingPageId: pinMutation.variables?.pageId ?? unpinMutation.variables ?? null,
    mutating: pinMutation.isPending || unpinMutation.isPending,
  }
}
