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
} from 'cubs-database'

import { useFeedback } from '@/contexts/FeedbackContext'
import type { UsePageRealtimeOptions } from '@/hooks/usePageRealtime'
import {
  applyLocalCellChange,
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
import type { PageRealtimeChannel } from '@/services/PageRealtimeChannel'
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
  const mountedRef = useRef(true)
  const currentPageIdRef = useRef(pageId)
  currentPageIdRef.current = pageId

  // Relógio de sincronização (último `updatedAt` por célula/coluna/view). Ref
  // e não state: ele decide se um evento entra, mas não desenha nada — virar
  // state só somaria um render por evento descartado.
  const clockRef = useRef<RealtimeClock>({})
  // O snapshot COMPLETO das views é o que uma escrita de view precisa
  // reenviar: `PUT /pages/:id` substitui `data` INTEIRO, então mandar só a
  // view editada apagaria as outras.
  const settingsRef = useRef<DataViewSettings>({})
  // A view fallback é uma sentinela estável de leitura, mas não é um ULID
  // válido. A primeira personalização materializa uma view real e este ref
  // mantém a tradução disponível para callbacks do render anterior.
  const materializedFallbackRef = useRef<{ pageId?: string; viewId?: string }>({ pageId })
  // Snapshot é substituição do `pages.data` inteiro. Serializar as escritas
  // desta sessão garante que um drag de linha seguido de um drag de coluna
  // chegue ao backend na mesma ordem em que atualizou a UI.
  const viewWriteQueueRef = useRef<Promise<unknown>>(Promise.resolve())
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

    setLoading(true)
    setFailed(false)
    try {
      const loaded = await databaseService.loadPage(pageId)
      if (!isCurrent() || clockRef.current !== clockAtStart) return
      clockRef.current = {}
      settingsRef.current = loaded.settings
      setDatabase(loaded)
    } catch {
      if (isCurrent()) setFailed(true)
    } finally {
      if (isCurrent()) setLoading(false)
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

  /**
   * Aplica e persiste uma personalização da view como snapshot completo.
   *
   * Além do otimismo visível, `settingsRef` muda SINCRONAMENTE: duas ações
   * rápidas partem sempre do resultado da anterior, mesmo antes de o React
   * renderizar ou de o primeiro PUT voltar. Para páginas ainda no fallback,
   * a primeira ação troca a sentinela por um ULID real.
   */
  const saveViewSnapshot = useCallback(
    (viewId: string, patch: Partial<DataViewType>) => {
      if (!pageId) return

      let resolvedViewId = viewId
      let baseSettings = settingsRef.current

      if (viewId === FALLBACK_VIEW_ID) {
        const materialized = materializedFallbackRef.current
        resolvedViewId =
          materialized.pageId === pageId && materialized.viewId
            ? materialized.viewId
            : ulid()

        if (!materialized.viewId || materialized.pageId !== pageId) {
          const fallback = baseSettings[FALLBACK_VIEW_ID]
          if (!fallback) return
          const { [FALLBACK_VIEW_ID]: _fallback, ...savedViews } = baseSettings
          baseSettings = { ...savedViews, [resolvedViewId]: fallback }
          materializedFallbackRef.current = { pageId, viewId: resolvedViewId }
        }
      }

      const current = baseSettings[resolvedViewId]
      if (!current) return

      const settings: DataViewSettings = {
        ...baseSettings,
        [resolvedViewId]: { ...current, ...patch },
      }
      settingsRef.current = settings
      setDatabase((database) => (database ? { ...database, settings } : database))

      // Cada chamada captura o snapshot já mesclado. O writer ainda recebe o
      // patch para preservar sua API/guard-rail, mas o `baseSettings` desta
      // chamada já contém todas as alterações concluídas anteriormente.
      viewWriteQueueRef.current = viewWriteQueueRef.current
        .catch(() => undefined)
        .then(() =>
          pageWriteService.saveViewSnapshot(pageId, baseSettings, resolvedViewId, patch),
        )
        .catch(handleWriteError)
    },
    [pageId, handleWriteError],
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
        saveViewSnapshot(viewId, { title: column })
      },
      [saveViewSnapshot],
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
        saveViewSnapshot(viewId, { orderedRows })
      },
      [saveViewSnapshot],
    ),
    onColumnOrderChange: useCallback(
      (viewId: string, orderedHeaderCols: string[]) => {
        saveViewSnapshot(viewId, { orderedHeaderCols })
      },
      [saveViewSnapshot],
    ),
    onColumnWidthChange: useCallback(
      (viewId: string, columnWidths: Record<string, number>) => {
        saveViewSnapshot(viewId, { columnWidths })
      },
      [saveViewSnapshot],
    ),
    onColumnWidthPreview: useCallback(
      (viewId: string, columnId: string, width: number) => {
        pageRealtimeChannelRef.current?.previewColumnResize({ viewId, columnId, width })
      },
      [],
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
      onStructureChanged: reload,
      onColumnResize: handleRemoteColumnResize,
      onResync: reload,
      onChannelChange: handleRealtimeChannelChange,
    },
    handlers,
  }
}
