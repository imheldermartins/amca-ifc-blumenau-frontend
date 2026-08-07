import { useState } from 'react'

import { Popover } from './Popover'
import { cn } from './lib/utils'
import { OPTION_COLORS, OPTION_COLOR_SWATCH, type OptionColor } from './lib/optionColors'

export interface ColorPickerProps {
  /** Cor atual — o swatch dela ganha um anel de selecionado. */
  value?: OptionColor
  /** Escolheu uma cor (fecha o popover). */
  onPick: (color: OptionColor) => void
  /** Cores oferecidas; default = as 6 do sistema. */
  colors?: readonly OptionColor[]
  /** Nome acessível do gatilho (o campo não tem label visível). */
  label?: string
  className?: string
}

/**
 * Seletor de cor — gatilho é um círculo com gradiente arco-íris (`conic-
 * gradient`, inline porque é uma cor de UI, não um token do tema) que abre um
 * `Popover` com as cores em flex. Clicar numa cor emite `onPick` e fecha.
 *
 * As cores são o vocabulário `OptionColor` do sistema (6) — o mesmo que o
 * backend aceita. É usado no editor de options do select, mas fica no pacote
 * (genérico) para servir outras telas.
 */
export function ColorPicker({
  value,
  onPick,
  colors = OPTION_COLORS,
  label = 'Escolher cor',
  className,
}: ColorPickerProps) {
  const [open, setOpen] = useState(false)

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      align="center"
      trigger={
        <button
          type="button"
          aria-label={label}
          className={cn(
            'size-5 shrink-0 rounded-full border border-divider-contrast',
            'transition-transform hover:scale-110',
            className,
          )}
          // Arco-íris no gatilho quando NÃO há cor; com cor, mostra a cor cheia.
          style={
            value
              ? undefined
              : { backgroundImage: 'conic-gradient(#f43f5e,#f59e0b,#eab308,#10b981,#3b82f6,#8b5cf6,#f43f5e)' }
          }
        >
          {value && <span className={cn('block size-full rounded-full', OPTION_COLOR_SWATCH[value])} />}
        </button>
      }
    >
      <div className="flex items-center gap-1.5 p-1">
        {colors.map((color) => (
          <button
            key={color}
            type="button"
            aria-label={color}
            onClick={() => {
              onPick(color)
              setOpen(false)
            }}
            className={cn(
              'size-6 rounded-full transition-transform hover:scale-110',
              OPTION_COLOR_SWATCH[color],
              value === color && 'ring-2 ring-foreground ring-offset-1 ring-offset-background',
            )}
          />
        ))}
      </div>
    </Popover>
  )
}
