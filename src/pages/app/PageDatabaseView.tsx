import { useCallback, useMemo } from 'react'
import { useNavigate, useParams } from '@tanstack/react-router'
import { CubsDatabase } from 'cubs-database'
import type { DataViewSettings, HeaderCol, RowData } from 'cubs-database'

import { PageShell } from '@components/PageShell'
import { usePageDatabase } from '@/hooks/usePageDatabase'
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
  const { database, loading, failed, cellErrors, realtimeOptions, handlers } =
    usePageDatabase(pageId)

  const broken = failed || failedToResolve
  const currentLang = lang ?? 'pt-br'

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
      renameColumn: i18n('pages.app.cubs-database.renomear-coluna'),
      columnTypes: {
        text: i18n('pages.app.cubs-database.tipos.text'),
        numeric: i18n('pages.app.cubs-database.tipos.numeric'),
        select: i18n('pages.app.cubs-database.tipos.select'),
        date: i18n('pages.app.cubs-database.tipos.date'),
        checkbox: i18n('pages.app.cubs-database.tipos.checkbox'),
      },
    }),
    // oxlint-disable-next-line react-hooks/exhaustive-deps
    [currentLang],
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
    <PageShell pageId={pageId} {...realtimeOptions}>
      <CubsDatabase
        settings={database?.settings ?? EMPTY_SETTINGS}
        headerCols={database?.headerCols ?? EMPTY_COLUMNS}
        rows={database?.rows ?? EMPTY_ROWS}
        cellErrors={cellErrors}
        loading={loading && !broken}
        emptyLabel={i18n(
          broken ? 'pages.app.cubs-database.erro' : 'pages.app.cubs-database.vazio',
        )}
        placeholderLabel={i18n('pages.app.cubs-database.em-breve')}
        onOpenRow={handleOpenRow}
        {...handlers}
        onSelectionChange={handleSelectionChange}
        labels={labels}
        viewMenuItems={viewMenuItems}
      />
    </PageShell>
  )
}
