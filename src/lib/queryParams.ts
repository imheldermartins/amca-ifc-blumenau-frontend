/**
 * Regras de leitura e escrita da query string — parte PURA (sem React, sem
 * router). O hook `useQueryParams` só liga isto ao TanStack Router; toda
 * decisão de semântica mora aqui, então é aqui que se testa.
 *
 * ─── O que o TanStack já faz por baixo (e por que importa) ──────────────────
 * O app usa o parser deste módulo para manter a URL pública legível e cada
 * valor como texto antes de você vê-lo.
 *
 *   ?name=Helder&age=20&ativo=true
 *   → { name: 'Helder', age: '20', ativo: 'true' }
 *
 * Chave repetida vira ARRAY (`?tag=a&tag=b` → `{ tag: ['a', 'b'] }`). O tipo
 * continua `unknown` porque o router também aceita updates programáticos antes
 * da serialização — daí os leitores explícitos abaixo.
 *
 * ─── A invariante do módulo: VAZIO É AUSENTE ────────────────────────────────
 * `null`, `undefined` e `''` são a mesma coisa nos dois sentidos:
 *
 *  • escrevendo → a chave SOME da URL (nunca gera `?q=` pendurado);
 *  • lendo      → devolve `undefined` (e `has()` responde `false`).
 *
 * É o que faz um campo de busca esvaziado voltar à URL limpa sem o chamador
 * ficar traduzindo `''` para `undefined` na mão. O custo: não dá para guardar
 * string vazia como valor — se um dia isso for necessário, é aqui que muda.
 *
 * O apagar depende de um detalhe do serializador: o `encode` do router pula
 * chave com valor `undefined` (e SÓ `undefined` — `null` viraria `?k=null`).
 * Por isso `applyQueryPatch` normaliza todo vazio para `undefined`.
 */

export type QueryScalar = string | number | boolean

/**
 * Valor aceito ao ESCREVER. Arrays produzem chaves repetidas na URL;
 * `null`/`undefined`/`''` e arrays vazios apagam a chave.
 */
export type QueryValue =
  | QueryScalar
  | readonly QueryScalar[]
  | null
  | undefined

/** Escrita em lote — `{ name: 'Helder', age: 20 }` vira `?name=Helder&age=20`. */
export type QueryPatch<TKey extends string = string> = Partial<Record<TKey, QueryValue>>

/**
 * Query crua como o router entrega. `unknown` no valor é honestidade, não
 * preguiça: depois da coerção acima pode ser string, number, boolean, array
 * ou objeto.
 */
export type QueryRecord = Record<string, unknown>

/**
 * Parser público do router: não aplica JSON.parse e preserva chaves repetidas.
 * Isso evita que `2`, `true` ou `001` mudem de tipo e garante round-trip sem
 * aspas codificadas na URL.
 */
export function parseQuerySearch(search: string): QueryRecord {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
  const result: QueryRecord = {}

  for (const [key, value] of params.entries()) {
    const previous = result[key]
    if (previous === undefined) result[key] = value
    else if (Array.isArray(previous)) previous.push(value)
    else result[key] = [previous, value]
  }

  return result
}

/**
 * Serializer público do router: arrays viram parâmetros repetidos e escalares
 * são escritos como texto puro. Objetos não fazem parte de `QueryValue`, mas
 * recebem JSON como fallback seguro para integrações futuras do router.
 */
export function stringifyQuerySearch(search: Record<string, unknown>): string {
  const params = new URLSearchParams()

  const append = (key: string, value: unknown) => {
    if (value == null || value === '') return
    if (typeof value === 'object') params.append(key, JSON.stringify(value))
    else params.append(key, String(value))
  }

  for (const [key, value] of Object.entries(search)) {
    if (Array.isArray(value)) value.forEach((item) => append(key, item))
    else append(key, value)
  }

  const encoded = params.toString()
  return encoded ? `?${encoded}` : ''
}

/** Vazio = ausente (ver invariante no topo). */
function isBlank(value: QueryValue): boolean {
  return value == null || value === '' || (Array.isArray(value) && value.length === 0)
}

/**
 * Aplica um patch sobre a query atual. Chave fora do patch fica intacta —
 * mexer em `q` não pode derrubar o `view` de quem estava na mesma tela.
 */
export function applyQueryPatch(current: QueryRecord, patch: QueryPatch): QueryRecord {
  const next: QueryRecord = { ...current }

  for (const [key, value] of Object.entries(patch)) {
    next[key] = isBlank(value) ? undefined : value
  }

  return next
}

/**
 * Substitui a query INTEIRA: o que não estiver em `next` é apagado.
 * `replaceQuery(current, {})` é o "limpa tudo".
 */
export function replaceQuery(current: QueryRecord, next: QueryPatch): QueryRecord {
  const cleared: QueryRecord = {}
  for (const key of Object.keys(current)) {
    cleared[key] = undefined
  }

  return applyQueryPatch(cleared, next)
}

/**
 * Substitui um namespace da query numa operação atômica, preservando todas as
 * chaves externas. É a fronteira usada por filtros para trocar `fv`, `group`
 * e todos os `f.*` sem várias navegações/renders intermediários.
 */
export function replaceQueryNamespace(
  current: QueryRecord,
  belongsToNamespace: (key: string) => boolean,
  next: QueryPatch,
): QueryRecord {
  const cleared: QueryRecord = { ...current }
  for (const key of Object.keys(current)) {
    if (belongsToNamespace(key)) cleared[key] = undefined
  }
  return applyQueryPatch(cleared, next)
}

/**
 * Leitura padrão: sempre string, custe o que custar ao tipo original.
 *
 * `?age=20` chega como number 20 e sai daqui como `'20'` — quem escreveu a URL
 * pensou em texto, e ler texto de um lugar e number de outro dependendo do que
 * o usuário digitou é a receita do bug intermitente. Para number/boolean, peça
 * explicitamente (`readNumber`/`readBoolean`).
 *
 * Chave repetida devolve só o PRIMEIRO valor; a lista inteira vem em `readList`.
 */
export function readText(value: unknown): string | undefined {
  if (Array.isArray(value)) return readText(value[0])
  if (value == null || value === '') return undefined
  if (typeof value === 'object') return undefined
  return String(value)
}

export function readNumber(value: unknown): number | undefined {
  const text = readText(value)
  if (text === undefined) return undefined

  const parsed = Number(text)
  return Number.isFinite(parsed) ? parsed : undefined
}

/** Só `true`/`false` literais viram boolean; qualquer outro texto é `undefined`. */
export function readBoolean(value: unknown): boolean | undefined {
  const text = readText(value)
  if (text === 'true') return true
  if (text === 'false') return false
  return undefined
}

/** Chave repetida (`?tag=a&tag=b`) como lista. Valor único vira lista de um. */
export function readList(value: unknown): string[] {
  if (value == null) return []

  const items = Array.isArray(value) ? value : [value]
  return items.map(readText).filter((item): item is string => item !== undefined)
}
