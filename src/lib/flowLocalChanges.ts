import type { CellChange, FlowConditionOperator, FlowDefinition, FlowStepV2, HeaderCol, RowData } from 'cubs-database'
import { toFlowDefinitionV2 } from '@/shared/cubs-database/flowDefinition'

function compare(operator: FlowConditionOperator, left: unknown, right: unknown): boolean {
  const empty = left == null || left === '' || (Array.isArray(left) && !left.length)
  if (operator === 'is_empty') return empty
  if (operator === 'is_not_empty') return !empty
  if (operator === 'contains') return String(left ?? '').includes(String(right ?? ''))
  if (operator === 'greater_than' || operator === 'less_than') {
    const one = Number(left), two = Number(right)
    return Number.isFinite(one) && Number.isFinite(two) && (operator === 'greater_than' ? one > two : one < two)
  }
  const equal = Object.is(left, right) || String(left ?? '') === String(right ?? '')
  return operator === 'equals' ? equal : !equal
}

/** Preview only values available locally. Macros requiring API context wait for its ACK. */
export function flowLocalChanges(flow: FlowDefinition | undefined, row: RowData, columns: readonly HeaderCol[]): CellChange[] {
  if (!flow) return []
  const values = new Map(Object.entries(row.cells).map(([id, cell]) => [id, cell?.value]))
  const changes = new Map<string, CellChange>()
  const unresolved = Symbol('unresolved')
  const literal = (value: unknown) => {
    if (typeof value === 'string' && /@[a-zA-Z]/.test(value)) throw unresolved
    return value
  }
  const run = (steps: readonly FlowStepV2[]) => {
    for (const step of steps) {
      if (step.type === 'email') continue
      if (step.type === 'switch') {
        run(compare(step.config.operator, values.get(step.config.columnId), literal(step.config.value)) ? step.config.whenTrue : step.config.whenFalse)
        continue
      }
      const column = columns.find((entry) => entry.id === step.config.columnId)
      if (!column || column.type === 'flow' || column.key === 'title') throw unresolved
      let value = literal(step.config.value)
      if (column.type === 'numeric' && typeof value === 'string' && value.trim()) value = Number(value)
      if (column.type === 'checkbox' && (value === 'true' || value === 'false')) value = value === 'true'
      if (column.type === 'text' && typeof value !== 'string') value = String(value ?? '')
      if ((column.type === 'numeric' && (typeof value !== 'number' || !Number.isFinite(value)))
        || (column.type === 'checkbox' && typeof value !== 'boolean')
        || (column.type === 'select' && value !== null && !column.options?.some((option) => option.id === value))) throw unresolved
      values.set(column.id, value)
      changes.set(column.id, { rowId: row.id, columnId: column.id, value, previousValue: row.cells[column.id]?.value })
    }
  }
  try {
    run(toFlowDefinitionV2(flow, columns).nodes.filter((node): node is FlowStepV2 => node.type !== 'start' && node.type !== 'callback'))
    return [...changes.values()]
  } catch (error) {
    if (error === unresolved) return []
    throw error
  }
}
