import type { FlowStepV2 } from './types'

function findSequence(steps: readonly FlowStepV2[], id: string, path = 'root'): string | null {
  if (steps.some((step) => step.id === id)) return path
  for (const step of steps) {
    if (step.type !== 'switch') continue
    const yes = findSequence(step.config.whenTrue, id, `${step.id}:true`)
    if (yes) return yes
    const no = findSequence(step.config.whenFalse, id, `${step.id}:false`)
    if (no) return no
  }
  return null
}

function mapStep(steps: FlowStepV2[], id: string, update: (step: FlowStepV2) => FlowStepV2): FlowStepV2[] {
  return steps.map((step) => step.id === id
    ? update(step)
    : step.type === 'switch'
      ? { ...step, config: { ...step.config, whenTrue: mapStep(step.config.whenTrue, id, update), whenFalse: mapStep(step.config.whenFalse, id, update) } }
      : step)
}

function removeStep(steps: FlowStepV2[], id: string): { steps: FlowStepV2[]; removed?: FlowStepV2 } {
  const direct = steps.find((step) => step.id === id)
  if (direct) return { steps: steps.filter((step) => step.id !== id), removed: direct }
  for (const step of steps) {
    if (step.type !== 'switch') continue
    const fromTrue = removeStep(step.config.whenTrue, id)
    if (fromTrue.removed) return { steps: mapStep(steps, step.id, () => ({ ...step, config: { ...step.config, whenTrue: fromTrue.steps } })), removed: fromTrue.removed }
    const fromFalse = removeStep(step.config.whenFalse, id)
    if (fromFalse.removed) return { steps: mapStep(steps, step.id, () => ({ ...step, config: { ...step.config, whenFalse: fromFalse.steps } })), removed: fromFalse.removed }
  }
  return { steps }
}

function readSequence(steps: readonly FlowStepV2[], path: string): FlowStepV2[] {
  if (path === 'root') return [...steps]
  const separator = path.lastIndexOf(':')
  const switchId = path.slice(0, separator)
  const branch = path.slice(separator + 1)
  let found: FlowStepV2[] = []
  const visit = (items: readonly FlowStepV2[]): boolean => items.some((item) => {
    if (item.type !== 'switch') return false
    if (item.id === switchId) {
      found = branch === 'true' ? item.config.whenTrue : item.config.whenFalse
      return true
    }
    return visit(item.config.whenTrue) || visit(item.config.whenFalse)
  })
  visit(steps)
  return [...found]
}

function replaceSequence(steps: FlowStepV2[], path: string, replacement: FlowStepV2[]): FlowStepV2[] {
  if (path === 'root') return replacement
  const separator = path.lastIndexOf(':')
  const switchId = path.slice(0, separator)
  const branch = path.slice(separator + 1)
  return mapStep(steps, switchId, (candidate) => candidate.type === 'switch'
    ? { ...candidate, config: { ...candidate.config, ...(branch === 'true' ? { whenTrue: replacement } : { whenFalse: replacement }) } }
    : candidate)
}

/** Move a ação junto com toda a sua subárvore entre raiz e ramos. */
export function moveFlowStep(steps: FlowStepV2[], activeId: string, overId: string): FlowStepV2[] {
  const fromPath = findSequence(steps, activeId)
  const toPath = overId.startsWith('drop:') ? overId.slice(5) : findSequence(steps, overId)
  if (!fromPath || !toPath || toPath.startsWith(`${activeId}:`)) return steps
  const sameSequenceTargetIndex = fromPath === toPath && !overId.startsWith('drop:')
    ? readSequence(steps, toPath).findIndex((step) => step.id === overId)
    : -1
  const removed = removeStep(steps, activeId)
  if (!removed.removed) return steps
  const target = readSequence(removed.steps, toPath)
  const targetIndex = overId.startsWith('drop:')
    ? target.length
    : sameSequenceTargetIndex >= 0
      ? sameSequenceTargetIndex
      : target.findIndex((step) => step.id === overId)
  target.splice(targetIndex < 0 ? target.length : targetIndex, 0, removed.removed)
  return replaceSequence(removed.steps, toPath, target)
}
