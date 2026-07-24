import { useCallback, useState } from 'react'

import { clientLocalStorage } from '@/lib/clientStorage'

/**
 * `useState` que persiste em `localStorage` via `clientLocalStorage` — para
 * preferência de usuário (tema, sidebar). NÃO para sessão: credencial mora em
 * cookie/memória, nunca aqui.
 *
 * A assinatura é a do `useState` (valor + setter que aceita valor ou
 * updater), então trocar um `useState` que deveria persistir por este é uma
 * substituição direta. O valor inicial é lido do storage UMA vez (lazy
 * initializer); ausente ou ilegível cai no `fallback`.
 *
 * Escopo consciente: NÃO escuta o evento `storage` de outras abas. Preferência
 * é troca deliberada e rara; sincronizar aba-a-aba aqui seria complexidade sem
 * demanda — o realtime da BASE, que precisa disso, tem o socket. Se um dia uma
 * preferência precisar cruzar abas, é aqui que o listener entra.
 */
export function useLocalStorageState<T>(
  key: string,
  fallback: T,
): [T, (value: T | ((previous: T) => T)) => void] {
  const [state, setState] = useState<T>(() => clientLocalStorage.get<T>(key) ?? fallback)

  const setPersisted = useCallback(
    (value: T | ((previous: T) => T)) => {
      setState((previous) => {
        const next = value instanceof Function ? value(previous) : value
        clientLocalStorage.set(key, next)
        return next
      })
    },
    [key],
  )

  return [state, setPersisted]
}
