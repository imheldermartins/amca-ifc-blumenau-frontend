import { useLayoutEffect, useRef, useState, type FocusEvent } from 'react'

/**
 * Rascunho de um editor de célula sincronizado com o valor EXTERNO — o que
 * chega por props quando outra pessoa (ou o eco do servidor) muda a célula.
 *
 * Existe por causa de um defeito concreto: os editores faziam
 * `useEffect(() => setDraft(externo), [externo])`, incondicional. Se alguém
 * editava a MESMA célula enquanto você digitava, o seu texto era apagado no
 * meio da digitação. E depois que o autor passou a receber o próprio eco
 * (ver `databaseRealtime.ts`), esse caminho passou a ser percorrido muito
 * mais.
 *
 * Há dois modos porque os rascunhos de configuração e os de CÉLULA têm
 * prioridades diferentes:
 *
 *  1. por padrão, **com foco o valor externo espera** — útil em campos de
 *     configuração que fazem merge depois;
 *  2. com `interruptOnExternalChange`, **o valor externo vence**: o rascunho
 *     é descartado, o campo perde o foco e o blur não pode commitar o valor
 *     velho. É o impasse das células em realtime;
 *  3. **sem edição do usuário, o blur ADOTA o valor externo em vez de
 *     commitar.** Sem isto o remédio viraria doença: você clica numa célula,
 *     outra pessoa a edita, você sai sem digitar nada — e o commit compararia
 *     o seu rascunho (o valor VELHO) com o novo, veria diferença e gravaria o
 *     velho de volta, desfazendo a edição alheia sem ninguém ter pedido.
 *
 * Usa estado derivado em RENDER (comparação com o valor já visto) e não
 * `useEffect`: o efeito custaria um render descartado a cada evento de
 * realtime, que é exatamente o que se quer evitar numa tabela.
 */
export interface ExternalDraft {
  /** Valor atual do campo. */
  draft: string
  /** `onChange` do campo — marca que a edição é do usuário. */
  change: (next: string) => void
  /** `onFocus` do campo — registra também o elemento que deve perder o foco. */
  focus: (event?: FocusEvent<HTMLInputElement>) => void
  /**
   * Chame no início do blur. `false` = o usuário não editou nada (e o
   * rascunho já foi realinhado ao valor externo), então NÃO commite.
   */
  settle: () => boolean
  /** Escape: descarta a edição e volta ao valor externo. */
  revert: () => void
}

export interface ExternalDraftOptions {
  /**
   * Uma mudança externa durante o foco cancela a edição em vez de ficar
   * pendente. Use nos editores de célula; campos de configuração preservam o
   * comportamento padrão.
   */
  interruptOnExternalChange?: boolean
  /** Chamado depois de o blur cancelado adotar o valor externo. */
  onConflict?: () => void
}

export function useExternalDraft(
  external: string,
  { interruptOnExternalChange = false, onConflict }: ExternalDraftOptions = {},
): ExternalDraft {
  const [draft, setDraft] = useState(external)
  const [seen, setSeen] = useState(external)
  const focused = useRef(false)
  const dirty = useRef(false)
  const focusedElement = useRef<HTMLInputElement | null>(null)
  const pendingConflict = useRef(false)
  const onConflictRef = useRef(onConflict)
  onConflictRef.current = onConflict

  // Estado derivado durante o render: o React reexecuta o componente na hora,
  // sem commitar o render intermediário. Um `useEffect` aqui custaria dois
  // renders por evento recebido.
  if (external !== seen) {
    setSeen(external)
    if (focused.current && interruptOnExternalChange) {
      // O receiver é autoritativo: antes de provocar o blur, invalida a
      // edição. Assim o onBlur síncrono chama `settle()` e recebe `false`, sem
      // nenhuma janela para o rascunho velho escapar pelo onCommit.
      focused.current = false
      dirty.current = false
      setDraft(external)
      pendingConflict.current = true
    } else if (!focused.current && !dirty.current) {
      setDraft(external)
    }
  }

  // O DOM não pode ser mutado durante render. Layout effect roda antes da
  // pintura do novo valor, fecha o editor e só então avisa o host para marcar
  // a célula/toaster. Sem dependências: a ref define se há trabalho pendente.
  useLayoutEffect(() => {
    if (!pendingConflict.current) return
    pendingConflict.current = false
    const element = focusedElement.current
    focusedElement.current = null
    element?.blur()
    onConflictRef.current?.()
  })

  return {
    draft,
    change: (next) => {
      dirty.current = true
      setDraft(next)
    },
    focus: (event) => {
      focused.current = true
      focusedElement.current = event?.currentTarget ?? null
    },
    settle: () => {
      focused.current = false
      focusedElement.current = null
      const edited = dirty.current
      dirty.current = false
      // Saiu sem editar: adota o que chegou enquanto o campo estava em foco.
      if (!edited) setDraft(external)
      return edited
    },
    revert: () => {
      dirty.current = false
      setDraft(external)
    },
  }
}
