import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it } from 'vitest'

import { useExternalDraft, type ExternalDraft } from './useExternalDraft'

/**
 * O guard que impede o realtime de atropelar quem está digitando.
 *
 * Testado aqui, e não no browser, por um motivo prático: a proteção depende de
 * FOCO REAL, e `element.focus()` num painel que não está visível atualiza o
 * `document.activeElement` sem disparar os eventos de foco — o que faz o teste
 * de browser passar/falhar pelo motivo errado. Aqui as transições são
 * chamadas diretamente, sem depender da semântica de foco do ambiente.
 */
let root: Root | null = null
let container: HTMLDivElement | null = null

function render(external: string): { get: () => ExternalDraft; update: (next: string) => void } {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)

  let latest!: ExternalDraft
  function Probe({ value }: { value: string }) {
    latest = useExternalDraft(value)
    return null
  }

  act(() => {
    root!.render(<Probe value={external} />)
  })

  return {
    get: () => latest,
    update: (next) => act(() => root!.render(<Probe value={next} />)),
  }
}

afterEach(() => {
  act(() => root?.unmount())
  container?.remove()
  root = null
  container = null
})

describe('useExternalDraft', () => {
  it('sem foco, acompanha o valor externo (o broadcast entra)', () => {
    const probe = render('inicial')
    expect(probe.get().draft).toBe('inicial')

    probe.update('veio-do-realtime')

    expect(probe.get().draft).toBe('veio-do-realtime')
  })

  it('COM foco, segura o valor externo — não atropela quem digita', () => {
    const probe = render('inicial')

    act(() => probe.get().focus())
    act(() => probe.get().change('estou-digitando'))
    probe.update('veio-do-realtime')

    // O defeito que isto corrige: um `useEffect(() => setDraft(externo))`
    // incondicional apagava o texto no meio da digitação.
    expect(probe.get().draft).toBe('estou-digitando')
  })

  it('blur SEM edição ADOTA o valor externo em vez de commitar', () => {
    // A armadilha do remédio: sem isto, focar uma célula, outra pessoa editá-la
    // e você sair sem digitar faria o commit comparar o rascunho VELHO com o
    // novo, ver diferença e gravar o velho de volta — desfazendo a edição
    // alheia sem ninguém ter pedido.
    const probe = render('inicial')

    act(() => probe.get().focus())
    probe.update('editado-por-outro')

    let deveCommitar = true
    act(() => {
      deveCommitar = probe.get().settle()
    })

    expect(deveCommitar).toBe(false)
    expect(probe.get().draft).toBe('editado-por-outro')
  })

  it('blur COM edição autoriza o commit', () => {
    const probe = render('inicial')

    act(() => probe.get().focus())
    act(() => probe.get().change('meu-texto'))

    let deveCommitar = false
    act(() => {
      deveCommitar = probe.get().settle()
    })

    expect(deveCommitar).toBe(true)
    expect(probe.get().draft).toBe('meu-texto')
  })

  it('revert descarta a edição e o blur seguinte não commita (Escape)', () => {
    const probe = render('inicial')

    act(() => probe.get().focus())
    act(() => probe.get().change('vou-desistir'))
    act(() => probe.get().revert())

    let deveCommitar = true
    act(() => {
      deveCommitar = probe.get().settle()
    })

    expect(deveCommitar).toBe(false)
    expect(probe.get().draft).toBe('inicial')
  })

  it('depois do blur volta a acompanhar o valor externo', () => {
    const probe = render('inicial')

    act(() => probe.get().focus())
    act(() => probe.get().change('editando'))
    act(() => probe.get().settle())

    probe.update('novo-do-realtime')

    expect(probe.get().draft).toBe('novo-do-realtime')
  })
})
