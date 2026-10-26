import type { CollisionDetection } from '@dnd-kit/core'
import { describe, expect, it } from 'vitest'

import { editorCollisionDetection } from './EditorDnd'

type CollisionArgs = Parameters<CollisionDetection>[0]

function collisionsAt(x: number, y: number): CollisionArgs {
  // Two columns whose block targets overlap the full-row boundary targets.
  const zones = [
    { id: 'row:before', type: 'row', rect: new DOMRect(0, 92, 640, 16) },
    { id: 'row:after', type: 'row', rect: new DOMRect(0, 292, 640, 16) },
    { id: 'item:before', type: 'item', rect: new DOMRect(0, 100, 304, 24) },
    { id: 'item:after', type: 'item', rect: new DOMRect(0, 276, 304, 24) },
    { id: 'column:left', type: 'column', rect: new DOMRect(0, 100, 73, 200) },
    { id: 'column:right', type: 'column', rect: new DOMRect(231, 100, 73, 200) },
  ]
  return {
    active: { id: 'source', data: { current: {} }, rect: { current: { initial: null, translated: null } } },
    pointerCoordinates: { x, y },
    collisionRect: new DOMRect(x, y, 300, 60),
    droppableContainers: zones.map(({ id, type, rect }) => ({
      id, key: id, disabled: false, data: { current: { type } },
      node: { current: null }, rect: { current: rect },
    })),
    droppableRects: new Map(zones.map(({ id, rect }) => [id, rect])),
  }
}

describe('editor drop targets', () => {
  it.each([20, 160, 320, 620])('allows a full row above/below all columns at x=%s', (x) => {
    expect(editorCollisionDetection(collisionsAt(x, 103))[0]?.id).toBe('row:before')
    expect(editorCollisionDetection(collisionsAt(x, 297))[0]?.id).toBe('row:after')
  })

  it('keeps stacking targets inside the block and lateral targets inside the column', () => {
    expect(editorCollisionDetection(collisionsAt(160, 120))[0]?.id).toBe('item:before')
    expect(editorCollisionDetection(collisionsAt(160, 280))[0]?.id).toBe('item:after')
    expect(editorCollisionDetection(collisionsAt(20, 200))[0]?.id).toBe('column:left')
    expect(editorCollisionDetection(collisionsAt(280, 200))[0]?.id).toBe('column:right')
  })

  it('does not activate a distant target outside the editor', () => {
    expect(editorCollisionDetection(collisionsAt(900, 500))).toEqual([])
  })
})
