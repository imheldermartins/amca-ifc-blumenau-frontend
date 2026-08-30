import { describe, expect, it } from 'vitest'

import { FALLBACK_VIEW_ID, parseDatabase, parseHeaderCols } from './databaseParser'

const VIEW_ID = '01KXVZ0000VIEW00000000001'

describe('databaseParser — coluna mestra de título', () => {
  it('mantém title como key e lê o column_name/máscara da view', () => {
    const parsed = parseDatabase({
      page: {
        id: '01KXVZ0000PAGE00000000001',
        title: 'Base',
        owner_id: '01KXVZ0000USER00000000001',
        data: {
          [VIEW_ID]: {
            view: 'table',
            name: 'Docentes',
            filters: '',
            title: { key: 'title', column_name: 'Docente', mask: 'cpf' },
            orderedHeaderCols: ['page_title'],
          },
        },
      },
      columns: [],
      dataset: [],
      titleLabel: 'Título',
      fallbackViewName: 'Tabela',
    })

    expect(parsed.headerCols[0]).toMatchObject({
      id: 'page_title',
      key: 'title',
      title: 'Título',
      type: 'text',
    })
    expect(parsed.settings[VIEW_ID].title).toEqual({
      key: 'title',
      column_name: 'Docente',
      mask: 'cpf',
    })
  })

  it('materializa a identidade title em snapshot legado e no fallback', () => {
    const legacy = parseDatabase({
      page: {
        id: '01KXVZ0000PAGE00000000001',
        title: 'Base',
        owner_id: '01KXVZ0000USER00000000001',
        data: {
          [VIEW_ID]: {
            view: 'table',
            name: 'Tabela',
            filters: '',
            orderedHeaderCols: ['page_title'],
          },
        },
      },
      columns: [],
      dataset: [],
      titleLabel: 'Título',
      fallbackViewName: 'Tabela',
    })

    expect(legacy.settings[VIEW_ID].title).toEqual({
      key: 'title',
      column_name: 'Título',
    })

    const fallback = parseDatabase({
      page: {
        id: '01KXVZ0000PAGE00000000001',
        title: 'Base',
        owner_id: '01KXVZ0000USER00000000001',
        data: {},
      },
      columns: [],
      dataset: [],
      titleLabel: 'Título',
      fallbackViewName: 'Tabela',
    })

    expect(fallback.settings[FALLBACK_VIEW_ID].title).toEqual({
      key: 'title',
      column_name: 'Título',
    })
  })
})

describe('databaseParser — cores das opções', () => {
  it('preserva pink e purple recebidos do backend', () => {
    const [, column] = parseHeaderCols(
      [
        {
          id: 'column-1',
          name: 'Status',
          type: 'select',
          data: {
            options: [
              { id: 'pink-option', value: 'Rosa', color: 'pink' },
              { id: 'purple-option', value: 'Roxa', color: 'purple' },
            ],
          },
          parent_id: 'page-1',
        },
      ],
      'Título',
    )

    expect(column.options).toEqual([
      { id: 'pink-option', label: 'Rosa', color: 'pink' },
      { id: 'purple-option', label: 'Roxa', color: 'purple' },
    ])
  })
})
