import type {
  FlowDefinition,
  FlowDefinitionV1,
  FlowDefinitionV2,
  FlowNode,
  FlowStepV2,
  HeaderCol,
} from './types'

function nodeId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `flow-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export function createDefaultFlowDefinition(): FlowDefinitionV2 {
  return {
    version: 2,
    trigger: { type: 'manual' },
    nodes: [
      { id: nodeId(), type: 'start', config: {} },
      { id: nodeId(), type: 'callback', config: { message: 'Flow concluído' } },
    ],
  }
}

function nextOf(node: FlowNode): string | null {
  if (node.type === 'callback' || node.type === 'switch') return null
  return node.config.nextNodeId
}

function linearPath(nodes: Map<string, FlowNode>, from: string): string[] {
  const path: string[] = []
  const seen = new Set<string>()
  let current: string | null = from
  while (current && !seen.has(current)) {
    seen.add(current)
    path.push(current)
    const node = nodes.get(current)
    if (!node || node.type === 'callback') break
    current = node.type === 'switch' ? node.config.trueTargetId : nextOf(node)
  }
  return path
}

function conditionColumnId(token: string): string {
  if (token === '@page.title') return 'page_title'
  const match = /^@columns\.([0-9A-Za-z_-]+)$/.exec(token)
  return match?.[1] ?? token
}

function typedLiteral(value: unknown, columnId: string, columns: readonly HeaderCol[]): unknown {
  const column = columnId === 'page_title'
    ? columns.find((candidate) => candidate.key === 'title' || candidate.id === 'page_title')
    : columns.find((candidate) => candidate.id === columnId)
  if (!column) return value
  if (column.type === 'numeric') {
    const parsed = typeof value === 'number' ? value : Number(value)
    return Number.isFinite(parsed) ? parsed : value
  }
  if (column.type === 'checkbox') {
    if (value === true || value === 'true') return true
    if (value === false || value === 'false') return false
  }
  if (column.type === 'select' && typeof value === 'string') {
    return column.options?.find((option) => option.id === value || option.label === value)?.id ?? value
  }
  return value
}

/** Converte o grafo v1 em árvore somente em memória; persiste no primeiro save. */
export function toFlowDefinitionV2(
  definition: FlowDefinition | null | undefined,
  columns: readonly HeaderCol[] = [],
): FlowDefinitionV2 {
  if (!definition) return createDefaultFlowDefinition()
  if (definition.version === 2) return definition

  const legacy = definition as FlowDefinitionV1
  const byId = new Map(legacy.nodes.map((node) => [node.id, node]))
  const start = legacy.nodes.find((node) => node.type === 'start')
  const callback = legacy.nodes.find((node) => node.type === 'callback')
  if (!start || !callback) return createDefaultFlowDefinition()

  const convertSequence = (from: string, stop?: string): FlowStepV2[] => {
    const result: FlowStepV2[] = []
    const seen = new Set<string>()
    let current: string | null = from
    while (current && current !== stop && current !== callback.id && !seen.has(current)) {
      seen.add(current)
      const node = byId.get(current)
      if (!node) break
      if (node.type === 'email') {
        result.push({ id: node.id, type: 'email', config: { to: node.config.to, subject: node.config.subject, body: node.config.body } })
        current = node.config.nextNodeId
        continue
      }
      if (node.type === 'set_value') {
        result.push({ id: node.id, type: 'set_value', config: { columnId: node.config.columnId, value: node.config.value } })
        current = node.config.nextNodeId
        continue
      }
      if (node.type === 'switch') {
        const truePath = linearPath(byId, node.config.trueTargetId)
        const falseIds = new Set(linearPath(byId, node.config.falseTargetId))
        const convergence: string = truePath.find((id) => falseIds.has(id)) ?? callback.id
        const columnId = conditionColumnId(node.config.left)
        result.push({
          id: node.id,
          type: 'switch',
          config: {
            columnId,
            operator: node.config.operator,
            ...(!['is_empty', 'is_not_empty'].includes(node.config.operator) && { value: typedLiteral(node.config.right, columnId, columns) }),
            whenTrue: convertSequence(node.config.trueTargetId, convergence),
            whenFalse: convertSequence(node.config.falseTargetId, convergence),
          },
        })
        current = convergence
        continue
      }
      break
    }
    return result
  }

  return {
    version: 2,
    trigger: { type: 'manual' },
    nodes: [
      { id: start.id, type: 'start', config: {} },
      ...convertSequence(start.config.nextNodeId),
      { id: callback.id, type: 'callback', config: { message: callback.config.message } },
    ],
  }
}
