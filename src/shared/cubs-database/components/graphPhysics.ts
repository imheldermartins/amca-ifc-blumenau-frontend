export interface ForceGraphNode {
  id: string
  x: number
  y: number
  vx: number
  vy: number
  radius: number
  parentId?: string
}

const LINK_DISTANCE = 185
const LINK_STRENGTH = 0.004
const CHARGE_STRENGTH = 1_100
const COLLISION_STRENGTH = 0.055
const CENTER_STRENGTH = 0.0007
const DAMPING = 0.86
const MAX_SPEED = 8

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

/** Um passo pequeno e determinístico do force layout local do Graph. */
export function stepGraphPhysics<T extends ForceGraphNode>(
  nodes: readonly T[],
  heldId?: string,
): T[] {
  if (nodes.length < 2) return nodes.map((node) => ({ ...node }))

  const forces = nodes.map(() => ({ x: 0, y: 0 }))
  const indexById = new Map(nodes.map((node, index) => [node.id, index]))

  nodes.forEach((node, childIndex) => {
    if (!node.parentId) return
    const parentIndex = indexById.get(node.parentId)
    if (parentIndex === undefined) return
    const parent = nodes[parentIndex]
    const dx = node.x - parent.x
    const dy = node.y - parent.y
    const distance = Math.max(1, Math.hypot(dx, dy))
    const pull = (distance - LINK_DISTANCE) * LINK_STRENGTH
    const fx = (dx / distance) * pull
    const fy = (dy / distance) * pull
    forces[parentIndex].x += fx
    forces[parentIndex].y += fy
    forces[childIndex].x -= fx
    forces[childIndex].y -= fy
  })

  for (let left = 0; left < nodes.length; left += 1) {
    for (let right = left + 1; right < nodes.length; right += 1) {
      const a = nodes[left]
      const b = nodes[right]
      let dx = b.x - a.x
      let dy = b.y - a.y
      if (dx === 0 && dy === 0) {
        // Evita que dois nós idênticos permaneçam colados sem introduzir acaso.
        dx = left % 2 === 0 ? 0.1 : -0.1
        dy = 0.1
      }
      const distance = Math.max(1, Math.hypot(dx, dy))
      const minimum = a.radius + b.radius + 18
      const collision = Math.max(0, minimum - distance) * COLLISION_STRENGTH
      const charge = CHARGE_STRENGTH / (distance * distance + 80)
      const push = collision + charge
      const fx = (dx / distance) * push
      const fy = (dy / distance) * push
      forces[left].x -= fx
      forces[left].y -= fy
      forces[right].x += fx
      forces[right].y += fy
    }
  }

  return nodes.map((node, index) => {
    if (node.id === heldId) return { ...node, vx: 0, vy: 0 }
    const centerScale = node.parentId ? CENTER_STRENGTH : CENTER_STRENGTH * 3
    const vx = clamp((node.vx + forces[index].x - node.x * centerScale) * DAMPING, -MAX_SPEED, MAX_SPEED)
    const vy = clamp((node.vy + forces[index].y - node.y * centerScale) * DAMPING, -MAX_SPEED, MAX_SPEED)
    return { ...node, x: node.x + vx, y: node.y + vy, vx, vy }
  })
}
