import { OPTION_COLORS, type OptionColor } from 'cubs-components'

/** Mesmo vocabulário visual já exportado pelo pacote de componentes. */
export const USER_COLORS = OPTION_COLORS
export type UserColor = OptionColor

/** Dados de usuário realmente recebidos pela sessão e pela API de colaboradores. */
export interface UserIdentity {
  id: string
  name: string | null
  email: string
}

/** Projeção visual calculada no frontend para um conjunto de participantes. */
export interface UserVisualIdentity extends UserIdentity {
  /** Iniciais locais em ASCII uppercase (1–3 caracteres). */
  slug: string
  /** Cor local distribuída entre os demais participantes da página. */
  color: UserColor
}
