import { useCallback, useMemo, useRef, useState } from 'react'
import { Icon } from '@iconify/react'
import { cn, type ContextMenuItem } from 'cubs-components'

import {
  DatabaseViewToolbar,
  type DatabaseViewToolbarLabels,
} from './components/DatabaseViewToolbar'
import type { DatabaseViewToolbarSyncStatus } from './components/DatabaseViewSyncStatus'
import { ViewTabsBar } from './components/ViewTabsBar'
import { TableView } from './components/TableView'
import { GridView } from './components/GridView'
import { CalendarView } from './components/CalendarView'
import { BoardView } from './components/BoardView'
import { GraphView } from './components/GraphView'
import { FormView, type FormViewLabels } from './components/FormView'
import { DEFAULT_VIEW_MOCK_SETTINGS, type ViewMockSettings } from './viewSettings'
import type { TableRowLabels } from './components/TableRow'
import type {
  CalendarPinInput,
  BoardCreateInput,
  BoardMoveInput,
  BoardViewConfig,
  CellChange,
  CellEditConflict,
  ColumnConfigPatch,
  ColumnDataType,
  ColumnLockEditor,
  ColumnLockMap,
  ColumnOption,
  FlowDefinition,
  FlowExecutionResult,
  FlowMacroOption,
  FlowMacroSectionsBuilder,
  FormSubmissionInput,
  FormViewConfig,
  DataViewKind,
  DataViewSettings,
  DataViewType,
  HeaderCol,
  PageTitleColumn,
  RowData,
  ViewFiltersV2,
} from './types'
import { reorderByIds } from './utils'
import { DATA_VIEW_KINDS, VIEW_KIND_ICON } from './viewKinds'
import { viewFiltersSemanticSignature } from './viewFilterUrl'
import { applyViewFilters, emptyViewFilters, parseViewFilters } from './viewFilters'
import type { DatabasePagination, DatabaseRowMove } from './pagination'

function useSemanticValue<T>(value: T, signature: string): T {
  const stableRef = useRef({ signature, value })
  if (stableRef.current.signature !== signature) {
    stableRef.current = { signature, value }
  }
  return stableRef.current.value
}

const FALLBACK_VIEW: DataViewType = {
  view: 'table',
  name: '',
  urlKey: { key: 'view', aliases: [] },
  filters: emptyViewFilters(),
  orderedHeaderCols: [],
}

const DEFAULT_TOOLBAR_LABELS: DatabaseViewToolbarLabels = {
  newPage: 'Criar',
  viewType: 'Tipo de visualização',
  viewTypes: {
    table: 'Tabela',
    grid: 'Grade',
    board: 'Quadros',
    calendar: 'Calendário',
    timeline: 'Cronograma',
    graph: 'Grafos',
    form: 'Formulário',
  },
  presets: 'Configurações da view',
  closePresets: 'Fechar configurações da view',
  groupBy: 'Agrupar por',
  filters: 'Filtros',
  searchColumns: 'Buscar coluna',
  noColumns: 'Nenhuma coluna encontrada',
  dragGroup: 'Alterar prioridade',
  selectGroup: 'Selecionar coluna',
  priority: 'Prioridade',
  clearGroups: 'Limpar agrupamento',
  where: 'Onde',
  column: 'Coluna',
  condition: 'Condição',
  value: 'Valor',
  valueFrom: 'Valor inicial',
  valueTo: 'Valor final',
  addFilter: 'Adicionar filtro',
  removeFilter: 'Remover filtro',
  clearFilters: 'Limpar filtros',
  true: 'Sim',
  false: 'Não',
  dateProperty: 'Propriedade de data',
  colorProperty: 'Propriedade de cor',
  defaultColor: 'Automática (primeira seleção)',
  visibleProperties: 'Propriedades visíveis',
  dragProperty: 'Reordenar propriedade',
  selectProperty: 'Mostrar propriedade',
  hideAllProperties: 'Ocultar todas',
  showPropertyLabels: 'Mostrar nomes das propriedades',
  columnLocks: 'Bloqueio de colunas',
  columnLocksDescription: 'Aplica-se a todas as views desta database.',
  columnLockSearch: 'Buscar pessoa',
  columnLockEmpty: 'Nenhum editor disponível',
  columnLockAllowed: 'Pode editar',
  columnLocked: 'Coluna bloqueada',
  conditions: {
    equals: 'Igual a',
    contains: 'Contém',
    greaterThan: 'Maior que',
    lessThan: 'Menor que',
    between: 'Entre',
  },
}

export interface CubsDatabaseProps {
  onBoardConfigChange?: (viewId: string, patch: BoardViewConfig) => void
  onBoardMove?: (viewId: string, input: BoardMoveInput) => Promise<void>
  onBoardCreateRow?: (input: BoardCreateInput) => Promise<RowData | undefined>
  /** Views salvas — chave é o ULID da view; cada uma vira uma tab da topbar. */
  settings: DataViewSettings
  /** Colunas na ordem natural de display (esq→dir); a view pode reordenar. */
  headerCols: HeaderCol[]
  rows: RowData[]
  pagination?: DatabasePagination
  onRowMove?: (viewId: string, move: DatabaseRowMove) => void | Promise<void>
  /**
   * Células em atenção (chave `cellErrorKey(rowId, columnId)`): falha de
   * escrita ou edição interrompida pelo receiver. A tabela só desenha a marca.
   */
  cellErrors?: Set<string>
  /** Modo controlado da view ativa; sem isso o componente controla sozinho. */
  activeViewId?: string
  onViewChange?: (viewId: string) => void
  /** Cria uma nova view do tipo escolhido no botão ao lado das tabs. */
  onAddView?: (kind: DataViewKind) => void | Promise<void>
  addViewLabel?: string
  /** Troca a projeção da view atual sem alterar sua identidade ou seus dados. */
  onViewKindChange?: (viewId: string, view: DataViewKind) => void
  /** Itens do ContextMenu das tabs (botão direito; app host injeta i18n). */
  viewMenuItems?: (viewId: string, actions: { startRename: () => void }) => ContextMenuItem[]
  onRenameView?: (viewId: string, name: string) => void | Promise<void>
  /** Reordena as tabs e envia a lista completa de ids para persistência. */
  onViewOrderChange?: (viewIds: string[]) => void
  /** Clique no botão "Abrir ›" de uma linha — recebe a row crua. */
  onOpenRow?: (row: RowData) => void
  /** Identidade/título da página aberta, usada como nó central do grafo. */
  pageId?: string
  pageTitle?: string
  /** Carrega filhos de um nó somente após foco ou ativação explícita. */
  onLoadGraphChildren?: (pageId: string) => Promise<RowData[]>
  /**
   * Uma célula foi editada e confirmada. A PRESENÇA desta prop é o que liga o
   * modo editável (despacho pelo cellMap de `components/cells`); sem ela a
   * tabela é read-only, como sempre foi. O payload (`CellChange`) já tem o
   * formato do futuro evento `cell-updated` do realtime — o transporte (PUT +
   * broadcast) é responsabilidade do app host.
   */
  onCellChange?: (change: CellChange) => void
  /**
   * O receiver atualizou uma célula que estava em edição. Nesse ponto o
   * rascunho já foi cancelado e o valor externo já está visível.
   */
  onCellEditConflict?: (conflict: CellEditConflict) => void
  /**
   * As options de uma coluna select foram reordenadas (drag no editor). Chega
   * o array COMPLETO na nova ordem — read-modify-write, como o snapshot das
   * views: persistir é reescrever o `options` inteiro da coluna.
   */
  onColumnOptionsChange?: (columnId: string, options: ColumnOption[]) => void
  /**
   * As LINHAS foram reordenadas por drag. Chega o id da VIEW ativa + o array
   * COMPLETO de ids de página na nova ordem — é o `orderedRows` pronto para
   * o patch atômico daquela view em `page.data`. A presença da prop é o que
   * habilita o drag de linha.
   */
  onRowOrderChange?: (viewId: string, orderedRows: string[]) => void
  /**
   * As COLUNAS foram reordenadas por drag no header. Mesmo contrato: id da
   * view + `orderedHeaderCols` completo (INCLUINDO a coluna sintética do
   * título), pronto para o snapshot.
   */
  onColumnOrderChange?: (viewId: string, orderedHeaderCols: string[]) => void
  /**
   * A seleção de linhas mudou — `selectedPagesIds` completo.
   */
  onSelectionChange?: (selectedPagesIds: string[]) => void
  /** Envia uma página/linha para a lixeira. */
  onDeleteRow?: (rowId: string) => void
  /** Envia as páginas selecionadas para a lixeira após confirmação no header. */
  onDeleteRows?: (rowIds: string[]) => void
  deletingRows?: boolean
  /**
   * Renomear coluna pelo menu do header (botão direito). Payload já no
   * formato do futuro `column-renamed` do realtime. A presença da prop é o
   * que habilita o menu.
   */
  onColumnRename?: (columnId: string, name: string) => void
  /**
   * Nome/máscara da coluna mestra `pages.title` naquela view. Diferente das
   * colunas EAV, essa apresentação pertence ao snapshot em `page.data`.
   */
  onPageTitleColumnChange?: (viewId: string, column: PageTitleColumn) => void
  /**
   * Trocar o TIPO da coluna (menu). Não-destrutivo no backend: o config e os
   * valores existentes ficam preservados.
   */
  onColumnTypeChange?: (columnId: string, type: ColumnDataType) => void
  /**
   * Config da coluna (formato/moeda de numeric, máscara de text) pelo menu.
   * `null` numa chave a LIMPA; ausente preserva (o backend mescla).
   */
  onColumnConfigChange?: (columnId: string, patch: ColumnConfigPatch) => void
  onFlowConfigChange?: (columnId: string, flow: FlowDefinition) => Promise<FlowDefinition | void> | FlowDefinition | void
  onFlowLoadMacros?: (input: { columnId: string; rowId?: string }) => Promise<FlowMacroOption[]>
  buildFlowMacroSections?: FlowMacroSectionsBuilder
  onFlowExecute?: (input: { columnId: string; rowId: string }) => Promise<FlowExecutionResult>
  /** Envia uma coluna real para a lixeira. */
  onColumnDelete?: (columnId: string) => void
  /**
   * Uma coluna foi redimensionada (alça na borda direita do header). Chega o
   * id da view + o mapa COMPLETO de larguras — o `columnWidths` pronto para o
   * snapshot. A presença da prop é o que habilita o resize.
   */
  onColumnWidthChange?: (viewId: string, columnWidths: Record<string, number>) => void
  /** Frame efêmero do drag para sincronização visual em realtime. */
  onColumnWidthPreview?: (viewId: string, columnId: string, width: number) => void
  /** Overrides efêmeros recebidos, agrupados por view e coluna. */
  columnWidthPreviews?: Record<string, Record<string, number>>
  /**
   * Documento soberano decodificado da URL para a view ativa. Ausente usa o
   * snapshot salvo; presente não altera o snapshot sozinho — o app host
   * decide a confirmação.
   */
  filtersOverride?: ViewFiltersV2
  /** Persiste atomicamente filtros + agrupamentos + passthrough canônicos. */
  onViewFiltersChange?: (viewId: string, filters: ViewFiltersV2) => void
  /** Persiste somente a configuração específica da view Calendar. */
  onCalendarConfigChange?: (viewId: string, patch: Pick<DataViewType, 'dateColumnId' | 'colorColumnId' | 'calendarPropertyIds' | 'calendarShowPropertyLabels'>) => void
  /** Persiste o tamanho dos cards no snapshot da view Grade. */
  onGridConfigChange?: (viewId: string, patch: Pick<DataViewType, 'tileSize'>) => void
  /** Persiste a configuração específica da view Form no snapshot. */
  onFormConfigChange?: (viewId: string, form: FormViewConfig) => void
  /** Envio condensado; a lib monta campos e o host decide o transporte. */
  onFormSubmit?: (viewId: string, input: FormSubmissionInput) => Promise<unknown>
  formLabels?: Partial<FormViewLabels>
  /** Agenda é injetada pelo host; a lib não conhece API, usuário ou workspace. */
  pinnedCalendarPageIds?: ReadonlySet<string>
  calendarPendingPageId?: string | null
  onCalendarPin?: (input: CalendarPinInput) => void | boolean | Promise<boolean>
  onCalendarUnpin?: (pageId: string) => void | boolean | Promise<boolean>
  onCalendarRequestPin?: (input: CalendarPinInput) => void
  /** Bloqueio global da coluna; a lib só projeta a decisão fornecida pelo host. */
  columnLocks?: ColumnLockMap
  columnLockEditors?: ColumnLockEditor[]
  lockedColumnKeys?: ReadonlySet<string>
  canManageColumnLocks?: boolean
  currentUserId?: string
  onColumnLockChange?: (columnKey: string, userIds: string[]) => void
  /** Relógio/estado de persistência e refresh remoto da view ativa. */
  filterSyncStatus?: DatabaseViewToolbarSyncStatus
  /** Traduções dos controles de filtro/agrupamento; a lib não acessa i18n. */
  toolbarLabels?: Partial<Omit<DatabaseViewToolbarLabels, 'conditions' | 'viewTypes'>> & {
    conditions?: Partial<DatabaseViewToolbarLabels['conditions']>
    viewTypes?: Partial<DatabaseViewToolbarLabels['viewTypes']>
  }
  /** Clique no controle guiado para adicionar uma linha (UI nesta etapa). */
  onAddRow?: () => void
  /** Clique no controle guiado para adicionar uma coluna (UI nesta etapa). */
  onAddColumn?: () => void
  addingColumn?: boolean
  /** Fetch inicial em andamento → skeleton. */
  loading?: boolean
  emptyLabel?: string
  /** Texto das views ainda não implementadas. */
  placeholderLabel?: string
  /** Labels de acessibilidade/texto dos controles da linha. */
  labels?: TableRowLabels
  className?: string
}

/**
 * Visualização da base simulada (PageTree): topbar de views (tabs + context
 * menu no botão direito) e a view ativa — sem chrome em volta, só a view.
 * Table é editável; Grid e Graph são projeções de leitura para explorar as
 * mesmas páginas. Os demais modos seguem identificados pelo placeholder.
 */
export function CubsDatabase({
  // Defaults defensivos: consumidor JS (sem TS) pode omitir na prática.
  settings = {},
  headerCols = [],
  rows = [],
  pagination,
  onRowMove,
  cellErrors,
  activeViewId,
  onViewChange,
  onAddView,
  addViewLabel,
  onViewKindChange,
  viewMenuItems,
  onRenameView,
  onViewOrderChange,
  onOpenRow,
  pageId,
  pageTitle,
  onLoadGraphChildren,
  onCellChange,
  onCellEditConflict,
  onColumnOptionsChange,
  onAddRow,
  onAddColumn,
  addingColumn,
  onRowOrderChange,
  onColumnOrderChange,
  onSelectionChange,
  onDeleteRow,
  onDeleteRows,
  deletingRows,
  onColumnRename,
  onPageTitleColumnChange,
  onColumnTypeChange,
  onColumnConfigChange,
  onFlowConfigChange,
  onFlowLoadMacros,
  buildFlowMacroSections,
  onFlowExecute,
  onColumnDelete,
  onColumnWidthChange,
  onColumnWidthPreview,
  columnWidthPreviews,
  filtersOverride,
  onViewFiltersChange,
  onCalendarConfigChange,
  onGridConfigChange,
  onFormConfigChange,
  onFormSubmit,
  formLabels,
  pinnedCalendarPageIds,
  calendarPendingPageId,
  onCalendarPin,
  onCalendarUnpin,
  onCalendarRequestPin,
  columnLocks,
  columnLockEditors,
  lockedColumnKeys,
  onBoardConfigChange,
  onBoardMove,
  onBoardCreateRow,
  canManageColumnLocks,
  currentUserId,
  onColumnLockChange,
  filterSyncStatus,
  toolbarLabels,
  loading,
  emptyLabel,
  placeholderLabel = 'Em breve.',
  labels,
  className,
}: CubsDatabaseProps) {
  const [internalViewId, setInternalViewId] = useState(() => Object.keys(settings)[0] ?? '')
  const [mockSettingsByView, setMockSettingsByView] = useState<Record<string, ViewMockSettings>>({})
  const [formHeaderPortalTarget, setFormHeaderPortalTarget] = useState<HTMLDivElement | null>(null)
  // A primeira personalização de uma página sem snapshot troca a sentinela
  // fallback por um ULID real. Se a view interna deixou de existir, acompanha
  // a primeira view salva em vez de cair num painel vazio até outro clique.
  const currentViewId =
    activeViewId ?? (settings[internalViewId] ? internalViewId : Object.keys(settings)[0] ?? '')
  const currentView = settings[currentViewId] ?? FALLBACK_VIEW
  const [boardCreateRequest, setBoardCreateRequest] = useState(0)
  const stableBoard = useSemanticValue(currentView.board, JSON.stringify(currentView.board ?? null))
  const mockSettingsKey = `${pageId ?? ''}:${currentViewId}`
  const localSettings = mockSettingsByView[mockSettingsKey] ?? DEFAULT_VIEW_MOCK_SETTINGS
  const mockSettings = { ...localSettings, tileSize: currentView.tileSize ?? localSettings.tileSize }
  const availableViewKinds = useMemo(
    () => headerCols.some((column) => column.type === 'flow')
      ? DATA_VIEW_KINDS
      : DATA_VIEW_KINDS.filter((kind) => kind !== 'form'),
    [headerCols],
  )

  // `view-updated` carrega o snapshot completo. HTTP e socket podem entregar
  // a mesma confirmação em momentos diferentes e cada parse cria arrays e
  // objetos novos. A tabela usa referência para reconciliar seu estado
  // otimista; portanto, estabilize as partes semanticamente idênticas para um
  // eco de filtros não parecer uma troca da database inteira.
  const stableViewTitle = useSemanticValue(
    currentView.title,
    JSON.stringify(currentView.title ?? null),
  )
  const stableOrderedHeaderCols = useSemanticValue(
    currentView.orderedHeaderCols,
    JSON.stringify(currentView.orderedHeaderCols),
  )
  const stableOrderedRows = useSemanticValue(
    currentView.orderedRows,
    JSON.stringify(currentView.orderedRows ?? null),
  )
  const stableColumnWidths = useSemanticValue(
    currentView.columnWidths,
    JSON.stringify(currentView.columnWidths ?? null),
  )
  const stableCalendarPropertyIds = useSemanticValue(
    currentView.calendarPropertyIds,
    JSON.stringify(currentView.calendarPropertyIds ?? null),
  )
  const stableForm = useSemanticValue(
    currentView.form,
    JSON.stringify(currentView.form ?? null),
  )

  const basePageTitleColumn = useMemo(
    () => headerCols.find((column) => column.key === 'title'),
    [headerCols],
  )
  const pageTitleColumn = useMemo<PageTitleColumn>(
    () =>
      stableViewTitle ?? {
        key: 'title',
        column_name: basePageTitleColumn?.title ?? '',
        ...(basePageTitleColumn?.mask && { mask: basePageTitleColumn.mask }),
        ...(basePageTitleColumn?.publicKey && { publicKey: basePageTitleColumn.publicKey }),
      },
    [basePageTitleColumn, stableViewTitle],
  )

  // O mesmo `pages.title` pode aparecer como "Docente" numa view e "Nome"
  // em outra. A coluna base mantém a identidade; o snapshot troca apenas a
  // apresentação que desce para a tabela ativa.
  const viewHeaderCols = useMemo(
    () =>
      headerCols.map((column) =>
        column.key === 'title'
          ? {
              ...column,
              title: pageTitleColumn.column_name,
              mask: pageTitleColumn.mask,
              publicKey: pageTitleColumn.publicKey ?? column.publicKey,
            }
          : column,
      ),
    [headerCols, pageTitleColumn],
  )

  const handleViewChange = (viewId: string) => {
    setInternalViewId(viewId)
    onViewChange?.(viewId)
  }

  // Memoizados de propósito: o TableView usa estes arrays como BASE do estado
  // otimista (ordem local re-sincroniza quando a prop muda). Sem memo, cada
  // render daqui criaria um array novo e o sync descartaria o otimismo.
  const orderedColumns = useMemo(
    () => reorderByIds(viewHeaderCols, stableOrderedHeaderCols),
    [stableOrderedHeaderCols, viewHeaderCols],
  )
  const orderedRows = useMemo(
    () => pagination ? rows : reorderByIds(rows, stableOrderedRows ?? []),
    [rows, stableOrderedRows, pagination],
  )
  const effectiveFilters = filtersOverride ?? currentView.filters
  const parsedFilters = useMemo(() => parseViewFilters(effectiveFilters), [effectiveFilters])
  const tableFilters = useSemanticValue(
    parsedFilters,
    viewFiltersSemanticSignature(parsedFilters),
  )
  const filteredRows = useMemo(
    () => pagination ? orderedRows : applyViewFilters(orderedRows, orderedColumns, tableFilters.clauses),
    [orderedColumns, orderedRows, tableFilters.clauses, pagination],
  )
  const resolvedToolbarLabels = useMemo<DatabaseViewToolbarLabels>(
    () => ({
      ...DEFAULT_TOOLBAR_LABELS,
      ...toolbarLabels,
      conditions: {
        ...DEFAULT_TOOLBAR_LABELS.conditions,
        ...toolbarLabels?.conditions,
      },
      viewTypes: {
        ...DEFAULT_TOOLBAR_LABELS.viewTypes,
        ...toolbarLabels?.viewTypes,
      },
    }),
    [toolbarLabels],
  )
  const previewWidths = columnWidthPreviews?.[currentViewId]
  const displayedColumnWidths = useMemo(
    () =>
      previewWidths
        ? { ...(stableColumnWidths ?? {}), ...previewWidths }
        : stableColumnWidths,
    [previewWidths, stableColumnWidths],
  )

  const handleColumnRename = useCallback(
    (columnId: string, name: string) => {
      const column = viewHeaderCols.find((candidate) => candidate.id === columnId)
      if (column?.key === 'title') {
        onPageTitleColumnChange?.(currentViewId, { ...pageTitleColumn, column_name: name })
        return
      }
      onColumnRename?.(columnId, name)
    },
    [currentViewId, onColumnRename, onPageTitleColumnChange, pageTitleColumn, viewHeaderCols],
  )

  const handleColumnConfigChange = useCallback(
    (columnId: string, patch: ColumnConfigPatch) => {
      const column = viewHeaderCols.find((candidate) => candidate.id === columnId)
      if (column?.key === 'title') {
        // `title` é sempre text; do patch genérico só a máscara se aplica.
        const mask = 'mask' in patch ? (patch.mask ?? undefined) : pageTitleColumn.mask
        onPageTitleColumnChange?.(currentViewId, {
          key: 'title',
          column_name: pageTitleColumn.column_name,
          ...(mask && { mask }),
          ...(pageTitleColumn.publicKey && { publicKey: pageTitleColumn.publicKey }),
        })
        return
      }
      onColumnConfigChange?.(columnId, patch)
    },
    [
      currentViewId,
      onColumnConfigChange,
      onPageTitleColumnChange,
      pageTitleColumn,
      viewHeaderCols,
    ],
  )

  return (
    <section className={cn('w-full', className)}>
      {pagination?.error && !pagination.projection ? <button type="button" className="w-full rounded-md border border-p-red/20 px-3 py-2 text-sm text-p-red" onClick={() => pagination.retry?.()}>Não foi possível carregar as páginas. Tentar novamente</button> : null}
      <ViewTabsBar
        settings={settings}
        activeViewId={currentViewId}
        onViewChange={handleViewChange}
        onAddView={onAddView}
        addViewLabel={addViewLabel}
        viewTypeLabels={resolvedToolbarLabels.viewTypes}
        availableViewKinds={availableViewKinds}
        viewMenuItems={viewMenuItems}
        onRenameView={onRenameView}
        onViewOrderChange={onViewOrderChange}
      />

      <DatabaseViewToolbar
        columns={orderedColumns}
        rows={orderedRows}
        viewKind={currentView.view}
        filters={effectiveFilters}
        labels={resolvedToolbarLabels}
        syncStatus={filterSyncStatus}
        settings={mockSettings}
        onSettingsChange={(patch) => {
          if (patch.tileSize !== undefined && onGridConfigChange) {
            onGridConfigChange(currentViewId, { tileSize: patch.tileSize })
            return
          }
          setMockSettingsByView((previous) => ({
            ...previous,
            [mockSettingsKey]: { ...(previous[mockSettingsKey] ?? DEFAULT_VIEW_MOCK_SETTINGS), ...patch },
          }))
        }}
        calendar={{ dateColumnId: currentView.dateColumnId, colorColumnId: currentView.colorColumnId, calendarShowPropertyLabels: currentView.calendarShowPropertyLabels }}
        onCalendarChange={onCalendarConfigChange ? (patch) => onCalendarConfigChange(currentViewId, patch) : undefined}
        calendarPropertyIds={stableCalendarPropertyIds}
        onCalendarPropertyIdsChange={onCalendarConfigChange ? (calendarPropertyIds) => onCalendarConfigChange(currentViewId, { calendarPropertyIds }) : undefined}
        board={stableBoard}
        onBoardChange={onBoardConfigChange ? (patch) => onBoardConfigChange(currentViewId, patch) : undefined}
        form={stableForm}
        onFormChange={onFormConfigChange ? (form) => onFormConfigChange(currentViewId, form) : undefined}
        formHeaderPortalRef={setFormHeaderPortalTarget}
        columnLocks={columnLocks}
        columnLockEditors={columnLockEditors}
        canManageColumnLocks={canManageColumnLocks}
        currentUserId={currentUserId}
        onColumnLockChange={onColumnLockChange}
        onAddRow={currentView.view === 'board' ? onBoardCreateRow ? () => setBoardCreateRequest((value) => value + 1) : undefined : onAddRow}
        onViewKindChange={
          onViewKindChange
            ? (view) => onViewKindChange(currentViewId, view)
            : undefined
        }
        availableViewKinds={availableViewKinds}
        onChange={
          onViewFiltersChange
            ? (filters) => onViewFiltersChange(currentViewId, filters)
            : undefined
        }
      />

      <div data-database-view-container className="mt-3.5 pb-6">
        {currentView.view === 'table' ? (
          <TableView
            key={currentViewId}
            columns={orderedColumns}
            rows={filteredRows}
            pagination={pagination}
            onRowMove={onRowMove ? (move) => onRowMove(currentViewId, move) : undefined}
            groupBy={tableFilters.groupBy}
            columnWidths={displayedColumnWidths}
            cellErrors={cellErrors}
            loading={loading}
            emptyLabel={emptyLabel}
            onOpenRow={onOpenRow}
            onCellChange={onCellChange}
            lockedColumnKeys={lockedColumnKeys}
            onCellEditConflict={onCellEditConflict}
            onColumnOptionsChange={onColumnOptionsChange}
            onRowOrderChange={
              onRowOrderChange ? (ids) => onRowOrderChange(currentViewId, ids) : undefined
            }
            onColumnOrderChange={
              onColumnOrderChange ? (ids) => onColumnOrderChange(currentViewId, ids) : undefined
            }
            onSelectionChange={onSelectionChange}
            onDeleteRow={onDeleteRow}
            onDeleteRows={onDeleteRows}
            deletingRows={deletingRows}
            onColumnRename={
              onColumnRename || onPageTitleColumnChange ? handleColumnRename : undefined
            }
            onColumnTypeChange={onColumnTypeChange}
            onColumnConfigChange={
              onColumnConfigChange || onPageTitleColumnChange
                ? handleColumnConfigChange
                : undefined
            }
            onFlowConfigChange={onFlowConfigChange}
            onFlowLoadMacros={onFlowLoadMacros}
            buildFlowMacroSections={buildFlowMacroSections}
            onFlowExecute={onFlowExecute}
            onColumnDelete={onColumnDelete}
            onColumnWidthChange={
              onColumnWidthChange
                ? (widths) => onColumnWidthChange(currentViewId, widths)
                : undefined
            }
            onColumnWidthPreview={
              onColumnWidthPreview
                ? (columnId, width) =>
                    onColumnWidthPreview(currentViewId, columnId, width)
                : undefined
            }
            onAddRow={onAddRow}
            onAddColumn={onAddColumn}
            addingColumn={addingColumn}
            labels={labels}
          />
        ) : currentView.view === 'grid' ? (
          <GridView
            columns={orderedColumns}
            rows={filteredRows}
            pagination={pagination}
            tileSize={mockSettings.tileSize}
            emptyLabel={emptyLabel}
            onOpenRow={onOpenRow}
            onCellChange={onCellChange}
            onCellEditConflict={onCellEditConflict}
            cellErrors={cellErrors}
            lockedColumnKeys={lockedColumnKeys}
          />
        ) : currentView.view === 'board' ? (
          <BoardView key={currentViewId} columns={orderedColumns} rows={filteredRows} allRows={orderedRows} config={stableBoard}
            pagination={pagination}
            onConfigChange={onBoardConfigChange ? (patch) => onBoardConfigChange(currentViewId, patch) : undefined}
            onMove={onBoardMove ? (input) => onBoardMove(currentViewId, input) : undefined} onCreateRow={onBoardCreateRow}
            createRequest={boardCreateRequest} onOpenRow={onOpenRow} onCellChange={onCellChange} onCellEditConflict={onCellEditConflict}
            cellErrors={cellErrors} lockedColumnKeys={lockedColumnKeys} onColumnConfigChange={onColumnConfigChange}
            onColumnOptionsChange={onColumnOptionsChange}
            onFlowConfigChange={onFlowConfigChange} onFlowLoadMacros={onFlowLoadMacros} buildFlowMacroSections={buildFlowMacroSections} onFlowExecute={onFlowExecute} />
        ) : currentView.view === 'calendar' ? (
          <CalendarView key={currentViewId} columns={orderedColumns} rows={filteredRows}
            pagination={pagination}
            dateColumnId={currentView.dateColumnId} colorColumnId={currentView.colorColumnId}
            calendarPropertyIds={stableCalendarPropertyIds}
            showPropertyLabels={currentView.calendarShowPropertyLabels !== false}
            onOpenRow={onOpenRow} pinnedPageIds={pinnedCalendarPageIds}
            pendingPageId={calendarPendingPageId} onPin={onCalendarPin} onUnpin={onCalendarUnpin}
            onRequestPin={onCalendarRequestPin}
            sourceTitle={pageTitle} />
        ) : currentView.view === 'graph' ? (
          <GraphView
            key={`${pageId ?? ''}:${currentViewId}`}
            rootId={pageId ?? currentViewId}
            rootTitle={pageTitle || currentView.name || 'Página atual'}
            rows={filteredRows}
            pagination={pagination}
            loadSubItems={mockSettings.loadSubItems}
            onLoadChildren={onLoadGraphChildren}
          />
        ) : currentView.view === 'form' ? (
          <FormView
            lockedColumnKeys={lockedColumnKeys}
            key={currentViewId}
            columns={orderedColumns}
            config={stableForm}
            labels={formLabels}
            headerPortalTarget={formHeaderPortalTarget}
            onConfigChange={onFormConfigChange ? (form) => onFormConfigChange(currentViewId, form) : undefined}
            onFieldOrderChange={onColumnOrderChange ? (ids) => onColumnOrderChange(currentViewId, ids) : undefined}
            onSubmit={onFormSubmit ? (input) => onFormSubmit(currentViewId, input) : undefined}
          />
        ) : (
          <div
            key={`${currentViewId}:${currentView.view}`}
            className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-divider-contrast px-4 py-8 opacity-60"
          >
            <Icon icon={VIEW_KIND_ICON[currentView.view]} fontSize={22} />
            <strong className="text-sm font-semibold">
              {resolvedToolbarLabels.viewTypes[currentView.view]}
            </strong>
            <span className="text-sm">{placeholderLabel}</span>
          </div>
        )}
      </div>
    </section>
  )
}
