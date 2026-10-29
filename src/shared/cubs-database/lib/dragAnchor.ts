import type { CollisionDetection } from '@dnd-kit/core'

export const cardTopCollisions: CollisionDetection = (args) => {
  const point = args.pointerCoordinates ?? { x: args.collisionRect.left + 12, y: args.collisionRect.top + 24 }
  return args.droppableContainers.flatMap((container) => {
    const rect = args.droppableRects.get(container.id)
    if (!rect) return []
    const dx = Math.max(rect.left - point.x, 0, point.x - rect.right)
    return [{ id: container.id, data: { droppableContainer: container, value: Math.hypot(dx, point.y - (rect.top + 24)) } }]
  }).sort((a, b) => a.data.value - b.data.value)
}
