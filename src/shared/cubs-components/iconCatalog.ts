import { addCollection } from '@iconify/react'

export type CatalogIcon = `${'cuida' | 'lucide'}:${string}`
export type IconLibrary = 'cuida' | 'lucide'

export interface IconCatalogOption {
  library: IconLibrary
  name: string
  value: CatalogIcon
}

let catalogPromise: Promise<IconCatalogOption[]> | null = null

/** Catálogo compartilhado por qualquer picker; cada coleção é carregada uma vez. */
export function loadIconCatalog(): Promise<IconCatalogOption[]> {
  catalogPromise ??= Promise.all([
    import('@iconify-json/cuida'),
    import('@iconify-json/lucide'),
  ]).then(([cuida, lucide]) => {
    addCollection(cuida.icons)
    addCollection(lucide.icons)
    return [
      ...Object.keys(cuida.icons.icons).map((name) => ({
        library: 'cuida' as const,
        name,
        value: `cuida:${name}` as CatalogIcon,
      })),
      ...Object.keys(lucide.icons.icons).map((name) => ({
        library: 'lucide' as const,
        name,
        value: `lucide:${name}` as CatalogIcon,
      })),
    ].sort((left, right) => left.name.localeCompare(right.name))
  })
  return catalogPromise
}
