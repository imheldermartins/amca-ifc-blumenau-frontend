/**
 * Adaptador entre a API do Cub's e o modelo de dados da lib `cubs-database`.
 *
 * A lib é agnóstica ao backend de propósito (ver `types.ts` dela): fala em
 * `settings` / `headerCols` / `rows`. O backend fala em páginas ligadas por
 * `page_edges` (parent → child), colunas e valores envelopados. A tradução mora
 * AQUI, e só aqui — a lib não conhece a API, e a API não conhece a lib.
 *
 * O modelo é RECURSIVO: não existe tipo especial de página "raiz". Qualquer
 * página pode ser parent de outras, e é isso que uma base É — uma página cujas
 * FILHAS são as linhas. Todas as rotas abaixo aceitam o id de qualquer página:
 *
 *   GET /pages/:id                → `data` guarda as views  → settings
 *   GET /pages/parent/:id/columns → definição das colunas   → headerCols
 *   GET /pages/:id/page           → filhas + valores        → rows
 *
 * Por que as colunas NÃO saem do dataset: o JOIN de `/pages/:id/page` parte dos
 * VALORES (`page_columns_values`), então uma coluna recém-criada — ainda sem
 * nenhum valor preenchido — simplesmente não aparece ali. `/columns` é a fonte
 * da verdade; o dataset entra só com os valores.
 */
import type {
  ColumnDataType,
  ColumnOption,
  DataViewKind,
  DataViewSettings,
  DataViewType,
  HeaderCol,
  NumberFormat,
  OptionColor,
  RowData,
} from 'cubs-database'

// --- Formato cru das respostas da API ---

export type ApiColumnType = 'text' | 'numeric' | 'select' | 'date' | 'checkbox'

/** Opção de uma coluna `select`; o valor da célula é o `id` dela, não o texto. */
export interface ApiSelectOption {
  id: string
  value: string
  color?: string
}

export interface ApiPageColumnData {
  options?: ApiSelectOption[]
  format?: 'percentage' | 'currency'
}

/** GET /pages/parent/:id/columns */
export interface ApiPageColumn {
  id: string
  name: string | null
  type: ApiColumnType
  data: ApiPageColumnData | null
  parent_id: string | null
}

/** GET /pages/:id (e /workspaces/:id/page_root, que devolve a mesma forma) */
export interface ApiPage {
  id: string
  title: string | null
  data: Record<string, unknown> | null
  owner_id: string
}

/**
 * Célula do dataset. `row_data` e `column_data` chegam como STRING JSON — são
 * produto de `json_object()` no SQLite, não passam pelo desserializador do
 * Model — então exigem parse antes de qualquer uso.
 */
export interface ApiDatasetCell {
  row_id: string | null
  /** Envelope `{"value":<T>}` serializado. */
  row_data: string | null
  column_name: string | null
  column_type: ApiColumnType | null
  /** `PageColumnData` serializado (options do select, format do numeric). */
  column_data: string | null
}

/** GET /pages/:id/page — uma entrada por página-filha. */
export interface ApiDatasetRow {
  page_id: string
  page_title: string | null
  /** Indexado pelo id da coluna. Filha sem nenhum valor vem `{}`. */
  page_columns: Record<string, ApiDatasetCell>
}

// --- Constantes do adaptador ---

/**
 * Id da coluna sintética do título. `pages.title` é campo da própria página, e
 * não uma `page_columns` — mas na tabela ele é a primeira coluna, como qualquer
 * outra. O id é propositalmente NÃO-ULID (tem `_`, e 10 chars): jamais colide
 * com o id de uma coluna real, e dá para reconhecê-lo em `orderedHeaderCols`.
 */
export const TITLE_COLUMN_ID = 'page_title'

/**
 * View usada quando a página ainda não tem nenhuma salva em `data` — o caso de
 * toda página que acabou de virar parent de outra. ULID FIXO (não gerado em
 * runtime) porque ele é a identidade da tab: gerar um novo a cada parse
 * trocaria a view ativa a cada refetch.
 */
export const FALLBACK_VIEW_ID = '01KXVZ0000FALLBACKTABLE001'

const VIEW_KINDS: readonly DataViewKind[] = ['table', 'board', 'calendar']
const COLUMN_TYPES: readonly ColumnDataType[] = ['text', 'numeric', 'select', 'date', 'checkbox']

// --- Helpers de desserialização (tolerantes: dado ruim vira ausência) ---

/** Faz parse de um JSON que pode vir como string, objeto ou lixo. */
function parseJsonObject<T>(raw: unknown): T | null {
  if (raw === null || raw === undefined) return null
  if (typeof raw === 'object') return raw as T
  if (typeof raw !== 'string') return null
  try {
    const parsed = JSON.parse(raw) as unknown
    return parsed && typeof parsed === 'object' ? (parsed as T) : null
  } catch {
    return null
  }
}

/**
 * Extrai o valor "nu" do envelope `{"value":<T>}`. O envelope é a convenção do
 * backend (`VALUE_CODECS`) para guardar qualquer tipo numa coluna TEXT — do
 * lado de cá ele não interessa a ninguém, some no parse.
 */
function decodeEnvelope(rawData: string | null): unknown {
  const envelope = parseJsonObject<{ value?: unknown }>(rawData)
  return envelope?.value
}

function isColumnType(value: unknown): value is ColumnDataType {
  return COLUMN_TYPES.includes(value as ColumnDataType)
}

// --- Colunas ---

const OPTION_COLORS: readonly OptionColor[] = ['red', 'orange', 'yellow', 'green', 'blue', 'grey']

function isOptionColor(value: unknown): value is OptionColor {
  return OPTION_COLORS.includes(value as OptionColor)
}

/** API → lib: `value` vira `label`; cor fora do vocabulário vira ausência. */
function toColumnOptions(options: ApiSelectOption[]): ColumnOption[] {
  return options.map((option) => ({
    id: option.id,
    label: option.value,
    ...(isOptionColor(option.color) && { color: option.color }),
  }))
}

/**
 * Mapa `columnId → options` das colunas `select`, montado a partir das
 * definições canônicas e completado com o `column_data` que vem embutido no
 * dataset (fallback para coluna cujo /columns veio sem options).
 */
function buildColumnOptions(
  columns: ApiPageColumn[],
  dataset: ApiDatasetRow[],
): Map<string, ColumnOption[]> {
  const optionsByColumn = new Map<string, ColumnOption[]>()

  const register = (columnId: string, options: ApiSelectOption[] | undefined) => {
    if (!options?.length || optionsByColumn.has(columnId)) return
    optionsByColumn.set(columnId, toColumnOptions(options))
  }

  for (const column of columns) {
    if (column.type === 'select') register(column.id, column.data?.options)
  }

  for (const row of dataset) {
    for (const [columnId, cell] of Object.entries(row.page_columns)) {
      if (cell?.column_type !== 'select') continue
      register(columnId, parseJsonObject<ApiPageColumnData>(cell.column_data)?.options)
    }
  }

  return optionsByColumn
}

/**
 * Colunas da tabela, com a coluna sintética de TÍTULO na frente — é ela que
 * carrega o `page_title` de cada filha e serve de âncora visual da linha.
 *
 * As colunas `select` levam as `options` junto (id → label/cor): é a lib quem
 * resolve o id guardado na célula na hora de renderizar — o parse NÃO traduz
 * mais o valor. `numeric` leva o `format`, que vira a máscara do editor.
 *
 * `titleLabel` é injetado por quem chama (o texto de tela vem do i18n do app;
 * este módulo não decide idioma). O `dataset` entra só como fallback de
 * options (coluna cujo /columns veio sem elas).
 */
export function parseHeaderCols(
  columns: ApiPageColumn[],
  titleLabel: string,
  dataset: ApiDatasetRow[] = [],
): HeaderCol[] {
  const titleColumn: HeaderCol = { id: TITLE_COLUMN_ID, title: titleLabel, type: 'text' }
  const optionsByColumn = buildColumnOptions(columns, dataset)

  const dataColumns = columns.map((column) => {
    const options = optionsByColumn.get(column.id)
    const format: NumberFormat | undefined =
      column.data?.format === 'percentage' || column.data?.format === 'currency'
        ? column.data.format
        : undefined

    return {
      id: column.id,
      title: column.name ?? '',
      // O type declarado manda; um valor fora do vocabulário da lib cai na
      // inferência dela (HeaderCol.type ausente), em vez de virar tipo inválido.
      ...(isColumnType(column.type) && { type: column.type }),
      ...(options && { options }),
      ...(format && { format }),
    }
  })

  return [titleColumn, ...dataColumns]
}

// --- Linhas ---

/**
 * Linhas da tabela: uma por página-filha. O `page_title` vira a célula da
 * coluna sintética; as demais saem de `page_columns`, com o envelope desfeito.
 *
 * Os valores passam CRUS — inclusive o `select`, que guarda o ULID da option:
 * a tradução id → label/cor virou responsabilidade de render da lib, que tem
 * as `options` na coluna (ver `parseHeaderCols`). É o que permite EDITAR a
 * célula: o editor precisa do id para saber qual option está ativa, e o commit
 * grava id, não texto. `date` é mantido na string ISO como veio (inclusive o
 * range `início@fim`) — formatar data é apresentação, e é a lib quem decide.
 *
 * Célula ausente é DIFERENTE de célula vazia (a lib desenha um espaço em vez de
 * um valor enganoso — um checkbox desmarcado, por exemplo), então só entra no
 * mapa a chave que realmente tem valor.
 */
export function parseRows(dataset: ApiDatasetRow[]): RowData[] {
  return dataset.map((row) => {
    const cells: RowData['cells'] = {}

    if (row.page_title !== null && row.page_title !== undefined) {
      cells[TITLE_COLUMN_ID] = { value: row.page_title }
    }

    for (const [columnId, cell] of Object.entries(row.page_columns)) {
      if (!cell) continue

      const value = decodeEnvelope(cell.row_data)
      if (value !== undefined) cells[columnId] = { value }
    }

    return { id: row.page_id, cells }
  })
}

// --- Views (settings) ---

function isViewKind(value: unknown): value is DataViewKind {
  return VIEW_KINDS.includes(value as DataViewKind)
}

/** Só entram larguras numéricas finitas — a lib clampa a faixa depois. */
function parseColumnWidths(raw: unknown): Record<string, number> | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const widths = Object.entries(raw as Record<string, unknown>).filter(
    (entry): entry is [string, number] => typeof entry[1] === 'number' && Number.isFinite(entry[1]),
  )
  return widths.length > 0 ? Object.fromEntries(widths) : undefined
}

/** Lista de ids (strings) vinda de um campo livre; lixo é filtrado. */
function parseIdList(raw: unknown): string[] {
  return Array.isArray(raw) ? raw.filter((id): id is string => typeof id === 'string') : []
}

/** Uma entrada de `page.data` só vira view se tiver o formato esperado. */
function parseView(raw: unknown): DataViewType | null {
  if (!raw || typeof raw !== 'object') return null
  const candidate = raw as Record<string, unknown>
  if (!isViewKind(candidate.view)) return null

  const columnWidths = parseColumnWidths(candidate.columnWidths)
  const orderedRows = parseIdList(candidate.orderedRows)

  return {
    view: candidate.view,
    name: typeof candidate.name === 'string' ? candidate.name : '',
    filters: typeof candidate.filters === 'string' ? candidate.filters : '',
    orderedHeaderCols: parseIdList(candidate.orderedHeaderCols),
    // Ausente e vazio são a MESMA coisa na leitura (ordem natural), então o
    // campo só entra quando tem conteúdo — snapshot enxuto.
    ...(orderedRows.length > 0 && { orderedRows }),
    ...(columnWidths && { columnWidths }),
  }
}

/**
 * Views salvas em `pages.data` — o Record `{ [ulid]: view }` que a lib consome
 * como tabs. `data` é um campo livre da página, então entradas que não têm cara
 * de view são DESCARTADAS em silêncio: elas podem ser qualquer outra coisa que
 * o app venha a guardar ali, e não devem virar uma tab quebrada.
 */
export function parseViewSettings(data: Record<string, unknown> | null | undefined): DataViewSettings {
  if (!data) return {}

  const settings: DataViewSettings = {}
  for (const [viewId, raw] of Object.entries(data)) {
    const view = parseView(raw)
    if (view) settings[viewId] = view
  }
  return settings
}

/** View mínima para uma base que ainda não tem nenhuma salva. */
export function createFallbackViewSettings(
  headerCols: HeaderCol[],
  name: string,
): DataViewSettings {
  return {
    [FALLBACK_VIEW_ID]: {
      view: 'table',
      name,
      filters: '',
      orderedHeaderCols: headerCols.map((column) => column.id),
    },
  }
}

// --- Composição ---

export interface ParsedDatabase {
  settings: DataViewSettings
  headerCols: HeaderCol[]
  rows: RowData[]
}

export interface ParseDatabaseInput {
  page: ApiPage
  columns: ApiPageColumn[]
  dataset: ApiDatasetRow[]
  /** Rótulo da coluna sintética de título (vem do i18n do app). */
  titleLabel: string
  /** Nome da tab quando a base ainda não tem view salva (vem do i18n). */
  fallbackViewName: string
}

/**
 * Junta as três respostas no modelo que `<CubsDatabase />` recebe. É o ponto de
 * entrada normal do adaptador — as funções acima ficam expostas para uso
 * isolado (e para teste), mas o fluxo do app passa por aqui.
 */
export function parseDatabase({
  page,
  columns,
  dataset,
  titleLabel,
  fallbackViewName,
}: ParseDatabaseInput): ParsedDatabase {
  const headerCols = parseHeaderCols(columns, titleLabel, dataset)
  const settings = parseViewSettings(page.data)

  return {
    headerCols,
    rows: parseRows(dataset),
    settings:
      Object.keys(settings).length > 0
        ? settings
        : createFallbackViewSettings(headerCols, fallbackViewName),
  }
}
