import type { CollisionDetection } from '@dnd-kit/core'

/** Pointer coordinates are the drag handle. Keyboard fallback uses the card's top edge. */
export const handleCollisions: CollisionDetection = (args) => {
  const point = args.pointerCoordinates ?? { x: args.collisionRect.left + 12, y: args.collisionRect.top + 12 }
  return args.droppableContainers.flatMap((container) => {
    const rect = args.droppableRects.get(container.id)
    if (!rect) return []
    const dx = Math.max(rect.left - point.x, 0, point.x - rect.right)
    const dy = Math.max(rect.top - point.y, 0, point.y - rect.bottom)
    return [{ id: container.id, data: { droppableContainer: container, value: Math.hypot(dx, dy), area: rect.width * rect.height } }]
  }).sort((a, b) => a.data.value - b.data.value || a.data.area - b.data.area)
}

export const cardTopCollisions: CollisionDetection = (args) => {
  const point = args.pointerCoordinates ?? { x: args.collisionRect.left + 12, y: args.collisionRect.top + 24 }
  return args.droppableContainers.flatMap((container) => {
    const rect = args.droppableRects.get(container.id)
    if (!rect) return []
    const dx = Math.max(rect.left - point.x, 0, point.x - rect.right)
    return [{ id: container.id, data: { droppableContainer: container, value: Math.hypot(dx, point.y - (rect.top + 24)) } }]
  }).sort((a, b) => a.data.value - b.data.value)
}
