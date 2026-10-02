import { apiService } from '@/services/ApiService'

export type NotificationType =
  | 'schedule_pin_request'
  | 'schedule_event_reminder'
  | 'flow_email'

export interface NotificationDto {
  id: string
  workspaceId: string
  type: NotificationType
  resourceType: 'schedule_pin_request' | 'page' | 'flow_execution'
  resourceId: string
  actor: { id: string; name: string | null; email: string } | null
  data: Record<string, unknown>
  readAt: string | null
  createdAt: string
}

export class NotificationService {
  list(workspaceId: string): Promise<NotificationDto[]> {
    return apiService.get(`/notifications/${workspaceId}`)
  }

  markRead(workspaceId: string, notificationId: string): Promise<void> {
    return apiService.put(`/notifications/${workspaceId}/${notificationId}/read`)
  }
}

export const notificationService = new NotificationService()
