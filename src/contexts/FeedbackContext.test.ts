import { describe, expect, it } from 'vitest'

import { MAX_VISIBLE, feedbackReducer, type Toast } from '@/contexts/FeedbackContext'

/**
 * O reducer da fila de toasts — puro, sem React. O auto-dismiss é problema do
 * `ToastCard` (um timer por card), não daqui; o reducer só empilha e remove.
 */
const toast = (id: string): Toast => ({ id, title: `t-${id}`, variant: 'info' })

describe('feedbackReducer', () => {
  it('push empilha na ordem', () => {
    let state: Toast[] = []
    state = feedbackReducer(state, { type: 'push', toast: toast('a') })
    state = feedbackReducer(state, { type: 'push', toast: toast('b') })
    expect(state.map((t) => t.id)).toEqual(['a', 'b'])
  })

  it('dismiss remove o id certo e mantém o resto', () => {
    const state: Toast[] = [toast('a'), toast('b'), toast('c')]
    expect(feedbackReducer(state, { type: 'dismiss', id: 'b' }).map((t) => t.id)).toEqual([
      'a',
      'c',
    ])
  })

  it('dismiss de id inexistente não muda nada', () => {
    const state: Toast[] = [toast('a')]
    expect(feedbackReducer(state, { type: 'dismiss', id: 'zzz' }).map((t) => t.id)).toEqual(['a'])
  })

  it('respeita o teto: os mais ANTIGOS caem quando passa de MAX_VISIBLE', () => {
    let state: Toast[] = []
    for (let i = 0; i < MAX_VISIBLE + 2; i++) {
      state = feedbackReducer(state, { type: 'push', toast: toast(String(i)) })
    }
    expect(state).toHaveLength(MAX_VISIBLE)
    // Os dois primeiros (0 e 1) caíram; a janela é a cauda.
    expect(state[0].id).toBe('2')
    expect(state[MAX_VISIBLE - 1].id).toBe(String(MAX_VISIBLE + 1))
  })
})
