import { describe, expect, it } from 'vitest'

import {
  FALLBACK_VIEW_ID,
  needsFilterKeyReconcile,
  parseDatabase,
  parseHeaderCols,
} from './databaseParser'

const VIEW_ID = '01KXVZ0000VIEW00000000001'

describe('databaseParser — coluna mestra de título', () => {
  it('mantém title como key e lê o column_name/máscara da view', () => {
    const parsed = parseDatabase({
      page: {
        id: '01KXVZ0000PAGE00000000001',
        title: 'Base',
        owner_id: '01KXVZ0000USER00000000001',
        updated_at: '2026-08-31 16:00:00',
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
      publicKey: { key: 'docente', aliases: [] },
    })
  })

  it('materializa a identidade title em snapshot legado e no fallback', () => {
    const legacy = parseDatabase({
      page: {
        id: '01KXVZ0000PAGE00000000001',
        title: 'Base',
        owner_id: '01KXVZ0000USER00000000001',
        updated_at: '2026-08-31 16:00:00',
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
      publicKey: { key: 'titulo', aliases: [] },
    })

    const fallback = parseDatabase({
      page: {
        id: '01KXVZ0000PAGE00000000001',
        title: 'Base',
        owner_id: '01KXVZ0000USER00000000001',
        updated_at: '2026-08-31 16:00:00',
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
      publicKey: { key: 'titulo', aliases: [] },
    })
  })
})

describe('databaseParser — tipos de view', () => {
  it.each(['table', 'grid', 'board', 'calendar', 'timeline', 'graph'] as const)(
    'preserva o modo %s recebido no snapshot',
    (view) => {
      const parsed = parseDatabase({
        page: {
          id: '01KXVZ0000PAGE00000000001',
          title: 'Base',
          owner_id: '01KXVZ0000USER00000000001',
          updated_at: '2026-08-31 16:00:00',
          data: {
            [VIEW_ID]: {
              view,
              name: 'Principal',
              filters: '',
              orderedHeaderCols: [],
            },
          },
        },
        columns: [],
        dataset: [],
        titleLabel: 'Título',
        fallbackViewName: 'Tabela',
      })

      expect(parsed.settings[VIEW_ID].view).toBe(view)
    },
  )
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
      {
        id: 'pink-option',
        label: 'Rosa',
        color: 'pink',
        publicKey: { key: 'rosa', aliases: [] },
      },
      {
        id: 'purple-option',
        label: 'Roxa',
        color: 'purple',
        publicKey: { key: 'roxa', aliases: [] },
      },
    ])
  })
})

describe('databaseParser — reconcile de filter keys', () => {
  const page = {
    id: '01KXVZ0000PAGE00000000001',
    title: 'Base',
    owner_id: '01KXVZ0000USER00000000001',
    updated_at: '2026-09-01T17:00:00.000Z',
    data: {
      [VIEW_ID]: {
        view: 'table',
        name: 'Docentes',
        urlKey: { key: 'docentes', aliases: [] },
        title: {
          key: 'title',
          column_name: 'Docente',
          publicKey: { key: 'docente', aliases: [] },
        },
        filters: {
          version: 2,
          updatedAt: null,
          clauses: [],
          groupBy: [],
          passthrough: [],
        },
        orderedHeaderCols: [],
      },
    },
  }

  it('não agenda trabalho quando o catálogo v2 já é íntegro', () => {
    expect(needsFilterKeyReconcile(page, [])).toBe(false)
  })

  it('agenda strings legadas e metadata ausente', () => {
    expect(
      needsFilterKeyReconcile(
        {
          ...page,
          data: {
            [VIEW_ID]: {
              ...page.data[VIEW_ID],
              urlKey: undefined,
              filters: `v=1&group=coluna-antiga`,
            },
          },
        },
        [],
      ),
    ).toBe(true)
  })

  it('agenda reconcile quando o parser tolerante podou cláusula raw inválida', () => {
    expect(
      needsFilterKeyReconcile(
        {
          ...page,
          data: {
            [VIEW_ID]: {
              ...page.data[VIEW_ID],
              filters: {
                ...page.data[VIEW_ID].filters,
                clauses: [
                  {
                    columnId: 'page_title',
                    condition: 'contains',
                    values: ['Ana'],
                  },
                  {
                    columnId: 'page_title',
                    condition: 'contains',
                    values: ['Bia'],
                    campoFuturo: true,
                  },
                ],
              },
            },
          },
        },
        [],
      ),
    ).toBe(true)
  })
})

describe('databaseParser — escopo público da coluna sintética', () => {
  it('não reutiliza a key de uma coluna real com o mesmo nome', () => {
    const parsed = parseHeaderCols(
      [
        {
          id: 'column-title',
          name: 'Título',
          type: 'text',
          data: { publicKey: { key: 'titulo', aliases: [] } },
          parent_id: 'page-1',
        },
      ],
      'Título',
    )

    expect(parsed[1].publicKey).toEqual({ key: 'titulo', aliases: [] })
    expect(parsed[0].publicKey).toEqual({ key: 'titulo_2', aliases: [] })
  })
})
