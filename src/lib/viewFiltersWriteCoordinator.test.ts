import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ViewFiltersV2 } from 'cubs-database'

import { ViewFiltersWriteCoordinator } from './viewFiltersWriteCoordinator'

function filters(groupBy: string[]): ViewFiltersV2 {
  return { version: 2, updatedAt: null, clauses: [], groupBy, passthrough: [] }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((onResolve, onReject) => {
    resolve = onResolve
    reject = onReject
  })
  return { promise, resolve, reject }
}

afterEach(() => {
  vi.useRealTimers()
})

describe('ViewFiltersWriteCoordinator', () => {
  it('reduz vinte mudanças antes do debounce a uma única request final', async () => {
    vi.useFakeTimers()
    const coordinator = new ViewFiltersWriteCoordinator()
    const submit = vi.fn(async (_viewId: string, document: ViewFiltersV2) => document)

    for (let index = 0; index < 20; index += 1) {
      coordinator.schedule({
        key: 'page\0view',
        viewId: 'view',
        filters: filters([String(index)]),
        submit,
      })
    }

    await vi.advanceTimersByTimeAsync(249)
    expect(submit).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(submit).toHaveBeenCalledTimes(1)
    expect(submit.mock.calls[0]?.[1]).toEqual(filters(['19']))
  })

  it('mantém no máximo uma request ativa e um único estado final pendente', async () => {
    vi.useFakeTimers()
    const first = deferred<ViewFiltersV2>()
    const submit = vi
      .fn<(viewId: string, document: ViewFiltersV2) => Promise<ViewFiltersV2>>()
      .mockImplementationOnce(() => first.promise)
      .mockImplementation(async (_viewId, document) => document)
    const coordinator = new ViewFiltersWriteCoordinator()

    coordinator.schedule({ key: 'scope', viewId: 'view', filters: filters(['0']), submit })
    await vi.advanceTimersByTimeAsync(250)
    expect(submit).toHaveBeenCalledTimes(1)

    for (let index = 1; index <= 20; index += 1) {
      coordinator.schedule({
        key: 'scope',
        viewId: 'view',
        filters: filters([String(index)]),
        submit,
      })
    }
    await vi.advanceTimersByTimeAsync(250)
    expect(submit).toHaveBeenCalledTimes(1)

    first.resolve(filters(['0']))
    await vi.runAllTimersAsync()
    expect(submit).toHaveBeenCalledTimes(2)
    expect(submit.mock.calls[1]?.[1]).toEqual(filters(['20']))
  })

  it('marca a falha antiga como stale e não perde a versão final', async () => {
    vi.useFakeTimers()
    const first = deferred<ViewFiltersV2>()
    const errors = vi.fn()
    const successes = vi.fn()
    const submit = vi
      .fn<(viewId: string, document: ViewFiltersV2) => Promise<ViewFiltersV2>>()
      .mockImplementationOnce(() => first.promise)
      .mockImplementation(async (_viewId, document) => document)
    const coordinator = new ViewFiltersWriteCoordinator()

    coordinator.schedule({
      key: 'scope',
      viewId: 'view',
      filters: filters(['old']),
      submit,
      onError: errors,
    })
    await vi.advanceTimersByTimeAsync(250)
    coordinator.schedule({
      key: 'scope',
      viewId: 'view',
      filters: filters(['new']),
      submit,
      onSuccess: successes,
    })
    coordinator.flush('scope')

    first.reject(new Error('old failed'))
    await vi.runAllTimersAsync()

    expect(errors.mock.calls[0]?.[0]).toMatchObject({ latest: false })
    expect(submit).toHaveBeenCalledTimes(2)
    await vi.runAllTimersAsync()
    expect(successes.mock.calls[0]?.[0]).toMatchObject({ latest: true })
  })

  it('flush no destroy envia a última versão e silencia callbacks', async () => {
    vi.useFakeTimers()
    const success = vi.fn()
    const submit = vi.fn(async (_viewId: string, document: ViewFiltersV2) => document)
    const coordinator = new ViewFiltersWriteCoordinator()
    coordinator.schedule({
      key: 'scope',
      viewId: 'view',
      filters: filters(['final']),
      submit,
      onSuccess: success,
    })

    coordinator.destroy()
    await Promise.resolve()
    await Promise.resolve()

    expect(submit).toHaveBeenCalledTimes(1)
    expect(success).not.toHaveBeenCalled()
  })

  it('cancel descarta debounce e invalida callback da request em voo', async () => {
    vi.useFakeTimers()
    const active = deferred<ViewFiltersV2>()
    const success = vi.fn()
    const submit = vi.fn(() => active.promise)
    const coordinator = new ViewFiltersWriteCoordinator()

    coordinator.schedule({
      key: 'scope',
      viewId: 'view',
      filters: filters(['local']),
      submit,
      onSuccess: success,
    })
    await vi.advanceTimersByTimeAsync(250)
    coordinator.schedule({
      key: 'scope',
      viewId: 'view',
      filters: filters(['pendente']),
      submit,
      onSuccess: success,
    })

    coordinator.cancel('scope')
    active.resolve(filters(['local']))
    await vi.runAllTimersAsync()

    expect(submit).toHaveBeenCalledTimes(1)
    expect(success).not.toHaveBeenCalled()
  })
})
