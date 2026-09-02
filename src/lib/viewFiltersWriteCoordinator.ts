import type { ViewFiltersV2 } from 'cubs-database'

export interface ViewFiltersWriteResult {
  revision: number
  viewId: string
  submitted: ViewFiltersV2
  confirmed?: ViewFiltersV2
  /** `false` significa que uma edição mais nova já substituiu esta revisão. */
  latest: boolean
}

export interface ViewFiltersWriteFailure extends Omit<ViewFiltersWriteResult, 'confirmed'> {
  error: unknown
}

export interface ScheduleViewFiltersWrite {
  /** Inclui o scope da página para views com o mesmo id nunca compartilharem fila. */
  key: string
  viewId: string
  filters: ViewFiltersV2
  submit: (viewId: string, filters: ViewFiltersV2) => Promise<ViewFiltersV2 | void>
  onSuccess?: (result: ViewFiltersWriteResult) => void
  onError?: (failure: ViewFiltersWriteFailure) => void
}

interface WriteJob extends ScheduleViewFiltersWrite {
  revision: number
}

interface WriteState {
  latestRevision: number
  active?: WriteJob
  pending?: WriteJob
  timer?: ReturnType<typeof setTimeout>
  pendingDue: boolean
  /** Revisões invalidadas não podem mais notificar o consumidor. */
  canceledThroughRevision?: number
}

/**
 * Debounce trailing + latest-wins por view.
 *
 * Enquanto uma request está ativa existe somente um slot pendente. Uma nova
 * edição substitui esse slot; assim vinte mudanças rápidas nunca viram uma
 * fila de vinte writes. `flush` antecipa somente a versão final existente.
 */
export class ViewFiltersWriteCoordinator {
  private readonly states = new Map<string, WriteState>()
  private readonly delayMs: number
  private muted = false

  constructor(delayMs = 250) {
    this.delayMs = delayMs
  }

  schedule(input: ScheduleViewFiltersWrite): number {
    const state = this.states.get(input.key) ?? {
      latestRevision: 0,
      pendingDue: false,
    }
    state.latestRevision += 1
    const job: WriteJob = { ...input, revision: state.latestRevision }
    state.pending = job
    state.pendingDue = false

    if (state.timer) clearTimeout(state.timer)
    state.timer = setTimeout(() => {
      state.timer = undefined
      state.pendingDue = true
      this.pump(input.key, state)
    }, this.delayMs)

    this.states.set(input.key, state)
    return job.revision
  }

  /** Força o último estado pendente agora; request ativa nunca é duplicada. */
  flush(key?: string): void {
    const entries = key
      ? ([[key, this.states.get(key)]] as const)
      : [...this.states.entries()].map(([stateKey, state]) => [stateKey, state] as const)

    for (const [stateKey, state] of entries) {
      if (!state?.pending) continue
      if (state.timer) clearTimeout(state.timer)
      state.timer = undefined
      state.pendingDue = true
      this.pump(stateKey, state)
    }
  }

  /**
   * Descarta a versão ainda no debounce e invalida a resposta já em voo.
   * A request ativa não pode ser desfeita no transporte, mas seu callback não
   * volta a aplicar um estado que o consumidor já substituiu explicitamente.
   */
  cancel(key: string): void {
    const state = this.states.get(key)
    if (!state) return
    if (state.timer) clearTimeout(state.timer)
    state.timer = undefined
    state.pending = undefined
    state.pendingDue = false
    state.canceledThroughRevision = Math.max(
      state.canceledThroughRevision ?? 0,
      state.latestRevision,
    )
  }

  /**
   * No unmount ainda envia a versão final, mas silencia callbacks React. Jobs
   * já ativos terminam e depois drenam o único slot final, se houver.
   */
  destroy({ flushPending = true }: { flushPending?: boolean } = {}): void {
    if (flushPending) this.flush()
    else {
      for (const state of this.states.values()) {
        if (state.timer) clearTimeout(state.timer)
        state.timer = undefined
        state.pending = undefined
      }
    }
    this.muted = true
  }

  private pump(key: string, state: WriteState): void {
    if (state.active || !state.pending || !state.pendingDue) return

    const job = state.pending
    state.pending = undefined
    state.pendingDue = false
    state.active = job

    void Promise.resolve()
      .then(() => job.submit(job.viewId, job.filters))
      .then(
        (confirmed) => this.finishSuccess(key, state, job, confirmed),
        (error: unknown) => this.finishError(key, state, job, error),
      )
  }

  private finishSuccess(
    key: string,
    state: WriteState,
    job: WriteJob,
    confirmed: ViewFiltersV2 | void,
  ): void {
    state.active = undefined
    const latest = job.revision === state.latestRevision && !state.pending
    const canceled = job.revision <= (state.canceledThroughRevision ?? 0)
    if (!this.muted && !canceled) {
      job.onSuccess?.({
        revision: job.revision,
        viewId: job.viewId,
        submitted: job.filters,
        confirmed: confirmed || undefined,
        latest,
      })
    }
    this.pump(key, state)
  }

  private finishError(key: string, state: WriteState, job: WriteJob, error: unknown): void {
    state.active = undefined
    const latest = job.revision === state.latestRevision && !state.pending
    const canceled = job.revision <= (state.canceledThroughRevision ?? 0)
    if (!this.muted && !canceled) {
      job.onError?.({
        revision: job.revision,
        viewId: job.viewId,
        submitted: job.filters,
        latest,
        error,
      })
    }
    this.pump(key, state)
  }
}
