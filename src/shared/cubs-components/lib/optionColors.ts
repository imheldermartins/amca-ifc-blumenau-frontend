/**
 * Cores de option/rótulo do Cub's — o vocabulário compartilhado entre o
 * `ColorPicker` (este pacote) e os chips de select da `cubs-database`. Mora
 * AQUI, no pacote, porque a cor é domínio comum; a lib de tabela re-exporta.
 *
 * O conjunto ESPELHA o `ColorOptions` do backend (`red|orange|yellow|green|
 * blue|grey`) — uma cor fora dele é rejeitada na escrita. Ampliar exige mexer
 * no enum do backend também (por isso não há "pink" ainda).
 *
 * Classes ESCRITAS POR EXTENSO: o Tailwind só gera o que enxerga literal, nada
 * de `bg-p-${cor}` em runtime.
 */
export const OPTION_COLORS = ['red', 'orange', 'yellow', 'green', 'blue', 'grey'] as const

export type OptionColor = (typeof OPTION_COLORS)[number]

/**
 * Chip: fundo suave translúcido + texto na cor (600 light / 400 dark) — o
 * mesmo tratamento da palette. É o que o `OptionChip` da tabela usa.
 */
export const OPTION_COLOR_CLASSES: Record<OptionColor, string> = {
  red: 'bg-p-red-600/15 text-p-red-600 dark:bg-p-red-500/20 dark:text-p-red-400',
  orange: 'bg-p-orange-600/15 text-p-orange-600 dark:bg-p-orange-500/20 dark:text-p-orange-400',
  yellow: 'bg-p-yellow-600/15 text-p-yellow-600 dark:bg-p-yellow-500/20 dark:text-p-yellow-400',
  green: 'bg-p-green-600/15 text-p-green-600 dark:bg-p-green-500/20 dark:text-p-green-400',
  blue: 'bg-p-blue-600/15 text-p-blue-600 dark:bg-p-blue-500/20 dark:text-p-blue-400',
  grey: 'bg-p-grey-600/15 text-p-grey-600 dark:bg-p-grey-500/20 dark:text-p-grey-400',
}

/** Amostra SÓLIDA (o bolinha do ColorPicker) — tom cheio da cor. */
export const OPTION_COLOR_SWATCH: Record<OptionColor, string> = {
  red: 'bg-p-red-500',
  orange: 'bg-p-orange-500',
  yellow: 'bg-p-yellow-500',
  green: 'bg-p-green-500',
  blue: 'bg-p-blue-500',
  grey: 'bg-p-grey-500',
}
