/**
 * Paleta de cores de destaque do Cub's.
 *
 * As chaves são SEMÂNTICAS e mapeiam para hues do Tailwind:
 *   red → rose · blue → blue · purple → violet · green → emerald
 *
 * Esse mapeamento está registrado como cor NATIVA do Tailwind no CSS do app
 * consumidor (escala `p-*`; ver o contrato de tokens no README do pacote).
 * Então, para a maioria dos casos, você NÃO precisa importar este arquivo —
 * use as classes direto no `className`:
 *
 *   bg-p-red / text-p-red / border-p-red / shadow-p-red   (tom cheio, theme-aware)
 *   text-p-red-600 dark:text-p-red-400                    (controle fino de tom)
 *
 * Este objeto `PALETTE` existe para o caso em que a cor é DINÂMICA (escolhida
 * por prop em runtime, ex.: <Button color={cor} />): aí não dá para escrever a
 * classe por extenso e precisamos de um mapa. Ele compõe exatamente as mesmas
 * classes `p-*` — a fonte da verdade das cores é o CSS.
 *
 * Regra de tema (a mesma da escala): superfície/hover/borda usam `-500..-600`;
 * texto sobre fundo colorido (filled) é branco; texto NA cor usa `-600`/`-400`.
 *
 * Para adicionar uma cor: registre a escala `p-<nome>` no index.css do app,
 * inclua a chave em `PALETTE_COLORS` e preencha a entrada em `PALETTE`.
 */
import { clsx } from 'clsx'

export const PALETTE_COLORS = ['blue', 'red', 'purple', 'green'] as const

export type PaletteColor = (typeof PALETTE_COLORS)[number]

export interface PaletteEntry {
  /** Fundo sólido na cor (300 light / 500 dark). */
  bg: string
  /** Fundo sólido no estado hover (um tom acima). */
  bgHover: string
  /** Fundo suave (translúcido) na cor — bom para hover de outlined/chips. */
  bgSoft: string
  /** Texto NA cor, legível sobre o background do tema. */
  text: string
  /** Texto de contraste para usar SOBRE o fundo sólido. */
  textOnFilled: string
  /** Borda na cor (300 light / 500 dark). */
  border: string
  /** Sombra na cor (300 light / 500 dark). */
  shadow: string
}

export const PALETTE: Record<PaletteColor, PaletteEntry> = {
  blue: {
    bg: 'bg-p-blue-500',
    bgHover: 'hover:bg-p-blue-400 dark:hover:bg-p-blue-600',
    bgSoft: 'hover:bg-p-blue-600/25 dark:hover:bg-p-blue-500/20',
    text: 'text-p-blue-600 dark:text-p-blue-400',
    textOnFilled: 'text-light-100',
    border: 'border-p-blue-600 dark:border-p-blue-500',
    shadow: 'shadow-lg shadow-p-blue-600/25 dark:shadow-p-blue-500/25',
  },
  red: {
    bg: 'bg-p-red-500',
    bgHover: 'hover:bg-p-red-400 dark:hover:bg-p-red-600',
    bgSoft: 'hover:bg-p-red-600/25 dark:hover:bg-p-red-500/20',
    text: 'text-p-red-600 dark:text-p-red-400',
    textOnFilled: 'text-light-100',
    border: 'border-p-red-600 dark:border-p-red-500',
    shadow: 'shadow-lg shadow-p-red-600/25 dark:shadow-p-red-500/25',
  },
  purple: {
    bg: 'bg-p-purple-500',
    bgHover: 'hover:bg-p-purple-400',
    bgSoft: 'hover:bg-p-purple-600/25 dark:hover:bg-p-purple-500/20',
    text: 'text-p-purple-600 dark:text-p-purple-400',
    textOnFilled: 'text-light-100',
    border: 'border-p-purple-600 dark:border-p-purple-500',
    shadow: 'shadow-lg shadow-p-purple-600/35 dark:shadow-p-purple-500/35',
  },
  green: {
    bg: 'bg-p-green-500',
    bgHover: 'hover:bg-p-green-400 dark:hover:bg-p-green-600',
    bgSoft: 'hover:bg-p-green-600/25 dark:hover:bg-p-green-500/20',
    text: 'text-p-green-600 dark:text-p-green-400',
    textOnFilled: 'text-light-100',
    border: 'border-p-green-600 dark:border-p-green-500',
    shadow: 'shadow-lg shadow-p-green-600/25 dark:shadow-p-green-500/25',
  },
}

/**
 * Helper sob demanda que combina `bg` + `text` de contraste de uma cor.
 *
 * @example
 * paletteBgText('blue') // → "bg-p-blue-500 text-light-100"
 */
export function paletteBgText(color: PaletteColor): string {
  const entry = PALETTE[color]
  return clsx(entry.bg, entry.textOnFilled)
}

/**
 * Combina `border` + `text` na própria cor (base do estilo outlined).
 *
 * @example
 * paletteBorderText('green') // → "border-p-green-600 dark:border-p-green-500 text-p-green-600 dark:text-p-green-400"
 */
export function paletteBorderText(color: PaletteColor): string {
  const entry = PALETTE[color]
  return clsx(entry.border, entry.text)
}
