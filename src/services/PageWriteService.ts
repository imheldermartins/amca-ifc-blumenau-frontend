import type {
  CellChange,
  ColumnConfigPatch,
  ColumnOption,
  DataViewSettings,
  DataViewType,
  ViewFiltersV2,
} from 'cubs-database'

import { TITLE_COLUMN_ID, type ApiPage, type ApiPageColumn } from '@/lib/databaseParser'
import { apiService } from '@/services/ApiService'

/**
 * Escrita da base — o caminho HTTP, e o ÚNICO caminho.
 *
 * O socket não grava nada: a base é rqlite/Raft, então toda mudança entra pela
 * API (que fala com o líder) e só DEPOIS do commit é propagada para a sala.
 * Isso evita escrita duplicada, fora de ordem, ou indo parar num nó que não é
 * líder. Ler `docs/cubs-database-realtime-arquitetura.md` §4.
 *
 * Cada método RETORNA a promise crua do `ApiService` — que rejeita com
 * `AppError` num erro. Quem chama (o `usePageDatabase`) é que trata: a célula
 * via `useMutation` (rollback fino + marca), as demais via `.catch` (feedback
 * + reload). Não engole nada aqui: engolir tiraria do caller a chance de
 * reverter o otimismo.
 */
export class PageWriteService {
  /** Cria somente a página-filha e sua aresta com a parent; células nascem ausentes. */
  createRow(parentId: string): Promise<ApiPage> {
    return apiService.post<ApiPage>(`/pages/${parentId}/page`, {})
  }

  /** Cria apenas a definição da coluna; células EAV continuam ausentes. */
  createColumn(parentId: string, name: string): Promise<ApiPageColumn> {
    return apiService.post<ApiPageColumn>(`/pages/parent/${parentId}/columns?type=text`, { name })
  }

  /** Soft delete da página/linha; o backend publica `row-deleted` pós-commit. */
  deleteRow(rowId: string): Promise<unknown> {
    return apiService.delete(`/pages/${rowId}`)
  }

  /** Soft delete da coluna; valores permanecem preservados sob o tombstone. */
  deleteColumn(parentId: string, columnId: string): Promise<unknown> {
    return apiService.delete(`/pages/parent/${parentId}/columns/${columnId}`)
  }

  /**
   * Uma célula. `rowId` é a página-FILHA (a linha) e `columnId` a coluna: é
   * exatamente o par que o backend usa como chave (UNIQUE em
   * `page_columns_values`).
   *
   * Duas ramificações, e as duas vêm do modelo do backend:
   *
   *  - a coluna sintética de TÍTULO não é uma coluna de verdade: mapeia para
   *    `pages.title` da linha, então vai pelo PUT da página;
   *  - a célula VAZIA ainda não tem linha em `page_columns_values`, e o PUT do
   *    valor exige que ela exista (404 quando não). Só `undefined` representa
   *    ausência: `null` pode vir de um registro legado que existe fisicamente;
   *  - limpar remove o registro com DELETE. O codec não aceita
   *    `PUT { value: null }`, e uma célula já ausente não precisa de request.
   */
  saveCell({ rowId, columnId, value, previousValue }: CellChange): Promise<unknown> {
    if (columnId === TITLE_COLUMN_ID) {
      return apiService.put(`/pages/${rowId}`, { title: value ?? null })
    }

    const url = `/pages/${rowId}/column/${columnId}/value`
    const cellExiste = previousValue !== undefined

    if (value == null) {
      return cellExiste ? apiService.delete(url) : Promise.resolve(null)
    }

    return cellExiste ? apiService.put(url, { value }) : apiService.post(url, { value })
  }

  /** Options de uma coluna select — o array COMPLETO, na ordem exibida. */
  saveColumnOptions(
    parentId: string,
    columnId: string,
    options: ColumnOption[],
  ): Promise<unknown> {
    return apiService.put(`/pages/parent/${parentId}/columns/${columnId}`, {
      // A API fala `value` onde a lib fala `label` (ver `databaseParser`), e a
      // tradução de volta mora aqui — do mesmo jeito que a de ida mora lá.
      options: options.map((option) => ({
        id: option.id,
        value: option.label,
        ...(option.color && { color: option.color }),
      })),
    })
  }

  renameColumn(parentId: string, columnId: string, name: string): Promise<unknown> {
    return apiService.put(`/pages/parent/${parentId}/columns/${columnId}`, { name })
  }

  /**
   * Troca o TIPO da coluna. Não-destrutivo: o backend PRESERVA o config e os
   * valores do tipo antigo (a limpeza é só via `resetColumn`). Manda só `type`
   * — o `data` fica intacto.
   */
  changeColumnType(parentId: string, columnId: string, type: string): Promise<unknown> {
    return apiService.put(`/pages/parent/${parentId}/columns/${columnId}`, { type })
  }

  /**
   * Config da coluna (formato/moeda/máscara). O `patch` vem da lib com `null`
   * para LIMPAR uma chave; o backend mescla (não apaga o que não veio).
   */
  saveColumnConfig(
    parentId: string,
    columnId: string,
    patch: ColumnConfigPatch,
  ): Promise<unknown> {
    return apiService.put(`/pages/parent/${parentId}/columns/${columnId}`, patch)
  }

  /**
   * "Reset de tipos" — a limpeza destrutiva. O backend zera o `data` para a
   * base do tipo e sobrescreve as células divergentes com o default. A base
   * muda em massa, então quem chama relê (reload) em vez de remendar.
   */
  resetColumn(parentId: string, columnId: string): Promise<unknown> {
    return apiService.post(`/pages/parent/${parentId}/columns/${columnId}/reset`)
  }

  /**
   * Materialização inicial do fallback: cria o snapshot completo uma única vez.
   * Personalizações posteriores usam `patchView`, e filtros/grupos usam
   * `saveViewFilters`, evitando read-modify-write concorrente de `pages.data`.
   */
  saveViewSnapshot(
    pageId: string,
    settings: DataViewSettings,
    viewId: string,
    patch: Partial<DataViewType>,
  ): Promise<unknown> {
    const current = settings[viewId]
    // View desconhecida (ex.: o fallback de id fixo, que não existe no banco):
    // gravar criaria uma tab fantasma na base de todo mundo.
    if (!current) return Promise.resolve(null)

    const data: DataViewSettings = { ...settings, [viewId]: { ...current, ...patch } }
    return apiService.put(`/pages/${pageId}`, { data })
  }

  /**
   * Personalização atômica de uma view já materializada. Filtros e urlKey são
   * deliberadamente excluídos: filtros têm endpoint próprio e a key pública é
   * carimbada/reconciliada pelo servidor ao renomear.
   */
  patchView(
    pageId: string,
    viewId: string,
    patch: Partial<DataViewType>,
  ): Promise<{ viewId: string; view: DataViewType }> {
    const body: Record<string, unknown> = {}
    if (patch.view !== undefined) body.view = patch.view
    if (patch.name !== undefined) body.name = patch.name
    if (patch.orderedHeaderCols !== undefined) {
      body.orderedHeaderCols = patch.orderedHeaderCols
    }
    if (patch.orderedRows !== undefined) body.orderedRows = patch.orderedRows
    if (patch.columnWidths !== undefined) body.columnWidths = patch.columnWidths
    if (patch.title !== undefined) {
      body.title = {
        key: patch.title.key,
        column_name: patch.title.column_name,
        ...(patch.title.mask && { mask: patch.title.mask }),
      }
    }
    return apiService.patch(`/pages/${pageId}/views/${viewId}`, body)
  }

  /** Documento canônico; `updatedAt` nunca é aceito do cliente. */
  saveViewFilters(
    pageId: string,
    viewId: string,
    filters: ViewFiltersV2,
  ): Promise<{ viewId: string; filters: ViewFiltersV2 }> {
    return apiService.put(`/pages/${pageId}/views/${viewId}/filters`, {
      version: 2,
      clauses: filters.clauses,
      groupBy: filters.groupBy,
      passthrough: filters.passthrough,
    })
  }
}

export const pageWriteService = new PageWriteService()
