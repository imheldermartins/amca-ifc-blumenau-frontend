/** Resultado puro do drop: ambos os IDs precisam pertencer à seleção atual. */
export function reorderPriorityValues(
  values: string[],
  activeId: string,
  overId: string,
): string[] {
  const from = values.indexOf(activeId)
  const to = values.indexOf(overId)
  if (from < 0 || to < 0 || from === to) return values
  const next = values.slice()
  const [moved] = next.splice(from, 1)
  if (moved === undefined) return values
  next.splice(to, 0, moved)
  return next
}
