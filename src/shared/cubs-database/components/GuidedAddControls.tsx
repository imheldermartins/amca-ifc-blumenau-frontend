import { useMemo, useState, type ReactNode } from 'react'
import { cn, NestedMenu, Popover, type MenuNode } from 'cubs-components'

import { COLUMN_TYPE_SECTIONS, type ColumnTypeSectionKey } from '../columnTypeSections'
import type { ColumnDataType } from '../types'
import { GuidedAddControl } from './GuidedAddControl'
import { TYPE_ICON } from './columnTypeIcons'

export interface GuidedAddControlsProps {
  children: ReactNode
  onAddRow?: () => void
  onAddColumn?: (type: ColumnDataType) => void
  addingColumn?: boolean
  addRowLabel: string
  addColumnLabel: string
  columnTypeLabels?: Partial<Record<ColumnDataType, string>>
  columnTypeSectionLabels?: Partial<Record<ColumnTypeSectionKey, string>>
  className?: string
}

/**
 * Moldura dos dois Guided. O conteúdo rolável ocupa apenas a primeira célula
 * da grade; os trilhos são irmãos dele e, por isso, nunca são engolidos pelo
 * `overflow-x-auto` da view padrão. O gap mantém cada trilho suspenso da
 * tabela, com sua própria borda, raio e sombra.
 */
export function GuidedAddControls({
  children,
  onAddRow,
  onAddColumn,
  addingColumn,
  addRowLabel,
  addColumnLabel,
  columnTypeLabels,
  columnTypeSectionLabels,
  className,
}: GuidedAddControlsProps) {
  const [columnPickerOpen, setColumnPickerOpen] = useState(false)
  const columnTypeNodes = useMemo<MenuNode[]>(() =>
    (Object.entries(COLUMN_TYPE_SECTIONS) as Array<[ColumnTypeSectionKey, readonly ColumnDataType[]]>).map(
      ([section, types], index) => ({
        id: `column-section-${section}`,
        name: columnTypeSectionLabels?.[section] ?? section,
        separatorBefore: index > 0,
        content: <NestedMenu nodes={types.map((type) => ({
          id: `add-column-${type}`,
          name: columnTypeLabels?.[type] ?? type,
          icon: TYPE_ICON[type],
          onSelect: () => {
            setColumnPickerOpen(false)
            onAddColumn?.(type)
          },
        }))} />,
      }),
    ), [columnTypeLabels, columnTypeSectionLabels, onAddColumn])

  return (
    <div
      data-guided-add-controls
      className={cn(
        'grid min-w-0 items-stretch gap-2',
        onAddColumn ? 'grid-cols-[minmax(0,1fr)_auto]' : 'grid-cols-1',
        className,
      )}
    >
      <div className="col-start-1 row-start-1 min-w-0">{children}</div>

      {onAddColumn && (
        <Popover
          open={columnPickerOpen && !addingColumn}
          onOpenChange={setColumnPickerOpen}
          side="left"
          align="start"
          sideOffset={6}
          className="min-w-52"
          trigger={<GuidedAddControl
            axis="vertical"
            label={addColumnLabel}
            busy={addingColumn}
            className="col-start-2 row-start-1 rounded-xl border border-divider shadow-sm"
          />}
        >
          <NestedMenu nodes={columnTypeNodes} />
        </Popover>
      )}

      {onAddRow && (
        <GuidedAddControl
          axis="horizontal"
          label={addRowLabel}
          onClick={onAddRow}
          className="col-start-1 row-start-2 rounded-xl border border-divider shadow-sm"
        />
      )}
    </div>
  )
}
