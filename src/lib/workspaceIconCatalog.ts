import {
  loadIconCatalog,
  type IconCatalogOption,
  type IconLibrary,
} from 'cubs-components'
import type { WorkspaceIcon } from '@/services/WorkspaceService'

export type { IconLibrary }

export type WorkspaceIconOption = Omit<IconCatalogOption, 'value'> & {
  value: WorkspaceIcon
}

export function loadWorkspaceIconCatalog(): Promise<WorkspaceIconOption[]> {
  return loadIconCatalog() as Promise<WorkspaceIconOption[]>
}
