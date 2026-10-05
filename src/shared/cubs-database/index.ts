export { CubsDatabase } from './CubsDatabase'
export type { CubsDatabaseProps } from './CubsDatabase'
export type { DatabasePagination, DatabasePageStream, DatabaseRowMove } from './pagination'
export * from './pageViewQueryContract'
export type { BoardViewConfig, BoardMoveInput, BoardCreateInput, FlowButtonConfig } from './types'

export { ViewTabsBar } from './components/ViewTabsBar'
export type { ViewTabsBarProps } from './components/ViewTabsBar'
export { FormView } from './components/FormView'
export type { FormViewLabels, FormViewMode, FormViewProps } from './components/FormView'
export { FormFieldControl } from './components/FormFieldControl'
export type { FormInputField } from './formView'
export { TableView } from './components/TableView'
export type { TableViewProps } from './components/TableView'
export { GridView, GridContainer, GridTile } from './components/GridView'
export { CalendarView, type CalendarViewLabels, type CalendarViewProps } from './components/CalendarView'
export { BoardView, type BoardViewProps } from './components/BoardView'
export { BOARD_UNASSIGNED, parseBoardConfig } from './boardView'
export { ColumnLockSettings, type ColumnLockSettingsLabels } from './components/ColumnLockSettings'
export { FlowEditorDialog } from './components/FlowEditorDialog'
export { createDefaultFlowDefinition } from './flowDefinition'
export {
  createFlowMacroScope,
  createFlowMacroSections,
  createMacroMentionMaps,
  encodeMacroMention,
  extractMacroMentions,
  formatMacroMentions,
  macroMentionSlug,
  parseMacroMentions,
} from './macroMentions'
export type { FlowEditorDialogProps } from './components/FlowEditorDialog'
export { CalendarProperties } from './components/CalendarProperties'
export type { CalendarPropertiesProps } from './components/CalendarProperties'
export { mappedProps } from './calendarPropertyRenderers'
export type { CalendarPropertyRenderContext, CalendarPropertyRenderer } from './calendarPropertyRenderers'
export { databaseCalendarItems } from './calendarItems'
export type { DatabaseCalendarItemTypes, DatabaseCalendarProperty } from './calendarItems'
export { GraphView, GraphCanvas, GraphNode } from './components/GraphView'
export { ViewSettingsForm } from './components/ViewSettingsForm'
export { mappedForm, DEFAULT_VIEW_MOCK_SETTINGS } from './viewSettings'
export type { ViewMockSettings } from './viewSettings'
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
export { DATA_VIEW_KINDS, VIEW_KIND_ICON, isDataViewKind } from './viewKinds'
export {
  createDefaultFormViewConfig,
  DEFAULT_FORM_SUBMIT_ICON,
  DEFAULT_FORM_SUBMIT_LABEL,
  flowColumns,
  formFieldColumns,
  formInputFieldFromColumn,
} from './formView'
export { ColumnHeaderMenu } from './components/ColumnHeaderMenu'
export type { ColumnHeaderMenuLabels, ColumnHeaderMenuProps } from './components/ColumnHeaderMenu'
export { useShiftKey } from './components/useShiftKey'
export { useSortableSensors } from './components/dndSensors'
export { TableRow } from './components/TableRow'
export type { TableRowLabels, TableRowProps } from './components/TableRow'
export { RowActionsMenu } from './components/RowActionsMenu'
export type {
  RowActionsMenuLabels,
  RowActionsMenuProps,
} from './components/RowActionsMenu'
export { TableCell } from './components/TableCell'
export type { TableCellProps } from './components/TableCell'
export {
  CELL_EDITORS,
  CheckboxCellEditor,
  DateCellEditor,
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
  CalendarPinInput,
  CellEditorLabels,
  CellEditorProps,
  ColumnConfigPatch,
  ColumnDataType,
  ColumnLockEditor,
  ColumnLockMap,
  ColumnMask,
  ColumnOption,
  CurrencyCode,
  CatalogIcon,
  DataViewKind,
  DataViewSettings,
  DataViewType,
  FlowCallbackNode,
  FlowConditionOperator,
  FlowDefinition,
  FlowDefinitionV1,
  FlowDefinitionV2,
  FlowDialogTarget,
  FlowEmailNode,
  FlowExecutionResult,
  FlowMacroGroup,
  FlowMacroOption,
  FlowMacroScope,
  FlowMacroSection,
  FlowMacroSectionsBuilder,
  FlowNode,
  FlowNodeV2,
  FlowNodeType,
  FlowStepV2,
  FlowSetValueNode,
  FlowStartNode,
  FlowSwitchNode,
  FormFieldAnswer,
  FormSubmissionInput,
  FormViewConfig,
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
