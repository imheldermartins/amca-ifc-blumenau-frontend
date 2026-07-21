import type { CellChange, ColumnOption, DataViewSettings, DataViewType } from 'cubs-database'

import { TITLE_COLUMN_ID } from '@/lib/databaseParser'
import { apiService } from '@/services/ApiService'

/**
 * Escrita da base — o caminho HTTP, e o ÚNICO caminho.
 *
 * O socket não grava nada: a base é rqlite/Raft, então toda mudança entra pela
 * API (que fala com o líder) e só DEPOIS do commit é propagada para a sala.
 * Isso evita escrita duplicada, fora de ordem, ou indo parar num nó que não é
 * líder. Ler `docs/cubs-database-realtime-arquitetura.md` §4.
 *
 * Os erros são engolidos de propósito neste estágio: o `ApiService` já loga o
 * `AppError`, e a UI é otimista — o rollback visual ainda não existe. Está
 * anotado como próximo passo no CLAUDE.md.
 */
export class PageWriteService {
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
   *    valor exige que ela exista (404 quando não). `previousValue` ausente é
   *    exatamente esse caso — daí o POST. Sem isto, preencher uma célula em
   *    branco falhava silenciosamente.
   */
  saveCell({ rowId, columnId, value, previousValue }: CellChange): Promise<unknown> {
    if (columnId === TITLE_COLUMN_ID) {
      return apiService.put(`/pages/${rowId}`, { title: value ?? null })
    }

    const url = `/pages/${rowId}/column/${columnId}/value`
    const cellExiste = previousValue !== undefined && previousValue !== null
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
   * Personalização de UMA view — e aqui mora a armadilha do snapshot:
   *
   * > `PUT /pages/:id` substitui `data` INTEIRO. Não há rota por view.
   *
   * Por isso a assinatura exige o `settings` ATUAL (todas as views): a função
   * faz o read-modify-write, aplicando o patch só na view editada e reenviando
   * as demais intactas. Mandar apenas a editada APAGARIA as outras.
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
}

export const pageWriteService = new PageWriteService()
