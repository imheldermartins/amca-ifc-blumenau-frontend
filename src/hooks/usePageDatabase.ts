import { useCallback, useEffect, useRef, useState } from 'react'
import type { CellChange, ColumnOption, DataViewSettings } from 'cubs-database'

import { useAuth } from '@contexts/AuthContext'
import type { UsePageRealtimeOptions } from '@/hooks/usePageRealtime'
import {
  applyLocalCellChange,
  applyRealtimeEvent,
  type RealtimeClock,
} from '@/lib/databaseRealtime'
import type { ParsedDatabase } from '@/lib/databaseParser'
import { i18n } from '@/lib/i18n'
import { databaseService } from '@/services/DatabaseService'
import { pageWriteService } from '@/services/PageWriteService'

export interface UsePageDatabaseResult {
  database: ParsedDatabase | null
  loading: boolean
  failed: boolean
  /** Repasse para o `<PageShell>`: é ele quem assina a sala. */
  realtimeOptions: UsePageRealtimeOptions
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
  const auth = useAuth()
  const [database, setDatabase] = useState<ParsedDatabase | null>(null)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)

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
        const result = applyRealtimeEvent(
          current,
          clockRef.current,
          event,
          auth.user?.id,
          i18n('pages.app.cubs-database.coluna-titulo'),
        )
        if (!result.applied) return current
        clockRef.current = result.clock
        settingsRef.current = result.database.settings
        return result.database
      })
    },
    [auth.user?.id],
  )

  // Linha criada/removida e reconexão caem no mesmo remédio: reler a base. É
  // mais barato (e mais honesto) do que remendar meia linha ou tentar
  // reconstruir os eventos perdidos enquanto o socket esteve fora.
  const reload = useCallback(() => {
    load()
  }, [load])

  const handlers = {
    onCellChange: useCallback(
      (change: CellChange) => {
        // OTIMISTA primeiro: quem edita ignora o próprio eco do servidor
        // (senão a resposta brigaria com o que está sendo digitado), então sem
        // aplicar aqui o autor seria o único a NÃO ver a própria mudança — o
        // chip do select ficava na option antiga enquanto todo mundo já via a
        // nova. A escrita HTTP segue logo atrás.
        setDatabase((current) => (current ? applyLocalCellChange(current, change) : current))
        void pageWriteService.saveCell(change)
      },
      [],
    ),
    onColumnOptionsChange: useCallback(
      (columnId: string, options: ColumnOption[]) => {
        if (!pageId) return
        void pageWriteService.saveColumnOptions(pageId, columnId, options)
      },
      [pageId],
    ),
    onColumnRename: useCallback(
      (columnId: string, name: string) => {
        if (!pageId) return
        void pageWriteService.renameColumn(pageId, columnId, name)
      },
      [pageId],
    ),
    onRowOrderChange: useCallback(
      (viewId: string, orderedRows: string[]) => {
        if (!pageId) return
        void pageWriteService.saveViewSnapshot(pageId, settingsRef.current, viewId, { orderedRows })
      },
      [pageId],
    ),
    onColumnOrderChange: useCallback(
      (viewId: string, orderedHeaderCols: string[]) => {
        if (!pageId) return
        void pageWriteService.saveViewSnapshot(pageId, settingsRef.current, viewId, {
          orderedHeaderCols,
        })
      },
      [pageId],
    ),
    onColumnWidthChange: useCallback(
      (viewId: string, columnWidths: Record<string, number>) => {
        if (!pageId) return
        void pageWriteService.saveViewSnapshot(pageId, settingsRef.current, viewId, {
          columnWidths,
        })
      },
      [pageId],
    ),
  }

  return {
    database,
    loading,
    failed,
    realtimeOptions: {
      onEvent: handleRealtimeEvent,
      onRowsChanged: reload,
      onResync: reload,
    },
    handlers,
  }
}
