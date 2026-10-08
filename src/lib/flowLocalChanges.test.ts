import { describe, expect, it } from 'vitest'
import type { FlowDefinitionV2, HeaderCol, RowData } from 'cubs-database'
import { flowLocalChanges } from './flowLocalChanges'

const columns: HeaderCol[] = [{ id: 'count', title: 'Count', type: 'numeric' }, { id: 'status', title: 'Status', type: 'select', options: [{ id: 'done', label: 'Feito' }] }]
const row: RowData = { id: 'row', cells: { count: { value: 1 } } }
const flow = (steps: FlowDefinitionV2['nodes']): FlowDefinitionV2 => ({ version: 2, trigger: { type: 'manual' }, nodes: [{ id: 'start', type: 'start', config: {} }, ...steps, { id: 'end', type: 'callback', config: {} }] })
describe('local Flow preview', () => {
  it('uses typed values and the values written by preceding steps when choosing branches', () => {
    const definition = flow([
      { id: 'count', type: 'set_value', config: { columnId: 'count', value: '3' } },
      { id: 'switch', type: 'switch', config: { columnId: 'count', operator: 'greater_than', value: 2,
        whenTrue: [{ id: 'done', type: 'set_value', config: { columnId: 'status', value: 'done' } }], whenFalse: [] } },
    ])
    expect(flowLocalChanges(definition, row, columns)).toEqual([
      { rowId: 'row', columnId: 'count', value: 3, previousValue: 1 },
      { rowId: 'row', columnId: 'status', value: 'done', previousValue: undefined },
    ])
  })
  it('waits for the API when a macro requires server context, without guessing a branch', () => {
    const definition = flow([{ id: 'switch', type: 'switch', config: { columnId: 'count', operator: 'equals', value: '@workspace.id',
      whenTrue: [{ id: 'done', type: 'set_value', config: { columnId: 'status', value: 'done' } }], whenFalse: [] } }])
    expect(flowLocalChanges(definition, row, columns)).toEqual([])
  })
  it('does not preview an invalid option or enqueue the email action', () => {
    expect(flowLocalChanges(flow([{ id: 'set', type: 'set_value', config: { columnId: 'status', value: 'missing' } }]), row, columns)).toEqual([])
    expect(flowLocalChanges(flow([{ id: 'mail', type: 'email', config: { to: '@page.title', subject: 'Hello', body: 'Body' } }]), row, columns)).toEqual([])
  })
})
