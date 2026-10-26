import { useState, type ComponentProps } from 'react'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { DragEndEvent } from '@dnd-kit/core'
import { ViewSettingsForm } from './ViewSettingsForm'
import { DEFAULT_VIEW_MOCK_SETTINGS } from '../viewSettings'

const drag = vi.hoisted(() => ({ end: undefined as ((event: DragEndEvent) => void) | undefined }))
vi.mock('@dnd-kit/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@dnd-kit/core')>()
  return { ...actual, DndContext: (props: ComponentProps<typeof actual.DndContext>) => {
    drag.end = props.onDragEnd
    return <actual.DndContext {...props} />
  } }
})

const columns = [
  { id: 'page_title', key: 'title' as const, title: 'Nome', type: 'text' as const },
  { id: 'a', title: 'Relação', type: 'relation' as const },
  { id: 'b', title: 'Valor Total', type: 'numeric' as const },
  { id: 'c', title: 'ID', type: 'formula' as const },
]
type View = 'grid' | 'calendar' | 'board'
function Harness({ type, save }: { type: View; save: (ids: string[]) => void }) {
  const [ids, setIds] = useState(['a', 'b', 'c'])
  const change = (next: string[]) => { setIds(next); save(next) }
  return <ViewSettingsForm type={type} settings={DEFAULT_VIEW_MOCK_SETTINGS} onChange={() => {}} columns={columns}
    gridPropertyIds={ids} onGridPropertyIdsChange={change} calendarPropertyIds={ids} onCalendarPropertyIdsChange={change}
    board={{ propertyIds: ids }} onBoardChange={(patch) => patch.propertyIds && change(patch.propertyIds)} />
}
afterEach(() => { cleanup(); vi.useRealTimers() })
describe('visible property edits', () => {
  it.each<View>(['grid', 'calendar', 'board'])('accumulates visibility and drag order, then persists and hides all in %s', (type) => {
    vi.useFakeTimers()
    const save = vi.fn(), view = render(<Harness type={type} save={save} />)
    const panel = screen.getByRole('region', { name: 'Propriedades visíveis' })
    expect(panel.className).not.toContain('border')
    fireEvent.click(within(panel).getByRole('checkbox', { name: 'Mostrar propriedade: Valor Total' }))
    fireEvent.click(within(panel).getByRole('checkbox', { name: 'Mostrar propriedade: Valor Total' }))
    act(() => drag.end?.({ active: { id: 'c' }, over: { id: 'a' } } as DragEndEvent))
    expect(save).not.toHaveBeenCalled()
    act(() => vi.advanceTimersByTime(450))
    expect(save).toHaveBeenCalledExactlyOnceWith(['c', 'a', 'b'])
    expect(within(panel).getAllByRole('listitem').map((item) => item.textContent)).toEqual(['ID1', 'Relação2', 'Valor Total3'])
    fireEvent.click(within(panel).getByRole('button', { name: 'Ocultar todas' }))
    view.unmount()
    expect(save).toHaveBeenLastCalledWith([])
    expect(save).toHaveBeenCalledTimes(2)
    act(() => vi.runAllTimers())
    expect(save).toHaveBeenCalledTimes(2)
  })
})
