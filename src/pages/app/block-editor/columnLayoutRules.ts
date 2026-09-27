export const MAX_COLUMNS = 4

export interface ColumnLayoutPreset {
  id: string
  equal: boolean
  widths: number[]
}

/**
 * Fonte única das regras de largura das colunas do editor.
 *
 * O documento persiste percentuais, enquanto o resize mantém uma prévia local
 * fluida. Valores antigos de 1 a 4 ainda são aceitos como quartos para que um
 * documento criado pela primeira versão do editor não mude de aparência.
 */
export class ColumnLayoutRules {
  static readonly totalPercent = 100
  static readonly minimumPercent = ColumnLayoutRules.totalPercent / MAX_COLUMNS

  static storedWidth(value: unknown): number {
    const width = Number(value)
    if (!Number.isFinite(width)) return ColumnLayoutRules.totalPercent

    const legacyQuarter = Number.isInteger(width) && width >= 1 && width <= MAX_COLUMNS
    const percentage = legacyQuarter
      ? width * ColumnLayoutRules.minimumPercent
      : width

    return ColumnLayoutRules.clamp(
      percentage,
      ColumnLayoutRules.minimumPercent,
      ColumnLayoutRules.totalPercent,
    )
  }

  static equalWidths(count: number): number[] {
    const columnCount = ColumnLayoutRules.columnCount(count)
    if (columnCount === 0) return []

    return ColumnLayoutRules.balance(
      Array.from(
        { length: columnCount },
        () => ColumnLayoutRules.totalPercent / columnCount,
      ),
    )
  }

  static normalize(widths: readonly unknown[]): number[] {
    const values = widths
      .slice(0, MAX_COLUMNS)
      .map((width) => ColumnLayoutRules.storedWidth(width))
    if (values.length === 0) return []
    if (values.length === 1) return [ColumnLayoutRules.totalPercent]

    const baseTotal = ColumnLayoutRules.minimumPercent * values.length
    const distributable = ColumnLayoutRules.totalPercent - baseTotal
    const weights = values.map((width) => width - ColumnLayoutRules.minimumPercent)
    const weightTotal = weights.reduce((total, weight) => total + weight, 0)
    const normalized = values.map((_, index) => {
      const ratio = weightTotal > 0 ? weights[index] / weightTotal : 1 / values.length
      return ColumnLayoutRules.minimumPercent + distributable * ratio
    })

    return ColumnLayoutRules.balance(normalized)
  }

  static resizeBoundary(
    widths: readonly unknown[],
    leftIndex: number,
    deltaPercent: number,
  ): number[] {
    const normalized = ColumnLayoutRules.normalize(widths)
    const rightIndex = leftIndex + 1
    if (!normalized[leftIndex] || !normalized[rightIndex]) return normalized

    const pairTotal = normalized[leftIndex] + normalized[rightIndex]
    const nextLeft = ColumnLayoutRules.clamp(
      normalized[leftIndex] + deltaPercent,
      ColumnLayoutRules.minimumPercent,
      pairTotal - ColumnLayoutRules.minimumPercent,
    )
    const result = [...normalized]
    result[leftIndex] = nextLeft
    result[rightIndex] = pairTotal - nextLeft
    return ColumnLayoutRules.balance(result)
  }

  static presets(count: number): ColumnLayoutPreset[] {
    const columnCount = ColumnLayoutRules.columnCount(count)
    if (columnCount === 0) return []

    const equal = ColumnLayoutRules.equalWidths(columnCount)
    const layouts = [equal, ...ColumnLayoutRules.sliceLayouts(columnCount)]
    const seen = new Set<string>()

    return layouts.flatMap((widths, index) => {
      const balanced = ColumnLayoutRules.balance(widths)
      const id = balanced.map((width) => ColumnLayoutRules.round(width)).join('-')
      if (seen.has(id)) return []
      seen.add(id)
      return [{ id, equal: index === 0, widths: balanced }]
    })
  }

  static anchor(widths: readonly unknown[], columnIndex: number): number[] {
    const normalized = ColumnLayoutRules.normalize(widths)
    if (normalized.length === 0) return []

    const anchor = Math.min(
      normalized.length - 1,
      Math.max(0, Math.trunc(columnIndex)),
    )
    const anchored = Array.from({ length: normalized.length }, () => 0)
    normalized.forEach((width, offset) => {
      anchored[(anchor + offset) % normalized.length] = width
    })
    return anchored
  }

  static format(widths: readonly number[]): string {
    return widths
      .map((width) => `${new Intl.NumberFormat('pt-BR', {
        maximumFractionDigits: 2,
      }).format(width)}%`)
      .join(' / ')
  }

  private static columnCount(count: number): number {
    if (!Number.isFinite(count)) return 0
    return Math.min(MAX_COLUMNS, Math.max(0, Math.trunc(count)))
  }

  private static sliceLayouts(count: number): number[][] {
    const layouts: number[][] = []

    const collect = (remaining: number, slots: number, slices: number[]) => {
      if (slots === 1) {
        if (remaining >= 1) {
          layouts.push([
            ...slices,
            remaining,
          ].map((slice) => slice * ColumnLayoutRules.minimumPercent))
        }
        return
      }

      for (let slice = 1; slice <= remaining - slots + 1; slice += 1) {
        collect(remaining - slice, slots - 1, [...slices, slice])
      }
    }

    collect(MAX_COLUMNS, count, [])
    return layouts
  }

  private static balance(widths: readonly number[]): number[] {
    if (widths.length === 0) return []
    const balanced = widths.map((width) => ColumnLayoutRules.round(width))
    const sum = balanced.reduce((total, width) => total + width, 0)
    balanced[balanced.length - 1] = ColumnLayoutRules.round(
      balanced[balanced.length - 1] + ColumnLayoutRules.totalPercent - sum,
    )
    return balanced
  }

  private static clamp(value: number, minimum: number, maximum: number): number {
    return Math.min(maximum, Math.max(minimum, value))
  }

  private static round(value: number): number {
    return Math.round(value * 10_000) / 10_000
  }
}
