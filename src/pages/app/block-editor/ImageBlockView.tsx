import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react'
import { useRef, type KeyboardEvent, type PointerEvent } from 'react'

import { i18n } from '@/lib/i18n'

import { projectImageWidth } from './imageResize'

const MIN_IMAGE_WIDTH = 120

interface ImageResizeSession {
  initialHeight: number
  initialWidth: number
  lastWidth: number
  maxWidth: number
  startX: number
  startY: number
}

function imageWidth(value: unknown): number | null {
  const width = Number(value)
  return Number.isFinite(width) && width > 0 ? Math.round(width) : null
}

export function ImageBlockView({ node, updateAttributes }: NodeViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const resizeSession = useRef<ImageResizeSession | null>(null)
  const width = imageWidth(node.attrs.width)
  const src = typeof node.attrs.src === 'string' ? node.attrs.src : ''
  const alt = typeof node.attrs.alt === 'string' ? node.attrs.alt : ''

  const handlePointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    const container = containerRef.current
    if (!container) return

    event.preventDefault()
    event.stopPropagation()
    const bounds = container.getBoundingClientRect()
    const parentWidth = container.parentElement?.getBoundingClientRect().width ?? bounds.width
    container.style.willChange = 'width'
    event.currentTarget.setPointerCapture(event.pointerId)
    resizeSession.current = {
      initialHeight: bounds.height,
      initialWidth: bounds.width,
      lastWidth: bounds.width,
      maxWidth: Math.max(MIN_IMAGE_WIDTH, parentWidth),
      startX: event.clientX,
      startY: event.clientY,
    }
  }

  const handlePointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    const session = resizeSession.current
    const container = containerRef.current
    if (!session || !container) return

    const deltaX = event.clientX - session.startX
    const deltaY = event.clientY - session.startY
    const nextWidth = projectImageWidth(
      session.initialWidth,
      session.initialHeight,
      deltaX,
      deltaY,
      session.maxWidth,
    )
    if (nextWidth === session.lastWidth) return

    session.lastWidth = nextWidth
    container.style.width = `${nextWidth}px`
  }

  const handlePointerUp = (event: PointerEvent<HTMLButtonElement>) => {
    const session = resizeSession.current
    if (!session) return

    resizeSession.current = null
    const container = containerRef.current
    if (container) container.style.willChange = ''
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    updateAttributes({ width: Math.round(session.lastWidth) })
  }

  const handlePointerCancel = (event: PointerEvent<HTMLButtonElement>) => {
    const session = resizeSession.current
    const container = containerRef.current
    if (!session || !container) return

    resizeSession.current = null
    container.style.willChange = ''
    container.style.width = width ? `${width}px` : ''
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return

    const container = containerRef.current
    if (!container) return
    event.preventDefault()
    const currentWidth = width ?? container.getBoundingClientRect().width
    const maxWidth =
      container.parentElement?.getBoundingClientRect().width ?? currentWidth
    updateAttributes({
      width: Math.round(
        Math.min(
          maxWidth,
          Math.max(MIN_IMAGE_WIDTH, currentWidth + (event.key === 'ArrowRight' ? 16 : -16)),
        ),
      ),
    })
  }

  return (
    <NodeViewWrapper
      as="figure"
      contentEditable={false}
      className="cubs-editor-image-block"
      data-type="image-block"
    >
      <div
        ref={containerRef}
        className="cubs-editor-image-container"
        style={width ? { width: `${width}px` } : undefined}
      >
        <img src={src} alt={alt} draggable={false} />
        <button
          type="button"
          role="separator"
          aria-orientation="vertical"
          aria-label={i18n('pages.block-editor.editor.resize-image')}
          aria-valuemin={MIN_IMAGE_WIDTH}
          aria-valuenow={width ?? undefined}
          className="cubs-editor-image-resizer"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerCancel}
          onKeyDown={handleKeyDown}
        />
      </div>
    </NodeViewWrapper>
  )
}
