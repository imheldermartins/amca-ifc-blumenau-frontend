import { describe, expect, it } from 'vitest'

import type { FlowMacroOption } from './types'
import {
  createFlowMacroScope,
  createFlowMacroSections,
  encodeMacroMention,
  extractMacroMentions,
  formatMacroMentions,
  macroMentionSlug,
  parseMacroMentions,
} from './macroMentions'

const macros: FlowMacroOption[] = [
  { token: '@people.user-1.email', label: 'Hélder Martins · e-mail', group: 'people' },
  { token: '@page.title', label: 'Título da página', group: 'page' },
  { token: '@workspace.name', label: 'Nome do workspace', group: 'workspace' },
  { token: '@columns.room', label: 'Sala disponível', group: 'columns' },
]

describe('macroMentions', () => {
  it('codifica o rótulo em uma menção legível Pascal_Snake_Case', () => {
    expect(macroMentionSlug('  título da página  ')).toBe('Titulo_Da_Pagina')
    expect(encodeMacroMention('Hélder Martins · e-mail')).toBe('@{Helder_Martins_E_Mail}')
  })

  it('projeta menções visuais sem alterar os tokens canônicos persistidos', () => {
    const canonical = 'Olá @people.user-1.email, página @page.title'
    const display = formatMacroMentions(canonical, macros)

    expect(display).toBe('Olá @{Helder_Martins_E_Mail}, página @{Titulo_Da_Pagina}')
    expect(extractMacroMentions(display)).toEqual([
      '@{Helder_Martins_E_Mail}',
      '@{Titulo_Da_Pagina}',
    ])
    expect(parseMacroMentions(display, macros)).toBe(canonical)
  })

  it('cria seções recomponíveis com arrays independentes', () => {
    const scope = createFlowMacroScope(macros)
    const sections = createFlowMacroSections(scope)

    expect(sections.map(({ id }) => id)).toEqual(['people', 'page', 'workspace', 'columns'])
    expect([...scope.people, ...scope.columns].map(({ token }) => token)).toEqual([
      '@people.user-1.email',
      '@columns.room',
    ])
  })
})
