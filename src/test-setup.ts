/**
 * Setup da suíte. Só uma coisa mora aqui, e ela é obrigatória para os testes
 * que renderizam hook: sem esta flag o React avisa "not configured to support
 * act(...)" a cada `act()`, enchendo a saída de ruído sem que nada esteja
 * errado. É o sinal padrão de "este ambiente é um test runner".
 */
declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true

export {}
