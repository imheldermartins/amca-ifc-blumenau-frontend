import { i18n } from '@/lib/i18n'
import {
  parseDatabase,
  parseHeaderCols,
  parseViewSettings,
  type ApiDatasetRow,
  type ApiPage,
  type ApiPageColumn,
  type ParsedDatabase,
} from '@/lib/databaseParser'
import { apiService } from '@/services/ApiService'

/**
 * Leitura de uma base do Cub's.
 *
 * O modelo é RECURSIVO: `page_edges` liga parent → child entre páginas, e não
 * existe um tipo especial de página "raiz". Qualquer página pode ser parent de
 * outras, então qualquer página é uma base em potencial — suas filhas são as
 * linhas, e `/pages/:id/page` responde para qualquer id. A workspace só resolve
 * o PONTO DE ENTRADA (a página por onde se começa a navegar); dali para baixo é
 * página → página, e o que muda é só o id.
 *
 * Por isso a unidade aqui é `loadPage(pageId)`: abrir a base da workspace é um
 * caso particular dela (`loadWorkspace`), não o contrário. Descer para uma
 * filha, quando houver navegação, é a MESMA chamada com outro id.
 *
 * O contrato de dados e a tradução para o modelo da lib `cubs-database` ficam
 * em `@/lib/databaseParser`; aqui só mora o I/O.
 *
 * Nada aqui assume uma workspace única: quem sabe QUAL workspace está em foco é
 * o `WorkspaceContext` (`@/contexts/WorkspaceContext`), que fornece o id — este
 * service só recebe ids por parâmetro.
 */
export class DatabaseService {
  /** A página em si — `data` guarda as views salvas. */
  getPage(pageId: string): Promise<ApiPage> {
    return apiService.get<ApiPage>(`/pages/${pageId}`)
  }

  /**
   * Página de entrada da workspace vinculada ao membro autenticado.
   * Único ponto do fluxo que fala de workspace — o resto fala de página.
   */
  getEntryPage(workspaceId: string): Promise<ApiPage> {
    return apiService.get<ApiPage>(`/workspaces/${workspaceId}/page_root`)
  }

  /**
   * Definição das colunas da página parent. É a fonte da verdade dos headers:
   * o dataset parte dos VALORES, então uma coluna ainda sem nenhum valor
   * preenchido não apareceria por lá.
   */
  getColumns(parentId: string): Promise<ApiPageColumn[]> {
    return apiService.get<ApiPageColumn[]>(`/pages/parent/${parentId}/columns`)
  }

  /** Filhas da página (as linhas da base) com seus valores por coluna. */
  getChildren(parentId: string): Promise<ApiDatasetRow[]> {
    return apiService.get<ApiDatasetRow[]>(`/pages/${parentId}/page`)
  }

  /**
   * Abre QUALQUER página como base, pronta para `<CubsDatabase />`.
   *
   * Com o id em mãos as três leituras são independentes → vão em paralelo. Uma
   * página sem filhas nem colunas responde vazia (não é erro): é só uma folha
   * da árvore que ainda não virou parent de ninguém.
   */
  async loadPage(pageId: string): Promise<ParsedDatabase> {
    const [page, columns, dataset] = await Promise.all([
      this.getPage(pageId),
      this.getColumns(pageId),
      this.getChildren(pageId),
    ])

    return parseDatabase({
      page,
      columns,
      dataset,
      titleLabel: i18n('pages.app.cubs-database.coluna-titulo'),
      fallbackViewName: i18n('pages.app.cubs-database.view-padrao'),
    })
  }

  /**
   * Upgrade idempotente de snapshots legados. A resposta já contém os dois
   * catálogos alteráveis, permitindo adotá-la sem uma segunda carga completa.
   */
  async reconcileFilterKeys(pageId: string): Promise<
    Pick<ParsedDatabase, 'settings' | 'headerCols'>
  > {
    const response = await apiService.post<{
      data: Record<string, unknown>
      columns: ApiPageColumn[]
    }>(`/pages/${pageId}/filter-keys/reconcile`)
    const titleLabel = i18n('pages.app.cubs-database.coluna-titulo')
    return {
      settings: parseViewSettings(response.data, titleLabel),
      headerCols: parseHeaderCols(response.columns, titleLabel),
    }
  }

  /**
   * Entra pela workspace: resolve a página de entrada e abre como base. O id
   * dela é o único dado que a workspace precisa fornecer — daí em diante o
   * fluxo é o mesmo de qualquer outra página.
   */
  async loadWorkspace(workspaceId: string): Promise<ParsedDatabase> {
    const entry = await this.getEntryPage(workspaceId)
    return this.loadPage(entry.id)
  }
}

export const databaseService = new DatabaseService()
