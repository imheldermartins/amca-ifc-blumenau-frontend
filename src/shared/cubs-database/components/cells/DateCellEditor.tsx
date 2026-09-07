import { memo, useLayoutEffect, useRef, useState } from 'react'
import { DatePicker } from 'cubs-components'

import type { CellEditorProps } from '../../types'

/**
 * Editor de célula `date`. O próprio DatePicker fala o wire da API (`ISO` ou
 * `startISO@endISO`), portanto esta camada só cuida do ciclo de edição da
 * tabela e da interrupção autoritativa do realtime.
 */
export const DateCellEditor = memo(function DateCellEditor({
  column,
  value,
  onCommit,
  onExternalConflict,
  hasError,
  labels,
}: CellEditorProps) {
  const normalizedValue = typeof value === 'string' ? value : null
  const [open, setOpen] = useState(false)
  const seenValue = useRef(value)

  useLayoutEffect(() => {
    const changed = !Object.is(seenValue.current, value)
    seenValue.current = value
    if (!changed || !open) return
    setOpen(false)
    onExternalConflict?.()
  }, [value, open, onExternalConflict])

  return (
    <DatePicker
      aria-label={column.title}
      value={normalizedValue}
      onValueChange={(next) => {
        if (!Object.is(next, normalizedValue)) onCommit(next)
      }}
      open={open}
      onOpenChange={setOpen}
      selectionMode="optional-range"
      surface="plain"
      size="sm"
      invalid={hasError}
      labels={labels?.datePicker}
      className="h-full w-full"
      triggerClassName="h-full min-h-8 cursor-pointer rounded-none px-2.5 py-1.5"
    />
  )
})
