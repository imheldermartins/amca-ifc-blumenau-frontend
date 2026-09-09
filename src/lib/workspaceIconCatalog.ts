import { addCollection } from '@iconify/react'

import type { WorkspaceIcon } from '@/services/WorkspaceService'

export type IconLibrary = 'cuida' | 'lucide'

export interface WorkspaceIconOption {
  library: IconLibrary
  name: string
  value: WorkspaceIcon
}

let catalogPromise: Promise<WorkspaceIconOption[]> | null = null

export function loadWorkspaceIconCatalog(): Promise<WorkspaceIconOption[]> {
  catalogPromise ??= Promise.all([
    import('@iconify-json/cuida'),
    import('@iconify-json/lucide'),
  ]).then(([cuida, lucide]) => {
    addCollection(cuida.icons)
    addCollection(lucide.icons)
    return ([
      ...Object.keys(cuida.icons.icons).map((name) => ({
        library: 'cuida' as const,
        name,
        value: `cuida:${name}` as WorkspaceIcon,
      })),
      ...Object.keys(lucide.icons.icons).map((name) => ({
        library: 'lucide' as const,
        name,
        value: `lucide:${name}` as WorkspaceIcon,
      })),
    ] satisfies WorkspaceIconOption[]).sort((left, right) => left.name.localeCompare(right.name))
  })
  return catalogPromise
}
