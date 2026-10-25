import type { HeaderCol, HeatmapConfig } from './types'

export type HeatmapDay = { total: number; checked: number }

export const heatmapDayKey = (date: Date) => date.toISOString().slice(0, 10)
export const heatmapDate = (key: string) => new Date(`${key}T00:00:00.000Z`)

function weekKey(day: string): string {
  const date = heatmapDate(day)
  date.setUTCDate(date.getUTCDate() - date.getUTCDay())
  return heatmapDayKey(date)
}

/** Only days within the requested period contribute, including across months. */
export function heatmapWeeklyMaxima(days: Record<string, HeatmapDay>): Record<string, number> {
  const weeks: Record<string, number> = {}
  for (const [day, value] of Object.entries(days)) {
    const key = weekKey(day)
    weeks[key] = Math.max(weeks[key] ?? 0, value.checked)
  }
  return Object.fromEntries(Object.keys(days).map((day) => [day, weeks[weekKey(day)] ?? 0]))
}

export function heatmapIntensity(checked: number, maximum: number): number {
  return maximum > 0 ? Math.min(1, Math.max(0, (checked / maximum - 0.1) / 0.9)) : 0
}

export function heatmapRuleDescription(config: HeatmapConfig, columns: HeaderCol[]): string {
  const date = columns.find((column) => column.id === config.dateColumnId)?.title ?? 'data selecionada'
  const checkboxes = config.checkboxColumnIds.map((id) => columns.find((column) => column.id === id)?.title ?? 'checkbox selecionada')
  return `Cor: roxo · soma de marcadas em ${checkboxes.join(' + ')} por ${date} · máximo semanal = 100%; até 10% do máximo = sem roxo`
}
