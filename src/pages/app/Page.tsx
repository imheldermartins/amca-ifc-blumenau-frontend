import {FormulaDrawer, type FormulaTarget} from '@/components/FormulaDrawer'
import { usePageAccess } from '@/hooks/usePageAccess'
import { can } from '@/services/AccessService'
import { useCallback, useEffect, useMemo, useState, useRef } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { CubsDatabase, DatabaseMentionProvider } from 'cubs-database'
import { MentionScopeProvider } from '@/contexts/MentionContext'
import { useMention } from '@/hooks/useMention'
import { mentionIds, mentionToken } from '@/shared/mentions'
import type {
  CalendarPinInput,
  ColumnConfigPatch,
  ColumnDataType,
  DataViewKind,
  DataViewSettings,
  HeaderCol,
  RowData,
} from 'cubs-database'
import { databaseCalendarItems } from 'cubs-database'

import { PageShell } from '@components/PageShell'
import {useCalendarPageModal} from '@/hooks/useCalendarPageModal'
import type {DatabaseCreateRequest} from 'cubs-database'
import { SchedulePinRequestDialog, type SchedulePinRequestTarget } from '@/components/SchedulePinRequestDialog'
import type { PageContentView } from '@components/PageContentViewSwitcher'
import { ReplaceViewFiltersContent } from '@components/ReplaceViewFiltersModal'
import { DeleteViewConfirmationContent } from '@components/DeleteViewConfirmationModal'
import { FormPublicationDialog } from '@components/FormPublicationDialog'
import { ColumnRelationRollupDialog, type ColumnRelationRollupTarget } from '@/components/ColumnRelationRollupDialog'
import { PageBlockEditor, type PageBlockEditorHandle } from './PageBlockEditor'
import { PdfExportContent } from '@/components/PagePdfControls'
import { useLanguage } from '@/contexts/LanguageContext'
import { useWorkspace } from '@/contexts/WorkspaceContext'
import { useDatabaseViewQuery } from '@/hooks/useDatabaseViewQuery'
import { useColumnLocks, usePageTitleLock } from '@/hooks/useColumnLocks'
import { usePageDatabase } from '@/hooks/usePageDatabase'
import { useDatabasePagination, type DatabaseProjectionBridge } from '@/hooks/useDatabasePagination'
import { useSchedule } from '@/hooks/useSchedule'
import { i18n } from '@/lib/i18n'
import { parseHeaderCols } from '@/lib/databaseParser'
import { databaseService } from '@/services/DatabaseService'
import { createPageNavigationState, readRowPageTitle } from '@/lib/pageNavigation'
import { useModal, type ModalHandle } from '@/hooks/useModal'

export interface PageProps {
  /** Identidade canônica da página, resolvida pelo TanStack Router. */
  pageId: string
  /** Título já conhecido pela tela que abriu esta página. */
  initialTitle?: string | null
}

/**
 * Fallbacks de identidade ESTÁVEL para o estado "ainda carregando".
 *
 * Não é preciosismo: `settings={database?.settings ?? {}}` cria um objeto novo
 * a cada render, e a `CubsDatabase` usa essas props como dependência de
 * `useMemo` e como base do estado otimista do `TableView`. Literal novo =
 * memo invalidado = ordem otimista descartada.
 */
const EMPTY_SETTINGS: DataViewSettings = {}
const EMPTY_COLUMNS: HeaderCol[] = []
const loadGraphColumns = async (parentId: string) => parseHeaderCols(await databaseService.getColumns(parentId), i18n('pages.app.cubs-database.coluna-titulo'))
const EMPTY_ROWS: RowData[] = []

/**
 * Componente de aplicação da página: unifica shell e recursos de conteúdo.
 * Todos os caminhos de entrada convergem em `/page/:id`, inclusive a página
 * inicial resolvida por `/workspace/:id`.
 *
 * O estado e a escrita moram no `usePageDatabase`; aqui só a composição.
 *
 * **Toda prop de objeto/função é memoizada de propósito.** A `CubsDatabase`
 * memoiza os componentes internos (linha, célula, editores), e comparação
 * rasa não sobrevive a um literal recriado a cada render: um `labels={{...}}`
 * inline desce até TODAS as células e invalida o `memo` de cada uma. A
 * memoização da lib só vale se o host cooperar — é aqui que ela começa.
 */
export function Page({ pageId, initialTitle }: PageProps) {
  return <MentionScopeProvider scope={{ pageId }}><PageContent pageId={pageId} initialTitle={initialTitle} /></MentionScopeProvider>
}

function PageContent({ pageId, initialTitle }: PageProps) {
  const openCalendarPage = useCalendarPageModal()
  const queryClient = useQueryClient()
  const mention = useMention()
  const trackMentionText = useCallback((text: string) => mention.register(mentionIds(text)), [mention.register])
  const mentionInput = useMemo(() => ({ options: mention.options, resolve: mention.resolve, token: mentionToken, track: trackMentionText, label: i18n('mentions.label'), empty: i18n('mentions.empty'), unavailable: i18n('mentions.unavailable') }), [mention.options, mention.resolve, trackMentionText])
  const { openModal } = useModal()
  const filterConflictModalRef = useRef<ModalHandle | null>(null)
  const projectionBridge = useRef<DatabaseProjectionBridge | null>(null)
  const [contentView, setContentView] = useState<PageContentView>('files')
  const [pdfSelection, setPdfSelection] = useState<{ pageId: string; ids: string[] }>({ pageId, ids: [] })
  const blockEditorRef = useRef<PageBlockEditorHandle | null>(null)
  const openPdf = useCallback((selectedIds: string[] = []) => {
    openModal({ size: selectedIds.length > 1 ? 'md' : 'xl', className: 'overflow-hidden p-0', content: <PdfExportContent pageId={pageId} selectedIds={selectedIds} beforeGenerate={async () => {
      if (blockEditorRef.current?.pageId === pageId) await blockEditorRef.current.flush()
    }} /> })
  }, [openModal, pageId])
  const handlePdfSelection = useCallback((ids: string[]) => setPdfSelection({ pageId, ids }), [pageId])
  // O documento resolve blocos de formulário contra o mesmo catálogo de views;
  // por isso a base permanece carregada também fora da tab `files`.
  const databasePageId = pageId
  const permissions = usePageAccess(pageId)
  const mayEdit = can(permissions.data, 'write', 'update')
  const mayEditRows = mayEdit && can(permissions.data, 'write', 'edit_subpages')
  const { slug: currentLang } = useLanguage()
  const { workspaceId } = useWorkspace()
  const schedule = useSchedule(workspaceId, { realtime: false })
  const columnLocks = useColumnLocks(databasePageId)
  const pageTitleLock = usePageTitleLock(pageId)
  const navigate = useNavigate()
  const {
    database,
    loading,
    failed,
    deletingRows,
    addingColumn,
    cellErrors,
    columnWidthPreviews,
    realtimeOptions,
    handlers,
    replaceLoadedRows,
  } = usePageDatabase(databasePageId, projectionBridge)
  const onStructureChanged = realtimeOptions.onStructureChanged
  const handlePdfStructureChanged = useCallback((event: Parameters<NonNullable<typeof onStructureChanged>>[0]) => {
    onStructureChanged?.(event)
    void queryClient.invalidateQueries({ queryKey: ['page-pdf-catalog', pageId] })
    void queryClient.invalidateQueries({ queryKey: ['mentions'] })
  }, [onStructureChanged, pageId, queryClient])
  const addView = handlers.onAddView
  const duplicateView = handlers.onDuplicateView
  const deleteView = handlers.onDeleteView
  const [preferredViewId, setPreferredViewId] = useState('')
  const [pendingCreatedView, setPendingCreatedView] = useState<{ pageId: string; viewId: string } | null>(null)
  const [formulaTarget,setFormulaTarget]=useState<{pageId:string;config:FormulaTarget}|null>(null)
  const settings = database?.settings ?? EMPTY_SETTINGS
  const columns = database?.headerCols ?? EMPTY_COLUMNS
  const lockedColumnKeys = useMemo(() => columnLocks.isPending || columnLocks.isError
    ? new Set(columns.map((column) => column.key === 'title' ? 'title' : column.id))
    : columnLocks.lockedColumnKeys, [columns, columnLocks.isPending, columnLocks.isError, columnLocks.lockedColumnKeys])
  const viewQuery = useDatabaseViewQuery({
    settings,
    columns,
    preferredViewId,
    scopeKey: databasePageId,
    onPersistFilters: mayEdit ? handlers.onViewFiltersChange : async () => undefined,
  })
  const changeView = viewQuery.changeView
  useEffect(() => { setPdfSelection((current) => current.pageId === pageId && !current.ids.length ? current : { pageId, ids: [] }) }, [pageId, contentView, viewQuery.activeViewId])
  const paged = useDatabasePagination({ pageId, viewId: viewQuery.activeViewId, view: settings[viewQuery.activeViewId], columns, filters: viewQuery.effectiveFilters, enabled: contentView === 'files' && Boolean(database) && !failed, onRows: replaceLoadedRows })
  projectionBridge.current = paged.bridge
  const pinnedCalendarPageIds = useMemo(() => new Set(schedule.pins.map((pin) => pin.pageId)), [schedule.pins])

  const handleCalendarPin = useCallback((input: CalendarPinInput) => {
    if (!workspaceId || !pageId) return
    const row = database?.rows.find((candidate) => candidate.id === input.pageId)
    const projected = row ? databaseCalendarItems([row], columns, input.dateColumnId, input.colorColumnId)[0] : undefined
    const properties = projected?.type === 'page' ? projected.data.properties ?? [] : []
    return schedule.pin({
      ...input,
      ...(projected && {
        optimisticItem: {
          id: `optimistic:${input.pageId}`,
          workspaceId,
          pageId: input.pageId,
          sourcePageId: pageId,
          sourceTitle: database?.pageTitle ?? initialTitle ?? null,
          title: projected.title,
          dateColumnId: input.dateColumnId,
          colorColumnId: input.colorColumnId ?? null,
          start: projected.start,
          ...(projected.end && { end: projected.end }),
          allDay: Boolean(projected.allDay),
          color: projected.color ?? 'purple',
          properties: properties.map((property) => ({ id: property.id, label: property.label, value: String(property.value) })),
          pinnedAt: new Date().toISOString(),
        },
      }),
    })
  }, [columns, database?.pageTitle, database?.rows, initialTitle, pageId, schedule, workspaceId])

  const handleCalendarRequestPin = useCallback((input: CalendarPinInput) => {
    const row = database?.rows.find((candidate) => candidate.id === input.pageId)
    if (!row) return
    const target: SchedulePinRequestTarget = { ...input, title: readRowPageTitle(row) ?? i18n('pages.app.pagina.sem-titulo') }
    openModal({
      size: 'sm',
      content: ({ closeModal }) => <SchedulePinRequestDialog
        onClose={closeModal}
        workspaceId={workspaceId}
        target={target}
      />,
    })
  }, [database?.rows, openModal, workspaceId])

  useEffect(() => {
    if (!pendingCreatedView || !pageId || pendingCreatedView.pageId !== pageId) return
    if (!settings[pendingCreatedView.viewId]) return
    setPreferredViewId(pendingCreatedView.viewId)
    changeView(pendingCreatedView.viewId)
    setPendingCreatedView(null)
  }, [changeView, pageId, pendingCreatedView, settings])

  const broken = failed || (!paged.pagination.projection && Boolean(paged.error))
  // `currentLang` na lista de dependências é PROPOSITAL, e o linter reclama
  // porque não consegue ver a ligação: `i18n()` lê do singleton do i18next,
  // não de uma variável do escopo. Trocar de idioma muda o slug da rota, e é
  // esse slug que precisa regerar os rótulos — sem a dependência, a tabela
  // ficaria no idioma anterior até algum outro motivo a re-renderizar.
  const labels = useMemo(
    () => ({
      drag: i18n('pages.app.cubs-database.arrastar-linha'),
      select: i18n('pages.app.cubs-database.selecionar-linha'),
      selectAll: i18n('pages.app.cubs-database.selecionar-todas'),
      open: i18n('pages.app.cubs-database.abrir'),
      rowActions: i18n('pages.app.cubs-database.acoes-pagina'),
      columnActions: i18n('pages.app.cubs-database.acoes-coluna'),
      selectRowAction: i18n('pages.app.cubs-database.selecionar'),
      moveUp: i18n('pages.app.cubs-database.mover-para-cima'),
      moveDown: i18n('pages.app.cubs-database.mover-para-baixo'),
      moveToTrash: i18n('pages.app.cubs-database.mover-para-lixeira'),
      confirmMoveToTrash: i18n('pages.app.cubs-database.confirmar-lixeira'),
      moveSelectedToTrash: (count: number) => i18n('pages.app.cubs-database.lixeira-selecionadas', { count }),
      confirmSelectedToTrash: (count: number) => i18n('pages.app.cubs-database.confirmar-lixeira-selecionadas', { count }),
      dragOption: i18n('pages.app.cubs-database.arrastar-option'),
      datePicker: {
        chooseDate: i18n('pages.app.cubs-database.date-picker.escolher'),
        calendar: i18n('pages.app.cubs-database.date-picker.calendario'),
        previousMonth: i18n('pages.app.cubs-database.date-picker.mes-anterior'),
        nextMonth: i18n('pages.app.cubs-database.date-picker.proximo-mes'),
        date: i18n('pages.app.cubs-database.date-picker.data'),
        startDate: i18n('pages.app.cubs-database.date-picker.data-inicial'),
        endDate: i18n('pages.app.cubs-database.date-picker.data-final'),
        time: i18n('pages.app.cubs-database.date-picker.horario'),
        startTime: i18n('pages.app.cubs-database.date-picker.hora-inicial'),
        endTime: i18n('pages.app.cubs-database.date-picker.hora-final'),
        includeTime: i18n('pages.app.cubs-database.date-picker.incluir-horario'),
        range: i18n('pages.app.cubs-database.date-picker.intervalo'),
        clear: i18n('pages.app.cubs-database.date-picker.limpar'),
        apply: i18n('pages.app.cubs-database.date-picker.aplicar'),
        invalidDate: i18n('pages.app.cubs-database.date-picker.data-invalida'),
        weekdays: [
          i18n('pages.app.cubs-database.date-picker.dias.domingo'),
          i18n('pages.app.cubs-database.date-picker.dias.segunda'),
          i18n('pages.app.cubs-database.date-picker.dias.terca'),
          i18n('pages.app.cubs-database.date-picker.dias.quarta'),
          i18n('pages.app.cubs-database.date-picker.dias.quinta'),
          i18n('pages.app.cubs-database.date-picker.dias.sexta'),
          i18n('pages.app.cubs-database.date-picker.dias.sabado'),
        ] as const,
      },
      dragColumn: i18n('pages.app.cubs-database.arrastar-coluna'),
      resizeColumn: i18n('pages.app.cubs-database.redimensionar-coluna'),
      addRow: i18n('pages.app.cubs-database.adicionar-linha'),
      addColumn: i18n('pages.app.cubs-database.adicionar-coluna'),
      renameColumn: i18n('pages.app.cubs-database.renomear-coluna'),
      columnTypes: {
        text: i18n('pages.app.cubs-database.tipos.text'),
        numeric: i18n('pages.app.cubs-database.tipos.numeric'),
        select: i18n('pages.app.cubs-database.tipos.select'),
        date: i18n('pages.app.cubs-database.tipos.date'),
        checkbox: i18n('pages.app.cubs-database.tipos.checkbox'),
        flow: i18n('pages.app.cubs-database.tipos.flow'),
        relation: i18n('pages.app.cubs-database.tipos.relation'),
        extract_as: i18n('pages.app.cubs-database.tipos.extract_as'),
        formula: 'Fórmula',
      },
      columnTypeSections: {
        base: i18n('pages.app.cubs-database.secoes-tipos.base'),
        automation: i18n('pages.app.cubs-database.secoes-tipos.automation'),
        advanced: i18n('pages.app.cubs-database.secoes-tipos.advanced'),
      },
      // Menu de coluna (submenus + editor de options).
      changeType: i18n('pages.app.cubs-database.coluna.tipo'),
      optionsMenu: i18n('pages.app.cubs-database.coluna.opcoes'),
      formatMenu: i18n('pages.app.cubs-database.coluna.formato'),
      maskMenu: i18n('pages.app.cubs-database.coluna.mascara'),
      formatPercentage: i18n('pages.app.cubs-database.coluna.percentual'),
      formatCurrency: i18n('pages.app.cubs-database.coluna.moeda'),
      currencyBRL: i18n('pages.app.cubs-database.coluna.brl'),
      none: i18n('pages.app.cubs-database.coluna.nenhum'),
      addOption: i18n('pages.app.cubs-database.coluna.adicionar-opcao'),
      selectOption: i18n('pages.app.cubs-database.coluna.selecionar-opcao'),
      deleteOption: i18n('pages.app.cubs-database.coluna.excluir-opcao'),
      optionColor: i18n('pages.app.cubs-database.coluna.cor-opcao'),
      optionNamePlaceholder: i18n('pages.app.cubs-database.coluna.nome-opcao'),
      flowConfig: i18n('pages.app.cubs-database.coluna.configurar-flow'),
      masks: {
        cpf: i18n('pages.app.cubs-database.mascaras.cpf'),
        cep: i18n('pages.app.cubs-database.mascaras.cep'),
        'phone-br': i18n('pages.app.cubs-database.mascaras.telefone'),
        date: i18n('pages.app.cubs-database.mascaras.data'),
        email: i18n('pages.app.cubs-database.mascaras.email'),
      },
      groupEmpty: i18n('pages.app.cubs-database.agrupar.sem-valor'),
      groupTrue: i18n('pages.app.cubs-database.agrupar.sim'),
      groupFalse: i18n('pages.app.cubs-database.agrupar.nao'),
      groupRow: i18n('pages.app.cubs-database.agrupar.linha'),
      groupRows: i18n('pages.app.cubs-database.agrupar.linhas'),
    }),
    // oxlint-disable-next-line react-hooks/exhaustive-deps
    [currentLang],
  )

  const toolbarLabels = useMemo(
    () => ({
      newPage: i18n('pages.app.cubs-database.nova'),
      viewType: i18n('pages.app.cubs-database.view-tipo'),
      viewTypes: {
        table: i18n('pages.app.cubs-database.views.table'),
        grid: i18n('pages.app.cubs-database.views.grid'),
        board: i18n('pages.app.cubs-database.views.board'),
        calendar: i18n('pages.app.cubs-database.views.calendar'),
        timeline: i18n('pages.app.cubs-database.views.timeline'),
        graph: i18n('pages.app.cubs-database.views.graph'),
        form: i18n('pages.app.cubs-database.views.form'),
      },
      presets: i18n('pages.app.cubs-database.predefinicoes'),
      closePresets: i18n('pages.app.cubs-database.fechar-predefinicoes'),
      groupBy: i18n('pages.app.cubs-database.agrupar.trigger'),
      filters: i18n('pages.app.cubs-database.filtros.trigger'),
      searchColumns: i18n('pages.app.cubs-database.agrupar.buscar'),
      noColumns: i18n('pages.app.cubs-database.agrupar.vazio'),
      dragGroup: i18n('pages.app.cubs-database.agrupar.arrastar'),
      selectGroup: i18n('pages.app.cubs-database.agrupar.selecionar'),
      priority: i18n('pages.app.cubs-database.agrupar.prioridade'),
      clearGroups: i18n('pages.app.cubs-database.agrupar.limpar'),
      where: i18n('pages.app.cubs-database.filtros.onde'),
      column: i18n('pages.app.cubs-database.filtros.coluna'),
      condition: i18n('pages.app.cubs-database.filtros.condicao'),
      value: i18n('pages.app.cubs-database.filtros.valor'),
      valueFrom: i18n('pages.app.cubs-database.filtros.valor-inicial'),
      valueTo: i18n('pages.app.cubs-database.filtros.valor-final'),
      selectedOption: i18n('pages.app.cubs-database.filtros.opcao-selecionada'),
      selectedOptions: i18n('pages.app.cubs-database.filtros.opcoes-selecionadas'),
      addFilter: i18n('pages.app.cubs-database.filtros.adicionar'),
      removeFilter: i18n('pages.app.cubs-database.filtros.remover'),
      clearFilters: i18n('pages.app.cubs-database.filtros.limpar'),
      true: i18n('pages.app.cubs-database.agrupar.sim'),
      false: i18n('pages.app.cubs-database.agrupar.nao'),
      dateProperty: i18n('pages.app.cubs-database.calendar.propriedade-data'),
      colorProperty: i18n('pages.app.cubs-database.calendar.propriedade-cor'),
      defaultColor: i18n('pages.app.cubs-database.calendar.roxo-padrao'),
      visibleProperties: i18n('pages.app.cubs-database.calendar.propriedades-visiveis'),
      dragProperty: i18n('pages.app.cubs-database.calendar.reordenar-propriedade'),
      selectProperty: i18n('pages.app.cubs-database.calendar.mostrar-propriedade'),
      hideAllProperties: i18n('pages.app.cubs-database.calendar.ocultar-todas'),
      showPropertyLabels: i18n('pages.app.cubs-database.calendar.mostrar-labels'),
      columnLocks: i18n('pages.app.cubs-database.lock.title'),
      columnLocksDescription: i18n('pages.app.cubs-database.lock.description'),
      columnLockSearch: i18n('pages.app.cubs-database.lock.search'),
      columnLockEmpty: i18n('pages.app.cubs-database.lock.empty'),
      columnLockAllowed: i18n('pages.app.cubs-database.lock.allowed'),
      columnLocked: i18n('pages.app.cubs-database.lock.locked'),
      formFlow: i18n('pages.app.cubs-database.form.flow'),
      formButtonLabel: i18n('pages.app.cubs-database.form.button-label'),
      formButtonIcon: i18n('pages.app.cubs-database.form.button-icon'),
      formIconPicker: {
        choose: i18n('pages.app.cubs-database.form.icon-choose'),
        search: i18n('pages.app.cubs-database.form.icon-search'),
        empty: i18n('pages.app.cubs-database.form.icon-empty'),
        loading: i18n('pages.app.cubs-database.form.icon-loading'),
        loadMore: i18n('pages.app.cubs-database.form.icon-more'),
      },
      conditions: {
        equals: i18n('pages.app.cubs-database.filtros.condicoes.igual'),
        contains: i18n('pages.app.cubs-database.filtros.condicoes.contem'),
        greaterThan: i18n('pages.app.cubs-database.filtros.condicoes.maior'),
        lessThan: i18n('pages.app.cubs-database.filtros.condicoes.menor'),
        between: i18n('pages.app.cubs-database.filtros.condicoes.entre'),
      },
    }),
    // oxlint-disable-next-line react-hooks/exhaustive-deps
    [currentLang],
  )

  const handleViewChange = useCallback(
    (viewId: string) => {
      setPreferredViewId(viewId)
      changeView(viewId)
    },
    [changeView],
  )

  const formLabels = useMemo(
    () => ({
      builder: i18n('pages.app.cubs-database.form.builder'),
      preview: i18n('pages.app.cubs-database.form.preview'),
      fields: i18n('pages.app.cubs-database.form.fields'),
      noFields: i18n('pages.app.cubs-database.form.no-fields'),
      noFlow: i18n('pages.app.cubs-database.form.no-flow'),
      hideField: i18n('pages.app.cubs-database.form.hide-field'),
      showField: i18n('pages.app.cubs-database.form.show-field'),
      hiddenField: i18n('pages.app.cubs-database.form.hidden-field'),
      submitUnavailable: i18n('pages.app.cubs-database.form.submit-unavailable'),
      submitError: i18n('pages.app.cubs-database.form.submit-error'),
      submitSuccess: i18n('pages.app.cubs-database.form.submit-success'),
      datePicker: labels.datePicker,
    }),
    // oxlint-disable-next-line react-hooks/exhaustive-deps
    [currentLang],
  )

  const handleContentViewChange = useCallback((next: PageContentView) => {
    setContentView(next)
    // Cada renderer começa com uma URL limpa. A tab `files` repõe somente
    // sua query canônica (`view`, `fv`, filtros) depois que a base carregar.
    void navigate({ to: '.', search: {}, replace: true })
  }, [navigate])

  const handleAddView = useCallback(
    async (kind: DataViewKind) => {
      if (!pageId) return
      try {
        const viewId = await addView(kind, viewQuery.activeViewId)
        setPendingCreatedView({ pageId, viewId })
      } catch {
        // O hook já mostra o erro e relê o snapshot após uma falha HTTP.
      }
    },
    [addView, pageId, viewQuery.activeViewId],
  )

  const handleConfiguredColumnType = useCallback(async (target: ColumnRelationRollupTarget, config: ColumnConfigPatch) => {
    await handlers.onConfiguredColumnSave(target.type, config, target.mode === 'update' ? target.columnId : undefined)
  }, [handlers])

  const openColumnConfiguration = useCallback((target: ColumnRelationRollupTarget) => {
    openModal({
      size: 'sm',
      content: ({ closeModal }) => <ColumnRelationRollupDialog
        target={target}
        workspaceId={workspaceId ?? undefined}
        columns={columns}
        onClose={closeModal}
        onSave={handleConfiguredColumnType}
      />,
    })
  }, [columns, handleConfiguredColumnType, openModal, workspaceId])

  const handleColumnTypeChange = useCallback((columnId: string, type: ColumnDataType) => {
    if(type === 'formula'){const column=columns.find(column=>column.id===columnId);if(column)setFormulaTarget({pageId,config:{column}});return}
    if (type === 'relation' || type === 'extract_as') {
      openColumnConfiguration({ mode: 'update', columnId, type })
      return
    }
    handlers.onColumnTypeChange(columnId, type)
  }, [handlers,columns,pageId,openColumnConfiguration])

  const handleAddColumn = useCallback((type: ColumnDataType) => {
    if(type === 'formula'){setFormulaTarget({pageId,config:{}});return}
    if (type === 'relation' || type === 'extract_as') {
      openColumnConfiguration({ mode: 'create', type })
      return
    }
    handlers.onAddColumn(type)
  }, [handlers,pageId,openColumnConfiguration])

  const handleDuplicateView = useCallback(async (viewId: string) => {
    if (!pageId) return
    try {
      const createdId = await duplicateView(viewId)
      setPendingCreatedView({ pageId, viewId: createdId })
    } catch {
      // O hook mostra o erro e relê o snapshot.
    }
  }, [duplicateView, pageId])

  const handleDeleteView = useCallback(async (viewId: string): Promise<boolean> => {
    if (!pageId) return false
    const nextId = Object.keys(settings).find((id) => id !== viewId)
    try {
      await deleteView(viewId)
      if (viewQuery.activeViewId !== viewId) return true
      if (nextId) {
        setPreferredViewId(nextId)
        changeView(nextId)
      } else {
        const createdId = await addView('table', '')
        setPendingCreatedView({ pageId, viewId: createdId })
      }
      return true
    } catch {
      // O hook mostra o erro e relê o snapshot.
      return false
    }
  }, [addView, changeView, deleteView, pageId, settings, viewQuery.activeViewId])

  // Descer na árvore é abrir a filha como página — a MESMA view, outro id,
  // outra sala. É o modelo recursivo do backend virando navegação.
  const handleOpenRow = useCallback(
    (row: RowData) =>
      navigate({
        to: '/$lang/page/$pageId',
        params: { lang: currentLang, pageId: row.id },
        search: {},
        state: createPageNavigationState(row.id, readRowPageTitle(row)),
      }),
    [navigate, currentLang],
  )


  // Mesma razão do `labels` acima: os rótulos saem do i18next, que o linter
  // não relaciona com o slug de idioma da rota.
  const viewMenuItems = useCallback(
    (viewId: string, actions: { startRename: () => void }) => [
      {
        id: 'rename',
        label: i18n('pages.app.cubs-database.menu.renomear'),
        icon: 'lucide:pencil',
        onSelect: actions.startRename,
      },
      {
        id: 'duplicate',
        label: i18n('pages.app.cubs-database.menu.duplicar'),
        icon: 'lucide:copy',
        onSelect: () => { void handleDuplicateView(viewId) },
      },
      ...(settings[viewId]?.view === 'form' ? [{
        id: 'publish-form',
        label: 'Publicar formulário',
        icon: 'lucide:send',
        onSelect: () => openModal({
          size: 'md',
          content: <FormPublicationDialog pageId={pageId} viewId={viewId} lang={currentLang} />,
        }),
      }] : []),
      {
        id: 'delete',
        label: i18n('pages.app.cubs-database.menu.excluir'),
        icon: 'lucide:trash-2',
        danger: true,
        onSelect: () => openModal({
          size: 'sm',
          className: 'px-5 pb-5 pt-1',
          content: ({ closeModal }) => <DeleteViewConfirmationContent
            viewName={settings[viewId]?.name || i18n('pages.app.cubs-database.view-padrao')}
            onClose={closeModal}
            onConfirm={() => handleDeleteView(viewId)}
          />,
        }),
      },
    ],
    [currentLang, handleDeleteView, handleDuplicateView, openModal, pageId, settings],
  )

  const {
    conflict: viewFilterConflict,
    acceptPersistence: acceptViewFilterPersistence,
    rejectPersistence: rejectViewFilterPersistence,
  } = viewQuery

  useEffect(() => {
    if (!viewFilterConflict || filterConflictModalRef.current) return
    let decided = false
    filterConflictModalRef.current = openModal({
      size: 'sm',
      className: 'px-5 pb-5 pt-1',
      onClose: () => {
        filterConflictModalRef.current = null
        if (!decided) rejectViewFilterPersistence()
      },
      content: ({ closeModal }) => <ReplaceViewFiltersContent
        onReplace={() => {
          decided = true
          acceptViewFilterPersistence()
          closeModal()
        }}
        onKeepSaved={() => {
          decided = true
          rejectViewFilterPersistence()
          closeModal()
        }}
      />,
    })
  }, [acceptViewFilterPersistence, openModal, rejectViewFilterPersistence, viewFilterConflict])

  const mentionTemplates = JSON.stringify((database?.rows ?? EMPTY_ROWS).flatMap((row) => Object.values(row.cells).flatMap((cell) => typeof cell?.value === 'string' ? mentionIds(cell.value) : [])))
  useEffect(() => mention.register(JSON.parse(mentionTemplates) as string[]), [mention.register, mentionTemplates])
  return (
    <DatabaseMentionProvider value={mentionInput}>
      <PageShell
        pageId={pageId}
        initialTitle={initialTitle}
        contentLoading={contentView === 'files' && loading && !broken}
        contentView={contentView}
        onContentViewChange={handleContentViewChange}
        titleReadOnly={Boolean(pageTitleLock.data?.locked && !pageTitleLock.data.canEdit)}
        pdfAction={{ label: i18n('pdf.title'), onSelect: () => openPdf() }}
        content={{
          files: (
            <>
            <CubsDatabase
              pageId={pageId}
              pageTitle={database?.pageTitle ?? initialTitle ?? undefined}
              pagination={paged.pagination}
              settings={settings}
              headerCols={columns}
              rows={database?.rows ?? EMPTY_ROWS}
              activeViewId={viewQuery.activeViewId}
              filtersOverride={viewQuery.effectiveFilters}
              cellErrors={cellErrors}
              columnWidthPreviews={columnWidthPreviews}
              loading={loading && !broken}
              emptyLabel={i18n(
                broken ? 'pages.app.cubs-database.erro' : 'pages.app.cubs-database.vazio',
              )}
              placeholderLabel={i18n('pages.app.cubs-database.em-breve')}
              onOpenRow={handleOpenRow}
              {...(mayEdit && !columnLocks.isPending && !columnLocks.isError ? handlers : {})}
              onSelectionChange={handlePdfSelection}
              selectionAction={pdfSelection.pageId === pageId && pdfSelection.ids.length > 0 ? { label: i18n(pdfSelection.ids.length > 1 ? 'pdf.batch' : 'pdf.selected-page'), onSelect: () => openPdf(pdfSelection.ids) } : undefined}
              onCellChange={mayEditRows && !columnLocks.isPending && !columnLocks.isError ? handlers.onCellChange : undefined}
              onColumnTypeChange={mayEdit ? handleColumnTypeChange : undefined}
              onLoadRelationOptions={paged.loadRelationOptions}
              onDeleteRow={permissions.data?.isOwner ? handlers.onDeleteRow : undefined}
              onDeleteRows={permissions.data?.isOwner ? handlers.onDeleteRows : undefined}
              deletingRows={deletingRows}
              addingColumn={addingColumn}
              onAddRow={pageId && !broken && can(permissions.data, 'write', 'create') ? handlers.onAddRow : undefined}
              onLoadGraphColumns={loadGraphColumns}
              onRequestCreateRow={pageId && !broken && can(permissions.data, 'write', 'create') ? (request: DatabaseCreateRequest) => {
                const parentPageId = request.parentPageId ?? pageId
                const nested = parentPageId !== pageId
                openCalendarPage({parentPageId, destinationLabel: request.destinationLabel || database?.pageTitle || 'Base atual',
                  dateColumnId: request.dateColumnId, viewId: nested ? undefined : request.viewId, viewType: request.viewType,
                  subscribeToParent: nested, onViewOrderSaved: nested ? undefined : handlers.onViewSaved,
                  selection: request.selection, initialValues: request.initialValues,
                  onCreated: nested ? () => paged.bridge.onResync() : handlers.onCreatedRow,
                  onDateColumn: nested ? undefined : dateColumnId => handlers.onCalendarConfigChange(request.viewId, {dateColumnId})})
              } : undefined}
              onRequestEditRow={request => openCalendarPage({
                parentPageId: request.parentPageId,
                rowId: request.rowId,
                dateColumnId: request.dateColumnId,
                viewId: request.viewId,
                viewType: request.viewType,
                subscribeToParent: request.parentPageId !== pageId,
                onViewOrderSaved: request.parentPageId === pageId ? handlers.onViewSaved : undefined,
                destinationLabel: request.destinationLabel || database?.pageTitle || 'Base atual',
                calendarActions: workspaceId && request.viewType !== 'graph'
                  ? {pinned: pinnedCalendarPageIds.has(request.rowId), onPin: handleCalendarPin, onUnpin: schedule.unpin, onRequestPin: handleCalendarRequestPin}
                  : undefined,
              })}
              onBoardCreateRow={pageId && !broken && !columnLocks.isPending && !columnLocks.isError && can(permissions.data, 'write', 'create') ? handlers.onBoardCreateRow : undefined}
              onViewChange={handleViewChange}
              onAddView={pageId && !broken && mayEdit ? handleAddView : undefined}
              addViewLabel={i18n('pages.app.cubs-database.adicionar-view')}
              onViewFiltersChange={viewQuery.changeLocal}
              onCalendarConfigChange={mayEdit ? handlers.onCalendarConfigChange : undefined}
              onHeatmapConfigChange={mayEdit ? handlers.onHeatmapConfigChange : undefined}
              pinnedCalendarPageIds={pinnedCalendarPageIds}
              calendarPendingPageId={schedule.mutating ? schedule.pendingPageId : null}
              onCalendarPin={workspaceId && pageId ? handleCalendarPin : undefined}
              onCalendarUnpin={workspaceId ? schedule.unpin : undefined}
              onCalendarRequestPin={workspaceId ? handleCalendarRequestPin : undefined}
              columnLocks={columnLocks.locks}
              columnLockEditors={columnLocks.editors}
              lockedColumnKeys={lockedColumnKeys}
              canManageColumnLocks={columnLocks.canManage}
              currentUserId={columnLocks.currentUserId}
              onColumnLockChange={columnLocks.canManage ? columnLocks.save : undefined}
              onAddColumn={pageId && !broken && mayEdit ? handleAddColumn : undefined}
              labels={labels}
              toolbarLabels={toolbarLabels}
              formLabels={formLabels}
              viewMenuItems={mayEdit ? viewMenuItems : undefined}
              onRenameView={mayEdit ? handlers.onRenameView : undefined}
            />
            </>
          ),
          document: <PageBlockEditor
            ref={blockEditorRef}
            key={pageId}
            pageId={pageId}
            readOnly={!mayEdit}
          />,
        }}
        {...realtimeOptions}
        onStructureChanged={handlePdfStructureChanged}
      />
      <FormulaDrawer key={pageId} pageId={pageId} target={formulaTarget?.pageId===pageId?formulaTarget.config:null} onClose={()=>setFormulaTarget(null)} onSaved={handlers.onFormulaSaved}/>
    </DatabaseMentionProvider>
  )
}
