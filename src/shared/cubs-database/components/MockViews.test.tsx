import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { CubsDatabase } from '../CubsDatabase'
import { emptyViewFilters } from '../viewFilters'
import { GraphCanvas, GraphView } from './GraphView'

vi.mock('@iconify/react', () => ({
  Icon: ({ icon }: { icon: string }) => <span data-icon={icon} />,
}))

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

const rows = [
  { id: 'child-1', cells: { page_title: { value: 'Página A' }, status: { value: 'Ativa' } } },
  { id: 'child-2', cells: { page_title: { value: 'Página B' } } },
]

describe('Grid mock', () => {
  it('mostra tiles separados no fundo do sistema e abre a página', () => {
    const onOpenRow = vi.fn()
    render(<CubsDatabase
      settings={{ grid: { view: 'grid', name: 'Grade', urlKey: { key: 'grade', aliases: [] }, filters: emptyViewFilters(), orderedHeaderCols: [] } }}
      headerCols={[{ id: 'page_title', key: 'title', title: 'Nome', type: 'text' }, { id: 'status', title: 'Status', type: 'text' }]}
      rows={rows}
      onOpenRow={onOpenRow}
    />)

    const container = document.querySelector('[data-grid-container]')
    expect(container).not.toBeNull()
    expect(container?.className).not.toContain('bg-contrast')
    expect(screen.getByText('Página A')).not.toBeNull()
    expect(screen.getByText('Ativa')).not.toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Abrir Página A' }))
    expect(onOpenRow).toHaveBeenCalledWith(rows[0])
  })

  it('monta a opção de tamanho da Grid na drawer e altera o container', async () => {
    render(<CubsDatabase
      settings={{ grid: { view: 'grid', name: 'Grade', urlKey: { key: 'grade', aliases: [] }, filters: emptyViewFilters(), orderedHeaderCols: [] } }}
      headerCols={[{ id: 'page_title', key: 'title', title: 'Nome', type: 'text' }]}
      rows={rows}
    />)
    fireEvent.click(screen.getByRole('button', { name: 'Configurações da view' }))
    const drawer = screen.getByRole('dialog', { name: 'Configurações da view' })
    fireEvent.click(within(drawer).getByRole('combobox', { name: 'Tamanho dos cards' }))
    fireEvent.click(await screen.findByRole('option', { name: 'Pequeno' }))
    expect(document.querySelector('[data-grid-container]')?.className).toContain('minmax(180px,1fr)')
  })
})

describe('Graph mock', () => {
  it('reativa e mantém o RAF ao arrastar depois de a simulação parar', () => {
    const frames = new Map<number, FrameRequestCallback>()
    let nextFrameId = 0
    let frameTime = 0
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      nextFrameId += 1
      frames.set(nextFrameId, callback)
      return nextFrameId
    })
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((frameId) => {
      frames.delete(frameId)
    })

    const runNextFrame = () => {
      const entry = frames.entries().next().value
      if (!entry) return false
      const [frameId, callback] = entry
      frames.delete(frameId)
      frameTime += 16
      act(() => callback(frameTime))
      return true
    }
    const runUntilIdle = () => {
      let frameCount = 0
      while (frames.size > 0 && frameCount < 1_000) {
        runNextFrame()
        frameCount += 1
      }
      expect(frames.size).toBe(0)
    }

    const onFocus = vi.fn()
    render(<GraphCanvas
      points={[
        { id: 'root', title: 'Raiz', x: -42.9375, y: 0, vx: 0, vy: 0, radius: 20, depth: 0 },
        { id: 'child', title: 'Filha', x: 128.8125, y: 0, vx: 0, vy: 0, radius: 20, parentId: 'root', depth: 1 },
      ]}
      focusedId="root"
      loadingIds={new Set()}
      onFocus={onFocus}
    />)
    runUntilIdle()

    const canvas = screen.getByRole('application', { name: 'Grafo de páginas' })
    const rootNode = screen.getByRole('button', { name: 'Raiz' })
    const childNode = screen.getByRole('button', { name: 'Filha' })
    const childBeforeDrag = childNode.style.left

    fireEvent(rootNode, new MouseEvent('pointerdown', { bubbles: true, clientX: 500, clientY: 400 }))
    expect(frames.size).toBe(1)
    expect(rootNode.className).toContain('cursor-grabbing')

    fireEvent(canvas, new MouseEvent('pointermove', { bubbles: true, clientX: 660, clientY: 470 }))
    for (let index = 0; index < 8; index += 1) {
      expect(frames.size).toBe(1)
      runNextFrame()
    }
    expect(childNode.style.left).not.toBe(childBeforeDrag)

    fireEvent(canvas, new MouseEvent('pointerup', { bubbles: true, clientX: 660, clientY: 470 }))
    expect(onFocus).not.toHaveBeenCalled()
    const childAtRelease = childNode.style.left
    expect(frames.size).toBe(1)
    runUntilIdle()
    expect(frames.size).toBe(0)
    expect(childNode.style.left).not.toBe(childAtRelease)
    expect(rootNode.className).toContain('cursor-grab')
  })

  it('foca um nó no pointerup sem movimento mesmo com captura no canvas', () => {
    const onFocus = vi.fn()
    render(<GraphCanvas
      points={[
        { id: 'root', title: 'Raiz', x: 0, y: 0, vx: 0, vy: 0, radius: 20, depth: 0 },
        { id: 'child', title: 'Filha', x: 180, y: 0, vx: 0, vy: 0, radius: 20, parentId: 'root', depth: 1 },
      ]}
      focusedId="root"
      loadingIds={new Set()}
      onFocus={onFocus}
    />)

    const canvas = screen.getByRole('application', { name: 'Grafo de páginas' })
    const childNode = screen.getByRole('button', { name: 'Filha' })
    fireEvent(childNode, new MouseEvent('pointerdown', { bubbles: true, clientX: 500, clientY: 400 }))
    fireEvent(canvas, new MouseEvent('pointerup', { bubbles: true, clientX: 500, clientY: 400 }))

    expect(onFocus).toHaveBeenCalledTimes(1)
    expect(onFocus).toHaveBeenCalledWith(expect.objectContaining({ id: 'child' }))
  })

  it('usa o ícone de órbita no nó principal', () => {
    render(<GraphView rootId="root" rootTitle="Raiz" rows={rows} loadSubItems={false} />)

    const rootNode = screen.getByRole('button', { name: 'Raiz' })
    expect(rootNode.querySelector('[data-icon="lucide:circle-dot-dashed"]')).not.toBeNull()
  })

  it('ativa o carregamento pela configuração da view', async () => {
    const onLoadChildren = vi.fn().mockResolvedValue([])
    render(<CubsDatabase
      pageId="root"
      settings={{ graph: { view: 'graph', name: 'Grafo', urlKey: { key: 'grafo', aliases: [] }, filters: emptyViewFilters(), orderedHeaderCols: [] } }}
      headerCols={[{ id: 'page_title', key: 'title', title: 'Nome', type: 'text' }]}
      rows={rows}
      onLoadGraphChildren={onLoadChildren}
    />)
    expect(onLoadChildren).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Configurações da view' }))
    const drawer = screen.getByRole('dialog', { name: 'Configurações da view' })
    fireEvent.click(within(drawer).getByRole('switch', { name: 'Carregar subitens' }))
    await waitFor(() => expect(onLoadChildren).toHaveBeenCalledTimes(2))
  })

  it('só busca subitens ao focar uma página', async () => {
    const onLoadChildren = vi.fn().mockResolvedValue([{ id: 'grandchild', cells: { page_title: { value: 'Neta' } } }])
    render(<GraphView rootId="root" rootTitle="Raiz" rows={rows} loadSubItems={false} onLoadChildren={onLoadChildren} />)
    expect(onLoadChildren).not.toHaveBeenCalled()
    expect(screen.queryByText('Neta')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Página A' }))
    expect(onLoadChildren).toHaveBeenCalledWith('child-1')
    await waitFor(() => expect(screen.getByText('Neta')).not.toBeNull())
    expect(screen.getByRole('button', { name: 'Página A' }).getAttribute('aria-pressed')).toBe('true')
  })

  it('busca subitens diretos ao ativar a configuração', async () => {
    const onLoadChildren = vi.fn().mockResolvedValue([])
    const { rerender } = render(<GraphView rootId="root" rootTitle="Raiz" rows={rows} loadSubItems={false} onLoadChildren={onLoadChildren} />)
    expect(onLoadChildren).not.toHaveBeenCalled()
    rerender(<GraphView rootId="root" rootTitle="Raiz" rows={rows} loadSubItems onLoadChildren={onLoadChildren} />)
    await waitFor(() => expect(onLoadChildren).toHaveBeenCalledTimes(2))
    expect(screen.getByRole('application', { name: 'Grafo de páginas' }).className).toContain('bg-background')
  })
})
