/**
 * Máscaras de input do Cub's.
 *
 * Dois tipos de máscara convivem aqui:
 *  - de PATTERN: `#` é um dígito, o resto é literal fixo (cpf, cep, ...);
 *  - de FUNÇÃO: recebem os dígitos crus e devolvem o texto formatado
 *    (currency, que tem separador de milhar variável).
 *
 * `applyMask` é idempotente (aplicar sobre um valor já mascarado dá o mesmo
 * resultado), então funciona direto no `onChange` do input: o valor digitado
 * é reduzido a dígitos e re-formatado a cada tecla.
 *
 * Para adicionar uma máscara: registre um pattern (ou função) em `MASKS`.
 * Para adicionar uma moeda: inclua o código em `CurrencyCode`, configure em
 * `CURRENCIES` e registre a entrada `currency-<codigo>` em `MASKS`.
 */

/** Moedas suportadas — por enquanto só BRL; adicione aqui quando expandir. */
export type CurrencyCode = 'BRL'

const CURRENCIES: Record<CurrencyCode, { locale: string; formatter: Intl.NumberFormat }> = {
  BRL: {
    locale: 'pt-BR',
    formatter: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }),
  },
}

/** Remove tudo que não é dígito. */
export function unmask(value: string): string {
  return value.replace(/\D/g, '')
}

/**
 * Formata dígitos como moeda, tratando-os como centavos:
 * "123456" → "R$ 1.234,56". Vazio permanece vazio.
 */
export function formatCurrency(code: CurrencyCode, digits: string): string {
  // Limita a 15 dígitos para não estourar a precisão de Number.
  const cents = unmask(digits).slice(0, 15)
  if (cents === '') return ''
  return CURRENCIES[code].formatter.format(Number(cents) / 100)
}

/**
 * Caminho de volta da máscara de moeda: valor mascarado → CENTAVOS (inteiro).
 * "R$ 1.234,56" → 123456. Inteiro de propósito — dinheiro em float dá ruim.
 */
export function unmaskCurrencyCents(value: string): number {
  const digits = unmask(value)
  return digits === '' ? 0 : Number(digits.slice(0, 15))
}

type MaskFormatter = (digits: string) => string

export const MASKS = {
  /** (11) 98765-4321 — fixo (10 dígitos) ou celular (11 dígitos). */
  'phone-br': '(##) #####-####',
  /** 000.000.000-00 */
  cpf: '###.###.###-##',
  /** 00000-000 */
  cep: '#####-###',
  /** dd/mm/aaaa */
  date: '##/##/####',
  /**
   * 42% — inteiro, até 3 dígitos (o teto natural é 100, mas 132% é legítimo).
   * `Number` derruba zeros à esquerda ("042" → "42%").
   */
  percentage: (digits: string) => (digits === '' ? '' : `${Number(digits.slice(0, 3))}%`),
  /** R$ 1.234,56 — alias da moeda padrão do projeto (BRL). */
  currency: (digits: string) => formatCurrency('BRL', digits),
  /** Forma explícita por moeda; novas moedas entram como currency-<codigo>. */
  'currency-brl': (digits: string) => formatCurrency('BRL', digits),
} satisfies Record<string, string | MaskFormatter>

export type MaskName = keyof typeof MASKS

function resolvePattern(mask: MaskName, pattern: string, digits: string): string {
  // Telefone BR: com 10 dígitos o traço muda de lugar ((11) 8765-4321).
  if (mask === 'phone-br' && digits.length <= 10) {
    return '(##) ####-####'
  }
  return pattern
}

/**
 * Formata `value` segundo a máscara, descartando dígitos excedentes.
 *
 * @example
 * applyMask('cpf', '12345678901') // → "123.456.789-01"
 * applyMask('currency', '123456') // → "R$ 1.234,56"
 */
export function applyMask(mask: MaskName, value: string): string {
  const entry = MASKS[mask]
  const digits = unmask(value)

  if (typeof entry === 'function') {
    return entry(digits)
  }

  const pattern = resolvePattern(mask, entry, digits)
  let output = ''
  let digitIndex = 0
  for (const char of pattern) {
    if (digitIndex >= digits.length) break
    if (char === '#') {
      output += digits[digitIndex]
      digitIndex += 1
    } else {
      output += char
    }
  }
  return output
}
