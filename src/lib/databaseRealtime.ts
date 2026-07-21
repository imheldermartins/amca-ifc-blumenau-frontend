/**
 * Aplicação dos eventos de realtime sobre a base já carregada.
 *
 * PURO e sem React de propósito (o mesmo espírito do `databaseParser`): quem
 * decide QUANDO aplicar é o hook; aqui mora só o COMO. Isso é o que torna a
 * regra de merge testável sem socket, sem render e sem backend.
 *
 * Duas guardas, e as duas existem por um motivo concreto:
 *
 *  - **ordem** (`updatedAt`): a rede não garante ordem de chegada. Sem o
 *    carimbo, um evento atrasado sobrescreveria uma edição mais nova — o
 *    usuário veria o próprio texto "voltar no tempo".
 *  - **eco** (`originUserId`): o servidor emite para a sala INTEIRA, inclusive
 *    quem escreveu. Sem o filtro, a resposta do próprio PUT chegaria de volta
 *    e brigaria com o estado local (pior: no meio de uma digitação).
 *
 * O filtro de eco é por USUÁRIO e não por socket porque a mesma conta pode ter
 * duas abas abertas: excluir só o socket que escreveu deixaria a outra aba
 * desatualizada.
 */
import type {
  CellUpdatedPayload,
  ColumnUpdatedPayload,
  RowUpdatedPayload,
  ViewUpdatedPayload,
} from '@/services/SocketService'
import { TITLE_COLUMN_ID, parseHeaderCols, parseViewSettings, type ApiPageColumn } from '@/lib/databaseParser'
import type { ParsedDatabase } from '@/lib/databaseParser'

/** Eventos que alteram a base exibida. */
export type DatabaseRealtimeEvent =
  | { type: 'cell-updated'; payload: CellUpdatedPayload }
  | { type: 'row-updated'; payload: RowUpdatedPayload }
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
 * o servidor propaga a mudança para a sala inteira, mas quem originou IGNORA o
 * próprio eco (senão a resposta brigaria com o que está sendo digitado). Sem
 * aplicar aqui, o autor da edição era o ÚNICO que não a via: os editores leem
 * o valor das props, e as props só mudavam pelo evento que ele mesmo descarta.
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

/** O evento é mais NOVO que o último aplicado nessa chave? */
function isFresh(clock: RealtimeClock, key: string, updatedAt: string): boolean {
  const applied = clock[key]
  return applied === undefined || applied < updatedAt
}

export interface ApplyResult {
  database: ParsedDatabase
  clock: RealtimeClock
  /** false = nada mudou (eco, evento velho ou alvo inexistente). */
  applied: boolean
}

/**
 * Aplica um evento à base. Devolve SEMPRE novos objetos quando muda (imutável,
 * para o React perceber) e o MESMO objeto quando não muda — descartar o evento
 * não pode custar um re-render.
 *
 * `currentUserId` identifica o eco; passe o id do usuário logado.
 */
export function applyRealtimeEvent(
  database: ParsedDatabase,
  clock: RealtimeClock,
  event: DatabaseRealtimeEvent,
  currentUserId: string | undefined,
  titleLabel: string,
): ApplyResult {
  const unchanged: ApplyResult = { database, clock, applied: false }
  const { payload } = event

  // Eco do próprio usuário: o estado local já está à frente.
  if (currentUserId && payload.originUserId === currentUserId) return unchanged

  switch (event.type) {
    case 'cell-updated': {
      const { rowId, columnId, value, updatedAt } = event.payload
      const key = cellKey(rowId, columnId)
      if (!isFresh(clock, key, updatedAt)) return unchanged

      // Linha desconhecida: quem chegou depois (row-created) recarrega a base;
      // inventar uma linha vazia aqui mostraria um registro sem as outras
      // células.
      const next = writeCell(database, rowId, columnId, value)
      if (!next) return unchanged

      return { database: next, clock: { ...clock, [key]: updatedAt }, applied: true }
    }

    case 'row-updated': {
      // O TÍTULO da linha não é uma coluna: é campo da própria página. Ele
      // chega por um evento próprio e cai na coluna sintética de título — o
      // mesmo lugar onde o parser o colocou na leitura inicial.
      const { rowId, title, updatedAt } = event.payload
      const key = cellKey(rowId, TITLE_COLUMN_ID)
      if (!isFresh(clock, key, updatedAt)) return unchanged

      const next = writeCell(database, rowId, TITLE_COLUMN_ID, title)
      if (!next) return unchanged

      return { database: next, clock: { ...clock, [key]: updatedAt }, applied: true }
    }

    case 'column-updated': {
      const { columnId, column, updatedAt } = event.payload
      const key = columnKey(columnId)
      if (!isFresh(clock, key, updatedAt)) return unchanged
      if (!column || typeof column !== 'object') return unchanged

      const columnIndex = database.headerCols.findIndex((header) => header.id === columnId)
      if (columnIndex < 0) return unchanged

      // A coluna vem no formato da API, então reusa o MESMO adaptador do fetch
      // inicial (nome, options com cor, format) — sem um segundo tradutor que
      // divergiria do primeiro. O `parseHeaderCols` devolve a coluna sintética
      // de título na frente; aqui interessa só a real, daí o `[1]`.
      const [, parsed] = parseHeaderCols([column as ApiPageColumn], titleLabel)
      if (!parsed) return unchanged

      const headerCols = database.headerCols.slice()
      headerCols[columnIndex] = { ...parsed, id: columnId }

      return {
        database: { ...database, headerCols },
        clock: { ...clock, [key]: updatedAt },
        applied: true,
      }
    }

    case 'view-updated': {
      const { data, updatedAt } = event.payload
      if (!isFresh(clock, VIEW_KEY, updatedAt)) return unchanged

      const settings = parseViewSettings(data as Record<string, unknown> | null)
      // Snapshot vazio/ilegível não apaga as tabs de quem está vendo: sem view
      // a tabela não teria como se desenhar.
      if (Object.keys(settings).length === 0) return unchanged

      return {
        database: { ...database, settings },
        clock: { ...clock, [VIEW_KEY]: updatedAt },
        applied: true,
      }
    }
  }
}
