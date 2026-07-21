import { KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable'

/**
 * Sensores padrão de TODO sortable da lib (options do select, linhas,
 * colunas) — um lugar só, para o comportamento de drag ser idêntico:
 *
 *  - Pointer com distância mínima de 4px para INICIAR: sem ela, qualquer
 *    clique tremido no handle viraria um drag de 0px e engoliria o clique;
 *  - Keyboard com as coordenadas do sortable: Space/Enter no handle levanta,
 *    setas movem, Space/Enter solta, Escape cancela — o caminho acessível.
 */
export function useSortableSensors() {
  return useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
}
