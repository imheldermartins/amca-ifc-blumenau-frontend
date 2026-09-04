import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import {
  decodeViewFiltersUrl,
  encodeViewFiltersUrl,
  getFilterCondition,
  hasViewFilters,
  isViewFilterQueryKey,
  viewFiltersSemanticSignature,
  type DataViewSettings,
  type FilterUrlDiagnostic,
  type HeaderCol,
  type ViewFiltersV2,
} from 'cubs-database'

import { useQueryParams } from '@/hooks/useQueryParams'
import { replaceQueryNamespace, type QueryPatch, type QueryRecord } from '@/lib/queryParams'
import {
  ViewFiltersWriteCoordinator,
  type ViewFiltersWriteFailure,
  type ViewFiltersWriteResult,
} from '@/lib/viewFiltersWriteCoordinator'

export { viewFiltersSemanticSignature } from 'cubs-database'

export type DatabaseViewFiltersSyncStatus =
  | 'confirmed'
  | 'saving'
  | 'remote-pending'
  | 'error'

export interface DatabaseViewFiltersSync {
  status: DatabaseViewFiltersSyncStatus
  /** Timestamp do último documento confirmado (ou da alteração remota pendente). */
  updatedAt: string | null
  error?: unknown
  /** Adota o snapshot remoto sem gerar outro PUT. */
  applyRemote: () => void
  /** Reaplica o último documento que falhou. */
  retry: () => void
}

export interface UseDatabaseViewQueryOptions {
  settings: DataViewSettings
  columns: readonly HeaderCol[]
  /** Tab escolhida localmente quando a URL ainda não aponta uma view válida. */
  preferredViewId: string
  /** Evita compartilhar debounce/rollback entre páginas durante navegação. */
  scopeKey?: string
  /** Retorne o documento carimbado/prunado pelo servidor sempre que disponível. */
  onPersistFilters: (
    viewId: string,
    filters: ViewFiltersV2,
  ) => void | ViewFiltersV2 | Promise<void | ViewFiltersV2>
}

export interface UseDatabaseViewQueryResult {
  activeViewId: string
  requestedViewId?: string
  /** URL explícita vence o snapshot; o estado em memória é sempre v2. */
  effectiveFilters: ViewFiltersV2
  /** Pergunta somente se a pessoa quer persistir a substituição já visível. */
  conflict: boolean
  diagnostics: FilterUrlDiagnostic[]
  sync: DatabaseViewFiltersSync
  acceptPersistence: () => void
  rejectPersistence: () => void
  changeLocal: (viewId: string, filters: ViewFiltersV2) => void
  changeView: (viewId: string) => void
}

interface InternalState {
  key: string
  viewId: string
  filters: ViewFiltersV2
  status: DatabaseViewFiltersSyncStatus
  updatedAt: string | null
  remote?: ViewFiltersV2
  failed?: ViewFiltersV2
  error?: unknown
}

interface ViewResolution {
  activeViewId: string
  requestedViewId?: string
  filters: ViewFiltersV2
  explicit: boolean
  diagnostics: FilterUrlDiagnostic[]
  needsCanonicalReplace: boolean
}

interface PrunedViewFilters {
  filters: ViewFiltersV2
  changed: boolean
}

function cloneFilters(filters: ViewFiltersV2): ViewFiltersV2 {
  return {
    version: 2,
    updatedAt: filters.updatedAt,
    clauses: filters.clauses.map((clause) => ({
      columnId: clause.columnId,
      condition: clause.condition,
      values: [...clause.values],
    })),
    groupBy: [...filters.groupBy],
    passthrough: filters.passthrough.map(([key, value]) => [key, value]),
  }
}

/** Remove referências que o catálogo atual já não consegue representar. */
function pruneViewFilters(
  filters: ViewFiltersV2,
  columns: readonly HeaderCol[],
): PrunedViewFilters {
  const byId = new Map(columns.map((column) => [column.id, column]))
  const seenGroups = new Set<string>()
  const groupBy = filters.groupBy.filter((columnId) => {
    if (!byId.has(columnId) || seenGroups.has(columnId)) return false
    seenGroups.add(columnId)
    return true
  })
  let changed = groupBy.length !== filters.groupBy.length

  const clauses = filters.clauses.flatMap((clause) => {
    const column = byId.get(clause.columnId)
    const type = column?.key === 'title' ? 'text' : column?.type
    if (!column || !type) {
      changed = true
      return []
    }

    const definition = getFilterCondition(type, clause.condition)
    if (!definition) {
      changed = true
      return []
    }

    let values = clause.values
    if (type === 'select') {
      const optionIds = new Set((column.options ?? []).map((option) => option.id))
      values = [...new Set(clause.values.filter((optionId) => optionIds.has(optionId)))]
      if (
        values.length !== clause.values.length ||
        values.some((value, index) => value !== clause.values[index])
      ) {
        changed = true
      }
    }

    if (!definition.accepts(values)) {
      changed = true
      return []
    }
    return values === clause.values ? [clause] : [{ ...clause, values }]
  })

  return changed
    ? {
        changed: true,
        filters: {
          ...filters,
          clauses,
          groupBy,
        },
      }
    : { changed: false, filters }
}

function filterCatalogFingerprint(columns: readonly HeaderCol[]): string {
  return JSON.stringify(
    columns.map((column) => ({
      id: column.id,
      type: column.key === 'title' ? 'text' : column.type,
      options: column.options?.map((option) => option.id) ?? [],
    })),
  )
}

function stateKey(scopeKey: string | undefined, viewId: string): string {
  return `${scopeKey ?? ''}\u0000${viewId}`
}

function resolutionScope(key: string, filters: ViewFiltersV2): string {
  return `${key}\u0000${viewFiltersSemanticSignature(filters)}`
}

function normalizeQueryValue(value: unknown): string[] {
  const values = Array.isArray(value) ? value : [value]
  return values
    .filter((item) => item !== null && item !== undefined && item !== '')
    .map((item) => String(item))
}

/** Comparação estável inclusive quando o router coage `fv=2` para number. */
function queryFingerprint(query: Readonly<QueryRecord>): string {
  return JSON.stringify(
    Object.keys(query)
      .sort()
      .flatMap((key) => {
        const values = normalizeQueryValue(query[key])
        return values.length > 0 ? [[key, values] as const] : []
      }),
  )
}

function buildResolution(
  query: Readonly<QueryRecord>,
  settings: DataViewSettings,
  columns: readonly HeaderCol[],
  preferredViewId: string,
): ViewResolution {
  const firstPass = decodeViewFiltersUrl(query, settings, columns)
  const fallbackViewId = settings[preferredViewId]
    ? preferredViewId
    : Object.keys(settings)[0] ?? ''
  const activeViewId = firstPass.viewId ?? fallbackViewId
  const requestedViewId = firstPass.viewId

  if (!activeViewId) {
    return {
      activeViewId: '',
      requestedViewId,
      filters: { version: 2, updatedAt: null, clauses: [], groupBy: [], passthrough: [] },
      explicit: firstPass.explicit,
      diagnostics: firstPass.diagnostics,
      needsCanonicalReplace: firstPass.needsCanonicalReplace,
    }
  }

  // `fv`/`filters` sem `view` continuam soberanos sobre a view fallback.
  const activeKey = settings[activeViewId]!.urlKey.key
  const resolved = firstPass.viewId
    ? firstPass
    : decodeViewFiltersUrl({ ...query, view: activeKey }, settings, columns)
  const diagnostics = [
    ...firstPass.diagnostics,
    ...resolved.diagnostics.filter(
      (candidate) =>
        !firstPass.diagnostics.some(
          (existing) =>
            existing.kind === candidate.kind &&
            existing.domain === candidate.domain &&
            existing.key === candidate.key,
        ),
    ),
  ]
  const saved = settings[activeViewId]!.filters

  return {
    activeViewId,
    requestedViewId,
    filters: cloneFilters(resolved.explicit ? resolved.filters : saved),
    explicit: resolved.explicit,
    diagnostics,
    needsCanonicalReplace:
      firstPass.needsCanonicalReplace ||
      resolved.needsCanonicalReplace ||
      !firstPass.viewId,
  }
}

function timestampIsOlder(candidate: string | null, baseline: string | null): boolean {
  if (!candidate || !baseline) return false
  const candidateTime = Date.parse(candidate)
  const baselineTime = Date.parse(baseline)
  return Number.isFinite(candidateTime) && Number.isFinite(baselineTime)
    ? candidateTime < baselineTime
    : false
}

/**
 * Ponte app-level entre snapshot e URL. A lib continua sem conhecer router;
 * este hook é a fronteira keys públicas ↔ IDs canônicos e também coordena os
 * writes atômicos da configuração de filtros da view.
 */
export function useDatabaseViewQuery({
  settings,
  columns,
  preferredViewId,
  scopeKey,
  onPersistFilters,
}: UseDatabaseViewQueryOptions): UseDatabaseViewQueryResult {
  const query = useQueryParams<string>()
  const queryAll = query.all
  const currentQueryFingerprint = queryFingerprint(queryAll)
  const resolution = useMemo(
    () => buildResolution(queryAll, settings, columns, preferredViewId),
    [columns, preferredViewId, queryAll, settings],
  )
  const key = stateKey(scopeKey, resolution.activeViewId)
  const activeKeyRef = useRef(key)
  activeKeyRef.current = key
  const savedFilters = settings[resolution.activeViewId]?.filters
  const initialState = useMemo<InternalState>(
    () => ({
      key,
      viewId: resolution.activeViewId,
      filters: resolution.filters,
      status: 'confirmed',
      updatedAt: savedFilters?.updatedAt ?? resolution.filters.updatedAt,
    }),
    [key, resolution.activeViewId, resolution.filters, savedFilters?.updatedAt],
  )
  const [internal, setInternal] = useState<InternalState>(initialState)
  const rendered = internal.key === key ? internal : initialState
  const pruning = useMemo(
    () => pruneViewFilters(rendered.filters, columns),
    [columns, rendered.filters],
  )
  const currentState = pruning.changed
    ? { ...rendered, filters: pruning.filters }
    : rendered
  const internalRef = useRef(currentState)
  internalRef.current = currentState

  const coordinatorRef = useRef<ViewFiltersWriteCoordinator | null>(null)
  if (!coordinatorRef.current) coordinatorRef.current = new ViewFiltersWriteCoordinator(250)
  const confirmedRef = useRef(new Map<string, ViewFiltersV2>())
  const desiredSignatureRef = useRef(new Map<string, string>())
  const previousSavedRef = useRef(new Map<string, string>())
  const expectedQueryRef = useRef<string | null>(null)
  const lastSeenQueryRef = useRef<string | null>(null)
  const previousKeyRef = useRef(key)
  const cleanupSourceRef = useRef(new Map<string, string>())
  const [resolvedConflictScope, setResolvedConflictScope] = useState<string | null>(null)

  if (savedFilters && !confirmedRef.current.has(key)) {
    confirmedRef.current.set(key, cloneFilters(savedFilters))
  }

  const writeUrl = useCallback(
    (viewId: string, filters: ViewFiltersV2, replace: boolean) => {
      if (!settings[viewId]) return
      const patch = encodeViewFiltersUrl(viewId, filters, settings, columns) as QueryPatch<string>
      const next = replaceQueryNamespace(queryAll, isViewFilterQueryKey, patch)
      const nextFingerprint = queryFingerprint(next)
      if (nextFingerprint === currentQueryFingerprint) {
        expectedQueryRef.current = null
        return
      }
      expectedQueryRef.current = nextFingerprint
      query.replaceNamespace(isViewFilterQueryKey, patch, { replace })
    },
    [columns, currentQueryFingerprint, query, queryAll, settings],
  )

  const applyConfirmedWrite = useCallback(
    (writeKey: string, result: ViewFiltersWriteResult) => {
      const confirmed = cloneFilters(result.confirmed ?? result.submitted)
      confirmedRef.current.set(writeKey, confirmed)
      if (!result.latest) return

      desiredSignatureRef.current.delete(writeKey)
      setInternal((current) => {
        if (current.key !== writeKey) return current
        return {
          key: writeKey,
          viewId: result.viewId,
          filters: confirmed,
          status: 'confirmed',
          updatedAt: confirmed.updatedAt,
        }
      })
      // A request pode terminar depois de uma troca de página/view. O cache
      // confirmado da origem ainda deve avançar, mas a resposta antiga não
      // tem autoridade para navegar a URL do scope que está aberto agora.
      if (activeKeyRef.current === writeKey) {
        writeUrl(result.viewId, confirmed, true)
      }
    },
    [writeUrl],
  )

  const applyFailedWrite = useCallback(
    (writeKey: string, failure: ViewFiltersWriteFailure) => {
      if (!failure.latest) return
      desiredSignatureRef.current.delete(writeKey)
      const confirmed =
        confirmedRef.current.get(writeKey) ??
        settings[failure.viewId]?.filters ??
        failure.submitted
      const rollback = cloneFilters(confirmed)
      setInternal((current) => {
        if (current.key !== writeKey) return current
        return {
          key: writeKey,
          viewId: failure.viewId,
          filters: rollback,
          status: 'error',
          updatedAt: rollback.updatedAt,
          failed: cloneFilters(failure.submitted),
          error: failure.error,
        }
      })
      if (activeKeyRef.current === writeKey) {
        writeUrl(failure.viewId, rollback, true)
      }
    },
    [settings, writeUrl],
  )

  const enqueue = useCallback(
    (viewId: string, document: ViewFiltersV2) => {
      const writeKey = stateKey(scopeKey, viewId)
      const filters = cloneFilters(document)
      desiredSignatureRef.current.set(writeKey, viewFiltersSemanticSignature(filters))
      setInternal((current) => ({
        ...(current.key === writeKey
          ? current
          : {
              key: writeKey,
              viewId,
              filters,
              updatedAt: confirmedRef.current.get(writeKey)?.updatedAt ?? filters.updatedAt,
            }),
        filters,
        status: 'saving',
        remote: undefined,
        failed: undefined,
        error: undefined,
      }))
      coordinatorRef.current!.schedule({
        key: writeKey,
        viewId,
        filters,
        submit: async (submittedViewId, submittedFilters) =>
          (await onPersistFilters(submittedViewId, submittedFilters)) || undefined,
        onSuccess: (result) => applyConfirmedWrite(writeKey, result),
        onError: (failure) => applyFailedWrite(writeKey, failure),
      })
    },
    [applyConfirmedWrite, applyFailedWrite, onPersistFilters, scopeKey],
  )

  // Alterações de catálogo (inclusive realtime) podem tornar IDs persistidos
  // órfãos. A UI adota a poda imediatamente; URL e banco recebem uma única
  // versão canônica por documento+catálogo de origem.
  useEffect(() => {
    if (!pruning.changed || !resolution.activeViewId) return
    const source = `${JSON.stringify(rendered.filters)}\u0000${filterCatalogFingerprint(columns)}`
    if (cleanupSourceRef.current.get(key) === source) return
    cleanupSourceRef.current.set(key, source)
    setResolvedConflictScope(resolutionScope(key, pruning.filters))
    writeUrl(resolution.activeViewId, pruning.filters, true)
    enqueue(resolution.activeViewId, pruning.filters)
  }, [columns, enqueue, key, pruning, rendered.filters, resolution.activeViewId, writeUrl])

  // Trocar página/view força o flush da última versão do scope anterior.
  useEffect(() => {
    const previousKey = previousKeyRef.current
    if (previousKey !== key) {
      coordinatorRef.current!.flush(previousKey)
      previousKeyRef.current = key
      setInternal(initialState)
      setResolvedConflictScope(null)
    }
  }, [initialState, key])

  useEffect(
    () => () => {
      coordinatorRef.current?.destroy({ flushPending: true })
    },
    [],
  )

  // Back/forward ou URL colada é soberana. Navegações disparadas por este
  // hook são reconhecidas pelo fingerprint e não desfazem o estado otimista.
  useEffect(() => {
    const previous = lastSeenQueryRef.current
    lastSeenQueryRef.current = currentQueryFingerprint
    if (previous === null || previous === currentQueryFingerprint) return
    if (expectedQueryRef.current === currentQueryFingerprint) {
      expectedQueryRef.current = null
      return
    }

    const nextState: InternalState = {
      key,
      viewId: resolution.activeViewId,
      filters: resolution.filters,
      status: 'confirmed',
      updatedAt: savedFilters?.updatedAt ?? resolution.filters.updatedAt,
    }
    setInternal(nextState)
    setResolvedConflictScope(null)
  }, [currentQueryFingerprint, key, resolution, savedFilters?.updatedAt])

  // Sempre deixa a URL copiável/canônica. Alias, ULID legado e critérios
  // removidos usam replace e não criam uma entrada artificial no histórico.
  useEffect(() => {
    if (!resolution.activeViewId) return
    const patch = encodeViewFiltersUrl(
      resolution.activeViewId,
      currentState.filters,
      settings,
      columns,
    ) as QueryPatch<string>
    const target = queryFingerprint(
      replaceQueryNamespace(queryAll, isViewFilterQueryKey, patch),
    )
    if (target === currentQueryFingerprint || expectedQueryRef.current === target) return
    writeUrl(resolution.activeViewId, currentState.filters, true)
  }, [
    columns,
    currentQueryFingerprint,
    queryAll,
    currentState.filters,
    resolution.activeViewId,
    resolution.needsCanonicalReplace,
    settings,
    writeUrl,
  ])

  // Realtime altera `settings`. Somente o documento de filtros participa
  // desta comparação: largura, ordem ou título não abrem aviso.
  useEffect(() => {
    if (!savedFilters || !resolution.activeViewId) return
    const savedFingerprint = JSON.stringify(savedFilters)
    const previous = previousSavedRef.current.get(key)
    previousSavedRef.current.set(key, savedFingerprint)
    if (previous === undefined || previous === savedFingerprint) return

    const confirmed = confirmedRef.current.get(key)
    if (confirmed && timestampIsOlder(savedFilters.updatedAt, confirmed.updatedAt)) return

    const savedSignature = viewFiltersSemanticSignature(savedFilters)
    const desiredSignature = desiredSignatureRef.current.get(key)
    const effectiveSignature = viewFiltersSemanticSignature(internalRef.current.filters)
    const prunedSaved = pruneViewFilters(savedFilters, columns)

    // Um column-updated pode invalidar referências antes de o snapshot de
    // filtros ser corrigido. Nesse intervalo, a versão podada localmente é a
    // limpeza desejada, não uma divergência remota que deva ser reaplicada.
    if (
      prunedSaved.changed &&
      effectiveSignature === viewFiltersSemanticSignature(prunedSaved.filters)
    ) {
      return
    }

    if (desiredSignature === savedSignature) {
      // O snapshot otimista normalmente preserva o timestamp anterior. O eco
      // só confirma quando traz um carimbo autoritativo diferente.
      if (savedFilters.updatedAt && savedFilters.updatedAt !== confirmed?.updatedAt) {
        const echoed = cloneFilters(savedFilters)
        confirmedRef.current.set(key, echoed)
        desiredSignatureRef.current.delete(key)
        setInternal((current) =>
          current.key === key
            ? {
                key,
                viewId: resolution.activeViewId,
                filters: echoed,
                status: 'confirmed',
                updatedAt: echoed.updatedAt,
              }
            : current,
        )
      }
      return
    }

    if (effectiveSignature === savedSignature) {
      const echoed = cloneFilters(savedFilters)
      confirmedRef.current.set(key, echoed)
      setInternal((current) =>
        current.key === key
          ? {
              ...current,
              filters: echoed,
              updatedAt: echoed.updatedAt,
              status: current.status === 'saving' ? current.status : 'confirmed',
            }
          : current,
      )
      return
    }

    const remote = cloneFilters(savedFilters)
    setInternal((current) =>
      current.key === key
        ? {
            ...current,
            status: 'remote-pending',
            updatedAt: remote.updatedAt,
            remote,
            error: undefined,
          }
        : current,
    )
  }, [columns, key, resolution.activeViewId, savedFilters])

  const currentConflictScope = resolutionScope(key, currentState.filters)
  const savedHasCriteria = Boolean(savedFilters && hasViewFilters(savedFilters))
  const differsFromSaved = Boolean(
    savedFilters &&
      viewFiltersSemanticSignature(currentState.filters) !==
        viewFiltersSemanticSignature(savedFilters),
  )
  const conflict = Boolean(
    resolution.activeViewId &&
      resolution.explicit &&
      savedHasCriteria &&
      differsFromSaved &&
      resolvedConflictScope !== currentConflictScope,
  )

  const acceptPersistence = useCallback(() => {
    if (!currentState.viewId) return
    setResolvedConflictScope(currentConflictScope)
    enqueue(currentState.viewId, currentState.filters)
  }, [currentConflictScope, currentState.filters, currentState.viewId, enqueue])

  const rejectPersistence = useCallback(() => {
    // O snapshot permanece intacto; a URL continua soberana nesta navegação.
    setResolvedConflictScope(currentConflictScope)
  }, [currentConflictScope])

  const changeLocal = useCallback(
    (viewId: string, filters: ViewFiltersV2) => {
      if (!settings[viewId]) return
      const document = cloneFilters(filters)
      const writeKey = stateKey(scopeKey, viewId)
      setResolvedConflictScope(resolutionScope(writeKey, document))
      enqueue(viewId, document)
      writeUrl(viewId, document, false)
    },
    [enqueue, scopeKey, settings, writeUrl],
  )

  const changeView = useCallback(
    (viewId: string) => {
      const view = settings[viewId]
      if (!view) return
      coordinatorRef.current!.flush(key)
      const nextKey = stateKey(scopeKey, viewId)
      activeKeyRef.current = nextKey
      const filters = cloneFilters(view.filters)
      confirmedRef.current.set(nextKey, filters)
      setInternal({
        key: nextKey,
        viewId,
        filters,
        status: 'confirmed',
        updatedAt: filters.updatedAt,
      })
      setResolvedConflictScope(resolutionScope(nextKey, filters))
      writeUrl(viewId, filters, false)
    },
    [key, scopeKey, settings, writeUrl],
  )

  const applyRemote = useCallback(() => {
    const current = internalRef.current
    if (!current.remote) return
    coordinatorRef.current?.cancel(current.key)
    const remote = cloneFilters(current.remote)
    confirmedRef.current.set(current.key, remote)
    desiredSignatureRef.current.delete(current.key)
    setInternal({
      key: current.key,
      viewId: current.viewId,
      filters: remote,
      status: 'confirmed',
      updatedAt: remote.updatedAt,
    })
    setResolvedConflictScope(resolutionScope(current.key, remote))
    writeUrl(current.viewId, remote, false)
  }, [writeUrl])

  const retry = useCallback(() => {
    const current = internalRef.current
    if (!current.failed) return
    const failed = cloneFilters(current.failed)
    writeUrl(current.viewId, failed, false)
    enqueue(current.viewId, failed)
  }, [enqueue, writeUrl])

  return useMemo(
    () => ({
      activeViewId: resolution.activeViewId,
      requestedViewId: resolution.requestedViewId,
      effectiveFilters: currentState.filters,
      conflict,
      diagnostics: resolution.diagnostics,
      sync: {
        status: currentState.status,
        updatedAt: currentState.updatedAt,
        error: currentState.error,
        applyRemote,
        retry,
      },
      acceptPersistence,
      rejectPersistence,
      changeLocal,
      changeView,
    }),
    [
      acceptPersistence,
      applyRemote,
      changeLocal,
      changeView,
      conflict,
      rejectPersistence,
      currentState.error,
      currentState.filters,
      currentState.status,
      currentState.updatedAt,
      resolution.activeViewId,
      resolution.diagnostics,
      resolution.requestedViewId,
      retry,
    ],
  )
}
