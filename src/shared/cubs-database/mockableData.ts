import type { DataViewSettings, HeaderCol, RowData } from './types'

export interface MockableDataset {
  tableName: string
  settings: DataViewSettings
  headerCols: HeaderCol[]
  rows: RowData[]
}

/** ULIDs fixos das views do mock (estáveis para deep-link/testes). */
export const MOCK_VIEW_IDS = {
  table: '01JZFM3T4V9GQ2W5X7Y8Z0ABCD',
  board: '01JZFM3T4VBH6K8M2N4P6Q8R0S',
  calendar: '01JZFM3T4VCX3Y5Z7A9B2C4D6E',
} as const

// const COL = {
//   title: 'col-title',
//   slug: 'col-slug',
//   status: 'col-status',
//   published: 'col-published',
//   order: 'col-order',
//   updatedAt: 'col-updated-at',
// } as const

/**
 * Dados simulados para desenvolvimento/preview. O dataset `pageTree` imita a
 * base do PageTree sem replicar a arquitetura literal: colunas dinâmicas
 * tipadas, e algumas SEM type declarado — a tabela infere o tipo dos valores.
 */
export const mockableData = {
  pageTree: {
    tableName: 'page_tree',
    settings: {
      [MOCK_VIEW_IDS.table]: {
        view: 'table',
        name: 'Tabela',
        filters: '',
        orderedHeaderCols: [
          '01KXVP2382G5ABC7K14NSY1BH2',
          '01KXVP2384NCBVJPGW1X15BE0K',
          '01KXVP2384YERQ9A792YD04K1R',
          '01KXVP2384TVZM7W5EASN3PX27',
          '01KXVP2384JC1VE6GNSW4RDMJ3',
          '01KXVP2384PRECMENSA1000001',
          '01KXVP2384PRGRESS000000001',
          '01KXVP2384GBJBCMVTG98K901B',
          '01KXVP47F97M7QXWEWQNP4KK9N'
        ],
        // Larguras por coluna (px). 'BlaBlaBla' fica de fora de propósito:
        // exercita o fallback pro DEFAULT_COLUMN_WIDTH.
        columnWidths: {
          ['01KXVP2382G5ABC7K14NSY1BH2']: 240,
          ['01KXVP2384NCBVJPGW1X15BE0K']: 220,
          ['01KXVP2384YERQ9A792YD04K1R']: 140,
          ['01KXVP2384TVZM7W5EASN3PX27']: 110,
          ['01KXVP2384JC1VE6GNSW4RDMJ3']: 100,
          ['01KXVP2384PRECMENSA1000001']: 140,
          ['01KXVP2384PRGRESS000000001']: 120,
          ['01KXVP2384GBJBCMVTG98K901B']: 180,
        },
      },
      [MOCK_VIEW_IDS.board]: {
        view: 'board',
        name: 'Kanban',
        filters: 'status=published',
        orderedHeaderCols: [],
      },
      [MOCK_VIEW_IDS.calendar]: {
        view: 'calendar',
        name: 'Calendário',
        filters: 'order=updated_at',
        orderedHeaderCols: [],
      },
    },
    headerCols: [
      // Sem type declarado: a tabela infere 'text' das strings.
      { id: '01KXVP2382G5ABC7K14NSY1BH2', title: 'Título' },
      { id: '01KXVP2384NCBVJPGW1X15BE0K', title: 'Slug', type: 'text' },
      {
        id: '01KXVP2384YERQ9A792YD04K1R',
        title: 'Status',
        type: 'select',
        // A célula guarda o ID da option (nunca o texto) — o chip resolve
        // label/cor por aqui. 'Revisão' sem cor exercita o chip neutro.
        options: [
          { id: 'opt_published', label: 'Publicada', color: 'green' },
          { id: 'opt_draft', label: 'Rascunho', color: 'grey' },
          { id: 'opt_review', label: 'Revisão' },
        ],
      },
      { id: '01KXVP2384TVZM7W5EASN3PX27', title: 'Publicada', type: 'checkbox' },
      { id: '01KXVP2384JC1VE6GNSW4RDMJ3', title: 'Ordem', type: 'numeric' },
      // `format` decide a máscara do editor: currency guarda CENTAVOS inteiros;
      // percentage guarda o inteiro (42 = "42%").
      { id: '01KXVP2384PRECMENSA1000001', title: 'Preço', type: 'numeric', format: 'currency' },
      { id: '01KXVP2384PRGRESS000000001', title: 'Progresso', type: 'numeric', format: 'percentage' },
      { id: '01KXVP2384GBJBCMVTG98K901B', title: 'Atualizada em', type: 'date' },
      // Sem type e com valor em UMA linha só: infere 'numeric' desse valor —
      // as 7 linhas vazias não interferem.
      { id: '01KXVP47F97M7QXWEWQNP4KK9N', title: 'BlaBlaBla' },
    ],
    rows: [
      {
        id: 'pg_01',
        cells: {
          ['01KXVP2382G5ABC7K14NSY1BH2']: { value: 'Home' },
          ['01KXVP2384NCBVJPGW1X15BE0K']: { value: 'home' },
          ['01KXVP2384YERQ9A792YD04K1R']: { value: 'opt_published' },
          ['01KXVP2384TVZM7W5EASN3PX27']: { value: true },
          ['01KXVP2384JC1VE6GNSW4RDMJ3']: { value: 1 },
          // currency em CENTAVOS: 129900 → "R$ 1.299,00".
          ['01KXVP2384PRECMENSA1000001']: { value: 129900 },
          ['01KXVP2384PRGRESS000000001']: { value: 80 },
          ['01KXVP2384GBJBCMVTG98K901B']: { value: '2026-07-10 09:12' },
          ['01KXVP47F97M7QXWEWQNP4KK9N']: { value: 100 },
        },
      },
      {
        id: 'pg_02',
        cells: {
          ['01KXVP2382G5ABC7K14NSY1BH2']: { value: 'Documentação' },
          ['01KXVP2384NCBVJPGW1X15BE0K']: { value: 'docs' },
          ['01KXVP2384YERQ9A792YD04K1R']: { value: 'opt_published' },
          ['01KXVP2384TVZM7W5EASN3PX27']: { value: true },
          ['01KXVP2384JC1VE6GNSW4RDMJ3']: { value: 2 },
          ['01KXVP2384PRECMENSA1000001']: { value: 4990 },
          ['01KXVP2384PRGRESS000000001']: { value: 25 },
          ['01KXVP2384GBJBCMVTG98K901B']: { value: '2026-07-11 14:40' },
        },
      },
      {
        id: 'pg_03',
        cells: {
          ['01KXVP2382G5ABC7K14NSY1BH2']: { value: 'Primeiros passos' },
          ['01KXVP2384NCBVJPGW1X15BE0K']: { value: 'docs/getting-started' },
          ['01KXVP2384YERQ9A792YD04K1R']: { value: 'opt_review' },
          ['01KXVP2384TVZM7W5EASN3PX27']: { value: true },
          ['01KXVP2384JC1VE6GNSW4RDMJ3']: { value: 3 },
          ['01KXVP2384GBJBCMVTG98K901B']: { value: '2026-07-12 08:05' },
        },
      },
      {
        id: 'pg_04',
        cells: {
          ['01KXVP2382G5ABC7K14NSY1BH2']: { value: 'API' },
          ['01KXVP2384NCBVJPGW1X15BE0K']: { value: 'docs/api' },
          ['01KXVP2384YERQ9A792YD04K1R']: { value: 'opt_draft' },
          ['01KXVP2384TVZM7W5EASN3PX27']: { value: false },
          ['01KXVP2384JC1VE6GNSW4RDMJ3']: { value: 4 },
          ['01KXVP2384GBJBCMVTG98K901B']: { value: '2026-07-13 17:22' },
        },
      },
      {
        id: 'pg_05',
        cells: {
          ['01KXVP2382G5ABC7K14NSY1BH2']: { value: 'Blog' },
          ['01KXVP2384NCBVJPGW1X15BE0K']: { value: 'blog' },
          ['01KXVP2384YERQ9A792YD04K1R']: { value: 'opt_published' },
          ['01KXVP2384TVZM7W5EASN3PX27']: { value: true },
          ['01KXVP2384JC1VE6GNSW4RDMJ3']: { value: 5 },
          ['01KXVP2384GBJBCMVTG98K901B']: { value: '2026-07-14 10:00' },
        },
      },
      {
        id: 'pg_06',
        cells: {
          ['01KXVP2382G5ABC7K14NSY1BH2']: { value: 'Primeiro post' },
          ['01KXVP2384NCBVJPGW1X15BE0K']: { value: 'blog/primeiro-post' },
          ['01KXVP2384YERQ9A792YD04K1R']: { value: 'opt_draft' },
          ['01KXVP2384TVZM7W5EASN3PX27']: { value: false },
          ['01KXVP2384JC1VE6GNSW4RDMJ3']: { value: 6 },
          ['01KXVP2384GBJBCMVTG98K901B']: { value: '2026-07-15 19:47' },
        },
      },
      {
        id: 'pg_07',
        cells: {
          ['01KXVP2382G5ABC7K14NSY1BH2']: { value: 'Sobre' },
          ['01KXVP2384NCBVJPGW1X15BE0K']: { value: 'sobre' },
          ['01KXVP2384YERQ9A792YD04K1R']: { value: 'opt_published' },
          ['01KXVP2384TVZM7W5EASN3PX27']: { value: true },
          ['01KXVP2384JC1VE6GNSW4RDMJ3']: { value: 7 },
          ['01KXVP2384GBJBCMVTG98K901B']: { value: '2026-07-15 21:30' },
        },
      },
      {
        id: 'pg_08',
        cells: {
          ['01KXVP2382G5ABC7K14NSY1BH2']: { value: 'Contato' },
          ['01KXVP2384NCBVJPGW1X15BE0K']: { value: 'contato' },
          ['01KXVP2384YERQ9A792YD04K1R']: { value: 'opt_published' },
          ['01KXVP2384TVZM7W5EASN3PX27']: { value: true },
          ['01KXVP2384JC1VE6GNSW4RDMJ3']: { value: 8 },
          ['01KXVP2384GBJBCMVTG98K901B']: { value: '2026-07-16 07:58' },
        },
      },
    ],
  },
} satisfies Record<string, MockableDataset>
