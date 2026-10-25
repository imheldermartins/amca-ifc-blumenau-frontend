import type { JSONContent } from '@tiptap/core'

export type DocumentSnapshot = JSONContent | (() => JSONContent)
export const EDITOR_IDLE_MS = 600
export function readDocumentSnapshot(snapshot: DocumentSnapshot): JSONContent { return typeof snapshot === 'function' ? snapshot() : snapshot }

/** No serialization or React state updates until typing has been idle. */
export function createDocumentChangeDebouncer(emit: (content: JSONContent) => void, delay = EDITOR_IDLE_MS) {
  let timer: ReturnType<typeof setTimeout> | null = null
  let pending: (() => JSONContent) | null = null
  const flush = () => {
    if (timer) clearTimeout(timer)
    timer = null
    const snapshot = pending; pending = null
    if (snapshot) emit(snapshot())
  }
  return {
    schedule(snapshot: () => JSONContent) {
      pending = snapshot
      if (timer) clearTimeout(timer)
      timer = setTimeout(flush, delay)
    },
    flush,
  }
}
