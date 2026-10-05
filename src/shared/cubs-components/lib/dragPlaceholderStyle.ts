import type { CSSProperties } from 'react'

/** Mantém a geometria medida pelo dnd-kit ao iniciar o arraste. */
export function dragPlaceholderStyle(rect: { width: number; height: number } | null | undefined): CSSProperties | undefined {
  if (!rect) return undefined
  return {
    width: rect.width,
    minWidth: rect.width,
    maxWidth: rect.width,
    height: rect.height,
    minHeight: rect.height,
    maxHeight: rect.height,
    boxSizing: 'border-box',
    flexShrink: 0,
  }
}
