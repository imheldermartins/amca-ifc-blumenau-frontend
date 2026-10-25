import { createContext, useContext } from 'react'
import type { ApiOrganization } from '@/services/WorkspaceService'

const Context = createContext<ApiOrganization | null>(null)
export const OrganizationSettingsProvider = Context.Provider
export function useOrganizationSettings() {
  const organization = useContext(Context)
  if (!organization) throw new Error('Configuração de organização fora do provider.')
  return organization
}
