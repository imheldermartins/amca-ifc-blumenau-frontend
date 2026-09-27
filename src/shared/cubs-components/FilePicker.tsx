import { Icon } from '@iconify/react'
import { useRef, type ChangeEvent } from 'react'

import { Button, type ButtonProps } from './Button'

export interface FilePickerProps
  extends Omit<ButtonProps, 'children' | 'onClick' | 'type'> {
  accept?: string
  icon?: string
  label: string
  onFileSelect: (file: File) => void
}

export function FilePicker({
  accept,
  icon = 'lucide:upload',
  label,
  onFileSelect,
  ...buttonProps
}: FilePickerProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (file) onFileSelect(file)
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={handleChange}
      />
      <Button
        {...buttonProps}
        type="button"
        aria-label={label}
        onClick={() => inputRef.current?.click()}
      >
        <Icon icon={icon} fontSize={17} />
      </Button>
    </>
  )
}
