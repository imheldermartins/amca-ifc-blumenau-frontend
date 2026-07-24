/**
 * Acesso tipado ao `localStorage` — para PREFERÊNCIA DE USUÁRIO, e só isso.
 *
 * A fronteira ficou nítida nesta leva: a sessão saiu do `localStorage` (o
 * refresh é cookie `HttpOnly`, o access mora em memória — ver `sessionStore`),
 * então o que sobra para cá é preferência que pode viver no navegador sem
 * risco: tema, sidebar recolhida, e afins. **Nada de credencial passa por
 * aqui.**
 *
 * Puro e testável (o mesmo espírito de `queryParams.ts`), resolvendo de uma
 * vez as três chatices que cada `localStorage.getItem` solto reinventava:
 *
 *  1. **namespace** `cubs.` aplicado por dentro — o chamador nunca escreve o
 *     prefixo, e duas telas não colidem por acaso numa chave crua;
 *  2. **JSON quebrado não explode**: leitura ilegível devolve `undefined` e
 *     LIMPA a chave (o `try/catch` que `tokenStore` e `theme.ts` repetiam);
 *  3. **storage indisponível não derruba a tela**: modo privativo/quota faz o
 *     `localStorage` lançar no acesso — aqui isso vira um no-op silencioso, e
 *     a preferência simplesmente não persiste.
 *
 * O valor é serializado como JSON, então cobre `string | number | boolean` e
 * objetos/arrays. O generic da leitura é uma AFIRMAÇÃO de quem chama sobre o
 * tipo gravado (como o de `useQueryParams`), não uma validação — dado externo
 * de verdade pediria um schema.
 */

const NAMESPACE = 'cubs.'

const namespaced = (key: string): string => `${NAMESPACE}${key}`

/**
 * O `localStorage`, ou `null` se indisponível. A checagem é feita UMA vez e
 * dentro de try/catch porque em alguns navegadores só TOCAR em
 * `window.localStorage` (não apenas usá-lo) já lança quando o storage está
 * bloqueado.
 */
function storage(): Storage | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

export const clientLocalStorage = {
  get<T>(key: string): T | undefined {
    const store = storage()
    if (!store) return undefined

    const raw = store.getItem(namespaced(key))
    if (raw === null) return undefined

    try {
      return JSON.parse(raw) as T
    } catch {
      // Valor corrompido (ou gravado fora do formato JSON): descarta e limpa,
      // para a próxima leitura não repetir o erro.
      store.removeItem(namespaced(key))
      return undefined
    }
  },

  set(key: string, value: unknown): void {
    const store = storage()
    if (!store) return

    // `undefined`/`null` significam "sem preferência" — apaga em vez de gravar
    // a string "null", para a leitura seguinte devolver undefined limpo.
    if (value === undefined || value === null) {
      store.removeItem(namespaced(key))
      return
    }

    try {
      store.setItem(namespaced(key), JSON.stringify(value))
    } catch {
      // Quota estourada ou storage bloqueado: a preferência não persiste, mas
      // a tela não pode cair por causa disso.
    }
  },

  remove(key: string): void {
    storage()?.removeItem(namespaced(key))
  },
}
