import type { JSONContent } from '@tiptap/core'

import { apiService } from '@/services/ApiService'

export interface PageDocumentRecord {
  content: JSONContent | null
  revision: number
}

export class PageDocumentService {
  load(pageId: string): Promise<PageDocumentRecord> {
    return apiService.get(`/pages/${pageId}/document`)
  }

  save(pageId: string, content: JSONContent): Promise<PageDocumentRecord> {
    return apiService.put(`/pages/${pageId}/document`, { content })
  }
}

export const pageDocumentService = new PageDocumentService()
