export function formulaText(value: unknown): string {
  if (value === null || value === undefined) return '—'
  if (Array.isArray(value)) return value.map(formulaText).join(', ')
  if (typeof value === 'object') {
    const item = value as Record<string, unknown>
    if (item.kind === 'markup') return formulaText(item.value)
    if (item.kind === 'formula-error') return typeof item.message === 'string' ? item.message : 'Fórmula indisponível'
    return '—'
  }
  return typeof value === 'boolean' ? (value ? 'Sim' : 'Não') : String(value)
}

