/**
 * Superfície compartilhada pelas camadas flutuantes do Cub's. O painel usa
 * sombra neutra padrão; somente as LINHAS interativas abaixo recebem glow.
 */
export const FLOATING_SURFACE_CLASSES =
  'rounded-2xl border border-light-100/70 bg-glass p-1 ' +
  'shadow-xl shadow-dark-900/15 ' +
  'ring-1 ring-light-100/60 backdrop-blur-2xl backdrop-saturate-150 ' +
  'dark:border-divider-contrast dark:shadow-dark-900/40 dark:ring-light-100/5'

/** Seleção suave: texto roxo do tema e fundo da mesma cor com 10% de opacidade. */
export const SOFT_SELECTION_CLASSES = 'bg-p-purple/10 text-p-purple'

const MENU_ROW_BASE_CLASSES =
  'flex w-full items-center gap-2 rounded px-2 py-1 text-left text-sm focus-visible:outline-none '

/** Linha interativa comum a menus planos e recursivos. */
export const MENU_ROW_CLASSES =
  MENU_ROW_BASE_CLASSES + 'glow-purple-hover transition-[color,background-color,box-shadow] hover:bg-active focus-visible:bg-active'

/** Ações destrutivas seguem o vermelho suave do menu da conta, sem glow. */
export const MENU_DANGER_ROW_CLASSES =
  MENU_ROW_BASE_CLASSES + 'transition-colors text-p-red hover:bg-p-red/10 focus-visible:bg-p-red/10'
