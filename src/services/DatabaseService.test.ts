import { beforeEach, describe, expect, it, vi } from 'vitest'

const dependencies = vi.hoisted(() => ({
  get: vi.fn(),
  parseDatabase: vi.fn(),
}))

vi.mock('@/services/ApiService', () => ({
  apiService: { get: dependencies.get },
}))

vi.mock('@/lib/i18n', () => ({
  i18n: (key: string) => key,
}))

vi.mock('@/lib/databaseParser', () => ({
  parseDatabase: dependencies.parseDatabase,
  parseHeaderCols: vi.fn(),
  parseViewSettings: vi.fn(),
}))

import { databaseService } from './DatabaseService'

const PAGE_ID = '01KXVZ0000PAGE000000000001'

describe('DatabaseService.loadPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    dependencies.get.mockImplementation((url: string) => {
      if (url === `/pages/${PAGE_ID}`) return Promise.resolve({ id: PAGE_ID, title: 'Raiz' })
      if (url === `/pages/parent/${PAGE_ID}/columns`) return Promise.resolve([])
      if (url === `/pages/${PAGE_ID}/page`) return Promise.resolve([])
      return Promise.reject(new Error(`URL inesperada: ${url}`))
    })
    dependencies.parseDatabase.mockReturnValue({ rows: [], settings: {}, headerCols: [] })
  })

  it('mantém as três leituras por pageId, inclusive quando a página é uma folha', async () => {
    await expect(databaseService.loadPage(PAGE_ID)).resolves.toEqual({
      rows: [],
      settings: {},
      headerCols: [],
    })

    expect(dependencies.get).toHaveBeenCalledTimes(3)
    expect(dependencies.get).toHaveBeenCalledWith(`/pages/${PAGE_ID}`)
    expect(dependencies.get).toHaveBeenCalledWith(`/pages/parent/${PAGE_ID}/columns`)
    expect(dependencies.get).toHaveBeenCalledWith(`/pages/${PAGE_ID}/page`)
    expect(dependencies.parseDatabase).toHaveBeenCalledWith({
      page: { id: PAGE_ID, title: 'Raiz' },
      columns: [],
      dataset: [],
      titleLabel: 'pages.app.cubs-database.coluna-titulo',
      fallbackViewName: 'pages.app.cubs-database.view-padrao',
    })
  })
})
