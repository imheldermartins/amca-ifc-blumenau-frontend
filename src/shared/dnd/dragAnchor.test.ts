import { describe, expect, it } from 'vitest'
import { cardTopCollisions, handleCollisions } from './dragAnchor'
const args = (height: number) => ({
  active: { id: 'active' }, pointerCoordinates: { x: 20, y: 220 }, collisionRect: new DOMRect(0, 200, 320, height),
  droppableContainers: [{ id: 'first' }, { id: 'second' }],
  droppableRects: new Map([['first', new DOMRect(0, 100, 320, 80)], ['second', new DOMRect(0, 210, 320, 400)]]),
})
describe('drag handle anchor', () => {
  it('chooses the same top target regardless of overlay height', () => {
    for (const height of [40, 500, 2000]) expect(cardTopCollisions(args(height) as never)[0]?.id).toBe('second')
  })
  it('activates the zone under the handle even when the overlay center is in another zone', () => {
    for (const height of [40, 500, 2000]) expect(handleCollisions(args(height) as never)[0]?.id).toBe('second')
  })
})
