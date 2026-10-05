import { describe, expect, it } from 'vitest'

import type { FlowDefinitionV1, FlowSwitchStepV2, HeaderCol } from './types'
import { createDefaultFlowDefinition, toFlowDefinitionV2 } from './flowDefinition'

describe('flowDefinition v2', () => {
  it('cria novos flows diretamente no contrato estruturado', () => {
    const flow = createDefaultFlowDefinition()
    expect(flow.version).toBe(2)
    expect(flow.nodes.map((node) => node.type)).toEqual(['start', 'callback'])
  })

  it('converte um v1 com dois caminhos e reencontro sem perder ações', () => {
    const legacy: FlowDefinitionV1 = {
      version: 1,
      trigger: { type: 'manual' },
      nodes: [
        { id: 'start', type: 'start', config: { nextNodeId: 'condition' } },
        { id: 'condition', type: 'switch', config: { left: '@columns.room', operator: 'equals', right: 'Sala A', trueTargetId: 'yes', falseTargetId: 'no' } },
        { id: 'yes', type: 'set_value', config: { columnId: 'notes', value: 'sim', nextNodeId: 'common' } },
        { id: 'no', type: 'set_value', config: { columnId: 'notes', value: 'não', nextNodeId: 'common' } },
        { id: 'common', type: 'email', config: { to: '@page.title', subject: 'Fim', body: 'Fim', nextNodeId: 'done' } },
        { id: 'done', type: 'callback', config: { message: 'Concluído' } },
      ],
    }
    const columns: HeaderCol[] = [{ id: 'room', title: 'Sala', type: 'select', options: [{ id: 'room-a', label: 'Sala A' }] }]

    const converted = toFlowDefinitionV2(legacy, columns)
    const condition = converted.nodes[1] as FlowSwitchStepV2

    expect(condition.config).toMatchObject({ columnId: 'room', value: 'room-a' })
    expect(condition.config.whenTrue.map((step) => step.id)).toEqual(['yes'])
    expect(condition.config.whenFalse.map((step) => step.id)).toEqual(['no'])
    expect(converted.nodes.map((node) => node.id)).toEqual(['start', 'condition', 'common', 'done'])
  })
})
