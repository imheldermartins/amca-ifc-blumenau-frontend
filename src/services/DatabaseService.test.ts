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
      if (url === `/pages/${PAGE_ID}/view-metadata`) return Promise.resolve({ page: { id: PAGE_ID, title: 'Raiz' }, columns: [] })
      return Promise.reject(new Error(`URL inesperada: ${url}`))
    })
    dependencies.parseDatabase.mockReturnValue({ rows: [], settings: {}, headerCols: [] })
  })

  it('carrega apenas metadados, inclusive quando a página é uma folha', async () => {
    await expect(databaseService.loadPage(PAGE_ID)).resolves.toEqual({
      rows: [],
      settings: {},
      headerCols: [],
    })

    expect(dependencies.get).toHaveBeenCalledTimes(1)
    expect(dependencies.get).toHaveBeenCalledWith(`/pages/${PAGE_ID}/view-metadata`)
    expect(dependencies.parseDatabase).toHaveBeenCalledWith({
      page: { id: PAGE_ID, title: 'Raiz' },
      columns: [],
      dataset: [],
      titleLabel: 'pages.app.cubs-database.coluna-titulo',
      fallbackViewName: 'pages.app.cubs-database.view-padrao',
    })
  })
})
