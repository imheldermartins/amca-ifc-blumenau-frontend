import {useEffect, type ReactNode} from 'react'
import {Controller, FormProvider, useForm} from 'react-hook-form'
import {PagePropertyFields, type HeaderCol, type RowData, type CellChange} from 'cubs-database'
import {PageTitleInput} from './PageTitleInput'

/** Shared page-shaped presentation; persistence belongs to the modal host. */
export function PagePropertiesForm({destinationLabel, title, onTitleChange, onTitleBlur, titleReadOnly, columns, row, lockedKeys, onChange, onOrderChange, onSortingChange, disabled, children, footer, onSubmit}: {
  destinationLabel: string
  title: string
  onTitleChange: (title: string) => void
  onTitleBlur?: () => void
  titleReadOnly?: boolean
  columns: HeaderCol[]
  row: RowData
  lockedKeys?: ReadonlySet<string>
  onChange?: (change: CellChange) => void
  onOrderChange?: (columnIds: string[]) => void
  onSortingChange?: (active: boolean) => void
  disabled?: boolean
  children?: ReactNode
  footer?: ReactNode
  onSubmit?: (values: {title: string; cells: RowData['cells']}) => void | Promise<void>
}) {
  const form = useForm<{title: string; cells: RowData['cells']}>({defaultValues: {title, cells: row.cells}})
  useEffect(() => {form.setValue('title', title); form.setValue('cells', row.cells)}, [form, title, row.cells])
  return <FormProvider {...form}><form className="mx-auto my-0 w-full max-w-6xl space-y-6 p-4" data-calendar-page-editor
    onSubmit={form.handleSubmit(async values => { await onSubmit?.(values) })}>
    <p className="text-xs text-dark-100 dark:text-light-900">{destinationLabel}</p>
    <div className="text-3xl font-bold"><Controller control={form.control} name="title" render={({field}) => <PageTitleInput autoFocus value={field.value} onValueChange={value => {field.onChange(value); onTitleChange(value)}} readOnly={titleReadOnly} onBlur={() => {field.onBlur(); onTitleBlur?.()}} />}/></div>
    <fieldset disabled={disabled} className="min-w-0">
      <PagePropertyFields columns={columns} row={row} lockedKeys={lockedKeys} onChange={change => {form.setValue(`cells.${change.columnId}` as `cells.${string}`, {value: change.value}); onChange?.(change)}} onOrderChange={disabled ? undefined : onOrderChange} onSortingChange={onSortingChange} />
    </fieldset>
    {children}
    {footer}
  </form></FormProvider>
}
