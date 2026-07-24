import { beforeEach, describe, expect, it, vi } from 'vitest'

import { sessionStore } from '@/services/sessionStore'

/**
 * Este arquivo existe para IMPEDIR UMA REGRESSÃO, não para exercitar getters.
 *
 * O motivo da leva inteira de sessão foi que o par de tokens — incluindo o
 * refresh, válido por 7 DIAS — morava em `localStorage`, ao alcance de
 * qualquer XSS. O `sessionStore` só pode guardar o access token EM MEMÓRIA.
 *
 * Se alguém "otimizar" isto de volta para persistência (para a sessão
 * sobreviver ao reload sem a ida ao `/auth/refresh`, que é a tentação óbvia),
 * o teste abaixo falha e explica por quê. A sessão sobrevive ao reload pelo
 * cookie `HttpOnly` — não por storage.
 */
describe('sessionStore', () => {
  beforeEach(() => {
    sessionStore.clear()
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('guarda e devolve o access token', () => {
    expect(sessionStore.get()).toBeNull()
    sessionStore.set('token-abc')
    expect(sessionStore.get()).toBe('token-abc')
  })

  it('esquece o token no clear', () => {
    sessionStore.set('token-abc')
    sessionStore.clear()
    expect(sessionStore.get()).toBeNull()
  })

  it('NUNCA escreve em localStorage nem sessionStorage', () => {
    const local = vi.spyOn(Storage.prototype, 'setItem')

    sessionStore.set('token-secreto')
    sessionStore.get()
    sessionStore.clear()

    expect(local).not.toHaveBeenCalled()
    expect(localStorage.length).toBe(0)
  })

  it('NUNCA escreve em document.cookie (o refresh é HttpOnly, do servidor)', () => {
    const setCookie = vi.fn()
    const original = Object.getOwnPropertyDescriptor(Document.prototype, 'cookie')
    Object.defineProperty(document, 'cookie', { set: setCookie, get: () => '', configurable: true })

    sessionStore.set('token-secreto')
    sessionStore.clear()

    expect(setCookie).not.toHaveBeenCalled()
    if (original) Object.defineProperty(Document.prototype, 'cookie', original)
  })

  it('o token não sobrevive a um "reload" — quem restaura é o cookie', () => {
    sessionStore.set('token-abc')
    // Um reload descarta o módulo inteiro; o equivalente aqui é conferir que
    // nada ficou para trás em storage que pudesse repovoá-lo.
    expect(localStorage.length).toBe(0)
    expect(sessionStorage.length).toBe(0)
  })
})
