import { describe, expect, it } from 'vitest'

import { loadWorkspaceIconCatalog } from './workspaceIconCatalog'

describe('workspace icon catalog', () => {
  it('expõe somente nome original e id global Cuida/Lucide', async () => {
    const catalog = await loadWorkspaceIconCatalog()
    const cuida = catalog.find((icon) => icon.value === 'cuida:building-outline')
    const lucide = catalog.find((icon) => icon.value === 'lucide:boxes')

    expect(cuida).toMatchObject({
      library: 'cuida',
      name: 'building-outline',
      value: 'cuida:building-outline',
    })
    expect(lucide).toMatchObject({
      library: 'lucide',
      name: 'boxes',
      value: 'lucide:boxes',
    })
    expect(catalog.every((icon) => !icon.name.includes(':'))).toBe(true)
    expect(new Set(catalog.map((icon) => icon.library))).toEqual(new Set(['cuida', 'lucide']))
  })
})
