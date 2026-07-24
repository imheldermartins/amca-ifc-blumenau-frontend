/**
 * Seleção de linhas da tabela — estado e transições, sem React.
 *
 * Antes isto vivia solto no `TableView`: um `useState` com array de ids, um
 * `useRef` para a âncora e outro `useState` para o hover, com as transições
 * escritas dentro de handlers que nasciam de novo a cada render (e desciam
 * para TODA linha, invalidando qualquer `memo`). Como redutor:
 *
 *  - `dispatch` tem identidade ESTÁVEL por definição, então os handlers param
 *    de mudar a cada render — que é a condição para o `memo` das linhas valer;
 *  - as três peças do estado passam a mudar juntas, numa transição só;
 *  - a regra fica testável sem montar componente nenhum.
 *
 * `ids` é um **Set**, não array. A pergunta continua sendo a mesma de sempre
 * (`ids.has(row.id)` no lugar de `ids.includes(row.id)`) — mesma forma, sem
 * condicional nova. O que muda é o custo: `includes` roda uma varredura
 * linear POR LINHA renderizada, e numa tabela isso é quadrático.
 */
export interface SelectionState {
  ids: Set<string>
  /** Último checkbox clicado — origem do intervalo com Shift. */
  anchorIndex: number | null
  /** Linha sob o mouse enquanto o Shift está pressionado. */
  hoverIndex: number | null
}

export type SelectionAction =
  /** Checkbox de uma linha. Com `shiftKey` + âncora, vale para o intervalo. */
  | { type: 'set-row'; rowIndex: number; checked: boolean; shiftKey: boolean; rowIds: string[] }
  /** "Selecionar todas" do header (ou limpar tudo). */
  | { type: 'select-all'; checked: boolean; rowIds: string[] }
  | { type: 'hover'; rowIndex: number | null }

export const EMPTY_SELECTION: SelectionState = {
  ids: new Set(),
  anchorIndex: null,
  hoverIndex: null,
}

export function selectionReducer(
  state: SelectionState,
  action: SelectionAction,
): SelectionState {
  switch (action.type) {
    case 'set-row': {
      const { rowIndex, checked, shiftKey, rowIds } = action

      // Shift+click com âncora: o estado clicado vale para o INTERVALO inteiro
      // [âncora, linha]. Sem shift (ou sem âncora), só a linha clicada.
      const from = shiftKey && state.anchorIndex !== null ? Math.min(state.anchorIndex, rowIndex) : rowIndex
      const to = shiftKey && state.anchorIndex !== null ? Math.max(state.anchorIndex, rowIndex) : rowIndex

      const ids = new Set(state.ids)
      for (let index = from; index <= to; index++) {
        const id = rowIds[index]
        if (id === undefined) continue
        if (checked) ids.add(id)
        else ids.delete(id)
      }

      return { ids, anchorIndex: rowIndex, hoverIndex: state.hoverIndex }
    }

    case 'select-all': {
      // Clicar no indeterminado resolve para MARCADO (regra do Radix), então
      // "limpar tudo" acontece no clique seguinte, com todas já marcadas.
      const ids = action.checked ? new Set(action.rowIds) : new Set<string>()
      return { ids, anchorIndex: null, hoverIndex: state.hoverIndex }
    }

    case 'hover': {
      // Mesmo objeto quando nada muda: o mouse atravessa a mesma linha várias
      // vezes, e cada retorno de estado novo custaria um render da tabela.
      if (state.hoverIndex === action.rowIndex) return state
      return { ...state, hoverIndex: action.rowIndex }
    }
  }
}

/** A linha está na área coberta pela seleção com Shift? */
export function inShiftRange(state: SelectionState, rowIndex: number, shiftHeld: boolean): boolean {
  const { anchorIndex, hoverIndex } = state
  if (!shiftHeld || anchorIndex === null || hoverIndex === null) return false
  return (
    rowIndex >= Math.min(anchorIndex, hoverIndex) && rowIndex <= Math.max(anchorIndex, hoverIndex)
  )
}
