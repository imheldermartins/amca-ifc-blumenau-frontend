import { describe, expect, it } from 'vitest'

import {
  applyLocalCellChange,
  applyLocalColumnCreated,
  applyLocalColumnDeleted,
  applyLocalColumnRename,
  applyLocalRowDeleted,
  applyRealtimeEvent,
  restoreLocalColumnDeleted,
  restoreLocalRowDeleted,
  type RealtimeClock,
} from '@/lib/databaseRealtime'
import { TITLE_COLUMN_ID, type ParsedDatabase } from '@/lib/databaseParser'

/**
 * O redutor de merge do realtime — a regra que decide o que da rede entra no
 * estado. É puro, então dá para testar sem socket, sem render e sem backend, e
 * é por isso que ele foi isolado assim.
 *
 * O caso que MOTIVOU esta suíte é o do eco: até esta leva, o autor de uma
 * edição DESCARTAVA o próprio evento. Como o caminho otimista não carimba o
 * relógio de propósito (o tempo é do servidor), a edição dele não deixava
 * marca temporal nenhuma — e um evento mais VELHO de outra pessoa passava pela
 * guarda de ordem e sobrescrevia o que ele acabara de escrever.
 */
const COLUNA = 'col-status'
const LINHA = 'row-1'
const EU = 'user-eu'
const OUTRO = 'user-outro'

function base(): ParsedDatabase {
  return {
    settings: {},
    headerCols: [
      { id: TITLE_COLUMN_ID, title: 'Título', type: 'text' },
      { id: COLUNA, title: 'Status', type: 'text' },
    ],
    rows: [{ id: LINHA, cells: { [COLUNA]: { value: 'inicial' } } }],
  }
}

function cellEvent(value: unknown, updatedAt: string, originUserId: string) {
  return {
    type: 'cell-updated' as const,
    payload: {
      pageId: 'page-1',
      rowId: LINHA,
      columnId: COLUNA,
      value,
      updatedAt,
      originUserId,
    },
  }
}

describe('applyRealtimeEvent — guarda de ordem', () => {
  it('aplica um evento novo e carimba o relógio com o updatedAt do SERVIDOR', () => {
    const result = applyRealtimeEvent(base(), {}, cellEvent('novo', '2026-07-21T10:00:00Z', OUTRO), 'Título')

    expect(result.applied).toBe(true)
    expect(result.database.rows[0].cells[COLUNA]?.value).toBe('novo')
    expect(result.clock[`cell:${LINHA}:${COLUNA}`]).toBe('2026-07-21T10:00:00Z')
  })

  it('DESCARTA evento mais velho que o já aplicado (chegada fora de ordem)', () => {
    const clock: RealtimeClock = { [`cell:${LINHA}:${COLUNA}`]: '2026-07-21T10:00:00Z' }
    const atrasado = cellEvent('valor-velho', '2026-07-21T09:59:00Z', OUTRO)

    const result = applyRealtimeEvent(base(), clock, atrasado, 'Título')

    expect(result.applied).toBe(false)
    expect(result.database.rows[0].cells[COLUNA]?.value).toBe('inicial')
  })

  it('aplica o segundo evento quando dois commits têm o mesmo milissegundo', () => {
    const timestamp = '2026-07-21T10:00:00.123Z'
    const clock: RealtimeClock = { [`cell:${LINHA}:${COLUNA}`]: timestamp }

    const result = applyRealtimeEvent(
      base(),
      clock,
      cellEvent('segundo-no-mesmo-ms', timestamp, OUTRO),
      'Título',
    )

    expect(result.applied).toBe(true)
    expect(result.database.rows[0].cells[COLUNA]?.value).toBe('segundo-no-mesmo-ms')
  })

  it('devolve o MESMO objeto quando não aplica — descartar não pode custar render', () => {
    const database = base()
    const clock: RealtimeClock = { [`cell:${LINHA}:${COLUNA}`]: '2026-07-21T10:00:00Z' }

    const result = applyRealtimeEvent(
      database,
      clock,
      cellEvent('x', '2026-07-21T09:00:00Z', OUTRO),
      'Título',
    )

    expect(result.database).toBe(database)
    expect(result.clock).toBe(clock)
  })

  it('ignora evento para uma linha que não existe (quem chegou depois recarrega)', () => {
    const evento = {
      type: 'cell-updated' as const,
      payload: {
        pageId: 'page-1',
        rowId: 'linha-fantasma',
        columnId: COLUNA,
        value: 'x',
        updatedAt: '2026-07-21T10:00:00Z',
        originUserId: OUTRO,
      },
    }

    expect(applyRealtimeEvent(base(), {}, evento, 'Título').applied).toBe(false)
  })

  it.each([false, 0, ''])('preserva valor falsy confirmado: %j', (value) => {
    const result = applyRealtimeEvent(
      base(),
      {},
      cellEvent(value, '2026-07-21T10:00:00Z', OUTRO),
      'Título',
    )

    expect(result.applied).toBe(true)
    expect(result.database.rows[0].cells[COLUNA]?.value).toBe(value)
  })

  it('remove a célula quando o evento confirmado carrega null', () => {
    const result = applyRealtimeEvent(
      base(),
      {},
      cellEvent(null, '2026-07-21T10:00:00Z', OUTRO),
      'Título',
    )

    expect(result.applied).toBe(true)
    expect(result.database.rows[0].cells[COLUNA]).toBeUndefined()
  })
})

describe('applyRealtimeEvent — o autor recebe o próprio eco', () => {
  it('APLICA o evento originado pelo próprio usuário', () => {
    // Antes desta leva havia um `originUserId === currentUserId → descarta`.
    // Ele sumiu: o eco é a confirmação do servidor, não ruído.
    const result = applyRealtimeEvent(base(), {}, cellEvent('meu-valor', '2026-07-21T10:00:00Z', EU), 'Título')

    expect(result.applied).toBe(true)
    expect(result.clock[`cell:${LINHA}:${COLUNA}`]).toBe('2026-07-21T10:00:00Z')
  })

  it('o eco SELA a chave contra um evento atrasado de outra pessoa', () => {
    // Este é o buraco que existia: escrita otimista não carimba relógio, então
    // sem o eco a chave ficava sem marca e qualquer evento velho passava.
    const local = applyLocalCellChange(base(), {
      rowId: LINHA,
      columnId: COLUNA,
      value: 'que-eu-escrevi',
    })

    // 1. o eco da minha escrita chega e carimba o relógio
    const comEco = applyRealtimeEvent(
      local,
      {},
      cellEvent('que-eu-escrevi', '2026-07-21T10:00:05Z', EU),
      'Título',
    )
    expect(comEco.applied).toBe(true)

    // 2. um evento ANTERIOR de outra pessoa chega atrasado — e agora bate na guarda
    const atrasado = applyRealtimeEvent(
      comEco.database,
      comEco.clock,
      cellEvent('valor-antigo-de-outro', '2026-07-21T10:00:01Z', OUTRO),
      'Título',
    )

    expect(atrasado.applied).toBe(false)
    expect(atrasado.database.rows[0].cells[COLUNA]?.value).toBe('que-eu-escrevi')
  })
})

describe('applyLocalCellChange / applyLocalColumnRename — caminho otimista', () => {
  it('escreve o valor sem tocar em mais nada', () => {
    const next = applyLocalCellChange(base(), { rowId: LINHA, columnId: COLUNA, value: 'otimista' })
    expect(next.rows[0].cells[COLUNA]?.value).toBe('otimista')
  })

  it('null REMOVE a célula — "ausente" e "vazia" são coisas diferentes', () => {
    const next = applyLocalCellChange(base(), { rowId: LINHA, columnId: COLUNA, value: null })
    expect(next.rows[0].cells[COLUNA]).toBeUndefined()
  })

  it('renomeia a coluna e devolve o MESMO objeto quando o nome não muda', () => {
    const database = base()

    const renomeado = applyLocalColumnRename(database, COLUNA, 'Situação')
    expect(renomeado.headerCols[1].title).toBe('Situação')

    expect(applyLocalColumnRename(database, COLUNA, 'Status')).toBe(database)
    expect(applyLocalColumnRename(database, 'coluna-inexistente', 'X')).toBe(database)
  })
})

describe('soft delete local — merge incremental e rollback pontual', () => {
  it('remove e restaura uma página sem substituir o restante da base', () => {
    const before = base()
    const removed = applyLocalRowDeleted(before, LINHA)

    expect(removed.rows).toHaveLength(0)
    expect(applyLocalRowDeleted(removed, LINHA)).toBe(removed)
    expect(restoreLocalRowDeleted(removed, before, LINHA).rows).toEqual(before.rows)
  })

  it('remove e restaura header + células da coluna', () => {
    const before = base()
    const removed = applyLocalColumnDeleted(before, COLUNA)

    expect(removed.headerCols.map(({ id }) => id)).toEqual([TITLE_COLUMN_ID])
    expect(removed.rows[0].cells[COLUNA]).toBeUndefined()
    expect(applyLocalColumnDeleted(removed, COLUNA)).toBe(removed)

    const restored = restoreLocalColumnDeleted(removed, before, COLUNA)
    expect(restored.headerCols).toEqual(before.headerCols)
    expect(restored.rows[0].cells[COLUNA]).toEqual({ value: 'inicial' })
  })
})

describe('row-updated — o título da linha é campo da página, não coluna', () => {
  it('cai na coluna sintética de título', () => {
    const evento = {
      type: 'row-updated' as const,
      payload: {
        pageId: 'page-1',
        rowId: LINHA,
        title: 'Novo título',
        updatedAt: '2026-07-21T10:00:00Z',
        originUserId: OUTRO,
      },
    }

    const result = applyRealtimeEvent(base(), {}, evento, 'Título')

    expect(result.applied).toBe(true)
    expect(result.database.rows[0].cells[TITLE_COLUMN_ID]?.value).toBe('Novo título')
  })
})

describe('handlers registrados de coluna e snapshot', () => {
  it('anexa uma coluna criada sem tocar nas linhas e deduplica o eco', () => {
    const database = base()
    const column = {
      id: 'col-new',
      name: 'Coluna',
      type: 'text' as const,
      parent_id: 'page-1',
      data: { publicKey: { key: 'coluna', aliases: [] } },
    }
    const local = applyLocalColumnCreated(database, column, 'Título')

    expect(local.headerCols.at(-1)).toEqual({
      id: 'col-new',
      title: 'Coluna',
      type: 'text',
      publicKey: { key: 'coluna', aliases: [] },
    })
    expect(local.rows).toBe(database.rows)

    const echoed = applyRealtimeEvent(
      local,
      {},
      {
        type: 'column-created',
        payload: {
          pageId: 'page-1',
          columnId: 'col-new',
          column,
          updatedAt: '2026-07-21T10:00:00Z',
          originUserId: OUTRO,
        },
      },
      'Título',
    )

    expect(echoed.applied).toBe(true)
    expect(echoed.database).toBe(local)
    expect(echoed.database.headerCols.filter(({ id }) => id === 'col-new')).toHaveLength(1)
    expect(echoed.clock['column:col-new']).toBe('2026-07-21T10:00:00Z')
  })

  it('substitui a definição completa com type, options, mask, format e currency', () => {
    const result = applyRealtimeEvent(
      base(),
      {},
      {
        type: 'column-updated',
        payload: {
          pageId: 'page-1',
          columnId: COLUNA,
          column: {
            id: COLUNA,
            name: 'Situação',
            type: 'select',
            parent_id: 'page-1',
            data: {
              publicKey: { key: 'situacao', aliases: ['status'] },
              options: [
                {
                  id: 'option-1',
                  value: 'Em andamento',
                  color: 'blue',
                  publicKey: { key: 'em_andamento', aliases: [] },
                },
              ],
              mask: 'cpf',
              format: 'currency',
              currency: 'BRL',
            },
          },
          updatedAt: '2026-07-21T10:00:00Z',
          originUserId: OUTRO,
        },
      },
      'Título',
    )

    expect(result.applied).toBe(true)
    expect(result.database.headerCols[1]).toEqual({
      id: COLUNA,
      title: 'Situação',
      type: 'select',
      publicKey: { key: 'situacao', aliases: ['status'] },
      options: [
        {
          id: 'option-1',
          label: 'Em andamento',
          color: 'blue',
          publicKey: { key: 'em_andamento', aliases: [] },
        },
      ],
      mask: 'cpf',
      format: 'currency',
      currency: 'BRL',
    })
    expect(result.clock[`column:${COLUNA}`]).toBe('2026-07-21T10:00:00Z')
  })

  it('substitui o snapshot completo mesmo quando a view atual pode ser outra', () => {
    const viewId = '01KXVZ0000VIEW000000000001'
    const result = applyRealtimeEvent(
      base(),
      {},
      {
        type: 'view-updated',
        payload: {
          pageId: 'page-1',
          data: {
            [viewId]: {
              view: 'board',
              name: 'Quadro',
              urlKey: { key: 'quadro', aliases: [] },
              filters: {
                version: 2,
                updatedAt: '2026-07-21T10:00:00Z',
                clauses: [],
                groupBy: [COLUNA],
                passthrough: [],
              },
              orderedHeaderCols: [TITLE_COLUMN_ID, COLUNA],
              title: {
                key: 'title',
                column_name: 'Tarefa',
                mask: 'cep',
                publicKey: { key: 'tarefa', aliases: [] },
              },
            },
          },
          updatedAt: '2026-07-21T10:00:00Z',
          originUserId: OUTRO,
        },
      },
      'Título',
    )

    expect(result.applied).toBe(true)
    expect(result.database.settings).toEqual({
      [viewId]: {
        view: 'board',
        name: 'Quadro',
        urlKey: { key: 'quadro', aliases: [] },
        filters: {
          version: 2,
          updatedAt: '2026-07-21T10:00:00Z',
          clauses: [],
          groupBy: [COLUNA],
          passthrough: [],
        },
        orderedHeaderCols: [TITLE_COLUMN_ID, COLUNA],
        title: {
          key: 'title',
          column_name: 'Tarefa',
          mask: 'cep',
          publicKey: { key: 'tarefa', aliases: [] },
        },
      },
    })
    expect(result.clock.view).toBe('2026-07-21T10:00:00Z')
  })
})
