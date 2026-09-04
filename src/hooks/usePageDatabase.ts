import { useCallback, useEffect, useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import {
  cellErrorKey,
  ulid,
  type CellChange,
  type CellEditConflict,
  type ColumnConfigPatch,
  type ColumnDataType,
  type ColumnOption,
  type DataViewSettings,
  type DataViewType,
  type PageTitleColumn,
  type ViewFiltersV2,
} from 'cubs-database'

import { useFeedback } from '@/contexts/FeedbackContext'
import type { UsePageRealtimeOptions } from '@/hooks/usePageRealtime'
import {
  applyLocalCellChange,
  applyLocalColumnCreated,
  applyLocalColumnConfig,
  applyLocalColumnOptions,
  applyLocalColumnRename,
  applyLocalColumnType,
  applyRealtimeEvent,
  type RealtimeClock,
} from '@/lib/databaseRealtime'
import { FALLBACK_VIEW_ID, TITLE_COLUMN_ID, type ParsedDatabase } from '@/lib/databaseParser'
import { classifyWriteError } from '@/lib/errors'
import { i18n } from '@/lib/i18n'
import { databaseService } from '@/services/DatabaseService'
import type {
  PageRealtimeChannel,
  PageStructureEvent,
} from '@/services/PageRealtimeChannel'
import { pageWriteService } from '@/services/PageWriteService'

const COLUMN_RESIZE_PREVIEW_TTL_MS = 2_000

/**
 * Set imutável: devolve a MESMA referência quando nada muda (para não custar
 * um re-render à toa) e um Set novo quando muda.
 */
function toggleKey(set: Set<string>, key: string, present: boolean): Set<string> {
  if (present === set.has(key)) return set
  const next = new Set(set)
  if (present) next.add(key)
  else next.delete(key)
  return next
}

function structureClockKey(event: PageStructureEvent): string {
  const targetId =
    event.type === 'row-created' || event.type === 'row-deleted'
      ? event.payload.rowId
      : event.payload.columnId
  return `structure:${event.type}:${targetId}`
}

export interface UsePageDatabaseResult {
  database: ParsedDatabase | null
  loading: boolean
  failed: boolean
  /** Repasse para o `<PageShell>`: é ele quem assina a sala. */
  realtimeOptions: UsePageRealtimeOptions
  /** Larguras efêmeras recebidas; não fazem parte do snapshot persistido. */
  columnWidthPreviews: Record<string, Record<string, number>>
  /**
   * Células em estado de atenção (chave `cellErrorKey`): escrita falhou ou o
   * receiver interrompeu uma edição simultânea. É a marca visual vermelha.
   */
  cellErrors: Set<string>
  /** Handlers prontos para a `<CubsDatabase />`. */
  handlers: {
    onAddRow: () => void
    onAddColumn: () => void
    onCellChange: (change: CellChange) => void
    onCellEditConflict: (conflict: CellEditConflict) => void
    onColumnOptionsChange: (columnId: string, options: ColumnOption[]) => void
    onColumnRename: (columnId: string, name: string) => void
    onPageTitleColumnChange: (viewId: string, column: PageTitleColumn) => void
    onColumnTypeChange: (columnId: string, type: ColumnDataType) => void
    onColumnConfigChange: (columnId: string, patch: ColumnConfigPatch) => void
    onColumnReset: (columnId: string) => void
    onRowOrderChange: (viewId: string, orderedRows: string[]) => void
    onColumnOrderChange: (viewId: string, orderedHeaderCols: string[]) => void
    onColumnWidthChange: (viewId: string, columnWidths: Record<string, number>) => void
    onColumnWidthPreview: (viewId: string, columnId: string, width: number) => void
    onViewFiltersChange: (viewId: string, filters: ViewFiltersV2) => Promise<ViewFiltersV2>
  }
}

/**
 * A base de UMA página, ponta a ponta: leitura, escrita e sincronização.
 *
 * O fluxo de uma edição é sempre o mesmo triângulo:
 *
 *   1. o componente muda a UI na hora (otimismo local da própria lib);
 *   2. este hook manda a escrita por **HTTP** — quem grava é sempre a API
 *      (router → rqlite, no líder do Raft). O socket NUNCA escreve;
 *   3. o backend, DEPOIS do commit, propaga o fato para a sala; os outros
   *      aplicam pelo redutor puro (`applyRealtimeEvent`), inclusive quem
   *      originou (o próprio eco sela o relógio autoritativo).
 *
 * O estado é UM `ParsedDatabase` por página, e não um cache por célula como o
 * doc de arquitetura descreve (§6). É uma escolha consciente para esta etapa:
 * na escala do protótipo o custo de re-render é irrelevante, e a regra de
 * merge já está isolada num redutor puro — migrar para chaves por célula vira
 * um passo mecânico, sem tocar em componente.
 */
export function usePageDatabase(pageId: string | undefined): UsePageDatabaseResult {
  const feedback = useFeedback()
  const [database, setDatabase] = useState<ParsedDatabase | null>(null)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  // Células em atenção — escrita falhou ou edição foi interrompida pelo receiver.
  const [cellErrors, setCellErrors] = useState<Set<string>>(() => new Set())
  const [columnWidthPreviews, setColumnWidthPreviews] = useState<
    Record<string, Record<string, number>>
  >({})
  // Revisão monotônica por célula. Duas mutações da mesma célula podem ficar
  // em voo ao mesmo tempo; uma falha ANTIGA não tem autoridade para desfazer
  // o otimismo de uma edição mais nova. O Map fica em ref porque coordena
  // callbacks assíncronos, mas não desenha nada.
  const cellMutationRevisionsRef = useRef<Map<string, number>>(new Map())
  // A revisão continua protegendo troca de página/unmount e qualquer resposta
  // obsoleta. O coalescer abaixo impede sobreposição normal: há no máximo
  // uma carga em voo e uma nova passagem pendente.
  const loadRevisionRef = useRef(0)
  const loadInFlightRef = useRef<Promise<void> | null>(null)
  const loadQueuedRef = useRef(false)
  const loadScopeRef = useRef(0)
  const loadScopePageIdRef = useRef<string | undefined>(undefined)
  // Distingue a primeira leitura da página (skeleton) das ressincronizações
  // sobre uma base já utilizável, que devem acontecer sem desmontar a tabela.
  const loadedPageIdRef = useRef<string | undefined>(undefined)
  const mountedRef = useRef(true)
  const currentPageIdRef = useRef(pageId)
  currentPageIdRef.current = pageId

  // Relógio de sincronização (último `updatedAt` por célula/coluna/view). Ref
  // e não state: ele decide se um evento entra, mas não desenha nada — virar
  // state só somaria um render por evento descartado.
  const clockRef = useRef<RealtimeClock>({})
  // Espelho canônico das views usado pelos patches por view, pelos filtros e
  // pela materialização inicial do fallback. Escritas normais não reenviam o
  // `pages.data` inteiro.
  const settingsRef = useRef<DataViewSettings>({})
  // A view fallback é uma sentinela estável de leitura, mas não é um ULID
  // válido. A primeira personalização materializa uma view real e este ref
  // mantém a tradução disponível para callbacks do render anterior.
  const materializedFallbackRef = useRef<{ pageId?: string; viewId?: string }>({ pageId })
  // Serializar os patches desta sessão preserva a ordem entre drag de linha,
  // coluna e largura sem transformar cada edição em snapshot completo.
  const viewWriteQueueRef = useRef<Promise<unknown>>(Promise.resolve())
  const filterKeyReconcileInFlightRef = useRef<Set<string>>(new Set())
  const pageRealtimeChannelRef = useRef<PageRealtimeChannel | null>(null)
  const columnResizePreviewTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map(),
  )

  const cancelColumnWidthPreviewTimers = useCallback(() => {
    for (const timer of columnResizePreviewTimersRef.current.values()) clearTimeout(timer)
    columnResizePreviewTimersRef.current.clear()
  }, [])

  const clearColumnWidthPreviews = useCallback(() => {
    cancelColumnWidthPreviewTimers()
    setColumnWidthPreviews((current) =>
      Object.keys(current).length === 0 ? current : {},
    )
  }, [cancelColumnWidthPreviewTimers])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  useEffect(() => {
    clearColumnWidthPreviews()
    loadedPageIdRef.current = undefined
    settingsRef.current = {}
    materializedFallbackRef.current = { pageId }
    viewWriteQueueRef.current = Promise.resolve()
    return cancelColumnWidthPreviewTimers
  }, [pageId, cancelColumnWidthPreviewTimers, clearColumnWidthPreviews])

  const performLoad = useCallback(async (): Promise<void> => {
    if (!pageId) return
    const revision = loadRevisionRef.current + 1
    loadRevisionRef.current = revision
    const scope = loadScopeRef.current
    const isCurrent = () =>
      mountedRef.current &&
      currentPageIdRef.current === pageId &&
      loadScopeRef.current === scope &&
      loadRevisionRef.current === revision
    // Um evento recebido depois do início deste fetch torna a resposta
    // potencialmente stale. `applyRealtimeEvent` troca a referência do clock
    // sempre que aplica conteúdo, então ela funciona como versão causal.
    const clockAtStart = clockRef.current
    const exposesLoading = loadedPageIdRef.current !== pageId

    // Skeleton pertence somente à primeira carga/troca de página. Um ACK de
    // reconexão ou fallback estrutural relê em background e conserva a tabela.
    if (exposesLoading) {
      setLoading(true)
      setFailed(false)
    }
    try {
      const loaded = await databaseService.loadPage(pageId)
      if (!isCurrent() || clockRef.current !== clockAtStart) return
      clockRef.current = {}
      loadedPageIdRef.current = pageId
      settingsRef.current = loaded.settings
      setFailed(false)
      setDatabase(loaded)

      if (
        loaded.needsFilterKeyReconcile &&
        !filterKeyReconcileInFlightRef.current.has(pageId)
      ) {
        filterKeyReconcileInFlightRef.current.add(pageId)
        const reconcileClock = clockRef.current
        void databaseService
          .reconcileFilterKeys(pageId)
          .then((reconciled) => {
            if (
              !mountedRef.current ||
              currentPageIdRef.current !== pageId ||
              clockRef.current !== reconcileClock
            ) {
              return
            }
            setDatabase((current) => {
              if (!current) return current
              const settings =
                Object.keys(reconciled.settings).length > 0
                  ? reconciled.settings
                  : current.settings
              settingsRef.current = settings
              return {
                ...current,
                settings,
                headerCols: reconciled.headerCols,
                needsFilterKeyReconcile: false,
              }
            })
          })
          .catch(() => undefined)
          .finally(() => {
            filterKeyReconcileInFlightRef.current.delete(pageId)
          })
      }
    } catch {
      // Uma falha de resync não apaga um snapshot que ainda é utilizável.
      if (isCurrent() && exposesLoading) setFailed(true)
    } finally {
      if (isCurrent() && exposesLoading) setLoading(false)
    }
  }, [pageId])

  /**
   * Coalescência autoritativa: eventos estruturais/ACKs durante uma leitura
   * não abrem requests paralelas. Eles reservam exatamente uma nova passagem
   * depois da atual; novos sinais durante essa passagem podem reservar outra.
   */
  const reload = useCallback(() => {
    if (!pageId) return

    if (loadInFlightRef.current) {
      loadQueuedRef.current = true
      return
    }

    const scope = loadScopeRef.current
    const start = () => {
      const request = performLoad()
      loadInFlightRef.current = request
      void request.finally(() => {
        if (loadScopeRef.current !== scope || loadInFlightRef.current !== request) return
        loadInFlightRef.current = null
        if (!loadQueuedRef.current) return
        loadQueuedRef.current = false
        start()
      })
    }

    start()
  }, [pageId, performLoad])

  useEffect(() => {
    // StrictMode repete effects em desenvolvimento. Resetar somente quando o
    // id realmente muda conserva a garantia de uma request em voo também lá.
    if (loadScopePageIdRef.current !== pageId) {
      loadScopePageIdRef.current = pageId
      loadScopeRef.current += 1
      loadInFlightRef.current = null
      loadQueuedRef.current = false
    }
    reload()
  }, [pageId, reload])

  const handleRealtimeEvent = useCallback<NonNullable<UsePageRealtimeOptions['onEvent']>>(
    (event) => {
      // Qualquer snapshot confirmado substitui os previews: ele é a verdade
      // durável, inclusive quando o resize acabou ou sua escrita foi superada.
      if (event.type === 'view-updated') clearColumnWidthPreviews()
      setDatabase((current) => {
        if (!current) return current
        // Sem filtro de autoria: o eco da PRÓPRIA edição também entra, e é ele
        // que traz o `updatedAt` do servidor para o relógio (ver
        // `databaseRealtime.ts`). Como o valor já é o que está na tela, o
        // efeito visível é nenhum — o ganho é a guarda de ordem passar a
        // valer para as edições deste usuário também.
        const result = applyRealtimeEvent(
          current,
          clockRef.current,
          event,
          i18n('pages.app.cubs-database.coluna-titulo'),
        )
        if (!result.applied) return current
        clockRef.current = result.clock
        settingsRef.current = result.database.settings
        return result.database
      })
    },
    [clearColumnWidthPreviews],
  )

  const handleRemoteColumnResize = useCallback<
    NonNullable<UsePageRealtimeOptions['onColumnResize']>
  >((payload) => {
    const key = `${payload.viewId}:${payload.columnId}`
    const previousTimer = columnResizePreviewTimersRef.current.get(key)
    if (previousTimer) clearTimeout(previousTimer)

    setColumnWidthPreviews((current) => ({
      ...current,
      [payload.viewId]: {
        ...current[payload.viewId],
        [payload.columnId]: payload.width,
      },
    }))

    columnResizePreviewTimersRef.current.set(
      key,
      setTimeout(() => {
        columnResizePreviewTimersRef.current.delete(key)
        setColumnWidthPreviews((current) => {
          const view = current[payload.viewId]
          if (!view || !(payload.columnId in view)) return current
          const { [payload.columnId]: _expired, ...remainingColumns } = view
          const next = { ...current }
          if (Object.keys(remainingColumns).length > 0) next[payload.viewId] = remainingColumns
          else delete next[payload.viewId]
          return next
        })
      }, COLUMN_RESIZE_PREVIEW_TTL_MS),
    )
  }, [])

  const handleRealtimeChannelChange = useCallback<
    NonNullable<UsePageRealtimeOptions['onChannelChange']>
  >((channel) => {
    pageRealtimeChannelRef.current = channel
  }, [])

  const handleStructureChanged = useCallback<
    NonNullable<UsePageRealtimeOptions['onStructureChanged']>
  >(
    (event) => {
      // Também invalida qualquer snapshot completo que tenha começado antes
      // deste fato. Se já houver uma leitura em voo, o coalescer agenda uma
      // passagem silenciosa depois dela para não reintroduzir estado velho.
      clockRef.current = {
        ...clockRef.current,
        [structureClockKey(event)]: event.payload.updatedAt,
      }

      if (event.type === 'row-created') {
        setDatabase((current) => {
          if (!current || current.rows.some((row) => row.id === event.payload.rowId)) {
            return current
          }
          return {
            ...current,
            rows: [...current.rows, { id: event.payload.rowId, cells: {} }],
          }
        })
      } else if (event.type === 'row-deleted') {
        setDatabase((current) => {
          if (!current || !current.rows.some((row) => row.id === event.payload.rowId)) {
            return current
          }
          return {
            ...current,
            rows: current.rows.filter((row) => row.id !== event.payload.rowId),
          }
        })
        setCellErrors((current) => {
          const prefix = `${event.payload.rowId}:`
          const next = new Set([...current].filter((key) => !key.startsWith(prefix)))
          return next.size === current.size ? current : next
        })
      } else {
        // Remoção de coluna ainda pede a estrutura autoritativa, mas a base
        // permanece montada durante o resync.
        reload()
        return
      }

      // Durante a primeira leitura ou outra leitura já ativa, garante que a
      // resposta anterior ao evento não vença o merge incremental.
      if (loadedPageIdRef.current !== pageId || loadInFlightRef.current) reload()
    },
    [pageId, reload],
  )

  // Traduz o erro HTTP numa notificação. A CLASSE do erro (`classifyWriteError`,
  // puro) vira o sufixo da chave i18n; o texto sai do locale.
  const notifyWriteError = useCallback(
    (error: unknown) => {
      feedback({
        title: i18n('feedback.escrita.titulo'),
        description: i18n(`feedback.escrita.${classifyWriteError(error)}`),
        variant: 'error',
      })
    },
    [feedback],
  )

  // As escritas SEM rollback fino (rename, options, snapshot) revertem o
  // otimismo pelo remédio grosso: reler a base. O reload re-sincroniza a UI
  // com o que o servidor de fato gravou, desfazendo a mudança que falhou.
  const handleWriteError = useCallback(
    (error: unknown) => {
      notifyWriteError(error)
      reload()
    },
    [notifyWriteError, reload],
  )

  const enqueueViewWrite = useCallback(<T,>(write: () => Promise<T>): Promise<T> => {
    const request = viewWriteQueueRef.current.catch(() => undefined).then(write)
    viewWriteQueueRef.current = request.catch(() => undefined)
    return request
  }, [])

  const prepareViewWrite = useCallback(
    (viewId: string): {
      viewId: string
      materializedNow: boolean
      settings: DataViewSettings
    } | null => {
      if (!pageId) return null
      if (viewId !== FALLBACK_VIEW_ID) {
        return settingsRef.current[viewId]
          ? { viewId, materializedNow: false, settings: settingsRef.current }
          : null
      }

      const previous = materializedFallbackRef.current
      if (previous.pageId === pageId && previous.viewId) {
        return settingsRef.current[previous.viewId]
          ? { viewId: previous.viewId, materializedNow: false, settings: settingsRef.current }
          : null
      }

      const fallback = settingsRef.current[FALLBACK_VIEW_ID]
      if (!fallback) return null
      const resolvedViewId = ulid()
      const { [FALLBACK_VIEW_ID]: _fallback, ...savedViews } = settingsRef.current
      const settings = { ...savedViews, [resolvedViewId]: fallback }
      materializedFallbackRef.current = { pageId, viewId: resolvedViewId }
      settingsRef.current = settings
      setDatabase((current) => (current ? { ...current, settings } : current))
      return { viewId: resolvedViewId, materializedNow: true, settings }
    },
    [pageId],
  )

  /**
   * Views existentes usam PATCH por caminho JSON. O PUT do snapshot completo
   * permanece somente para materializar a sentinela fallback uma única vez.
   */
  const saveViewPatch = useCallback(
    (viewId: string, patch: Partial<DataViewType>) => {
      if (!pageId) return
      const prepared = prepareViewWrite(viewId)
      if (!prepared) return
      const current = prepared.settings[prepared.viewId]
      if (!current) return
      const settings = {
        ...prepared.settings,
        [prepared.viewId]: { ...current, ...patch },
      }
      settingsRef.current = settings
      setDatabase((database) => (database ? { ...database, settings } : database))

      void enqueueViewWrite(() =>
        prepared.materializedNow
          ? pageWriteService.saveViewSnapshot(
              pageId,
              settings,
              prepared.viewId,
              {},
            )
          : pageWriteService.patchView(pageId, prepared.viewId, patch),
      ).catch(handleWriteError)
    },
    [enqueueViewWrite, handleWriteError, pageId, prepareViewWrite],
  )

  const saveViewFilters = useCallback(
    async (viewId: string, filters: ViewFiltersV2): Promise<ViewFiltersV2> => {
      if (!pageId) throw new Error('Página ausente')
      const prepared = prepareViewWrite(viewId)
      if (!prepared) throw new Error('View ausente')

      const response = await enqueueViewWrite(async () => {
        if (prepared.materializedNow) {
          await pageWriteService.saveViewSnapshot(
            pageId,
            prepared.settings,
            prepared.viewId,
            {},
          )
        }
        return pageWriteService.saveViewFilters(pageId, prepared.viewId, filters)
      })

      if (mountedRef.current && currentPageIdRef.current === pageId) {
        const current = settingsRef.current[prepared.viewId]
        if (current) {
          const settings = {
            ...settingsRef.current,
            [prepared.viewId]: { ...current, filters: response.filters },
          }
          settingsRef.current = settings
          setDatabase((database) => (database ? { ...database, settings } : database))
        }
      }
      return response.filters
    },
    [enqueueViewWrite, pageId, prepareViewWrite],
  )

  /**
   * A CÉLULA é a escrita de maior frequência e a única com rollback FINO — daí
   * o `useMutation` (o padrão que SignIn/SignUp já usam), que dá o ciclo
   * onMutate/onError com contexto sem gerência manual:
   *
   *  - `onMutate`: aplica o otimismo e LIMPA a marca de erro anterior (é uma
   *    nova tentativa);
   *  - `onError`: desfaz o otimismo voltando ao `previousValue` — "se deu erro,
   *    não era para atualizar" — MARCA a célula e notifica;
   *  - sucesso: a marca já saiu no onMutate e o eco do servidor confirma o
   *    valor, então não há o que fazer.
   */
  const cellMutation = useMutation({
    mutationFn: (change: CellChange) => pageWriteService.saveCell(change),
    onMutate: (change: CellChange) => {
      const key = cellErrorKey(change.rowId, change.columnId)
      const revision = (cellMutationRevisionsRef.current.get(key) ?? 0) + 1
      cellMutationRevisionsRef.current.set(key, revision)
      setCellErrors((prev) => toggleKey(prev, key, false))
      setDatabase((current) => (current ? applyLocalCellChange(current, change) : current))
      return { key, revision }
    },
    onError: (_error, change, context) => {
      // A célula já recebeu outra edição depois desta requisição. Reverter,
      // marcar ou notificar agora atribuiria a falha velha ao valor novo.
      if (
        !context ||
        cellMutationRevisionsRef.current.get(context.key) !== context.revision
      ) {
        return
      }

      setDatabase((current) =>
        current
          ? applyLocalCellChange(current, {
              rowId: change.rowId,
              columnId: change.columnId,
              value: change.previousValue,
            })
          : current,
      )
      setCellErrors((prev) => toggleKey(prev, context.key, true))
      notifyWriteError(_error)

      // 404 = o snapshot dizia "existe", mas a célula/página já sumiu; 409 =
      // dizia "ausente", mas alguém a criou. Sem reler, toda tentativa seguinte
      // repete o mesmo PUT/POST errado e fica presa no mesmo impasse.
      const kind = classifyWriteError(_error)
      if (kind === 'nao-encontrado' || kind === 'conflito') reload()
    },
  })

  const handleCellEditConflict = useCallback(
    (conflict: CellEditConflict) => {
      const key = cellErrorKey(conflict.rowId, conflict.columnId)

      // Um evento autoritativo também invalida o rollback de qualquer request
      // antiga ainda em voo. Sem isto, uma falha atrasada poderia restaurar o
      // valor anterior POR CIMA daquele que acabou de chegar pelo receiver.
      const revision = (cellMutationRevisionsRef.current.get(key) ?? 0) + 1
      cellMutationRevisionsRef.current.set(key, revision)
      setCellErrors((prev) => toggleKey(prev, key, true))
      feedback({
        title: i18n('feedback.realtime.titulo'),
        description: i18n('feedback.realtime.edicao-interrompida', {
          column: conflict.columnTitle,
          value: conflict.displayValue,
        }),
        variant: 'warning',
      })
    },
    [feedback],
  )

  const handlers = {
    onAddRow: useCallback(() => {
      if (!pageId) return

      // A API cria somente `pages` + `page_edges`; nenhuma célula EAV nasce
      // aqui. A resposta HTTP e o broadcast `row-created` usam o mesmo merge
      // idempotente: a ordem em que chegarem não duplica nem recarrega a base.
      pageWriteService
        .createRow(pageId)
        .then((created) => {
          if (currentPageIdRef.current !== pageId) return
          setDatabase((current) => {
            if (!current || current.rows.some((row) => row.id === created.id)) return current
            return {
              ...current,
              rows: [...current.rows, { id: created.id, cells: {} }],
            }
          })
        })
        .catch(handleWriteError)
    }, [handleWriteError, pageId]),
    onAddColumn: useCallback(() => {
      if (!pageId) return

      // A resposta HTTP e o eco carregam a mesma coluna completa. Ambos usam
      // merge idempotente, então não importa qual chega primeiro e nenhuma
      // linha ganha um value artificial para fazer o header aparecer.
      pageWriteService
        .createColumn(pageId, i18n('pages.app.cubs-database.nova-coluna'))
        .then((created) => {
          if (currentPageIdRef.current !== pageId) return
          setDatabase((current) =>
            current
              ? applyLocalColumnCreated(
                  current,
                  created,
                  i18n('pages.app.cubs-database.coluna-titulo'),
                )
              : current,
          )
        })
        .catch(handleWriteError)
    }, [handleWriteError, pageId]),
    // `.mutate` tem identidade estável (React Query garante), então serve
    // direto de handler sem `useCallback` — e mantém o memo da célula intacto.
    onCellChange: cellMutation.mutate,
    onCellEditConflict: handleCellEditConflict,
    onColumnOptionsChange: useCallback(
      (columnId: string, options: ColumnOption[]) => {
        if (!pageId) return
        // Otimista: o editor de options do menu lê `column.options`, então o
        // read-modify-write dele precisa ver a mudança na hora (senão a próxima
        // edição parte de estado velho). O eco confirma; erro → reload desfaz.
        setDatabase((current) =>
          current ? applyLocalColumnOptions(current, columnId, options) : current,
        )
        pageWriteService.saveColumnOptions(pageId, columnId, options).catch(handleWriteError)
      },
      [pageId, handleWriteError],
    ),
    onColumnRename: useCallback(
      (columnId: string, name: string) => {
        // Defesa de fronteira: a coluna mestra usa o handler por-view abaixo
        // e nunca pode escapar para a rota de uma `page_columns` inexistente.
        if (!pageId || columnId === TITLE_COLUMN_ID) return
        // Otimista, como a célula: o header mostra o nome novo sem esperar a
        // volta da rede. O eco confirma logo atrás; se a escrita falhar, o
        // reload do `handleWriteError` desfaz o otimismo.
        setDatabase((current) =>
          current ? applyLocalColumnRename(current, columnId, name) : current,
        )
        pageWriteService.renameColumn(pageId, columnId, name).catch(handleWriteError)
      },
      [pageId, handleWriteError],
    ),
    onPageTitleColumnChange: useCallback(
      (viewId: string, column: PageTitleColumn) => {
        // A coluna mestra não existe em `page_columns`: nome e máscara são
        // a prévia daquela view e entram no snapshot da própria página.
        saveViewPatch(viewId, { title: column })
      },
      [saveViewPatch],
    ),
    onColumnTypeChange: useCallback(
      (columnId: string, type: ColumnDataType) => {
        if (!pageId || columnId === TITLE_COLUMN_ID) return
        // Otimista: header/editores passam ao novo tipo na hora. Não-destrutivo
        // no backend (config e valores do tipo antigo ficam preservados).
        setDatabase((current) =>
          current ? applyLocalColumnType(current, columnId, type) : current,
        )
        pageWriteService.changeColumnType(pageId, columnId, type).catch(handleWriteError)
      },
      [pageId, handleWriteError],
    ),
    onColumnConfigChange: useCallback(
      (columnId: string, patch: ColumnConfigPatch) => {
        if (!pageId || columnId === TITLE_COLUMN_ID) return
        setDatabase((current) =>
          current ? applyLocalColumnConfig(current, columnId, patch) : current,
        )
        pageWriteService.saveColumnConfig(pageId, columnId, patch).catch(handleWriteError)
      },
      [pageId, handleWriteError],
    ),
    onColumnReset: useCallback(
      (columnId: string) => {
        if (!pageId || columnId === TITLE_COLUMN_ID) return
        // Destrutivo e em MASSA (coluna + N células) — sem otimismo: relê a base
        // no sucesso (a verdade autoritativa), notifica no erro.
        pageWriteService
          .resetColumn(pageId, columnId)
          .then(() => reload())
          .catch(handleWriteError)
      },
      [pageId, handleWriteError, reload],
    ),
    onRowOrderChange: useCallback(
      (viewId: string, orderedRows: string[]) => {
        saveViewPatch(viewId, { orderedRows })
      },
      [saveViewPatch],
    ),
    onColumnOrderChange: useCallback(
      (viewId: string, orderedHeaderCols: string[]) => {
        saveViewPatch(viewId, { orderedHeaderCols })
      },
      [saveViewPatch],
    ),
    onColumnWidthChange: useCallback(
      (viewId: string, columnWidths: Record<string, number>) => {
        saveViewPatch(viewId, { columnWidths })
      },
      [saveViewPatch],
    ),
    onColumnWidthPreview: useCallback(
      (viewId: string, columnId: string, width: number) => {
        pageRealtimeChannelRef.current?.previewColumnResize({ viewId, columnId, width })
      },
      [],
    ),
    onViewFiltersChange: useCallback(
      (viewId: string, filters: ViewFiltersV2) => saveViewFilters(viewId, filters),
      [saveViewFilters],
    ),
  }

  return {
    database,
    loading,
    failed,
    cellErrors,
    columnWidthPreviews,
    realtimeOptions: {
      onEvent: handleRealtimeEvent,
      onStructureChanged: handleStructureChanged,
      onColumnResize: handleRemoteColumnResize,
      onResync: reload,
      onChannelChange: handleRealtimeChannelChange,
    },
    handlers,
  }
}
