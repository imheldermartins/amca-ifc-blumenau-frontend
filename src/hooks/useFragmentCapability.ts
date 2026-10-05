import { useEffect, useState } from 'react'

function readCapability(): string {
  if (typeof window === 'undefined') return ''
  return new URLSearchParams(window.location.hash.slice(1)).get('key')?.trim() ?? ''
}

export interface FragmentCapability {
  value: string
  /** Permite refetch ao trocar o fragmento sem pôr o segredo na query key. */
  revision: number
}

/** Lê a capability somente do fragmento; nunca a persiste em storage/state de rota. */
export function useFragmentCapability(): FragmentCapability {
  const [state, setState] = useState<FragmentCapability>(() => ({
    value: readCapability(),
    revision: 0,
  }))
  useEffect(() => {
    const update = () => setState((current) => ({
      value: readCapability(),
      revision: current.revision + 1,
    }))
    window.addEventListener('hashchange', update)
    return () => window.removeEventListener('hashchange', update)
  }, [])
  return state
}
