import type {
  ColumnDataType,
  FilterCondition,
  HeaderCol,
  RowData,
  ViewFilterClause,
  ViewFiltersPassthrough,
  ViewFiltersV2,
} from './types'
import { resolveColumnTypes } from './utils'

export type {
  FilterCondition,
  ViewFilterClause,
  ViewFiltersPassthrough,
  ViewFiltersV2,
} from './types'

/** Versão do documento canônico persistido em `view.filters`. */
export const VIEW_FILTERS_VERSION = 2 as const
/** Versão do codec string aceito somente durante o upgrade dos snapshots. */
export const LEGACY_VIEW_FILTERS_VERSION = '1' as const

/** Nome histórico mantido para consumidores do pacote. Em memória é sempre v2. */
export type ParsedViewFilters = ViewFiltersV2

export function emptyViewFilters(updatedAt: string | null = null): ViewFiltersV2 {
  return {
    version: VIEW_FILTERS_VERSION,
    updatedAt,
    clauses: [],
    groupBy: [],
    passthrough: [],
  }
}

export type FilterValueInput =
  | 'text'
  | 'number'
  | 'select'
  | 'date'
  | 'dateRange'
  | 'checkbox'

export type FilterValueArity = 1 | 2 | 'many'

export type FilterPredicate = (
  cellValue: unknown,
  filterValues: readonly string[],
  column: HeaderCol,
) => boolean

export interface FilterConditionDefinition {
  id: FilterCondition
  input: FilterValueInput
  arity: FilterValueArity
  /** Valida o payload antes de torná-lo um filtro efetivo. */
  accepts: (values: readonly string[]) => boolean
  predicate: FilterPredicate
}

export interface FilterTypeDefinition {
  defaultCondition: FilterCondition
  conditions: readonly FilterConditionDefinition[]
}

const FILTER_CONDITIONS = new Set<FilterCondition>([
  'equals',
  'contains',
  'greaterThan',
  'lessThan',
  'between',
])

function isFilterCondition(value: unknown): value is FilterCondition {
  return typeof value === 'string' && FILTER_CONDITIONS.has(value as FilterCondition)
}

function hasOnlyClauseKeys(value: Record<string, unknown>): boolean {
  const allowed = new Set(['columnId', 'condition', 'values'])
  return Object.keys(value).every((key) => allowed.has(key))
}

/** `where` válido. Qualquer extensão desconhecida fica como passthrough. */
function parseWhere(value: string): ViewFilterClause | null {
  try {
    const parsed = JSON.parse(value) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null

    const candidate = parsed as Record<string, unknown>
    if (!hasOnlyClauseKeys(candidate)) return null
    if (typeof candidate.columnId !== 'string' || candidate.columnId.length === 0) return null
    if (!isFilterCondition(candidate.condition)) return null
    if (
      !Array.isArray(candidate.values) ||
      !candidate.values.every((item): item is string => typeof item === 'string')
    ) {
      return null
    }

    return {
      columnId: candidate.columnId,
      condition: candidate.condition,
      values: candidate.values,
    }
  } catch {
    return null
  }
}

/**
 * Lê v1 e o legado `group=<columnId>`. Para versão desconhecida, nenhuma
 * entrada de domínio é interpretada: tudo, exceto o primeiro `v`, fica em
 * passthrough e volta intacto na reserialização.
 */
function parseLegacyViewFilters(raw: string): ViewFiltersV2 {
  const params = new URLSearchParams(raw ?? '')
  const entries = [...params.entries()]
  const versionIndex = entries.findIndex(([key]) => key === 'v')
  const version = versionIndex >= 0 ? entries[versionIndex][1] : null
  const supported = version === null || version === LEGACY_VIEW_FILTERS_VERSION

  const clauses: ViewFilterClause[] = []
  const groupBy: string[] = []
  const passthrough: ViewFiltersPassthrough[] = []

  entries.forEach(([key, value], index) => {
    // O primeiro `v` governa o documento. Um `v` duplicado é desconhecido e
    // precisa sobreviver como qualquer outro par.
    if (index === versionIndex) return

    if (!supported) {
      passthrough.push([key, value])
      return
    }

    if (key === 'group' && value.length > 0) {
      groupBy.push(value)
      return
    }

    // `where` nasceu no v1. Sem versão, apenas `group` tem significado legado
    // conhecido; interpretar um `where` antigo seria adivinhar contrato.
    if (key === 'where' && version === LEGACY_VIEW_FILTERS_VERSION) {
      const clause = parseWhere(value)
      if (clause) clauses.push(clause)
      else passthrough.push([key, value])
      return
    }

    passthrough.push([key, value])
  })

  return {
    version: VIEW_FILTERS_VERSION,
    updatedAt: null,
    clauses,
    groupBy,
    // O discriminador legado já foi consumido. Pares desconhecidos seguem
    // lossless no documento v2, como faz a reconciliação do backend.
    passthrough,
  }
}

function isViewFiltersV2(raw: unknown): raw is Record<string, unknown> {
  return Boolean(raw && typeof raw === 'object' && !Array.isArray(raw))
}

/** Aceita snapshot legado string ou v2 e sempre devolve um documento v2 seguro. */
export function parseViewFilters(
  raw: string | ViewFiltersV2 | null | undefined,
): ParsedViewFilters {
  if (typeof raw === 'string') return parseLegacyViewFilters(raw)
  if (!isViewFiltersV2(raw) || raw.version !== VIEW_FILTERS_VERSION) {
    return emptyViewFilters()
  }

  const clauses = Array.isArray(raw.clauses)
    ? raw.clauses.flatMap((candidate) => {
        if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) return []
        const value = candidate as unknown as Record<string, unknown>
        if (
          !hasOnlyClauseKeys(value) ||
          typeof value.columnId !== 'string' ||
          value.columnId.length === 0 ||
          !isFilterCondition(value.condition) ||
          !Array.isArray(value.values) ||
          !value.values.every((item): item is string => typeof item === 'string')
        ) {
          return []
        }
        return [{
          columnId: value.columnId,
          condition: value.condition,
          values: [...value.values],
        }]
      })
    : []

  const passthrough = Array.isArray(raw.passthrough)
    ? raw.passthrough.flatMap((candidate) =>
        Array.isArray(candidate) &&
        candidate.length === 2 &&
        typeof candidate[0] === 'string' &&
        typeof candidate[1] === 'string'
          ? [[candidate[0], candidate[1]] as ViewFiltersPassthrough]
          : [],
      )
    : []

  return {
    version: VIEW_FILTERS_VERSION,
    updatedAt:
      typeof raw.updatedAt === 'string' && Number.isFinite(Date.parse(raw.updatedAt))
        ? raw.updatedAt
        : null,
    clauses,
    groupBy: Array.isArray(raw.groupBy)
      ? raw.groupBy.filter((id): id is string => typeof id === 'string' && id.length > 0)
      : [],
    passthrough,
  }
}

function appendPassthrough(
  params: URLSearchParams,
  passthrough: readonly ViewFiltersPassthrough[],
): void {
  for (const [key, value] of passthrough) params.append(key, value)
}

/**
 * Compatibilidade de saída v1 para links/snapshots históricos. Fluxos novos
 * persistem o objeto v2 e usam `viewFilterUrl` somente na fronteira da URL.
 */
export function serializeViewFilters(document: ParsedViewFilters): string {
  const params = new URLSearchParams()

  params.append('v', LEGACY_VIEW_FILTERS_VERSION)
  for (const columnId of document.groupBy) {
    if (columnId.length > 0) params.append('group', columnId)
  }
  for (const filter of document.clauses) {
    params.append(
      'where',
      JSON.stringify({
        columnId: filter.columnId,
        condition: filter.condition,
        values: filter.values,
      } satisfies ViewFilterClause),
    )
  }
  appendPassthrough(params, document.passthrough)
  return params.toString()
}

/** Canonicaliza uma string legada sem eliminar pares desconhecidos. */
export function canonicalizeViewFilters(raw: string | null | undefined): string {
  return serializeViewFilters(parseViewFilters(raw))
}

/** Critérios visíveis; passthrough não é interpretado como filtro oculto. */
export function hasViewFilters(document: ParsedViewFilters): boolean {
  return document.clauses.length > 0 || document.groupBy.length > 0
}

function normalizedText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase()
}

function oneValue(values: readonly string[]): boolean {
  return values.length === 1
}

function twoValues(values: readonly string[]): boolean {
  return values.length === 2
}

function nonBlankValues(values: readonly string[]): boolean {
  return values.length > 0 && values.every((value) => value.trim().length > 0)
}

function parseFiniteNumber(value: string): number | null {
  if (value.trim().length === 0) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function numericValues(values: readonly string[]): number[] | null {
  const parsed = values.map(parseFiniteNumber)
  return parsed.every((value): value is number => value !== null) ? parsed : null
}

function parseBoolean(value: string): boolean | null {
  if (value === 'true') return true
  if (value === 'false') return false
  return null
}

interface DateInterval {
  start: number
  end: number
}

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/

function dateOperand(value: string): DateInterval | null {
  const instant = Date.parse(value)
  if (!Number.isFinite(instant)) return null

  if (DATE_ONLY.test(value)) {
    // `YYYY-MM-DD` representa o dia inteiro, e não somente meia-noite.
    return { start: instant, end: instant + 86_400_000 - 1 }
  }
  return { start: instant, end: instant }
}

function cellDateInterval(value: unknown): DateInterval | null {
  if (value instanceof Date) {
    const instant = value.getTime()
    return Number.isFinite(instant) ? { start: instant, end: instant } : null
  }
  if (typeof value !== 'string') return null

  const parts = value.includes('@') ? value.split('@') : [value]
  if (parts.length < 1 || parts.length > 2) return null
  const intervals = parts.map(dateOperand)
  if (intervals.some((interval) => interval === null)) return null

  const first = intervals[0]!
  const last = intervals[intervals.length - 1]!
  return {
    start: Math.min(first.start, last.start),
    end: Math.max(first.end, last.end),
  }
}

function dateValues(values: readonly string[]): DateInterval[] | null {
  const parsed = values.map(dateOperand)
  return parsed.every((value): value is DateInterval => value !== null) ? parsed : null
}

const textEquals: FilterConditionDefinition = {
  id: 'equals',
  input: 'text',
  arity: 1,
  accepts: oneValue,
  predicate: (cellValue, values) =>
    typeof cellValue === 'string' &&
    values.some((value) => normalizedText(cellValue) === normalizedText(value)),
}

const textContains: FilterConditionDefinition = {
  id: 'contains',
  input: 'text',
  arity: 1,
  accepts: (values) => oneValue(values) && values[0]!.length > 0,
  predicate: (cellValue, values) =>
    typeof cellValue === 'string' &&
    values.some((value) => normalizedText(cellValue).includes(normalizedText(value))),
}

const numericEquals: FilterConditionDefinition = {
  id: 'equals',
  input: 'number',
  arity: 1,
  accepts: (values) => oneValue(values) && numericValues(values) !== null,
  predicate: (cellValue, values) => {
    const expected = numericValues(values)
    return (
      typeof cellValue === 'number' &&
      Number.isFinite(cellValue) &&
      expected !== null &&
      expected.includes(cellValue)
    )
  },
}

const numericGreaterThan: FilterConditionDefinition = {
  id: 'greaterThan',
  input: 'number',
  arity: 1,
  accepts: (values) => oneValue(values) && numericValues(values) !== null,
  predicate: (cellValue, values) => {
    const expected = numericValues(values)?.[0]
    return (
      typeof cellValue === 'number' &&
      Number.isFinite(cellValue) &&
      expected !== undefined &&
      cellValue > expected
    )
  },
}

const numericLessThan: FilterConditionDefinition = {
  id: 'lessThan',
  input: 'number',
  arity: 1,
  accepts: (values) => oneValue(values) && numericValues(values) !== null,
  predicate: (cellValue, values) => {
    const expected = numericValues(values)?.[0]
    return (
      typeof cellValue === 'number' &&
      Number.isFinite(cellValue) &&
      expected !== undefined &&
      cellValue < expected
    )
  },
}

const selectEquals: FilterConditionDefinition = {
  id: 'equals',
  input: 'select',
  arity: 'many',
  accepts: nonBlankValues,
  predicate: (cellValue, values) =>
    typeof cellValue === 'string' && values.includes(cellValue),
}

const checkboxEquals: FilterConditionDefinition = {
  id: 'equals',
  input: 'checkbox',
  arity: 1,
  accepts: (values) => oneValue(values) && parseBoolean(values[0]!) !== null,
  predicate: (cellValue, values) =>
    typeof cellValue === 'boolean' && cellValue === parseBoolean(values[0] ?? ''),
}

const dateEquals: FilterConditionDefinition = {
  id: 'equals',
  input: 'date',
  arity: 1,
  accepts: (values) => oneValue(values) && dateValues(values) !== null,
  predicate: (cellValue, values) => {
    const cell = cellDateInterval(cellValue)
    const expected = dateValues(values)?.[0]
    return Boolean(cell && expected && cell.start <= expected.end && cell.end >= expected.start)
  },
}

const dateBetween: FilterConditionDefinition = {
  id: 'between',
  input: 'dateRange',
  arity: 2,
  accepts: (values) => twoValues(values) && dateValues(values) !== null,
  predicate: (cellValue, values) => {
    const cell = cellDateInterval(cellValue)
    const expected = dateValues(values)
    if (!cell || !expected) return false

    const start = Math.min(expected[0]!.start, expected[1]!.start)
    const end = Math.max(expected[0]!.end, expected[1]!.end)
    // Uma célula date pode ser um range; `between` usa sobreposição
    // inclusiva para não perder um evento que atravessa a borda do filtro.
    return cell.start <= end && cell.end >= start
  },
}

/**
 * Fonte única do comportamento por tipo. A exaustividade do `Record` faz uma
 * nova `ColumnDataType` falhar no typecheck até receber seu conjunto de filtros.
 */
export const mappedFilters = {
  text: {
    defaultCondition: 'contains',
    conditions: [textEquals, textContains],
  },
  numeric: {
    defaultCondition: 'equals',
    conditions: [numericEquals, numericGreaterThan, numericLessThan],
  },
  select: {
    defaultCondition: 'equals',
    conditions: [selectEquals],
  },
  date: {
    defaultCondition: 'equals',
    conditions: [dateEquals, dateBetween],
  },
  checkbox: {
    defaultCondition: 'equals',
    conditions: [checkboxEquals],
  },
} satisfies Record<ColumnDataType, FilterTypeDefinition>

export function getFilterCondition(
  type: ColumnDataType,
  condition: FilterCondition,
): FilterConditionDefinition | undefined {
  return mappedFilters[type].conditions.find((candidate) => candidate.id === condition)
}

/**
 * Uma cláusula incompatível/incompleta é tolerada como no restante do
 * snapshot: não esconde todas as linhas e pode ser podada na próxima edição.
 */
export function matchesViewFilter(
  row: RowData,
  column: HeaderCol,
  type: ColumnDataType,
  filter: ViewFilterClause,
): boolean {
  const definition = getFilterCondition(type, filter.condition)
  if (!definition || !definition.accepts(filter.values)) return true
  return definition.predicate(row.cells[column.id]?.value, filter.values, column)
}

interface CompiledFilter {
  filter: ViewFilterClause
  column: HeaderCol
  type: ColumnDataType
  definition: FilterConditionDefinition
}

/**
 * Aplica AND entre cláusulas. OR dentro de um filtro é responsabilidade do
 * predicate (hoje, principalmente os vários IDs de uma coluna select).
 * Coluna removida, condição incompatível ou valor incompleto são ignorados.
 */
export function applyViewFilters(
  rows: RowData[],
  columns: HeaderCol[],
  filters: readonly ViewFilterClause[],
): RowData[] {
  if (filters.length === 0) return rows

  const byColumnId = new Map(columns.map((column) => [column.id, column]))
  const types = resolveColumnTypes(columns, rows)
  const compiled: CompiledFilter[] = []

  for (const filter of filters) {
    const column = byColumnId.get(filter.columnId)
    const type = types[filter.columnId]
    if (!column || !type) continue

    const definition = getFilterCondition(type, filter.condition)
    if (!definition || !definition.accepts(filter.values)) continue
    compiled.push({ filter, column, type, definition })
  }

  if (compiled.length === 0) return rows
  return rows.filter((row) =>
    compiled.every(({ filter, column, definition }) =>
      definition.predicate(row.cells[column.id]?.value, filter.values, column),
    ),
  )
}
