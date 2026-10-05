import { describe, expect, it } from 'vitest'

import {
  FALLBACK_VIEW_ID,
  needsFilterKeyReconcile,
  parseDatabase,
  parseFlowDefinition,
  parseHeaderCols,
  parseViewSettings,
} from './databaseParser'

const VIEW_ID = '01KXVZ0000VIEW00000000001'

describe('databaseParser — coluna mestra de título', () => {
  it('mantém title como key e lê o column_name/máscara da view', () => {
    const parsed = parseDatabase({
      page: {
        id: '01KXVZ0000PAGE00000000001',
        title: 'Base',
        owner_id: '01KXVZ0000USER00000000001',
        created_at: '2026-08-31 16:00:00',
        updated_at: '2026-08-31 16:00:00',
        latest_updated_at: null,
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
        created_at: '2026-08-31 16:00:00',
        updated_at: '2026-08-31 16:00:00',
        latest_updated_at: null,
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
        created_at: '2026-08-31 16:00:00',
        updated_at: '2026-08-31 16:00:00',
        latest_updated_at: null,
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
  it.each(['small', 'medium', 'large'] as const)('preserva tamanho %s da Grade salvo no snapshot', (tileSize) => {
    const parsed = parseViewSettings({ [VIEW_ID]: { view: 'grid', name: 'Grade', tileSize } })
    expect(parsed[VIEW_ID].tileSize).toBe(tileSize)
  })

  it.each([undefined, null, 'enorme', 240, ['small'], { size: 'small' }])('ignora tamanho inválido ou legado (%j)', (tileSize) => {
    const parsed = parseViewSettings({ [VIEW_ID]: { view: 'grid', name: 'Grade', tileSize } })
    expect(parsed[VIEW_ID].tileSize).toBeUndefined()
  })

  it('ordena as tabs pelo order persistido e mantém legado estável no fim', () => {
    const second = '01KXVZ0000VIEW00000000002'
    const legacy = '01KXVZ0000VIEW00000000003'
    const parsed = parseViewSettings({
      [VIEW_ID]: { view: 'table', name: 'Primeira', order: 0 },
      [legacy]: { view: 'grid', name: 'Legada' },
      [second]: { view: 'graph', name: 'Segunda', order: 1, dateColumnId: 'date-id', colorColumnId: null, calendarPropertyIds: [], calendarShowPropertyLabels: false },
    })
    expect(Object.keys(parsed)).toEqual([VIEW_ID, second, legacy])
    expect(parsed[second].order).toBe(1)
    expect(parsed[second]).toMatchObject({ dateColumnId: 'date-id', colorColumnId: null, calendarPropertyIds: [], calendarShowPropertyLabels: false })
  })

  it('omite views com tombstone mesmo quando as demais continuam visíveis', () => {
    const deleted = { view: 'table', name: 'Antiga', deletedAt: '2026-09-13T12:00:00.000Z' }
    const live = { view: 'board', name: 'Quadros', urlKey: { key: 'quadros', aliases: [] } }
    const data = { [VIEW_ID]: deleted, '01KXVZ0000VIEW00000000002': live }
    expect(Object.keys(parseViewSettings(data))).toEqual(['01KXVZ0000VIEW00000000002'])
  })
  it.each(['table', 'grid', 'board', 'calendar', 'timeline', 'graph', 'form'] as const)(
    'preserva o modo %s recebido no snapshot',
    (view) => {
      const parsed = parseDatabase({
        page: {
          id: '01KXVZ0000PAGE00000000001',
          title: 'Base',
          owner_id: '01KXVZ0000USER00000000001',
          created_at: '2026-08-31 16:00:00',
          updated_at: '2026-08-31 16:00:00',
          latest_updated_at: null,
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

  it('lê a configuração persistida da view form e poda configuração inválida', () => {
    const flowColumnId = '01KXVZ0000FLOW00000000001'
    const valid = parseViewSettings({
      [VIEW_ID]: {
        view: 'form',
        name: 'Inscrição',
        form: {
          version: 1,
          flowColumnId,
          hiddenFieldIds: ['page_title'],
          submitButton: { label: 'Enviar inscrição', icon: 'lucide:send' },
        },
      },
    })
    expect(valid[VIEW_ID].form).toEqual({
      version: 1,
      flowColumnId,
      hiddenFieldIds: ['page_title'],
      submitButton: { label: 'Enviar inscrição', icon: 'lucide:send' },
    })

    const invalid = parseViewSettings({
      [VIEW_ID]: {
        view: 'form',
        name: 'Legado quebrado',
        form: { version: 1, flowColumnId, submitButton: { label: '', icon: 'javascript:x' } },
      },
    })
    expect(invalid[VIEW_ID].view).toBe('form')
    expect(invalid[VIEW_ID].form).toBeUndefined()
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

describe('databaseParser — máscara de e-mail', () => {
  it('preserva email no contrato da coluna text', () => {
    const [, contact] = parseHeaderCols([
      {
        id: 'contact',
        name: 'Contato',
        type: 'text',
        data: { mask: 'email' },
        parent_id: 'page-1',
      },
    ], 'Título')

    expect(contact.mask).toBe('email')
  })
})

describe('databaseParser — flow', () => {
  it('preserva recursivamente uma definição v2', () => {
    const flow = {
      version: 2,
      trigger: { type: 'manual' },
      nodes: [
        { id: 'start', type: 'start', config: {} },
        { id: 'condition', type: 'switch', config: {
          columnId: 'status', operator: 'equals', value: 'approved',
          whenTrue: [{ id: 'email', type: 'email', config: { to: '@page.title', subject: 'Oi', body: 'Oi' } }],
          whenFalse: [{ id: 'nested', type: 'switch', config: { columnId: 'score', operator: 'greater_than', value: 5, whenTrue: [], whenFalse: [] } }],
        } },
        { id: 'done', type: 'callback', config: { message: 'Fim' } },
      ],
    }

    expect(parseFlowDefinition(flow)).toEqual(flow)
  })

  it('preserva somente uma definição manual estruturalmente válida', () => {
    const validFlow = {
      version: 1 as const,
      trigger: { type: 'manual' as const },
      nodes: [
        { id: 'start', type: 'start', config: { nextNodeId: 'callback' } },
        { id: 'callback', type: 'callback', config: { message: 'Concluído' } },
      ],
    }
    const [, valid, invalid] = parseHeaderCols([
      {
        id: 'flow-valid',
        name: 'Aprovação',
        type: 'flow',
        data: { flow: validFlow },
        parent_id: 'page-1',
      },
      {
        id: 'flow-invalid',
        name: 'Inválido',
        type: 'flow',
        data: {
          flow: {
            version: 1,
            trigger: { type: 'automatic' },
            nodes: [],
          },
        },
        parent_id: 'page-1',
      },
    ], 'Título')

    expect(valid).toMatchObject({ type: 'flow', flow: validFlow })
    expect(invalid).toMatchObject({ type: 'flow' })
    expect(invalid.flow).toBeUndefined()
  })
})

describe('databaseParser — reconcile de filter keys', () => {
  const page = {
    id: '01KXVZ0000PAGE00000000001',
    title: 'Base',
    owner_id: '01KXVZ0000USER00000000001',
    created_at: '2026-09-01T17:00:00.000Z',
    updated_at: '2026-09-01T17:00:00.000Z',
    latest_updated_at: null,
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
