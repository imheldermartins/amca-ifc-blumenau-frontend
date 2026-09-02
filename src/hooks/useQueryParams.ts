import { useCallback, useMemo } from 'react'
import { useNavigate, useRouterState } from '@tanstack/react-router'

import {
  applyQueryPatch,
  readBoolean,
  readList,
  readNumber,
  readText,
  replaceQuery,
  replaceQueryNamespace,
  type QueryPatch,
  type QueryRecord,
  type QueryValue,
} from '@/lib/queryParams'

export interface QueryWriteOptions {
  /**
   * Troca a entrada atual do histórico em vez de empilhar uma nova.
   *
   * Padrão `false` (empilha), porque mudar filtro é navegação: o "voltar" tem
   * que desfazer o filtro, não sair da tela. A exceção é entrada CONTÍNUA —
   * campo de busca, slider — onde empilhar por tecla digitada entope o
   * histórico; aí passe `true` (é o que o `<SearchBar>` faz).
   */
  replace?: boolean
}

/**
 * Query da URL como objeto de leitura/escrita.
 *
 * `TKey` é opcional e só restringe as CHAVES (`useQueryParams<'q' | 'view'>()`
 * autocompleta e recusa typo). Os tipos dos valores não vêm daqui: o que
 * chega na URL é o que o usuário digitou nela, então quem tipa a leitura é o
 * método escolhido (`get` → string, `getNumber` → number, ...).
 */
export interface QueryParams<TKey extends string = string> {
  /** Query crua, já parseada pelo router. Escotilha de saída — prefira os `get*`. */
  all: Readonly<QueryRecord>

  /** Valor como string (`?age=20` → `'20'`). Ausente ou vazio → `undefined`. */
  get(key: TKey): string | undefined
  getNumber(key: TKey): number | undefined
  /** Só `?k=true` / `?k=false`; qualquer outro texto → `undefined`. */
  getBoolean(key: TKey): boolean | undefined
  /** Chave repetida (`?tag=a&tag=b`) como lista. */
  getAll(key: TKey): string[]
  has(key: TKey): boolean

  /**
   * Escreve uma chave ou um objeto inteiro. As demais chaves da URL ficam
   * intactas; `null`/`undefined`/`''` apagam a chave.
   *
   * A forma em objeto é UMA navegação só — mexer em 3 chaves com 3 `set`
   * separados gera 3 entradas no histórico e 3 renders.
   */
  set: {
    (key: TKey, value: QueryValue, options?: QueryWriteOptions): void
    (patch: QueryPatch<TKey>, options?: QueryWriteOptions): void
  }
  /** Apaga uma ou mais chaves numa navegação só. */
  remove(...keys: TKey[]): void
  /** Liga/desliga uma FLAG: ausente → `?k=true`, presente → some. */
  toggle(key: TKey, options?: QueryWriteOptions): void
  /** Substitui a query inteira — o que não estiver em `next` é apagado. */
  reset(next: QueryPatch<TKey>, options?: QueryWriteOptions): void
  /** Substitui somente as chaves pertencentes ao namespace informado. */
  replaceNamespace(
    belongsToNamespace: (key: string) => boolean,
    next: QueryPatch<TKey>,
    options?: QueryWriteOptions,
  ): void
  clear(options?: QueryWriteOptions): void
}

/**
 * Estado guardado na URL, sem `validateSearch` por rota.
 *
 * Serve para o estado que o usuário espera poder copiar, favoritar e voltar
 * com o botão do navegador: busca, filtro, aba aberta, página da listagem.
 * Estado efêmero (modal aberta, hover) continua em `useState`.
 *
 * Funciona em QUALQUER componente abaixo do `<RouterProvider>` — não precisa
 * de `from`, não precisa saber em que rota está, e a rota não precisa declarar
 * nada. Isso é de propósito: o `<SearchBar>` mora no layout e é usado por
 * telas que ele não conhece. O preço é não ter validação/tipagem automática
 * dos valores; quando uma rota quiser garantias (default, coerção, recusar
 * lixo), o caminho é `validateSearch` + `Route.useSearch()` nela, e este hook
 * continua valendo para o resto.
 *
 * ─── Duas armadilhas do router que o hook já resolve ────────────────────────
 * 1. `navigate({ to })` SEM `search` apaga a query inteira. Toda escrita aqui
 *    passa pela forma funcional (`search: (previous) => ...`), que preserva o
 *    que não foi tocado.
 * 2. Os valores voltam coagidos (`?age=20` → number). Ver `src/lib/queryParams.ts`.
 *
 * @example
 * const query = useQueryParams()
 *
 * query.get('name')                        // 'Helder'
 * query.set('name', 'Helder')              // ?name=Helder
 * query.set({ name: 'Helder', age: 20 })   // ?name=Helder&age=20 (1 navegação)
 * query.remove('name')                     // some da URL
 *
 * @example Botão que liga um filtro (a URL é o estado — nada de useState):
 * const query = useQueryParams<'status'>()
 *
 * <Button
 *   variant={query.get('status') === 'ativo' ? 'filled' : 'outlined'}
 *   onClick={() => query.set('status', query.get('status') === 'ativo' ? null : 'ativo')}
 * >
 *   Ativos
 * </Button>
 */
export function useQueryParams<TKey extends string = string>(): QueryParams<TKey> {
  const navigate = useNavigate()

  // `location.search` em vez de `useSearch()`: é a query CRUA da URL, sem
  // depender de `from`/`strict` nem do que cada rota validou — que é o que
  // torna o hook utilizável de qualquer lugar da árvore.
  const search = useRouterState({
    select: (state) => state.location.search as QueryRecord,
  })

  // `to: '.'` = a rota atual, com os params atuais (o `$lang` inclusive). Não
  // dá para omitir: sem `to`, o router não sabe contra qual rota resolver o
  // schema de search e o retorno do redutor vira `never` na tipagem.
  const update = useCallback(
    (updater: (previous: QueryRecord) => QueryRecord, options?: QueryWriteOptions) => {
      void navigate({ to: '.', search: updater, replace: options?.replace ?? false })
    },
    [navigate],
  )

  const write = useCallback(
    (patch: QueryPatch<TKey>, options?: QueryWriteOptions) => {
      update((previous) => applyQueryPatch(previous, patch), options)
    },
    [update],
  )

  const reset = useCallback(
    (next: QueryPatch<TKey>, options?: QueryWriteOptions) => {
      update((previous) => replaceQuery(previous, next), options)
    },
    [update],
  )

  const replaceNamespace = useCallback(
    (
      belongsToNamespace: (key: string) => boolean,
      next: QueryPatch<TKey>,
      options?: QueryWriteOptions,
    ) => {
      update(
        (previous) => replaceQueryNamespace(previous, belongsToNamespace, next),
        options,
      )
    },
    [update],
  )

  const set = useCallback(
    (
      keyOrPatch: TKey | QueryPatch<TKey>,
      valueOrOptions?: QueryValue | QueryWriteOptions,
      maybeOptions?: QueryWriteOptions,
    ) => {
      if (typeof keyOrPatch === 'string') {
        write({ [keyOrPatch]: valueOrOptions } as QueryPatch<TKey>, maybeOptions)
        return
      }
      write(keyOrPatch, valueOrOptions as QueryWriteOptions | undefined)
    },
    [write],
    // O overload público (chave+valor OU objeto) não tem como ser inferido da
    // implementação, que precisa dos dois formatos no mesmo parâmetro.
  ) as QueryParams<TKey>['set']

  return useMemo<QueryParams<TKey>>(
    () => ({
      all: search,

      get: (key) => readText(search[key]),
      getNumber: (key) => readNumber(search[key]),
      getBoolean: (key) => readBoolean(search[key]),
      getAll: (key) => readList(search[key]),
      has: (key) => readText(search[key]) !== undefined,

      set,
      remove: (...keys) => {
        write(Object.fromEntries(keys.map((key) => [key, undefined])) as QueryPatch<TKey>)
      },
      toggle: (key, options) => {
        write({ [key]: readBoolean(search[key]) === true ? undefined : true } as QueryPatch<TKey>, options)
      },
      reset,
      replaceNamespace,
      clear: (options) => reset({}, options),
    }),
    [search, set, write, reset, replaceNamespace],
  )
}
