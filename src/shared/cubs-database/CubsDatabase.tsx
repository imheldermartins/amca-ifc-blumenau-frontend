import { useMemo, useState } from 'react'
import { Icon } from '@iconify/react'
import { cn, type ContextMenuItem } from 'cubs-components'

import { ViewTabsBar } from './components/ViewTabsBar'
import { TableView } from './components/TableView'
import type { TableRowLabels } from './components/TableRow'
import type {
  CellChange,
  ColumnOption,
  DataViewSettings,
  DataViewType,
  HeaderCol,
  RowData,
} from './types'
import { reorderByIds } from './utils'

const FALLBACK_VIEW: DataViewType = {
  view: 'table',
  name: '',
  filters: '',
  orderedHeaderCols: [],
}

export interface CubsDatabaseProps {
  /** Views salvas — chave é o ULID da view; cada uma vira uma tab da topbar. */
  settings: DataViewSettings
  /** Colunas na ordem natural de display (esq→dir); a view pode reordenar. */
  headerCols: HeaderCol[]
  rows: RowData[]
  /**
   * Células cuja última escrita FALHOU (chave `cellErrorKey(rowId, columnId)`).
   * O app host preenche no `onError` da escrita e limpa na reedição — a tabela
   * só desenha a moldura de erro. Ausente = nenhuma marca.
   */
  cellErrors?: Set<string>
  /** Modo controlado da view ativa; sem isso o componente controla sozinho. */
  activeViewId?: string
  onViewChange?: (viewId: string) => void
  /** Itens do ContextMenu das tabs (botão direito; app host injeta i18n). */
  viewMenuItems?: (viewId: string) => ContextMenuItem[]
  /** Clique no botão "Abrir ›" de uma linha — recebe a row crua. */
  onOpenRow?: (row: RowData) => void
  /**
   * Uma célula foi editada e confirmada. A PRESENÇA desta prop é o que liga o
   * modo editável (despacho pelo cellMap de `components/cells`); sem ela a
   * tabela é read-only, como sempre foi. O payload (`CellChange`) já tem o
   * formato do futuro evento `cell-updated` do realtime — o transporte (PUT +
   * broadcast) é responsabilidade do app host.
   */
  onCellChange?: (change: CellChange) => void
  /**
   * As options de uma coluna select foram reordenadas (drag no editor). Chega
   * o array COMPLETO na nova ordem — read-modify-write, como o snapshot das
   * views: persistir é reescrever o `options` inteiro da coluna.
   */
  onColumnOptionsChange?: (columnId: string, options: ColumnOption[]) => void
  /**
   * As LINHAS foram reordenadas por drag. Chega o id da VIEW ativa + o array
   * COMPLETO de ids de página na nova ordem — é o `orderedRows` pronto para
   * entrar no snapshot da view em `page.data` (read-modify-write, como tudo
   * no snapshot). A presença da prop é o que habilita o drag de linha.
   */
  onRowOrderChange?: (viewId: string, orderedRows: string[]) => void
  /**
   * As COLUNAS foram reordenadas por drag no header. Mesmo contrato: id da
   * view + `orderedHeaderCols` completo (INCLUINDO a coluna sintética do
   * título), pronto para o snapshot.
   */
  onColumnOrderChange?: (viewId: string, orderedHeaderCols: string[]) => void
  /**
   * A seleção de linhas mudou — `selectedPagesIds` completo. É o terreno do
   * futuro batchRealtimeUpdate: agir sobre N páginas de uma vez.
   */
  onSelectionChange?: (selectedPagesIds: string[]) => void
  /**
   * Renomear coluna pelo menu do header (botão direito). Payload já no
   * formato do futuro `column-renamed` do realtime. A presença da prop é o
   * que habilita o menu.
   */
  onColumnRename?: (columnId: string, name: string) => void
  /**
   * Uma coluna foi redimensionada (alça na borda direita do header). Chega o
   * id da view + o mapa COMPLETO de larguras — o `columnWidths` pronto para o
   * snapshot. A presença da prop é o que habilita o resize.
   */
  onColumnWidthChange?: (viewId: string, columnWidths: Record<string, number>) => void
  /** Fetch inicial em andamento → skeleton. */
  loading?: boolean
  emptyLabel?: string
  /** Texto das views ainda não implementadas (board/calendar). */
  placeholderLabel?: string
  /** Labels de acessibilidade/texto dos controles da linha. */
  labels?: TableRowLabels
  className?: string
}

/**
 * Visualização da base simulada (PageTree): topbar de views (tabs + context
 * menu no botão direito) e a view ativa — sem chrome em volta, só a view.
 * Por enquanto só 'table' renderiza de verdade; board e calendar mostram
 * placeholder.
 */
export function CubsDatabase({
  // Defaults defensivos: consumidor JS (sem TS) pode omitir na prática.
  settings = {},
  headerCols = [],
  rows = [],
  cellErrors,
  activeViewId,
  onViewChange,
  viewMenuItems,
  onOpenRow,
  onCellChange,
  onColumnOptionsChange,
  onRowOrderChange,
  onColumnOrderChange,
  onSelectionChange,
  onColumnRename,
  onColumnWidthChange,
  loading,
  emptyLabel,
  placeholderLabel = 'Em breve.',
  labels,
  className,
}: CubsDatabaseProps) {
  const [internalViewId, setInternalViewId] = useState(() => Object.keys(settings)[0] ?? '')
  const currentViewId = activeViewId ?? internalViewId
  const currentView = settings[currentViewId] ?? FALLBACK_VIEW

  const handleViewChange = (viewId: string) => {
    setInternalViewId(viewId)
    onViewChange?.(viewId)
  }

  // Memoizados de propósito: o TableView usa estes arrays como BASE do estado
  // otimista (ordem local re-sincroniza quando a prop muda). Sem memo, cada
  // render daqui criaria um array novo e o sync descartaria o otimismo.
  const orderedColumns = useMemo(
    () => reorderByIds(headerCols, currentView.orderedHeaderCols),
    [headerCols, currentView],
  )
  const orderedRows = useMemo(
    () => reorderByIds(rows, currentView.orderedRows ?? []),
    [rows, currentView],
  )

  return (
    <section className={cn('w-full', className)}>
      <ViewTabsBar
        settings={settings}
        activeViewId={currentViewId}
        onViewChange={handleViewChange}
        viewMenuItems={viewMenuItems}
      />

      <div className="pt-2">
        {currentView.view === 'table' ? (
          <TableView
            // key por view: trocar de tab zera ordem otimista e seleção — são
            // estados DA VIEW (a ordem mora no snapshot dela), não da base.
            key={currentViewId}
            columns={orderedColumns}
            rows={orderedRows}
            columnWidths={currentView.columnWidths}
            cellErrors={cellErrors}
            loading={loading}
            emptyLabel={emptyLabel}
            onOpenRow={onOpenRow}
            onCellChange={onCellChange}
            onColumnOptionsChange={onColumnOptionsChange}
            onRowOrderChange={
              onRowOrderChange ? (ids) => onRowOrderChange(currentViewId, ids) : undefined
            }
            onColumnOrderChange={
              onColumnOrderChange ? (ids) => onColumnOrderChange(currentViewId, ids) : undefined
            }
            onSelectionChange={onSelectionChange}
            onColumnRename={onColumnRename}
            onColumnWidthChange={
              onColumnWidthChange
                ? (widths) => onColumnWidthChange(currentViewId, widths)
                : undefined
            }
            labels={labels}
          />
        ) : (
          <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-divider-contrast px-4 py-10 opacity-60">
            <Icon
              icon={currentView.view === 'board' ? 'lucide:kanban' : 'lucide:calendar'}
              fontSize={22}
            />
            <span className="text-sm">{placeholderLabel}</span>
          </div>
        )}
      </div>
    </section>
  )
}
