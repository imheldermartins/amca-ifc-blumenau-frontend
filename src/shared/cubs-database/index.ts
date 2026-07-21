export { CubsDatabase } from './CubsDatabase'
export type { CubsDatabaseProps } from './CubsDatabase'

export { ViewTabsBar } from './components/ViewTabsBar'
export type { ViewTabsBarProps } from './components/ViewTabsBar'
export { TableView } from './components/TableView'
export type { TableViewProps } from './components/TableView'
export { TYPE_ICON } from './components/columnTypeIcons'
export { ColumnHeaderMenu } from './components/ColumnHeaderMenu'
export type { ColumnHeaderMenuLabels, ColumnHeaderMenuProps } from './components/ColumnHeaderMenu'
export { useShiftKey } from './components/useShiftKey'
export { useSortableSensors } from './components/dndSensors'
export { TableRow } from './components/TableRow'
export type { TableRowLabels, TableRowProps } from './components/TableRow'
export { TableCell } from './components/TableCell'
export type { TableCellProps } from './components/TableCell'
export {
  CELL_EDITORS,
  CheckboxCellEditor,
  NumericCellEditor,
  OptionChip,
  OPTION_COLOR_CLASSES,
  SelectCellEditor,
  TextCellEditor,
} from './components/cells'
export type { CellEditor } from './components/cells'

export type {
  CellChange,
  CellData,
  CellEditorProps,
  ColumnDataType,
  ColumnOption,
  DataViewKind,
  DataViewSettings,
  DataViewType,
  HeaderCol,
  NumberFormat,
  OptionColor,
  RowData,
} from './types'

/**
 * `ContextMenuItem` mora em `cubs-components` (junto do componente), mas é
 * re-exportado aqui porque `CubsDatabaseProps.viewMenuItems` o usa — quem
 * consome esta lib precisa do tipo para montar a prop.
 */
export type { ContextMenuItem } from 'cubs-components'

export {
  formatCellValue,
  formatNumericValue,
  inferColumnType,
  reorderByIds,
  resolveColumnTypes,
  resolveColumnWidth,
  ulid,
  DEFAULT_COLUMN_WIDTH,
  MIN_COLUMN_WIDTH,
} from './utils'
export { mockableData, MOCK_VIEW_IDS } from './mockableData'
export type { MockableDataset } from './mockableData'
export { CUBS_DATABASE_VERSION } from './version'
