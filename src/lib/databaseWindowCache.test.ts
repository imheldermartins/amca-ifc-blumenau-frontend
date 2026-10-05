import { describe, expect, it } from 'vitest'
import { mergeDatabaseGroups, refreshDatabaseGroups, mergeDatabaseWindow, shareDatabaseRows, trimDatabaseWindows, type CachedDatabaseWindow } from './databaseWindowCache'
const batch = (id: number, key = 'root'): CachedDatabaseWindow => ({ id, key, scope: { type: 'root' }, rows: Array.from({ length: 50 }, (_, index) => ({ id: `${id}-${index}`, cells: { page_title: { value: `${id}-${index}` } } })), total: 10000, nextCursor: `next-${id}`, previousCursor: `prev-${id}` })
describe('bounded database windows', () => {
  it('keeps 250 hydrated rows with a 10k-row dataset and protects the viewport', () => {
    const windows = Array.from({ length: 200 }, (_, index) => batch(index))
    const result = trimDatabaseWindows(windows, new Map([['root', { firstId: '198-0', lastId: '199-49' }]]), new Set())
    expect(result.windows.flatMap((window) => window.rows)).toHaveLength(250)
    expect(result.windows.at(-1)?.id).toBe(199)
    expect(result.windows.some((window) => window.id === 198)).toBe(true)
  })
  it('does not evict an active editor or drag and avoids holes', () => {
    const windows = Array.from({ length: 7 }, (_, index) => batch(index))
    const result = trimDatabaseWindows(windows, new Map(), new Set(['0-1']))
    expect(result.windows.some((window) => window.id === 0)).toBe(true)
    expect(result.windows.flatMap((window) => window.rows)).toHaveLength(250)
    expect(result.windows.map((window) => window.id)).toEqual([0, 1, 2, 3, 4])
  })
  it('shares unchanged card references and deduplicates adjacent pages', () => {
    const old = batch(0)
    const rows = shareDatabaseRows(JSON.parse(JSON.stringify(old.rows)), new Map(old.rows.map((row) => [row.id, row])))
    expect(rows[0]).toBe(old.rows[0])
    const overlap = { ...batch(1), rows: [old.rows[49], ...batch(1).rows] }
    const merged = mergeDatabaseWindow([old], overlap, 'next')
    expect(merged[0].rows).toHaveLength(49)
    expect(new Set(merged.flatMap((window) => window.rows.map((row) => row.id))).size).toBe(100)
  })
  it('reconciles a retained slice instead of appending it', () => {
    const one = batch(1)
    const replacement = { ...one, rows: one.rows.slice(1) }
    const windows = mergeDatabaseWindow([batch(0), one, batch(2)], replacement, 'next', 1)
    expect(windows).toHaveLength(3)
    expect(windows[1]).toBe(replacement)
  })
  it('merges shared group ancestors and preserves unaffected header references', () => {
    const child = (key: string) => ({ key, label: key, path: [], total: 1 })
    const untouched = child('other')
    const first = [{ key: 'parent', label: 'Parent', total: 120, path: [], children: [child('one')] }, untouched]
    const second = [{ key: 'parent', label: 'Parent', total: 120, path: [], children: [child('two')] }]
    const merged = mergeDatabaseGroups(first, second, true)
    expect(merged).toHaveLength(2)
    expect(merged[0].children?.map((group) => group.key)).toEqual(['one', 'two'])
    expect(merged[1]).toBe(untouched)
  })
  it('evicts horizontally hidden columns even when they still have mounted lists', () => {
    const windows = Array.from({ length: 6 }, (_, index) => batch(index, `board:${index}`))
    const viewports = new Map(windows.map((window, index) => [window.key, { firstId: `${index}-0`, lastId: `${index}-49`, visible: index > 0 }]))
    expect(trimDatabaseWindows(windows, viewports, new Set()).evicted.map((window) => window.id)).toEqual([0])
  })
  it('refreshes authoritative counts and prefix order while retaining later header pages', () => {
    const group = (key: string, total = 3) => ({ key, label: key, path: [], total })
    const later = group('later')
    const result = refreshDatabaseGroups([group('one'), group('two'), later], [group('two', 4), group('one', 5)], true)
    expect(result.map((entry) => entry.key)).toEqual(['two', 'one', 'later'])
    expect(result.map((entry) => entry.total)).toEqual([4, 5, 3])
    expect(result[2]).toBe(later)
    expect(refreshDatabaseGroups(result, [group('two', 6)], false).map((entry) => entry.key)).toEqual(['two'])
  })
})
