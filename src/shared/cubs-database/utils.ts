import { applyMask } from 'cubs-components'

import type { ColumnDataType, HeaderCol, NumberFormat, RowData } from './types'

/** Formata um valor de célula para exibição na tabela. */
export function formatCellValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'boolean') return value ? '✓' : '✕'
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

/**
 * Texto de um valor `numeric` segundo o `format` da coluna — o MESMO nos dois
 * modos da célula (read-only e editor). O contrato de armazenamento:
 *
 *   currency   → CENTAVOS inteiros (dinheiro em float dá ruim) → "R$ 1.234,56"
 *   percentage → inteiro → "42%"
 *   sem format → número livre → String(n)
 */
export function formatNumericValue(value: unknown, format: NumberFormat | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return ''
  if (format === 'currency') return applyMask('currency', String(Math.round(value)))
  if (format === 'percentage') return applyMask('percentage', String(value))
  return String(value)
}

/**
 * Data no formato `YYYY-MM-DD`, com hora opcional (`2026-07-10 09:12`, ISO com
 * `T`/`Z`/offset). Proposital NÃO usar `Date.parse`: ele aceita coisa demais
 * ("Home" vira data em alguns engines) e transformaria texto em data.
 */
const DATE_LIKE = /^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2})?(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?)?$/

/** Tipo de UM valor. `null` = vazio/indeterminado, não conta na inferência. */
function inferValueType(value: unknown): ColumnDataType | null {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'boolean') return 'checkbox'
  if (typeof value === 'number') return Number.isFinite(value) ? 'numeric' : null
  if (value instanceof Date) return 'date'
  if (typeof value === 'string') return DATE_LIKE.test(value) ? 'date' : 'text'
  return 'text'
}

/**
 * Tipo de uma coluna a partir dos seus valores, para quando `HeaderCol.type`
 * não vem declarado. Conservador de propósito:
 *
 * - células vazias são ignoradas (uma linha sem valor não muda o tipo);
 * - valores de tipos DIFERENTES entre si → 'text' (o denominador comum);
 * - coluna toda vazia → 'text'.
 *
 * 'select' nunca é inferido: distinguir select de text exigiria adivinhar por
 * cardinalidade ("poucos valores repetidos"), e o palpite erraria justamente
 * nas colunas de texto curto. Select precisa vir declarado.
 */
export function inferColumnType(values: Iterable<unknown>): ColumnDataType {
  let inferred: ColumnDataType | null = null
  for (const value of values) {
    const type = inferValueType(value)
    if (type === null) continue
    if (inferred === null) inferred = type
    else if (inferred !== type) return 'text'
  }
  return inferred ?? 'text'
}

/**
 * Tipo FINAL de cada coluna, por ID: o declarado quando existe, senão o
 * inferido dos valores daquela coluna em todas as linhas. Resolver aqui (uma
 * vez, no nível da tabela) e não dentro da célula é o que mantém o ícone do
 * header e as células concordando — do mesmo jeito que `columnWidths`.
 */
export function resolveColumnTypes(
  columns: HeaderCol[],
  rows: RowData[],
): Record<string, ColumnDataType> {
  const types: Record<string, ColumnDataType> = {}
  for (const column of columns) {
    // Caminho curto: coluna que DECLARA o tipo não olha uma linha sequer.
    // Importa porque isto é recalculado a cada mudança em `rows` — ou seja, a
    // cada célula editada — e no uso real do app o tipo vem sempre declarado
    // (o parser o lê de `page_columns`). Sem o atalho, cada tecla confirmada
    // custava uma varredura de colunas × linhas.
    if (column.type) {
      types[column.id] = column.type
      continue
    }
    // Sem `rows.map()`: o array intermediário era alocado uma vez POR COLUNA
    // só para ser consumido e descartado. O generator percorre igual, sem
    // materializar nada.
    types[column.id] = inferColumnType(cellValues(rows, column.id))
  }
  return types
}

/** Valores de uma coluna em todas as linhas, sem materializar array. */
function* cellValues(rows: RowData[], columnId: string): Generator<unknown> {
  for (const row of rows) yield row.cells[columnId]?.value
}

/**
 * Chave de uma célula em `cellErrors` — o par (linha, coluna) que identifica a
 * célula que falhou ao salvar. Exportada para o app HOST montar o Set com o
 * MESMO formato que a lib lê (o contrato entre os dois lados). Espelha o
 * `cellKey` interno do realtime do app.
 */
export const cellErrorKey = (rowId: string, columnId: string): string => `${rowId}:${columnId}`

/** Largura (px) de uma coluna sem entrada em `columnWidths` da view. */
export const DEFAULT_COLUMN_WIDTH = 176
/** Piso do resize: abaixo disso o ícone de tipo + título não cabem. */
export const MIN_COLUMN_WIDTH = 80

/**
 * Largura final de uma coluna, em px. Header e células chamam esta MESMA
 * função com o MESMO valor da view — é o que garante que as duas grades
 * fiquem alinhadas. Ausente/inválido cai no default.
 *
 * NÃO existe teto: a tabela é `w-max` dentro de um `overflow-x-auto`, então
 * coluna larga empurra a rolagem HORIZONTAL em vez de disputar espaço com as
 * vizinhas. Um teto (havia 720px) truncaria silenciosamente o resize do
 * usuário — a largura salva na view deixaria de ser a largura exibida. Só o
 * piso continua, para o header não colapsar em cima do próprio ícone.
 */
export function resolveColumnWidth(width: number | undefined): number {
  if (typeof width !== 'number' || !Number.isFinite(width)) return DEFAULT_COLUMN_WIDTH
  return Math.max(MIN_COLUMN_WIDTH, Math.round(width))
}

/** Alfabeto Crockford base32 (sem I, L, O, U) usado pelo ULID. */
const ULID_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'

/**
 * Gera um ULID (26 chars: 48 bits de tempo + 80 de aleatoriedade). Uso aqui é
 * identidade de views/linhas, não segurança — a aleatoriedade é Math.random.
 */
export function ulid(seedTime: number = Date.now()): string {
  let time = seedTime
  let encoded = ''
  for (let i = 0; i < 10; i++) {
    encoded = ULID_ALPHABET[time % 32] + encoded
    time = Math.floor(time / 32)
  }
  for (let i = 0; i < 16; i++) {
    encoded += ULID_ALPHABET[Math.floor(Math.random() * 32)]
  }
  return encoded
}

/**
 * Reordena itens pela lista de IDs (`orderedHeaderCols` das views) SEM mutar:
 * o resultado é sempre um array novo. IDs desconhecidos são ignorados; itens
 * fora da lista vão para o fim, na ordem original.
 */
export function reorderByIds<T extends { id: string }>(items: T[], orderedIds: string[]): T[] {
  if (orderedIds.length === 0) return items.slice()
  const byId = new Map(items.map((item) => [item.id, item]))
  const ordered = orderedIds
    .map((id) => byId.get(id))
    .filter((item): item is T => item !== undefined)
  // `Set` e não `orderedIds.includes(...)`: o includes rodava DENTRO do
  // filter, varrendo a lista de ids uma vez por item — quadrático numa função
  // que roda a cada render da tabela. A expressão continua sendo uma
  // pergunta de pertencimento; só o container mudou.
  const orderedSet = new Set(orderedIds)
  const rest = items.filter((item) => !orderedSet.has(item.id))
  return [...ordered, ...rest]
}
