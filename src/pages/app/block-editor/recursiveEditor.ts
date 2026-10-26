import { i18n } from '@/lib/i18n'
import { CHILD_TITLE, PDF_TITLE, childColumn, pdfColumn, relationTitle, relationColumn, type RecursiveColumn, type RecursiveRow } from '@/shared/recursive-template'

export function recursiveMentionOptions(columns: RecursiveColumn[], relationId?: string, name?: string) {
  const section = name ? `${i18n('recursive.section')} · ${name}` : i18n('recursive.section')
  return [{ id: relationId ? relationTitle(relationId) : CHILD_TITLE, label: i18n('recursive.child-title'), value: '', section, search: 'título relation recursive' },
    ...columns.map((col) => ({ id: relationId ? relationColumn(relationId, col.id) : childColumn(col.id), label: col.name || i18n('recursive.unnamed-property'), value: '', section, search: `${col.name} relation recursive` }))]
}
export function pdfMentionOptions(columns: RecursiveColumn[]) {
  const section = i18n('recursive.page-context')
  return [{ id: PDF_TITLE, label: i18n('recursive.page-title'), value: '', section }, ...columns.map((col) => ({ id: pdfColumn(col.id), label: col.name || i18n('recursive.unnamed-property'), value: '', section }))]
}
export function recursiveSampleRows(columns: RecursiveColumn[]): RecursiveRow[] {
  return ['2026-03-12T00:00:00.000Z', '2028-08-20T00:00:00.000Z', ''].map((date, index) => ({
    id: `sample-${index}`, title: `${i18n('recursive.sample-item')} ${index + 1}`, values: Object.fromEntries(columns.map((col) => [col.id, col.type === 'date' ? date ? index ? '20/08/2028' : '12/03/2026' : '' : col.type === 'numeric' ? '125' : col.type === 'checkbox' ? 'Sim' : `${col.name} ${index + 1}`])),
    dates: Object.fromEntries(columns.filter((col) => col.type === 'date').map((col) => [col.id, date])),
  }))
}
