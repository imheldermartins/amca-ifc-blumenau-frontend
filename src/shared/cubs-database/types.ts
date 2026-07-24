/**
 * Tipos públicos da lib.
 *
 * A visualização é orientada a "views" (settings): um Record cuja CHAVE é um
 * ULID e o valor descreve como exibir os mesmos dados (tabela, board, ...).
 * Os tipos de célula espelham os tipos de coluna usados no sistema — a lib
 * define os seus próprios, sem referência direta ao backend.
 */

/** Tipos de dado que uma coluna pode ter. */
export type ColumnDataType = 'text' | 'numeric' | 'select' | 'date' | 'checkbox'

/**
 * Cores aceitas para uma option de coluna `select`. O vocabulário espelha o do
 * sistema que alimenta a lib (sem citá-lo): quem monta os dados garante que a
 * cor está neste conjunto; cor desconhecida cai no chip neutro.
 */
export type OptionColor = 'red' | 'orange' | 'yellow' | 'green' | 'blue' | 'grey'

/**
 * Uma option de coluna `select`. A célula guarda o `id` da option — NUNCA o
 * texto: renomear a option não invalida os valores já gravados. Quem renderiza
 * resolve `id → label/cor` pelas `options` da coluna; id órfão vira célula
 * vazia (melhor que um id cru na tela).
 */
export interface ColumnOption {
  id: string
  label: string
  color?: OptionColor
}

/** Formato de exibição de uma coluna `numeric` — decide a máscara do editor. */
export type NumberFormat = 'percentage' | 'currency'

/**
 * Uma edição de célula confirmada, no formato que o transporte de escrita vai
 * carregar — hoje o callback `onCellChange`, amanhã o evento `cell-updated` do
 * realtime (o `pageId`/room entra do lado do app, que sabe qual página está
 * aberta). `previousValue` viaja junto para log/otimismo/undo — a lib não
 * decide o que fazer com ele.
 */
export interface CellChange {
  rowId: string
  columnId: string
  value: unknown
  previousValue: unknown
}

/**
 * Contrato de um editor de célula (as entradas do `CELL_EDITORS`, o cellMap em
 * `components/cells`). Para criar um editor novo: implemente estas props,
 * memoize (`React.memo`) e registre no map — `TableCell` despacha pelo TIPO da
 * coluna, sem conhecer editor nenhum por nome.
 *
 * `onCommit` deve ser chamado SÓ quando o valor realmente mudou — é o contrato
 * que mantém o transporte (callback hoje, socket amanhã) livre de eco.
 */
export interface CellEditorProps {
  column: HeaderCol
  rowId: string
  /** Valor atual da célula (cru; select = id da option). `undefined` = vazia. */
  value: unknown
  /** Confirma um novo valor. `null` = limpar a célula. */
  onCommit: (value: unknown) => void
  /** Só o select usa: a coluna teve as options reordenadas (array COMPLETO). */
  onOptionsChange?: (options: ColumnOption[]) => void
  /**
   * A última escrita desta célula FALHOU (o app reverteu o valor otimista).
   * O editor marca o campo como inválido (`aria-invalid`); a moldura visual
   * fica no container da célula. Some quando o valor é reeditado.
   */
  hasError?: boolean
  /** Rótulos de a11y injetados pelo app host (i18n mora lá, nunca aqui). */
  labels?: { dragOption?: string }
}

/** Modos de visualização disponíveis (só 'table' implementado por enquanto). */
export type DataViewKind = 'table' | 'board' | 'calendar'

/** Uma view salva: como exibir os dados. */
export interface DataViewType {
  view: DataViewKind
  /** Nome exibido na tab da topbar. */
  name: string
  /**
   * Filtros serializados como string — o objetivo é, no futuro, fazer parsing
   * direto para a query da URL (ex.: `status=published&depth=0`).
   */
  filters: string
  /**
   * Ordem de exibição como lista de IDs de coluna. Reordenar = produzir um
   * NOVO array (slice/spread), nunca mexer em índices na mão. Vazio = usa a
   * ordem natural de `headerCols`.
   */
  orderedHeaderCols: string[]
  /**
   * Ordem das LINHAS (ids de página) na view — mesmo contrato do
   * `orderedHeaderCols`: array NOVO a cada reordenação, id desconhecido é
   * ignorado, linha fora da lista vai para o fim (`reorderByIds`). Opcional e
   * POR VIEW de propósito: a ordem é apresentação, como a largura de coluna.
   */
  orderedRows?: string[]
  /**
   * Largura das colunas EM PIXELS, indexada pelo ID da coluna. Mora na VIEW e
   * não na coluna de propósito: largura é apresentação, então a mesma coluna
   * pode ser larga numa view e estreita em outra — e é aqui que o resize de
   * coluna vai persistir. Coluna ausente = `DEFAULT_COLUMN_WIDTH`; valores
   * fora da faixa são clampados por `resolveColumnWidth`.
   */
  columnWidths?: Record<string, number>
}

/** Conjunto de views: chave = ULID da view. */
export type DataViewSettings = Record<string, DataViewType>

/**
 * Dados de uma linha: as células são indexadas pelo ID da coluna. Nem toda
 * página tem valor para toda coluna, então a célula pode estar AUSENTE — o
 * acesso `cells[id]` é `CellData | undefined` e quem renderiza trata o vazio.
 */
export interface RowData {
  id: string
  cells: Record<string, CellData | undefined>
}

/** Célula sempre no formato `{ value }`; o TIPO vem da coluna, não da célula. */
export interface CellData {
  value: unknown
}

/** Definição de coluna. A ordem do array já é a ordem de display (esq→dir). */
export interface HeaderCol {
  id: string
  title: string
  /**
   * Ausente = INFERIDO dos valores da coluna (`inferColumnType`). A lib não
   * assume nada sobre por que o type falta — se a base tem colunas sem type
   * declarado, isso é regra de negócio de quem monta os dados, e a tabela só
   * precisa saber como desenhar a célula.
   */
  type?: ColumnDataType
  /**
   * Options de uma coluna `select`, na ordem de exibição. É a fonte que resolve
   * o `id` guardado na célula para label/cor — sem elas, a célula select não
   * tem como exibir nada além de vazio.
   */
  options?: ColumnOption[]
  /** Formato de uma coluna `numeric` — vira a máscara do editor da célula. */
  format?: NumberFormat
}

/*
 * `ContextMenuItem` saiu daqui: o componente ContextMenu virou primitiva
 * compartilhada em `cubs-components`, e o tipo foi junto. O `index.ts`
 * re-exporta para quem consome esta lib.
 */
