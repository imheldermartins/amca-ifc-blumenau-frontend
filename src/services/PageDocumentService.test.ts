import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PageDocumentService } from './PageDocumentService'
import { encodePageDocument } from '@/shared/page-document-codec'

const api = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn() }))
vi.mock('@/services/ApiService', () => ({ apiService: api }))
const content = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Conteúdo' }] }] }

describe('PageDocumentService compact wire format', () => {
  beforeEach(() => vi.clearAllMocks())
  it('sends typed compact JSON and reconstructs the editor document from the response', async () => {
    const compact = encodePageDocument(content)
    api.put.mockResolvedValue({ content: compact, revision: 2 })
    expect(await new PageDocumentService().save('page', content)).toEqual({ content, revision: 2 })
    expect(api.put).toHaveBeenCalledWith('/pages/page/document', { content: compact })
    expect(JSON.stringify(compact)).not.toContain('"type"')
  })
  it.each([content, encodePageDocument(content)])('loads both old and compact stored documents', async (stored) => {
    api.get.mockResolvedValue({ content: stored, revision: 1 })
    expect(await new PageDocumentService().load('page')).toEqual({ content, revision: 1 })
  })
  it('preserves the absence of a document', async () => {
    api.get.mockResolvedValue({ content: null, revision: 0 })
    expect(await new PageDocumentService().load('page')).toEqual({ content: null, revision: 0 })
  })
})
