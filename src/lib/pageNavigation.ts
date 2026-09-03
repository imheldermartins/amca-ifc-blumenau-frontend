import type { HistoryState } from '@tanstack/history'
import type { RowData } from 'cubs-database'

import { TITLE_COLUMN_ID } from '@/lib/databaseParser'

export interface PageShellNavigationState {
  pageId: string
  title: string | null
}

declare module '@tanstack/history' {
  interface HistoryState {
    /** Chrome provisório da página enquanto a rota resgata o snapshot autoritativo. */
    pageShell?: PageShellNavigationState
  }
}

/** Ausência, string vazia e whitespace representam uma página sem título. */
export function normalizePageTitle(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null
}

/**
 * A célula sintética é a projeção de `pages.title` já disponível na parent.
 * Ela pode, portanto, viajar com a navegação sem antecipar outra request.
 */
export function readRowPageTitle(row: RowData): string | null {
  return normalizePageTitle(row.cells[TITLE_COLUMN_ID]?.value)
}

export function createPageNavigationState(pageId: string, title: unknown): HistoryState {
  return {
    pageShell: {
      pageId,
      title: normalizePageTitle(title),
    },
  }
}

/** Nunca reaproveita o título transportado para outro `pageId`. */
export function readPageNavigationTitle(
  state: HistoryState,
  pageId: string,
): string | null | undefined {
  return state.pageShell?.pageId === pageId ? state.pageShell.title : undefined
}
