import type { ColumnDataType } from './types'

/**
 * Catálogo canônico do seletor de criação de colunas.
 *
 * A chave identifica a seção e o array define, explicitamente, a ordem das
 * opções dentro dela. Assim a UI não precisa inferir agrupamento pelo tipo.
 */
export const COLUMN_TYPE_SECTIONS = {
  base: ['text', 'numeric', 'select', 'date', 'checkbox'],
  automation: ['flow'],
  advanced: ['relation', 'extract_as', 'formula'],
} as const satisfies Record<string, readonly ColumnDataType[]>

export type ColumnTypeSectionKey = keyof typeof COLUMN_TYPE_SECTIONS
