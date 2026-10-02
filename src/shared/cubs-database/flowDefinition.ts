import type { FlowDefinition } from './types'

function nodeId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `flow-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export function createDefaultFlowDefinition(): FlowDefinition {
  const startId = nodeId()
  const callbackId = nodeId()
  return {
    version: 1,
    trigger: { type: 'manual' },
    nodes: [
      { id: startId, type: 'start', config: { nextNodeId: callbackId } },
      { id: callbackId, type: 'callback', config: { message: 'Flow concluído' } },
    ],
  }
}
