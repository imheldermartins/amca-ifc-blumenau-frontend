import { createContext, useContext, type ReactNode } from 'react'

import type { AccessScope } from '@/services/AccessService'

interface AccessRouteState {
  scope: AccessScope
  id: string
}

const AccessRouteContext = createContext<AccessRouteState | null>(null)

export function isAccessScope(value: string): value is AccessScope {
  return value === 'organization' || value === 'workspace' || value === 'page'
}

export function AccessRouteProvider({
  value,
  children,
}: {
  value: AccessRouteState
  children: ReactNode
}) {
  return <AccessRouteContext.Provider value={value}>{children}</AccessRouteContext.Provider>
}

export function useAccessRoute(): AccessRouteState {
  const context = useContext(AccessRouteContext)
  if (!context) throw new Error('useAccessRoute precisa estar dentro da rota de acesso.')
  return context
}

export function useOptionalAccessRoute(): AccessRouteState | null {
  return useContext(AccessRouteContext)
}
