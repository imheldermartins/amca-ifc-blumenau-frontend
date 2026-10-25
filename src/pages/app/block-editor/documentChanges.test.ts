import { afterEach, describe, expect, it, vi } from 'vitest'
import { createDocumentChangeDebouncer, EDITOR_IDLE_MS } from './documentChanges'

afterEach(() => vi.useRealTimers())
describe('idle document changes', () => {
  it('does not serialize or publish while typing and reads only the latest snapshot after a pause', () => {
    vi.useFakeTimers()
    const emit = vi.fn(), first = vi.fn(() => ({ type: 'doc', content: [] })), latest = vi.fn(() => ({ type: 'doc' }))
    const changes = createDocumentChangeDebouncer(emit)
    changes.schedule(first); vi.advanceTimersByTime(400)
    changes.schedule(latest); vi.advanceTimersByTime(EDITOR_IDLE_MS - 1)
    expect(first).not.toHaveBeenCalled(); expect(latest).not.toHaveBeenCalled(); expect(emit).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(first).not.toHaveBeenCalled(); expect(latest).toHaveBeenCalledOnce(); expect(emit).toHaveBeenCalledWith({ type: 'doc' })
  })
  it('flushes the pending snapshot once on exit and cancels the delayed callback', () => {
    vi.useFakeTimers()
    const emit = vi.fn(), read = vi.fn(() => ({ type: 'doc' })), changes = createDocumentChangeDebouncer(emit)
    changes.schedule(read); changes.flush(); changes.flush(); vi.advanceTimersByTime(EDITOR_IDLE_MS)
    expect(read).toHaveBeenCalledOnce(); expect(emit).toHaveBeenCalledOnce()
  })
})
