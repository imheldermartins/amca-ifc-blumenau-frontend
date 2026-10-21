import { formulaText } from '../formulaValue'
import { OptionChip } from './cells/OptionChip'
import type { ColumnOption } from '../types'


export function FormulaResult({ value }: { value: unknown }) {
  if (Array.isArray(value)) return <span className="flex min-w-0 flex-wrap gap-1">{value.slice(0,250).map((item,index)=><FormulaResult key={index} value={item}/>)}</span>
  if (value && typeof value === 'object') {
    const item=value as Record<string,unknown>
    if(item.kind==='markup') return <OptionChip option={{id:'formula',label:formulaText(item.value),color:item.color as ColumnOption['color']}} />
    if(item.kind==='formula-error') return <span className="truncate text-xs text-p-orange-600" title={formulaText(value)}>⚠ {formulaText(value)}</span>
  }
  return <span className="truncate tabular-nums">{formulaText(value)}</span>
}
