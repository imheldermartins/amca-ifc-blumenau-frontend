import type { ColumnMask, FormViewConfig, HeaderCol } from './types'

export interface FormInputField {
  id: string
  label: string
  type: 'text' | 'numeric' | 'select' | 'date' | 'checkbox'
  mask?: ColumnMask
  options?: Array<{ value: string; label: string }>
}

export const DEFAULT_FORM_SUBMIT_LABEL = 'Enviar'
export const DEFAULT_FORM_SUBMIT_ICON = 'lucide:send' as const

export function flowColumns(columns: readonly HeaderCol[]): HeaderCol[] {
  return columns.filter((column) => column.type === 'flow')
}

export function createDefaultFormViewConfig(
  columns: readonly HeaderCol[],
): FormViewConfig | null {
  const flowColumn = flowColumns(columns)[0]
  return flowColumn
    ? {
        version: 1,
        flowColumnId: flowColumn.id,
        submitButton: {
          label: DEFAULT_FORM_SUBMIT_LABEL,
          icon: DEFAULT_FORM_SUBMIT_ICON,
        },
      }
    : null
}

export function formFieldColumns(columns: readonly HeaderCol[]): HeaderCol[] {
  return columns.filter((column) => column.type !== 'flow')
}

export function formInputFieldFromColumn(column: HeaderCol): FormInputField {
  const type = column.type === 'numeric'
    || column.type === 'select'
    || column.type === 'date'
    || column.type === 'checkbox'
    ? column.type
    : 'text'
  return {
    id: column.id,
    label: column.title,
    type,
    ...(type === 'text' && column.mask && { mask: column.mask }),
    ...(type === 'select' && {
      options: (column.options ?? []).map((option) => ({
        value: option.publicKey?.key ?? option.id,
        label: option.label,
      })),
    }),
  }
}
