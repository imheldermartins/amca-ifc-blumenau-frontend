import { apiService } from '@/services/ApiService'
import type { PinnedSchedulePageDto } from '@/pages/app/schedule/types'

export interface PinSchedulePageInput {
  dateColumnId: string
  colorColumnId?: string | null
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
}

export const scheduleService = new ScheduleService()
