import type { OptionColor } from '../../types'

/**
 * Classes por cor de option, ESCRITAS POR EXTENSO — o Tailwind só gera classe
 * que aparece literal no código, então nada de `bg-p-${cor}` em runtime. Segue
 * a regra da palette: texto na cor usa 600 (light) / 400 (dark); o fundo é a
 * versão suave (translúcida) do mesmo hue.
 *
 * (Arquivo separado do `OptionChip` só por causa do Fast Refresh: módulo de
 * componente não deve exportar constante.)
 */
export const OPTION_COLOR_CLASSES: Record<OptionColor, string> = {
  red: 'bg-p-red-600/15 text-p-red-600 dark:bg-p-red-500/20 dark:text-p-red-400',
  orange: 'bg-p-orange-600/15 text-p-orange-600 dark:bg-p-orange-500/20 dark:text-p-orange-400',
  yellow: 'bg-p-yellow-600/15 text-p-yellow-600 dark:bg-p-yellow-500/20 dark:text-p-yellow-400',
  green: 'bg-p-green-600/15 text-p-green-600 dark:bg-p-green-500/20 dark:text-p-green-400',
  blue: 'bg-p-blue-600/15 text-p-blue-600 dark:bg-p-blue-500/20 dark:text-p-blue-400',
  grey: 'bg-p-grey-600/15 text-p-grey-600 dark:bg-p-grey-500/20 dark:text-p-grey-400',
}
