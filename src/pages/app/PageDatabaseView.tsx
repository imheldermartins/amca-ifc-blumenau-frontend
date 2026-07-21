import { useNavigate, useParams } from '@tanstack/react-router'
import { CubsDatabase } from 'cubs-database'

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
 * Uma página do Cub's com a base dentro. É a view compartilhada pelos DOIS
 * caminhos de entrada — `/myworkspace/:id` (que resolve a página de entrada) e
 * `/page/:id` (o card de "Colaborando") —, e é justamente por serem a mesma
 * view, sobre o mesmo `pageId`, que os dois caem na mesma sala de realtime.
 *
 * O estado e a escrita moram no `usePageDatabase`; aqui só a composição.
 */
export function PageDatabaseView({ pageId, failedToResolve }: PageDatabaseViewProps) {
  const { lang } = useParams({ strict: false })
  const navigate = useNavigate()
  const { database, loading, failed, realtimeOptions, handlers } = usePageDatabase(pageId)

  const broken = failed || failedToResolve

  return (
    <PageShell pageId={pageId} {...realtimeOptions}>
      <CubsDatabase
        settings={database?.settings ?? {}}
        headerCols={database?.headerCols ?? []}
        rows={database?.rows ?? []}
        loading={loading && !broken}
        emptyLabel={i18n(
          broken ? 'pages.app.cubs-database.erro' : 'pages.app.cubs-database.vazio',
        )}
        placeholderLabel={i18n('pages.app.cubs-database.em-breve')}
        // Descer na árvore é abrir a filha como página — a MESMA view, outro
        // id, outra sala. É o modelo recursivo do backend virando navegação.
        onOpenRow={(row) =>
          navigate({
            to: '/$lang/page/$pageId',
            params: { lang: lang ?? 'pt-br', pageId: row.id },
          })
        }
        {...handlers}
        // Terreno do batchRealtimeUpdate: agir sobre N páginas de uma vez (a
        // seleção já sobe completa como array de ids).
        onSelectionChange={(selectedPagesIds) =>
          console.log('[cubs-database] selection-change', selectedPagesIds)
        }
        labels={{
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
        }}
        viewMenuItems={(viewId) => [
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
        ]}
      />
    </PageShell>
  )
}
