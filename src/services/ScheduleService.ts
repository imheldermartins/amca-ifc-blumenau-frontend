import { apiService } from '@/services/ApiService'
import type { PinnedSchedulePageDto } from '@/pages/app/schedule/types'

export interface PinSchedulePageInput {
  dateColumnId: string
  colorColumnId?: string | null
}

export interface ScheduleRecipient {
  id: string
  name: string | null
  email: string
}

export interface SchedulePinRequestResult {
  id: string
  status: 'pending'
  recipient: ScheduleRecipient
  emailQueued: true
}

export interface SchedulePinDecisionResult {
  requestId: string
  status: 'accepted' | 'declined'
  pinnedPage: PinnedSchedulePageDto | null
}

export class ScheduleService {
  list(workspaceId: string): Promise<PinnedSchedulePageDto[]> {
    return apiService.get(`/schedule/${workspaceId}/pinned-pages`)
  }

  pin(workspaceId: string, pageId: string, input: PinSchedulePageInput): Promise<PinnedSchedulePageDto> {
    return apiService.put(`/schedule/${workspaceId}/pinned-pages/${pageId}`, input)
  }

  unpin(workspaceId: string, pageId: string): Promise<void> {
    return apiService.delete(`/schedule/${workspaceId}/pinned-pages/${pageId}`)
  }

  recipients(workspaceId: string, pageId: string): Promise<ScheduleRecipient[]> {
    return apiService.get(`/schedule/${workspaceId}/pages/${pageId}/pin-recipients`)
  }

  requestPin(
    workspaceId: string,
    pageId: string,
    input: PinSchedulePageInput & { recipientUserId: string },
  ): Promise<SchedulePinRequestResult> {
    return apiService.post(`/schedule/${workspaceId}/pinned-pages/${pageId}/requests`, input)
  }

  decidePinRequest(
    workspaceId: string,
    requestId: string,
    decision: 'accepted' | 'declined',
  ): Promise<SchedulePinDecisionResult> {
    return apiService.post(`/schedule/${workspaceId}/pin-requests/${requestId}/decision`, { decision })
  }
}

export const scheduleService = new ScheduleService()
