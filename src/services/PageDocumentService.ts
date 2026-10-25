import type { JSONContent } from '@tiptap/core'

import { apiService } from '@/services/ApiService'
import { decodePageDocument, encodePageDocument } from '@/shared/page-document-codec'

export interface PageDocumentRecord {
  content: JSONContent | null
  revision: number
}
interface PageDocumentWireRecord { content: unknown; revision: number }

export class PageDocumentService {
  async load(pageId: string): Promise<PageDocumentRecord> {
    const record = await apiService.get<PageDocumentWireRecord>(`/pages/${pageId}/document`)
    return { ...record, content: record.content === null ? null : decodePageDocument(record.content) }
  }

  async save(pageId: string, content: JSONContent): Promise<PageDocumentRecord> {
    const record = await apiService.put<PageDocumentWireRecord>(`/pages/${pageId}/document`, { content: encodePageDocument(content) })
    return { ...record, content: record.content === null ? null : decodePageDocument(record.content) }
  }
}

export const pageDocumentService = new PageDocumentService()
