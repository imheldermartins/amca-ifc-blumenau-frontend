import { beforeEach, describe, expect, it, vi } from 'vitest'

const api = vi.hoisted(() => ({
  delete: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  patch: vi.fn(),
}))

vi.mock('@/services/ApiService', () => ({ apiService: api }))

import { PageWriteService } from './PageWriteService'

const rowId = '01KXVZ0000ROW000000000001'
const columnId = '01KXVZ0000COLUMN00000001'
const url = `/pages/${rowId}/column/${columnId}/value`

describe('PageWriteService.saveCell', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    api.delete.mockResolvedValue(undefined)
    api.post.mockResolvedValue(undefined)
    api.put.mockResolvedValue(undefined)
    api.patch.mockResolvedValue(undefined)
  })

  it('cria apenas quando a célula está ausente (previousValue undefined)', async () => {
    await new PageWriteService().saveCell({ rowId, columnId, value: 'novo', previousValue: undefined })

    expect(api.post).toHaveBeenCalledWith(url, { value: 'novo' })
    expect(api.put).not.toHaveBeenCalled()
  })

  it('atualiza uma célula existente cujo valor lido é null', async () => {
    await new PageWriteService().saveCell({ rowId, columnId, value: 'novo', previousValue: null })

    expect(api.put).toHaveBeenCalledWith(url, { value: 'novo' })
    expect(api.post).not.toHaveBeenCalled()
  })

  it('remove a célula existente ao limpar seu valor', async () => {
    await new PageWriteService().saveCell({ rowId, columnId, value: null, previousValue: 'anterior' })

    expect(api.delete).toHaveBeenCalledWith(url)
    expect(api.put).not.toHaveBeenCalled()
  })

  it('não chama a API ao limpar uma célula que ainda não existe', async () => {
    await new PageWriteService().saveCell({ rowId, columnId, value: null, previousValue: undefined })

    expect(api.delete).not.toHaveBeenCalled()
    expect(api.post).not.toHaveBeenCalled()
    expect(api.put).not.toHaveBeenCalled()
  })
})

describe('PageWriteService — views atômicas', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    api.put.mockResolvedValue(undefined)
    api.patch.mockResolvedValue(undefined)
  })

  it('não envia filtros, urlKey nem publicKey pelo PATCH de apresentação', async () => {
    const pageId = '01KXVZ0000PAGE00000000001'
    const viewId = '01KXVZ0000VIEW00000000001'
    await new PageWriteService().patchView(pageId, viewId, {
      filters: {
        version: 2,
        updatedAt: null,
        clauses: [],
        groupBy: [],
        passthrough: [],
      },
      urlKey: { key: 'tabela', aliases: [] },
      title: {
        key: 'title',
        column_name: 'Docente',
        publicKey: { key: 'docente', aliases: ['professor'] },
      },
      columnWidths: { [columnId]: 320 },
    })

    expect(api.patch).toHaveBeenCalledWith(`/pages/${pageId}/views/${viewId}`, {
      title: { key: 'title', column_name: 'Docente' },
      columnWidths: { [columnId]: 320 },
    })
  })

  it('remove updatedAt do documento enviado ao endpoint de filtros', async () => {
    const pageId = '01KXVZ0000PAGE00000000001'
    const viewId = '01KXVZ0000VIEW00000000001'
    await new PageWriteService().saveViewFilters(pageId, viewId, {
      version: 2,
      updatedAt: '2026-09-01T17:00:00.000Z',
      clauses: [{ columnId, condition: 'contains', values: ['Ana'] }],
      groupBy: [columnId],
      passthrough: [['future', 'kept']],
    })

    expect(api.put).toHaveBeenCalledWith(`/pages/${pageId}/views/${viewId}/filters`, {
      version: 2,
      clauses: [{ columnId, condition: 'contains', values: ['Ana'] }],
      groupBy: [columnId],
      passthrough: [['future', 'kept']],
    })
  })
})
