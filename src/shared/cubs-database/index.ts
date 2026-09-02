export { CubsDatabase } from './CubsDatabase'
export type { CubsDatabaseProps } from './CubsDatabase'

export { ViewTabsBar } from './components/ViewTabsBar'
export type { ViewTabsBarProps } from './components/ViewTabsBar'
export { TableView } from './components/TableView'
export type { TableViewProps } from './components/TableView'
export { DatabaseViewToolbar } from './components/DatabaseViewToolbar'
export type {
  DatabaseViewToolbarLabels,
  DatabaseViewToolbarProps,
} from './components/DatabaseViewToolbar'
export { DatabaseViewSyncStatus } from './components/DatabaseViewSyncStatus'
export type {
  DatabaseViewToolbarSyncState,
  DatabaseViewToolbarSyncStatus,
  DatabaseViewSyncStatusProps,
} from './components/DatabaseViewSyncStatus'
export { PrioritySelect } from './components/PrioritySelect'
export type {
  PrioritySelectLabels,
  PrioritySelectOption,
  PrioritySelectProps,
} from './components/PrioritySelect'
export { FilterChip } from './components/FilterChip'
export type { FilterChipLabels, FilterChipProps } from './components/FilterChip'
export {
  TableGroupAccordion,
} from './components/TableGroupAccordion'
export type {
  TableGroupAccordionProps,
} from './components/TableGroupAccordion'
export { buildTableGroups, formatTableGroupValue } from './tableGroups'
export type { TableGroupLabels, TableGroupNode } from './tableGroups'
export { GuidedAddControl } from './components/GuidedAddControl'
export type { GuidedAddControlProps } from './components/GuidedAddControl'
export { GuidedAddControls } from './components/GuidedAddControls'
export type { GuidedAddControlsProps } from './components/GuidedAddControls'
export { VirtualScroller } from './components/VirtualScroller'
export type { VirtualScrollerProps } from './components/VirtualScroller'
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
  CellEditConflict,
  CellEditorProps,
  ColumnConfigPatch,
  ColumnDataType,
  ColumnMask,
  ColumnOption,
  CurrencyCode,
  DataViewKind,
  DataViewSettings,
  DataViewType,
  HeaderCol,
  NumberFormat,
  OptionColor,
  PageTitleColumn,
  PublicKeyMetadata,
  RowData,
  FilterCondition,
  ViewFilterClause,
  ViewFiltersPassthrough,
  ViewFiltersV2,
} from './types'

/**
 * `ContextMenuItem` mora em `cubs-components` (junto do componente), mas é
 * re-exportado aqui porque `CubsDatabaseProps.viewMenuItems` o usa — quem
 * consome esta lib precisa do tipo para montar a prop.
 */
export type { ContextMenuItem } from 'cubs-components'

export {
  cellErrorKey,
  columnDivergence,
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
export { reorderPriorityValues } from './prioritySelect'
export {
  isPublicKeyMetadata,
  normalizePublicKey,
  parsePublicKeyMetadata,
  reconcilePublicKeys,
  resolvePublicKey,
} from './publicKeys'
export type {
  PublicKeyCandidate,
  PublicKeyFallback,
  PublicKeyResolution,
  ReconciledPublicKey,
} from './publicKeys'
export {
  decodeViewFiltersUrl,
  encodeViewFiltersUrl,
  FILTER_URL_VERSION,
  isViewFilterQueryKey,
  viewFiltersSemanticSignature,
} from './viewFilterUrl'
export type {
  DecodeViewFilterUrlResult,
  FilterUrlDiagnostic,
  FilterUrlPatch,
  FilterUrlQuery,
  FilterUrlValue,
  PublicFilterCondition,
} from './viewFilterUrl'
export {
  applyViewFilters,
  canonicalizeViewFilters,
  getFilterCondition,
  hasViewFilters,
  mappedFilters,
  matchesViewFilter,
  emptyViewFilters,
  parseViewFilters,
  serializeViewFilters,
  VIEW_FILTERS_VERSION,
} from './viewFilters'
export type {
  FilterConditionDefinition,
  FilterPredicate,
  FilterTypeDefinition,
  FilterValueArity,
  FilterValueInput,
  ParsedViewFilters,
} from './viewFilters'
