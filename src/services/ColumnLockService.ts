import { apiService } from '@/services/ApiService'
import type { ColumnLockEditor, ColumnLockMap } from 'cubs-database'

export interface ColumnLockConfiguration {
  locks: ColumnLockMap
  canManage: boolean
  editors: ColumnLockEditor[]
}

export class ColumnLockService {
  get(pageId: string): Promise<ColumnLockConfiguration> {
    return apiService.get(`/pages/${pageId}/column-locks`)
  }

  save(pageId: string, columnKey: string, userIds: string[]): Promise<ColumnLockConfiguration> {
    return apiService.put(`/pages/${pageId}/column-locks`, { columnKey, userIds })
  }

  titleStatus(pageId: string): Promise<{ locked: boolean; canEdit: boolean }> {
    return apiService.get(`/pages/${pageId}/title-lock`)
  }
}

export const columnLockService = new ColumnLockService()
