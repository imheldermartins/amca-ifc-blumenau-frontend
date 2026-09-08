/**
 * Aplicação dos eventos de realtime sobre a base já carregada.
 *
 * PURO e sem React de propósito (o mesmo espírito do `databaseParser`): quem
 * decide QUANDO aplicar é o hook; aqui mora só o COMO. Isso é o que torna a
 * regra de merge testável sem socket, sem render e sem backend.
 *
 * **O autor RECEBE o próprio eco.** O servidor emite para a sala inteira,
 * inclusive para quem escreveu, e aqui isso é tratado como confirmação — não
 * como ruído a filtrar. Antes havia um descarte por `originUserId`, e ele
 * deixava um buraco real: o caminho otimista (`applyLocalCellChange`) não
 * carimba o relógio de propósito (o tempo é do SERVIDOR), então uma edição
 * sua não deixava marca temporal nenhuma — e um evento mais VELHO de outra
 * pessoa passava pela guarda de ordem e sobrescrevia o que você acabou de
 * escrever. Aceitar o eco fecha isso sem inventar relógio local:
 *
 *   1. a edição própria aparece na hora (otimista, sem esperar a rede);
 *   2. o eco chega com o `updatedAt` do commit e SELA aquela chave no
 *      relógio, deixando o estado local defensável contra evento atrasado.
 *
 * Sobra UMA guarda:
 *
 *  - **ordem** (`updatedAt`): a rede não garante ordem de chegada. Sem o
 *    carimbo, um evento atrasado sobrescreveria uma edição mais nova — o
 *    usuário veria o próprio texto "voltar no tempo".
 *
 * `originUserId` continua viajando no payload, mas como AUDITORIA (quem
 * originou), não como regra de merge. Quem protege a digitação em andamento é
 * o editor, via `useExternalDraft` — o lugar certo, porque só ele sabe se o
 * campo está em foco.
 */
import type {
  ColumnConfigPatch,
  ColumnDataType,
  ColumnOption,
  HeaderCol,
} from 'cubs-database'

import type {
  CellUpdatedPayload,
  ColumnCreatedPayload,
  ColumnUpdatedPayload,
  RowUpdatedPayload,
  ViewUpdatedPayload,
} from '@/services/realtime-contract-v1'
import { TITLE_COLUMN_ID, parseHeaderCols, parseViewSettings, type ApiPageColumn } from '@/lib/databaseParser'
import type { ParsedDatabase } from '@/lib/databaseParser'

/** Eventos que alteram a base exibida. */
export type DatabaseRealtimeEvent =
  | { type: 'cell-updated'; payload: CellUpdatedPayload }
  | { type: 'row-updated'; payload: RowUpdatedPayload }
  | { type: 'column-created'; payload: ColumnCreatedPayload }
  | { type: 'column-updated'; payload: ColumnUpdatedPayload }
  | { type: 'view-updated'; payload: ViewUpdatedPayload }

/**
 * Relógio por chave: guarda o `updatedAt` do último evento APLICADO em cada
 * célula/coluna/view. Fica FORA do `ParsedDatabase` porque é metadado de
 * sincronização, não conteúdo — a tabela não deve saber que ele existe.
 */
export type RealtimeClock = Record<string, string>

const cellKey = (rowId: string, columnId: string) => `cell:${rowId}:${columnId}`
const columnKey = (columnId: string) => `column:${columnId}`
const VIEW_KEY = 'view'

/**
 * Escreve o valor de uma célula na base, sem tocar em nada mais.
 * `null`/`undefined` REMOVEM a chave: para a tabela, "ausente" e "vazia" são
 * coisas diferentes (ver `parseRows`) — um checkbox sem valor não é `false`.
 */
function writeCell(
  database: ParsedDatabase,
  rowId: string,
  columnId: string,
  value: unknown,
): ParsedDatabase | null {
  const rowIndex = database.rows.findIndex((row) => row.id === rowId)
  if (rowIndex < 0) return null

  const row = database.rows[rowIndex]
  const cells = { ...row.cells }
  if (value === null || value === undefined) delete cells[columnId]
  else cells[columnId] = { value }

  const rows = database.rows.slice()
  rows[rowIndex] = { ...row, cells }
  return { ...database, rows }
}

/**
 * Aplica LOCALMENTE a edição que este usuário acabou de fazer — o caminho
 * otimista, e a razão de ele existir:
 *
 * o servidor propaga a mudança para a sala inteira, inclusive ao autor, mas o
 * caminho HTTP + socket não substitui a resposta imediata da interface. Sem
 * aplicar aqui, o autor só veria a própria edição depois da ida e volta; o eco
 * continua entrando em seguida para selar o relógio do servidor.
 *
 * Não mexe no relógio de propósito: o carimbo é do SERVIDOR, e adiantar o
 * relógio com a hora local faria eventos legítimos de outras pessoas parecerem
 * velhos se os relógios divergirem.
 */
export function applyLocalCellChange(
  database: ParsedDatabase,
  change: { rowId: string; columnId: string; value: unknown },
): ParsedDatabase {
  return writeCell(database, change.rowId, change.columnId, change.value) ?? database
}

/**
 * Mesma ideia para o RENAME de coluna: mostra o nome novo imediatamente, sem
 * esperar a ida e volta do HTTP + socket. O eco chega logo atrás com a coluna
 * inteira como o servidor a gravou (e aí sim carimba o relógio).
 *
 * Também não toca no relógio, pelo mesmo motivo do de célula: o carimbo é do
 * servidor, e adiantá-lo com a hora local faria evento legítimo de outra
 * pessoa parecer velho se os relógios divergirem.
 */
export function applyLocalColumnRename(
  database: ParsedDatabase,
  columnId: string,
  name: string,
): ParsedDatabase {
  const index = database.headerCols.findIndex((header) => header.id === columnId)
  if (index < 0) return database

  const column = database.headerCols[index]
  if (column.title === name) return database

  const headerCols = database.headerCols.slice()
  headerCols[index] = { ...column, title: name }
  return { ...database, headerCols }
}

function parseApiColumn(column: unknown, titleLabel: string): HeaderCol | null {
  if (!column || typeof column !== 'object') return null
  const [, parsed] = parseHeaderCols([column as ApiPageColumn], titleLabel)
  return parsed ?? null
}

/** Insere somente o header confirmado; linhas/células permanecem intocadas. */
export function applyLocalColumnCreated(
  database: ParsedDatabase,
  column: ApiPageColumn,
  titleLabel: string,
): ParsedDatabase {
  if (database.headerCols.some((header) => header.id === column.id)) return database
  const parsed = parseApiColumn(column, titleLabel)
  return parsed
    ? { ...database, headerCols: [...database.headerCols, parsed] }
    : database
}

/** Remove uma página/linha localmente; eco e repetição devolvem a mesma base. */
export function applyLocalRowDeleted(
  database: ParsedDatabase,
  rowId: string,
): ParsedDatabase {
  const index = database.rows.findIndex((row) => row.id === rowId)
  if (index < 0) return database
  return {
    ...database,
    rows: database.rows.filter((row) => row.id !== rowId),
  }
}

/**
 * Remove o header e as células órfãs de uma coluna sem remontar a base. As
 * referências do snapshot podem permanecer: `reorderByIds` e os filtros já
 * ignoram ids desconhecidos, e o backend conserva o tombstone de public key.
 */
export function applyLocalColumnDeleted(
  database: ParsedDatabase,
  columnId: string,
): ParsedDatabase {
  if (!database.headerCols.some((column) => column.id === columnId)) return database

  return {
    ...database,
    headerCols: database.headerCols.filter((column) => column.id !== columnId),
    rows: database.rows.map((row) => {
      if (!(columnId in row.cells)) return row
      const cells = { ...row.cells }
      delete cells[columnId]
      return { ...row, cells }
    }),
  }
}

/** Rollback pontual de uma linha removida, sem substituir mudanças concorrentes. */
export function restoreLocalRowDeleted(
  database: ParsedDatabase,
  beforeDelete: ParsedDatabase,
  rowId: string,
): ParsedDatabase {
  if (database.rows.some((row) => row.id === rowId)) return database
  const oldIndex = beforeDelete.rows.findIndex((row) => row.id === rowId)
  if (oldIndex < 0) return database
  const rows = database.rows.slice()
  rows.splice(Math.min(oldIndex, rows.length), 0, beforeDelete.rows[oldIndex]!)
  return { ...database, rows }
}

/** Rollback pontual de coluna + células, preservando conteúdo recebido depois. */
export function restoreLocalColumnDeleted(
  database: ParsedDatabase,
  beforeDelete: ParsedDatabase,
  columnId: string,
): ParsedDatabase {
  if (database.headerCols.some((column) => column.id === columnId)) return database
  const oldIndex = beforeDelete.headerCols.findIndex((column) => column.id === columnId)
  if (oldIndex < 0) return database

  const headerCols = database.headerCols.slice()
  headerCols.splice(
    Math.min(oldIndex, headerCols.length),
    0,
    beforeDelete.headerCols[oldIndex]!,
  )
  const oldRows = new Map(beforeDelete.rows.map((row) => [row.id, row]))
  const rows = database.rows.map((row) => {
    if (columnId in row.cells) return row
    const oldCell = oldRows.get(row.id)?.cells[columnId]
    return oldCell === undefined
      ? row
      : { ...row, cells: { ...row.cells, [columnId]: oldCell } }
  })

  return { ...database, headerCols, rows }
}

/** Aplica um patch parcial numa coluna do header (otimista). Puro. */
function patchColumn(
  database: ParsedDatabase,
  columnId: string,
  patch: Partial<HeaderCol>,
): ParsedDatabase {
  const index = database.headerCols.findIndex((header) => header.id === columnId)
  if (index < 0) return database
  const headerCols = database.headerCols.slice()
  headerCols[index] = { ...headerCols[index], ...patch }
  return { ...database, headerCols }
}

/**
 * Otimismo do editor de options do menu: mostra o array novo (add/renomear/cor/
 * reordenar/excluir) na hora, para o próprio read-modify-write do editor não
 * partir de estado velho enquanto o eco não voltou. Não toca no relógio.
 */
export function applyLocalColumnOptions(
  database: ParsedDatabase,
  columnId: string,
  options: ColumnOption[],
): ParsedDatabase {
  return patchColumn(database, columnId, { options })
}

/** Otimismo da troca de TIPO — o header/editores refletem antes do eco. */
export function applyLocalColumnType(
  database: ParsedDatabase,
  columnId: string,
  type: ColumnDataType,
): ParsedDatabase {
  return patchColumn(database, columnId, { type })
}

/**
 * Otimismo da config (formato/moeda/máscara). `null` no patch LIMPA a chave —
 * o mesmo contrato do backend. Traduz o `ColumnConfigPatch` (null) para o
 * `HeaderCol` (undefined) da lib.
 */
export function applyLocalColumnConfig(
  database: ParsedDatabase,
  columnId: string,
  patch: ColumnConfigPatch,
): ParsedDatabase {
  const applied: Partial<HeaderCol> = {}
  if ('format' in patch) applied.format = patch.format ?? undefined
  if ('currency' in patch) applied.currency = patch.currency ?? undefined
  if ('mask' in patch) applied.mask = patch.mask ?? undefined
  return patchColumn(database, columnId, applied)
}

/** O evento não é anterior ao último aplicado nessa chave? */
function isFresh(clock: RealtimeClock, key: string, updatedAt: string): boolean {
  const applied = clock[key]
  // Dois commits podem receber o mesmo milissegundo do relógio da rota. O
  // Socket.IO preserva a ordem de emissão; aceitar o empate deixa o segundo
  // evento vencer em vez de descartá-lo silenciosamente.
  return applied === undefined || applied <= updatedAt
}

export interface ApplyResult {
  database: ParsedDatabase
  clock: RealtimeClock
  /** false = nada mudou (eco, evento velho ou alvo inexistente). */
  applied: boolean
}

interface ApplyContext {
  database: ParsedDatabase
  clock: RealtimeClock
  titleLabel: string
  unchanged: ApplyResult
}

type DatabaseRealtimeEventType = DatabaseRealtimeEvent['type']
type EventFor<T extends DatabaseRealtimeEventType> = Extract<
  DatabaseRealtimeEvent,
  { type: T }
>
type RealtimeEventHandler<T extends DatabaseRealtimeEventType> = (
  context: ApplyContext,
  payload: EventFor<T>['payload'],
) => ApplyResult
type RealtimeEventHandlerRegistry = {
  [T in DatabaseRealtimeEventType]: RealtimeEventHandler<T>
}

/**
 * Registro fechado dos eventos que alteram o `ParsedDatabase` canônico.
 * Adicionar um evento ao union sem registrar seu handler quebra o typecheck.
 */
const DATABASE_REALTIME_HANDLERS = {
  'cell-updated': ({ database, clock, unchanged }, payload) => {
    const { rowId, columnId, value, updatedAt } = payload
    const key = cellKey(rowId, columnId)
    if (!isFresh(clock, key, updatedAt)) return unchanged

    // Linha desconhecida: quem chegou depois (row-created) recarrega a base;
    // inventar uma linha vazia aqui mostraria um registro sem as outras células.
    const next = writeCell(database, rowId, columnId, value)
    if (!next) return unchanged

    return { database: next, clock: { ...clock, [key]: updatedAt }, applied: true }
  },

  'row-updated': ({ database, clock, unchanged }, payload) => {
    // O TÍTULO da linha é campo da página e cai na coluna sintética, o
    // mesmo lugar onde o parser o colocou na leitura inicial.
    const { rowId, title, updatedAt } = payload
    const key = cellKey(rowId, TITLE_COLUMN_ID)
    if (!isFresh(clock, key, updatedAt)) return unchanged

    const next = writeCell(database, rowId, TITLE_COLUMN_ID, title)
    if (!next) return unchanged

    return { database: next, clock: { ...clock, [key]: updatedAt }, applied: true }
  },

  'column-created': ({ database, clock, titleLabel, unchanged }, payload) => {
    const { columnId, column, updatedAt } = payload
    const key = columnKey(columnId)
    if (!isFresh(clock, key, updatedAt)) return unchanged

    const parsed = parseApiColumn(column, titleLabel)
    if (!parsed || parsed.id !== columnId) return unchanged

    const alreadyExists = database.headerCols.some((header) => header.id === columnId)
    return {
      database: alreadyExists
        ? database
        : { ...database, headerCols: [...database.headerCols, parsed] },
      clock: { ...clock, [key]: updatedAt },
      applied: true,
    }
  },

  'column-updated': ({ database, clock, titleLabel, unchanged }, payload) => {
    const { columnId, column, updatedAt } = payload
    const key = columnKey(columnId)
    if (!isFresh(clock, key, updatedAt)) return unchanged
    const columnIndex = database.headerCols.findIndex((header) => header.id === columnId)
    if (columnIndex < 0) return unchanged

    const parsed = parseApiColumn(column, titleLabel)
    if (!parsed || parsed.id !== columnId) return unchanged

    const headerCols = database.headerCols.slice()
    headerCols[columnIndex] = { ...parsed, id: columnId }
    return {
      database: { ...database, headerCols },
      clock: { ...clock, [key]: updatedAt },
      applied: true,
    }
  },

  'view-updated': ({ database, clock, titleLabel, unchanged }, payload) => {
    const { data, updatedAt } = payload
    if (!isFresh(clock, VIEW_KEY, updatedAt)) return unchanged

    const settings = parseViewSettings(data as Record<string, unknown> | null, titleLabel)
    // Snapshot vazio/ilegível não apaga as tabs de quem está vendo.
    if (Object.keys(settings).length === 0) return unchanged

    return {
      database: { ...database, settings },
      clock: { ...clock, [VIEW_KEY]: updatedAt },
      applied: true,
    }
  },
} satisfies RealtimeEventHandlerRegistry

/**
 * Aplica um evento à base. Devolve SEMPRE novos objetos quando muda (imutável,
 * para o React perceber) e o MESMO objeto quando não muda — descartar o evento
 * não pode custar um re-render.
 *
 * Não recebe o id do usuário atual: o eco do próprio autor é aplicado como
 * qualquer outro evento (ver o cabeçalho do arquivo). Para a edição própria o
 * valor já é o mesmo que está na tela, então o efeito visível é nenhum — o que
 * o eco entrega é o `updatedAt` do servidor para o relógio.
 */
export function applyRealtimeEvent(
  database: ParsedDatabase,
  clock: RealtimeClock,
  event: DatabaseRealtimeEvent,
  titleLabel: string,
): ApplyResult {
  const unchanged: ApplyResult = { database, clock, applied: false }

  const context: ApplyContext = { database, clock, titleLabel, unchanged }
  // TypeScript perde a correlação discriminante ao indexar um registry com
  // uma union. O `satisfies` acima prova cada par evento/payload; este cast fica
  // restrito à fronteira de despacho.
  const handler = DATABASE_REALTIME_HANDLERS[event.type] as (
    applyContext: ApplyContext,
    payload: DatabaseRealtimeEvent['payload'],
  ) => ApplyResult
  return handler(context, event.payload)
}
