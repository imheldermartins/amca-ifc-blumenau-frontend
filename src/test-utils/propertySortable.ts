import {act, fireEvent, screen, waitFor} from '@testing-library/react'
import {expect, vi} from 'vitest'

/** Real sortable/keyboard sensor; only the browser layout missing in jsdom is supplied. */
export function mockPropertyRects() {
  return vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    const property = this.closest<HTMLElement>('[data-page-property-id]')
    if (property) {
      const rows = [...property.parentElement!.querySelectorAll('[data-page-property-id]')]
      const top = rows.indexOf(property) * 60
      return new DOMRect(0, top, 600, 52)
    }
    return new DOMRect(0, 0, 600, 500)
  })
}

export async function dragProperty(name: string, direction: 'ArrowUp' | 'ArrowDown', steps = 1) {
  const handle = screen.getByRole('button', {name: `Arrastar propriedade ${name}`})
  fireEvent.keyDown(handle, {key: ' ', code: 'Space'})
  await waitFor(() => expect(document.querySelector('[data-page-property-id][data-dragging=true]')).toBeTruthy())
  await act(async () => {await new Promise(resolve => setTimeout(resolve, 0))})
  for (let step = 0; step < steps; step++) {
    fireEvent.keyDown(document, {key: direction, code: direction})
    await act(async () => {await new Promise(resolve => setTimeout(resolve, 0))})
  }
  fireEvent.keyDown(document, {key: ' ', code: 'Space'})
  await waitFor(() => expect(document.querySelector('[data-page-property-id][data-dragging=true]')).toBeNull())
}
