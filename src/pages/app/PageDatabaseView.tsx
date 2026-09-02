import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from '@tanstack/react-router'
import { CubsDatabase } from 'cubs-database'
import type {
  DatabaseViewToolbarSyncStatus,
  DataViewSettings,
  HeaderCol,
  RowData,
} from 'cubs-database'

import { PageShell } from '@components/PageShell'
import { ReplaceViewFiltersModal } from '@components/ReplaceViewFiltersModal'
import { useDatabaseViewQuery } from '@/hooks/useDatabaseViewQuery'
import { usePageDatabase } from '@/hooks/usePageDatabase'
import { useFeedback } from '@/contexts/FeedbackContext'
import { formatRelativeTime } from '@/lib/formatRelativeTime'
import { i18n } from '@/lib/i18n'

export interface PageDatabaseViewProps {
  /** Página a exibir; `undefined` = ainda sendo resolvida (workspace). */
  pageId?: string
  /** Erro ANTES de ter um pageId (ex.: a workspace não resolveu a entrada). */
  failedToResolve?: boolean
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
const EMPTY_ROWS: RowData[] = []

/**
 * Uma página do Cub's com a base dentro. É a view compartilhada pelos DOIS
 * caminhos de entrada — `/myworkspace/:id` (que resolve a página de entrada) e
 * `/page/:id` (o card de "Colaborando") —, e é justamente por serem a mesma
 * view, sobre o mesmo `pageId`, que os dois caem na mesma sala de realtime.
 *
 * O estado e a escrita moram no `usePageDatabase`; aqui só a composição.
 *
 * **Toda prop de objeto/função é memoizada de propósito.** A `CubsDatabase`
 * memoiza os componentes internos (linha, célula, editores), e comparação
 * rasa não sobrevive a um literal recriado a cada render: um `labels={{...}}`
 * inline desce até TODAS as células e invalida o `memo` de cada uma. A
 * memoização da lib só vale se o host cooperar — é aqui que ela começa.
 */
export function PageDatabaseView({ pageId, failedToResolve }: PageDatabaseViewProps) {
  const { lang } = useParams({ strict: false })
  const navigate = useNavigate()
  const feedback = useFeedback()
  const {
    database,
    loading,
    failed,
    cellErrors,
    columnWidthPreviews,
    realtimeOptions,
    handlers,
  } = usePageDatabase(pageId)
  const [preferredViewId, setPreferredViewId] = useState('')
  const [relativeNow, setRelativeNow] = useState(() => Date.now())
  const lastDiagnosticRef = useRef('')
  const settings = database?.settings ?? EMPTY_SETTINGS
  const columns = database?.headerCols ?? EMPTY_COLUMNS
  const viewQuery = useDatabaseViewQuery({
    settings,
    columns,
    preferredViewId,
    scopeKey: pageId,
    onPersistFilters: handlers.onViewFiltersChange,
  })
  const changeView = viewQuery.changeView

  const broken = failed || failedToResolve
  const currentLang = lang ?? 'pt-br'

  useEffect(() => {
    const timer = setInterval(() => setRelativeNow(Date.now()), 60_000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    if (viewQuery.diagnostics.length === 0) {
      lastDiagnosticRef.current = ''
      return
    }
    const signature = JSON.stringify(viewQuery.diagnostics)
    if (lastDiagnosticRef.current === signature) return
    lastDiagnosticRef.current = signature
    feedback({
      title: i18n('pages.app.cubs-database.filtros.url-ajustada-titulo'),
      description: i18n('pages.app.cubs-database.filtros.url-ajustada-descricao'),
      variant: 'warning',
    })
  }, [feedback, viewQuery.diagnostics])

  const filterSyncStatus = useMemo<DatabaseViewToolbarSyncStatus>(() => {
    const relative = viewQuery.sync.updatedAt
      ? formatRelativeTime(viewQuery.sync.updatedAt, relativeNow, 'pt-BR')
      : null
    if (viewQuery.sync.status === 'saving') {
      return {
        state: 'saving',
        label: i18n('pages.app.cubs-database.filtros.sync.salvando'),
      }
    }
    if (viewQuery.sync.status === 'remote-pending') {
      return {
        state: 'pending',
        label: relative
          ? i18n('pages.app.cubs-database.filtros.sync.alterados-em', { time: relative })
          : i18n('pages.app.cubs-database.filtros.sync.alterados'),
        actionLabel: i18n('pages.app.cubs-database.filtros.sync.atualizar'),
        onAction: viewQuery.sync.applyRemote,
      }
    }
    if (viewQuery.sync.status === 'error') {
      return {
        state: 'error',
        label: i18n('pages.app.cubs-database.filtros.sync.falha'),
        actionLabel: i18n('pages.app.cubs-database.filtros.sync.tentar-novamente'),
        onAction: viewQuery.sync.retry,
      }
    }
    return {
      state: 'confirmed',
      label: relative
        ? i18n('pages.app.cubs-database.filtros.sync.atualizado-em', { time: relative })
        : i18n('pages.app.cubs-database.filtros.sync.atualizado'),
    }
  }, [relativeNow, viewQuery.sync])

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
      dragOption: i18n('pages.app.cubs-database.arrastar-option'),
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
      resetType: i18n('pages.app.cubs-database.coluna.resetar'),
      addOption: i18n('pages.app.cubs-database.coluna.adicionar-opcao'),
      deleteOption: i18n('pages.app.cubs-database.coluna.excluir-opcao'),
      optionColor: i18n('pages.app.cubs-database.coluna.cor-opcao'),
      optionNamePlaceholder: i18n('pages.app.cubs-database.coluna.nome-opcao'),
      masks: {
        cpf: i18n('pages.app.cubs-database.mascaras.cpf'),
        cep: i18n('pages.app.cubs-database.mascaras.cep'),
        'phone-br': i18n('pages.app.cubs-database.mascaras.telefone'),
        date: i18n('pages.app.cubs-database.mascaras.data'),
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
      groupBy: i18n('pages.app.cubs-database.agrupar.trigger'),
      filters: i18n('pages.app.cubs-database.filtros.trigger'),
      searchColumns: i18n('pages.app.cubs-database.agrupar.buscar'),
      noColumns: i18n('pages.app.cubs-database.agrupar.vazio'),
      dragGroup: i18n('pages.app.cubs-database.agrupar.arrastar'),
      selectGroup: i18n('pages.app.cubs-database.agrupar.selecionar'),
      priority: i18n('pages.app.cubs-database.agrupar.prioridade'),
      where: i18n('pages.app.cubs-database.filtros.onde'),
      column: i18n('pages.app.cubs-database.filtros.coluna'),
      condition: i18n('pages.app.cubs-database.filtros.condicao'),
      value: i18n('pages.app.cubs-database.filtros.valor'),
      valueFrom: i18n('pages.app.cubs-database.filtros.valor-inicial'),
      valueTo: i18n('pages.app.cubs-database.filtros.valor-final'),
      addFilter: i18n('pages.app.cubs-database.filtros.adicionar'),
      removeFilter: i18n('pages.app.cubs-database.filtros.remover'),
      true: i18n('pages.app.cubs-database.agrupar.sim'),
      false: i18n('pages.app.cubs-database.agrupar.nao'),
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

  // Descer na árvore é abrir a filha como página — a MESMA view, outro id,
  // outra sala. É o modelo recursivo do backend virando navegação.
  const handleOpenRow = useCallback(
    (row: RowData) =>
      navigate({ to: '/$lang/page/$pageId', params: { lang: currentLang, pageId: row.id } }),
    [navigate, currentLang],
  )

  // Terreno do batchRealtimeUpdate: agir sobre N páginas de uma vez (a
  // seleção já sobe completa como array de ids).
  const handleSelectionChange = useCallback((selectedPagesIds: string[]) => {
    console.log('[cubs-database] selection-change', selectedPagesIds)
  }, [])

  // Controles visuais desta etapa. Os callbacks já delimitam a futura ponte
  // de criação, mas ainda não fazem request nem alteram os dados da tabela.
  const handleAddRow = useCallback(() => {
    console.log('[cubs-database] guided-add-row')
  }, [])
  const handleAddColumn = useCallback(() => {
    console.log('[cubs-database] guided-add-column')
  }, [])

  // Mesma razão do `labels` acima: os rótulos saem do i18next, que o linter
  // não relaciona com o slug de idioma da rota.
  const viewMenuItems = useCallback(
    (viewId: string) => [
      {
        id: 'rename',
        label: i18n('pages.app.cubs-database.menu.renomear'),
        icon: 'lucide:pencil',
        onSelect: () => console.log('[cubs-database] renomear view', viewId),
      },
      {
        id: 'duplicate',
        label: i18n('pages.app.cubs-database.menu.duplicar'),
        icon: 'lucide:copy',
        onSelect: () => console.log('[cubs-database] duplicar view', viewId),
      },
      {
        id: 'delete',
        label: i18n('pages.app.cubs-database.menu.excluir'),
        icon: 'lucide:trash-2',
        danger: true,
        onSelect: () => console.log('[cubs-database] excluir view', viewId),
      },
    ],
    // oxlint-disable-next-line react-hooks/exhaustive-deps
    [currentLang],
  )

  return (
    <>
      <PageShell pageId={pageId} {...realtimeOptions}>
        <CubsDatabase
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
          {...handlers}
          onViewChange={handleViewChange}
          onViewFiltersChange={viewQuery.changeLocal}
          onSelectionChange={handleSelectionChange}
          onAddRow={handleAddRow}
          onAddColumn={handleAddColumn}
          labels={labels}
          toolbarLabels={toolbarLabels}
          filterSyncStatus={filterSyncStatus}
          viewMenuItems={viewMenuItems}
        />
      </PageShell>
      <ReplaceViewFiltersModal
        open={viewQuery.conflict}
        onReplace={viewQuery.acceptPersistence}
        onKeepSaved={viewQuery.rejectPersistence}
      />
    </>
  )
}
