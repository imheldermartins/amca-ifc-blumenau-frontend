import { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { useAuth } from '@/contexts/AuthContext'
import { useFeedback } from '@/contexts/FeedbackContext'
import { i18n } from '@/lib/i18n'
import { notificationService, type NotificationDto } from '@/services/NotificationService'
import { scheduleService } from '@/services/ScheduleService'
import { scheduleQueryKey } from '@/hooks/useSchedule'
import type { PinnedSchedulePageDto } from '@/pages/app/schedule/types'

export const notificationQueryKey = (userId: string, workspaceId: string) =>
  ['notifications', userId, workspaceId] as const

export function useNotifications(workspaceId: string | null) {
  const { user } = useAuth()
  const feedback = useFeedback()
  const queryClient = useQueryClient()
  const key = useMemo(
    () => notificationQueryKey(user?.id ?? 'anonymous', workspaceId ?? 'none'),
    [user?.id, workspaceId],
  )
  const enabled = Boolean(user && workspaceId)
  const query = useQuery({
    queryKey: key,
    queryFn: () => notificationService.list(workspaceId!),
    enabled,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  })

  const markReadMutation = useMutation({
    mutationFn: (notificationId: string) => notificationService.markRead(workspaceId!, notificationId),
    onMutate: (notificationId) => {
      queryClient.setQueryData<NotificationDto[]>(key, (current = []) => current.map((item) =>
        item.id === notificationId && !item.readAt
          ? { ...item, readAt: new Date().toISOString() }
          : item,
      ))
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  })

  const decisionMutation = useMutation({
    mutationFn: ({ requestId, decision }: { requestId: string; decision: 'accepted' | 'declined' }) =>
      scheduleService.decidePinRequest(workspaceId!, requestId, decision),
    onSuccess: (result) => {
      queryClient.setQueryData<NotificationDto[]>(key, (current = []) => current.map((item) =>
        item.resourceType === 'schedule_pin_request' && item.resourceId === result.requestId
          ? { ...item, readAt: item.readAt ?? new Date().toISOString(), data: { ...item.data, status: result.status } }
          : item,
      ))
      if (result.pinnedPage && user && workspaceId) {
        const scheduleKey = scheduleQueryKey(user.id, workspaceId)
        queryClient.setQueryData<PinnedSchedulePageDto[]>(scheduleKey, (current = []) => [
          ...current.filter((item) => item.pageId !== result.pinnedPage!.pageId),
          result.pinnedPage!,
        ])
        void queryClient.invalidateQueries({ queryKey: scheduleKey })
      }
    },
    onError: () => feedback({
      title: i18n('pages.app.notifications.error-title'),
      description: i18n('pages.app.notifications.error-description'),
      variant: 'error',
    }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  })

  const notifications = query.data ?? []
  return {
    ...query,
    notifications,
    unreadCount: notifications.filter((item) => !item.readAt).length,
    markRead: (notificationId: string) => markReadMutation.mutateAsync(notificationId),
    decide: (requestId: string, decision: 'accepted' | 'declined') =>
      decisionMutation.mutateAsync({ requestId, decision }),
    pendingRequestId: decisionMutation.variables?.requestId ?? null,
  }
}
