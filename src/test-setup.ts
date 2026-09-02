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

// Radix Popper (Select/Tooltip) observa o tamanho do conteúdo para posicionar
// o portal. JSDOM não implementa ResizeObserver; a suíte só precisa da
// interface estável, pois não calcula layout real.
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class ResizeObserver {
    constructor(_callback: ResizeObserverCallback) {}
    observe(_target: Element, _options?: ResizeObserverOptions) {}
    unobserve(_target: Element) {}
    disconnect() {}
  }
}

export {}
