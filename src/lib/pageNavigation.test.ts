import { describe, expect, it } from 'vitest'

import { TITLE_COLUMN_ID } from '@/lib/databaseParser'
import {
  createPageNavigationState,
  normalizePageTitle,
  readPageNavigationTitle,
  readPageNavigationWorkspaceId,
  readRowPageTitle,
} from '@/lib/pageNavigation'

describe('pageNavigation', () => {
  it('transporta o título sintético da filha junto do pageId', () => {
    const state = createPageNavigationState(
      'page-child',
      readRowPageTitle({
        id: 'page-child',
        cells: { [TITLE_COLUMN_ID]: { value: 'Database filha' } },
      }),
      'workspace-current',
    )

    expect(readPageNavigationTitle(state, 'page-child')).toBe('Database filha')
    expect(readPageNavigationTitle(state, 'page-other')).toBeUndefined()
    expect(readPageNavigationWorkspaceId(state, 'page-child')).toBe('workspace-current')
    expect(readPageNavigationWorkspaceId(state, 'page-other')).toBeUndefined()
  })

  it('normaliza ausência, string vazia e whitespace como título ausente', () => {
    expect(normalizePageTitle(undefined)).toBeNull()
    expect(normalizePageTitle(null)).toBeNull()
    expect(normalizePageTitle('')).toBeNull()
    expect(normalizePageTitle('   ')).toBeNull()
  })
})
