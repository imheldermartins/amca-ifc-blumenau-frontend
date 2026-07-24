import { useRef, useState } from 'react'

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
 * Duas regras, e a segunda é a que não é óbvia:
 *
 *  1. **com foco, o valor externo não entra** — quem está digitando manda;
 *  2. **sem edição do usuário, o blur ADOTA o valor externo em vez de
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
  /** `onFocus` do campo — a partir daqui o valor externo espera. */
  focus: () => void
  /**
   * Chame no início do blur. `false` = o usuário não editou nada (e o
   * rascunho já foi realinhado ao valor externo), então NÃO commite.
   */
  settle: () => boolean
  /** Escape: descarta a edição e volta ao valor externo. */
  revert: () => void
}

export function useExternalDraft(external: string): ExternalDraft {
  const [draft, setDraft] = useState(external)
  const [seen, setSeen] = useState(external)
  const focused = useRef(false)
  const dirty = useRef(false)

  // Estado derivado durante o render: o React reexecuta o componente na hora,
  // sem commitar o render intermediário. Um `useEffect` aqui custaria dois
  // renders por evento recebido.
  if (external !== seen) {
    setSeen(external)
    if (!focused.current && !dirty.current) setDraft(external)
  }

  return {
    draft,
    change: (next) => {
      dirty.current = true
      setDraft(next)
    },
    focus: () => {
      focused.current = true
    },
    settle: () => {
      focused.current = false
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
