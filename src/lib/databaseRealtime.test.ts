import { describe, expect, it } from 'vitest'

import {
  applyLocalCellChange,
  applyLocalColumnRename,
  applyRealtimeEvent,
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

function cellEvent(value: string, updatedAt: string, originUserId: string) {
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
