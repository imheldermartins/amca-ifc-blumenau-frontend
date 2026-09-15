import { describe, expect, it } from 'vitest'

import { stepGraphPhysics, type ForceGraphNode } from './graphPhysics'

function node(overrides: Partial<ForceGraphNode> & Pick<ForceGraphNode, 'id'>): ForceGraphNode {
  return {
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    radius: 30,
    ...overrides,
  }
}

describe('stepGraphPhysics', () => {
  it('mantém o nó arrastado fixo durante a simulação', () => {
    const held = node({ id: 'held', x: 250, y: -40, vx: 5, vy: -3 })
    const neighbor = node({ id: 'neighbor', x: 500, parentId: held.id })

    const [nextHeld] = stepGraphPhysics([held, neighbor], held.id)

    expect(nextHeld).toMatchObject({ x: 250, y: -40, vx: 0, vy: 0 })
  })

  it('move o nó ligado quando o nó segurado desloca a órbita', () => {
    const held = node({ id: 'held' })
    const linked = node({ id: 'linked', x: 400, parentId: held.id })

    const [, nextLinked] = stepGraphPhysics([held, linked], held.id)

    expect(nextLinked.x).toBeLessThan(linked.x)
    expect(nextLinked.vx).toBeLessThan(0)
  })

  it('afasta outro nó quando os dois colidem', () => {
    const held = node({ id: 'held', radius: 40 })
    const colliding = node({ id: 'colliding', x: 20, radius: 40 })

    const [, nextColliding] = stepGraphPhysics([held, colliding], held.id)

    expect(nextColliding.x).toBeGreaterThan(colliding.x)
    expect(nextColliding.vx).toBeGreaterThan(0)
  })
})
