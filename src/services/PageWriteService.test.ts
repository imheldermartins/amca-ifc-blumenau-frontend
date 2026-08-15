import { beforeEach, describe, expect, it, vi } from 'vitest'

const api = vi.hoisted(() => ({
  delete: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
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
