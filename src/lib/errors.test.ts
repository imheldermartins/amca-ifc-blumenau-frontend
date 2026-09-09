import { describe, expect, it } from 'vitest'

import { AppError, classifyWriteError, toAppError } from '@/lib/errors'

/**
 * `classifyWriteError` é o mapa que decide a mensagem de uma escrita que
 * falhou (a tabela do plano / demanda-backend). É puro, e o teste trava a
 * CATEGORIA — não o texto PT, que mora no i18n — para cada erro real.
 */
describe('classifyWriteError', () => {
  const cases: Array<[number, string]> = [
    [409, 'conflito'], // dois preenchendo a mesma célula vazia
    [400, 'invalido'], // codec rejeita o valor
    [404, 'nao-encontrado'], // célula/linha sumiu
    [403, 'sem-acesso'], // colaboração revogada
    [401, 'sessao-expirada'], // refresh falhou
    [500, 'servidor'],
    [502, 'servidor'],
    [503, 'servidor'],
  ]

  it.each(cases)('status %i vira %s', (status, kind) => {
    expect(classifyWriteError(new AppError('api', 'x', { status }))).toBe(kind)
  })

  it('AppError SEM status (rede/timeout, sem resposta) vira sem-conexao', () => {
    expect(classifyWriteError(new AppError('api', 'Network Error'))).toBe('sem-conexao')
  })

  it('status inesperado cai no genérico', () => {
    expect(classifyWriteError(new AppError('api', 'x', { status: 418 }))).toBe('generico')
  })

  it('erro que NÃO é AppError (bug síncrono) cai no genérico', () => {
    expect(classifyWriteError(new Error('boom'))).toBe('generico')
    expect(classifyWriteError('string solta')).toBe('generico')
    expect(classifyWriteError(undefined)).toBe('generico')
  })
})

describe('toAppError', () => {
  it('não mantém o AxiosError com senha ou chave como causa logável', () => {
    const axiosError = {
      isAxiosError: true,
      message: 'Request failed',
      config: {
        method: 'post',
        url: '/auth/register/workspace',
        data: JSON.stringify({ password: 'secret1', key: 'cubs_ws_v1_secret' }),
      },
      response: { status: 400, data: { message: 'Dados inválidos' } },
    }

    const error = toAppError('api', axiosError)

    expect(error.message).toBe('POST /auth/register/workspace → 400: Dados inválidos')
    expect(error.cause).toBeUndefined()
  })
})
