import { getFilterCondition, parseViewFilters } from './viewFilters'
import {
  normalizePublicKey,
  resolvePublicKey,
  type PublicKeyResolution,
} from './publicKeys'
import type {
  DataViewSettings,
  FilterCondition,
  HeaderCol,
  PublicKeyMetadata,
  ViewFilterClause,
  ViewFiltersV2,
} from './types'

export const FILTER_URL_VERSION = '2' as const

export type PublicFilterCondition =
  | 'equals'
  | 'contains'
  | 'greater_than'
  | 'less_than'
  | 'between'

const TO_PUBLIC_CONDITION: Record<FilterCondition, PublicFilterCondition> = {
  equals: 'equals',
  contains: 'contains',
  greaterThan: 'greater_than',
  lessThan: 'less_than',
  between: 'between',
}

const FROM_PUBLIC_CONDITION: Record<PublicFilterCondition, FilterCondition> = {
  equals: 'equals',
  contains: 'contains',
  greater_than: 'greaterThan',
  less_than: 'lessThan',
  between: 'between',
}

const PUBLIC_CONDITIONS = new Set(Object.keys(FROM_PUBLIC_CONDITION))
const PUBLIC_KEY_PART = '[a-z0-9]+(?:_[a-z0-9]+)*'
const FILTER_CLAUSE_KEY = new RegExp(`^f(\\d*)\\.(${PUBLIC_KEY_PART})\\.([a-z_]+)$`)
/** Prefixo reservado de uma cláusula, inclusive quando o restante está malformado. */
const FILTER_CLAUSE_NAMESPACE_KEY = /^f\d*\./

export type FilterUrlValue = string | string[] | undefined
export type FilterUrlQuery = Record<string, unknown>
export type FilterUrlPatch = Record<string, FilterUrlValue>

export interface FilterUrlDiagnostic {
  kind: 'unknown' | 'ambiguous' | 'invalid'
  domain: 'view' | 'column' | 'option' | 'condition'
  key: string
}

export interface DecodeViewFilterUrlResult {
  explicit: boolean
  viewId?: string
  filters: ViewFiltersV2
  diagnostics: FilterUrlDiagnostic[]
  /** Alias, legado, lixo ou forma não-canônica exigem `replace`. */
  needsCanonicalReplace: boolean
}

function readText(value: unknown): string | undefined {
  if (Array.isArray(value)) return readText(value[0])
  if (value === null || value === undefined || value === '') return undefined
  if (typeof value === 'object') return undefined
  return String(value)
}

function readAll(value: unknown): string[] {
  const items = Array.isArray(value) ? value : [value]
  return items.map(readText).filter((item): item is string => item !== undefined)
}

function fallbackMetadata(label: string, fallback: 'coluna' | 'opcao' | 'view'): PublicKeyMetadata {
  return { key: normalizePublicKey(label, fallback), aliases: [] }
}

function viewCandidates(settings: DataViewSettings) {
  return Object.entries(settings).map(([id, view]) => ({
    value: id,
    publicKey: view.urlKey ?? fallbackMetadata(view.name, 'view'),
  }))
}

function resolveView(
  raw: string | undefined,
  settings: DataViewSettings,
): PublicKeyResolution<string> {
  if (!raw) return { status: 'unknown' }
  const byKey = resolvePublicKey(raw, viewCandidates(settings))
  if (byKey.status !== 'unknown') return byKey
  // Compatibilidade de URL v1: `view` era o ULID canônico.
  return settings[raw]
    ? { status: 'alias', value: raw, currentKey: settings[raw].urlKey.key }
    : byKey
}

function columnCandidates(
  settings: DataViewSettings,
  viewId: string,
  columns: readonly HeaderCol[],
) {
  const view = settings[viewId]
  return columns.map((column) => ({
    value: column,
    publicKey:
      (column.key === 'title'
        ? view?.title?.publicKey ?? column.publicKey
        : column.publicKey) ?? fallbackMetadata(column.title, 'coluna'),
  }))
}

function optionCandidates(column: HeaderCol) {
  return (column.options ?? []).map((option) => ({
    value: option.id,
    publicKey: option.publicKey ?? fallbackMetadata(option.label, 'opcao'),
  }))
}

function resolveColumn(
  key: string,
  candidates: ReturnType<typeof columnCandidates>,
): PublicKeyResolution<HeaderCol> {
  const resolved = resolvePublicKey(key, candidates)
  if (resolved.status !== 'unknown') return resolved
  // Compatibilidade v1: group/filtros podiam expor o id canônico.
  const byId = candidates.find((candidate) => candidate.value.id === key)
  return byId
    ? { status: 'alias', value: byId.value, currentKey: byId.publicKey.key }
    : resolved
}

function appendPatchValue(patch: FilterUrlPatch, key: string, values: string[]): void {
  if (values.length === 0) return
  patch[key] = values.length === 1 ? values[0] : values
}

/** Somente estas keys pertencem ao namespace de filtros v2. */
export function isViewFilterQueryKey(key: string): boolean {
  return (
    key === 'view' ||
    key === 'fv' ||
    key === 'group' ||
    key === 'filters' ||
    FILTER_CLAUSE_NAMESPACE_KEY.test(key)
  )
}

/** Converte IDs canônicos para keys legíveis; nunca emite ULID de entidade. */
export function encodeViewFiltersUrl(
  viewId: string,
  filters: ViewFiltersV2,
  settings: DataViewSettings,
  columns: readonly HeaderCol[],
): FilterUrlPatch {
  const view = settings[viewId]
  if (!view) return {}
  const viewKey = view.urlKey ?? fallbackMetadata(view.name, 'view')
  const candidates = columnCandidates(settings, viewId, columns)
  const byColumnId = new Map(candidates.map((candidate) => [candidate.value.id, candidate]))
  const patch: FilterUrlPatch = { view: viewKey.key, fv: FILTER_URL_VERSION }

  appendPatchValue(
    patch,
    'group',
    filters.groupBy.flatMap((id) => {
      const column = byColumnId.get(id)
      return column ? [column.publicKey.key] : []
    }),
  )

  const repetitions = new Map<string, number>()
  for (const clause of filters.clauses) {
    const column = byColumnId.get(clause.columnId)
    if (!column) continue
    const publicCondition = TO_PUBLIC_CONDITION[clause.condition]
    const pair = `${column.publicKey.key}\u0000${publicCondition}`
    const occurrence = repetitions.get(pair) ?? 0
    repetitions.set(pair, occurrence + 1)
    const prefix = occurrence === 0 ? 'f' : `f${occurrence}`
    const key = `${prefix}.${column.publicKey.key}.${publicCondition}`
    const values =
      column.value.type === 'select'
        ? clause.values.flatMap((optionId) => {
            const option = optionCandidates(column.value).find(
              (candidate) => candidate.value === optionId,
            )
            return option ? [option.publicKey.key] : []
          })
        : clause.values
    appendPatchValue(patch, key, values)
  }
  return patch
}

function diagnosticFromResolution(
  resolution: PublicKeyResolution<unknown>,
  domain: FilterUrlDiagnostic['domain'],
  key: string,
): FilterUrlDiagnostic | null {
  if (resolution.status === 'unknown') return { kind: 'unknown', domain, key }
  if (resolution.status === 'ambiguous') return { kind: 'ambiguous', domain, key }
  return null
}

function parseLegacyFiltersFromQuery(query: FilterUrlQuery): ViewFiltersV2 | null {
  const legacy = readText(query.filters)
  return legacy === undefined ? null : parseViewFilters(legacy)
}

/**
 * Resolve a URL para o documento interno com IDs. Entidade desconhecida é
 * podada; colisão fica diagnosticada e nunca escolhe a primeira candidata.
 */
export function decodeViewFiltersUrl(
  query: FilterUrlQuery,
  settings: DataViewSettings,
  columns: readonly HeaderCol[],
): DecodeViewFilterUrlResult {
  const diagnostics: FilterUrlDiagnostic[] = []
  const rawView = readText(query.view)
  const viewResolution = resolveView(rawView, settings)
  const viewDiagnostic = rawView
    ? diagnosticFromResolution(viewResolution, 'view', rawView)
    : null
  if (viewDiagnostic) diagnostics.push(viewDiagnostic)
  const viewId = viewResolution.value
  const legacy = parseLegacyFiltersFromQuery(query)
  const hasV2Namespace =
    readText(query.fv) !== undefined ||
    readAll(query.group).length > 0 ||
    Object.keys(query).some((key) => FILTER_CLAUSE_NAMESPACE_KEY.test(key))
  const explicit = legacy !== null || hasV2Namespace

  if (!viewId) {
    return {
      explicit,
      filters: legacy ?? emptyFromSaved(undefined),
      diagnostics,
      needsCanonicalReplace: diagnostics.length > 0 || legacy !== null,
    }
  }

  if (legacy) {
    return {
      explicit: true,
      viewId,
      filters: legacy,
      diagnostics,
      needsCanonicalReplace: true,
    }
  }

  const saved = settings[viewId]?.filters
  if (!hasV2Namespace) {
    return {
      explicit: false,
      viewId,
      filters: saved ?? emptyFromSaved(undefined),
      diagnostics,
      needsCanonicalReplace: viewResolution.status === 'alias',
    }
  }

  const candidates = columnCandidates(settings, viewId, columns)
  const clauses: ViewFilterClause[] = []
  const groups: string[] = []
  let canonical =
    readText(query.fv) !== FILTER_URL_VERSION || viewResolution.status === 'alias'

  for (const key of readAll(query.group)) {
    const resolution = resolveColumn(key, candidates)
    const diagnostic = diagnosticFromResolution(resolution, 'column', key)
    if (diagnostic) {
      diagnostics.push(diagnostic)
      canonical = true
      continue
    }
    if (resolution.status === 'alias') canonical = true
    const columnId = resolution.value!.id
    if (!groups.includes(columnId)) groups.push(columnId)
    else canonical = true
  }

  for (const [queryKey, rawValues] of Object.entries(query)) {
    if (!FILTER_CLAUSE_NAMESPACE_KEY.test(queryKey)) continue
    const match = FILTER_CLAUSE_KEY.exec(queryKey)
    if (!match) {
      diagnostics.push({ kind: 'invalid', domain: 'condition', key: queryKey })
      canonical = true
      continue
    }
    const [, , columnKey, conditionKey] = match
    if (!PUBLIC_CONDITIONS.has(conditionKey)) {
      diagnostics.push({ kind: 'invalid', domain: 'condition', key: conditionKey })
      canonical = true
      continue
    }

    const resolution = resolveColumn(columnKey, candidates)
    const diagnostic = diagnosticFromResolution(resolution, 'column', columnKey)
    if (diagnostic) {
      diagnostics.push(diagnostic)
      canonical = true
      continue
    }
    const column = resolution.value!
    const condition = FROM_PUBLIC_CONDITION[conditionKey as PublicFilterCondition]
    const type = column.key === 'title' ? 'text' : column.type
    if (!type || !getFilterCondition(type, condition)) {
      diagnostics.push({ kind: 'invalid', domain: 'condition', key: conditionKey })
      canonical = true
      continue
    }

    let values = readAll(rawValues)
    if (column.type === 'select') {
      const options = optionCandidates(column)
      values = values.flatMap((optionKey) => {
        const option = resolvePublicKey(optionKey, options)
        const optionDiagnostic = diagnosticFromResolution(option, 'option', optionKey)
        if (optionDiagnostic) {
          diagnostics.push(optionDiagnostic)
          canonical = true
          return []
        }
        if (option.status === 'alias') canonical = true
        return [option.value!]
      })
    }
    const definition = getFilterCondition(type, condition)
    if (values.length === 0 || !definition?.accepts(values)) {
      diagnostics.push({ kind: 'invalid', domain: 'condition', key: conditionKey })
      canonical = true
      continue
    }
    clauses.push({ columnId: column.id, condition, values })
    if (resolution.status === 'alias') canonical = true
  }

  return {
    explicit: true,
    viewId,
    filters: {
      version: 2,
      updatedAt: saved?.updatedAt ?? null,
      clauses,
      groupBy: groups,
      passthrough: saved?.passthrough ?? [],
    },
    diagnostics,
    needsCanonicalReplace: canonical || diagnostics.length > 0,
  }
}

function emptyFromSaved(saved: ViewFiltersV2 | undefined): ViewFiltersV2 {
  return saved ?? { version: 2, updatedAt: null, clauses: [], groupBy: [], passthrough: [] }
}

/** Estável para comparação: updatedAt e ordem interna de values não mudam semântica. */
export function viewFiltersSemanticSignature(filters: ViewFiltersV2): string {
  const clauses = filters.clauses
    .map((clause) => ({
      columnId: clause.columnId,
      condition: clause.condition,
      values: [...clause.values].sort(),
    }))
    .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)))
  return JSON.stringify({ groupBy: filters.groupBy, clauses })
}
