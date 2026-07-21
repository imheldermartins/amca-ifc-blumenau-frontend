import { useEffect, useState } from 'react'

/**
 * O "shiftContext" da seleção em intervalo: `true` enquanto Shift está
 * pressionado. É estado de TECLADO global (listeners na window), não de um
 * elemento — o destaque do intervalo precisa reagir mesmo antes de qualquer
 * clique, e o blur da janela solta a tecla (sem ele, alt-tab com Shift preso
 * deixaria o destaque ligado para sempre).
 */
export function useShiftKey(): boolean {
  const [pressed, setPressed] = useState(false)

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => setPressed(event.shiftKey)
    const handleBlur = () => setPressed(false)

    window.addEventListener('keydown', handleKey)
    window.addEventListener('keyup', handleKey)
    window.addEventListener('blur', handleBlur)
    return () => {
      window.removeEventListener('keydown', handleKey)
      window.removeEventListener('keyup', handleKey)
      window.removeEventListener('blur', handleBlur)
    }
  }, [])

  return pressed
}
