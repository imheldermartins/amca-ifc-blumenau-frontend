/**
 * Superfície compartilhada pelas camadas flutuantes do Cub's. O painel usa
 * sombra neutra padrão; somente as LINHAS interativas abaixo recebem glow.
 */
export const FLOATING_SURFACE_CLASSES =
  'rounded-2xl border border-light-100/70 bg-glass p-1 ' +
  'shadow-xl shadow-dark-900/15 ' +
  'ring-1 ring-light-100/60 backdrop-blur-2xl backdrop-saturate-150 ' +
  'dark:border-divider-contrast dark:shadow-dark-900/40 dark:ring-light-100/5'

/** Linha interativa comum a menus planos e recursivos. */
export const MENU_ROW_CLASSES =
  'glow-purple-hover flex w-full items-center gap-2 rounded px-2 py-1 text-left text-sm ' +
  'transition-[color,background-color,box-shadow] hover:bg-active focus-visible:bg-active focus-visible:outline-none'
