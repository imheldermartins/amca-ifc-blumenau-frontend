import { useCallback, useEffect, useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { cellErrorKey, type CellChange, type ColumnOption, type DataViewSettings } from 'cubs-database'

import { useFeedback } from '@/contexts/FeedbackContext'
import type { UsePageRealtimeOptions } from '@/hooks/usePageRealtime'
import {
  applyLocalCellChange,
  applyLocalColumnRename,
  applyRealtimeEvent,
  type RealtimeClock,
} from '@/lib/databaseRealtime'
import type { ParsedDatabase } from '@/lib/databaseParser'
import { classifyWriteError } from '@/lib/errors'
import { i18n } from '@/lib/i18n'
import { databaseService } from '@/services/DatabaseService'
import { pageWriteService } from '@/services/PageWriteService'

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
  /**
   * Células cuja última escrita FALHOU (chave `cellErrorKey`). A UI otimista
   * já reverteu o valor; isto é só a marca visual, que some na reedição.
   */
  cellErrors: Set<string>
  /** Handlers prontos para a `<CubsDatabase />`. */
  handlers: {
    onCellChange: (change: CellChange) => void
    onColumnOptionsChange: (columnId: string, options: ColumnOption[]) => void
    onColumnRename: (columnId: string, name: string) => void
    onRowOrderChange: (viewId: string, orderedRows: string[]) => void
    onColumnOrderChange: (viewId: string, orderedHeaderCols: string[]) => void
    onColumnWidthChange: (viewId: string, columnWidths: Record<string, number>) => void
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
 *      aplicam pelo redutor puro (`applyRealtimeEvent`), e quem originou
 *      ignora o próprio eco.
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
  // Células cuja escrita falhou — só a MARCA (o valor já foi revertido).
  const [cellErrors, setCellErrors] = useState<Set<string>>(() => new Set())

  // Relógio de sincronização (último `updatedAt` por célula/coluna/view). Ref
  // e não state: ele decide se um evento entra, mas não desenha nada — virar
  // state só somaria um render por evento descartado.
  const clockRef = useRef<RealtimeClock>({})
  // O snapshot COMPLETO das views é o que uma escrita de view precisa
  // reenviar: `PUT /pages/:id` substitui `data` INTEIRO, então mandar só a
  // view editada apagaria as outras.
  const settingsRef = useRef<DataViewSettings>({})

  const load = useCallback(() => {
    if (!pageId) return
    let active = true

    setLoading(true)
    setFailed(false)
    databaseService
      .loadPage(pageId)
      .then((loaded) => {
        if (!active) return
        clockRef.current = {}
        settingsRef.current = loaded.settings
        setDatabase(loaded)
      })
      .catch(() => {
        if (active) setFailed(true)
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [pageId])

  useEffect(() => load(), [load])

  const handleRealtimeEvent = useCallback<NonNullable<UsePageRealtimeOptions['onEvent']>>(
    (event) => {
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
    [],
  )

  // Linha criada/removida e reconexão caem no mesmo remédio: reler a base. É
  // mais barato (e mais honesto) do que remendar meia linha ou tentar
  // reconstruir os eventos perdidos enquanto o socket esteve fora.
  const reload = useCallback(() => {
    load()
  }, [load])

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
      setCellErrors((prev) => toggleKey(prev, key, false))
      setDatabase((current) => (current ? applyLocalCellChange(current, change) : current))
      return { key }
    },
    onError: (_error, change, context) => {
      setDatabase((current) =>
        current
          ? applyLocalCellChange(current, {
              rowId: change.rowId,
              columnId: change.columnId,
              value: change.previousValue,
            })
          : current,
      )
      if (context) setCellErrors((prev) => toggleKey(prev, context.key, true))
      notifyWriteError(_error)
    },
  })

  const handlers = {
    // `.mutate` tem identidade estável (React Query garante), então serve
    // direto de handler sem `useCallback` — e mantém o memo da célula intacto.
    onCellChange: cellMutation.mutate,
    onColumnOptionsChange: useCallback(
      (columnId: string, options: ColumnOption[]) => {
        if (!pageId) return
        pageWriteService.saveColumnOptions(pageId, columnId, options).catch(handleWriteError)
      },
      [pageId, handleWriteError],
    ),
    onColumnRename: useCallback(
      (columnId: string, name: string) => {
        if (!pageId) return
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
    onRowOrderChange: useCallback(
      (viewId: string, orderedRows: string[]) => {
        if (!pageId) return
        pageWriteService
          .saveViewSnapshot(pageId, settingsRef.current, viewId, { orderedRows })
          .catch(handleWriteError)
      },
      [pageId, handleWriteError],
    ),
    onColumnOrderChange: useCallback(
      (viewId: string, orderedHeaderCols: string[]) => {
        if (!pageId) return
        pageWriteService
          .saveViewSnapshot(pageId, settingsRef.current, viewId, { orderedHeaderCols })
          .catch(handleWriteError)
      },
      [pageId, handleWriteError],
    ),
    onColumnWidthChange: useCallback(
      (viewId: string, columnWidths: Record<string, number>) => {
        if (!pageId) return
        pageWriteService
          .saveViewSnapshot(pageId, settingsRef.current, viewId, { columnWidths })
          .catch(handleWriteError)
      },
      [pageId, handleWriteError],
    ),
  }

  return {
    database,
    loading,
    failed,
    cellErrors,
    realtimeOptions: {
      onEvent: handleRealtimeEvent,
      onRowsChanged: reload,
      onResync: reload,
    },
    handlers,
  }
}
