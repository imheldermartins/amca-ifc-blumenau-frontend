import { arrayMove } from '@dnd-kit/sortable'

export function reorderViewIds(viewIds: string[], activeId: string, overId: string) {
  const from = viewIds.indexOf(activeId)
  const to = viewIds.indexOf(overId)
  return from < 0 || to < 0 || from === to ? viewIds : arrayMove(viewIds, from, to)
}
