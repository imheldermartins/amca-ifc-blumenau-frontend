import type { ColumnDataType } from '../types'

/**
 * Ícone por tipo de coluna — o MESMO no header e no menu da coluna. (Arquivo
 * separado do TableView só por causa do Fast Refresh: módulo de componente
 * não deve exportar constante.)
 */
export const TYPE_ICON: Record<ColumnDataType, string> = {
  text: 'lucide:type',
  numeric: 'lucide:hash',
  select: 'lucide:list',
  date: 'lucide:calendar',
  checkbox: 'lucide:square-check',
}
