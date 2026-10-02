import type {
  FlowMacroOption,
  FlowMacroScope,
  FlowMacroSection,
} from './types'

const MENTION = /@\{([^}\r\n]+)\}/g

const SECTION_LABELS: Record<keyof FlowMacroScope, string> = {
  people: 'Pessoas desta página',
  page: 'Página',
  workspace: 'Workspace',
  columns: 'Colunas',
}

/**
 * Transforma o rótulo humano em Pascal_Snake_Case para a menção visível.
 * O token canônico (`@columns.<id>`, por exemplo) continua sendo o valor
 * persistido e enviado à API; a menção é apenas a projeção editável da UI.
 */
export function macroMentionSlug(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean)
    .map((part) => {
      const lower = part.toLocaleLowerCase()
      return `${lower.charAt(0).toLocaleUpperCase()}${lower.slice(1)}`
    })
    .join('_')
}

export function encodeMacroMention(label: string): string {
  const slug = macroMentionSlug(label) || 'Macro'
  return `@{${encodeURIComponent(slug)}}`
}

export function extractMacroMentions(value: string): string[] {
  return [...value.matchAll(MENTION)].map((match) => match[0])
}

export function createFlowMacroScope(macros: readonly FlowMacroOption[]): FlowMacroScope {
  return {
    people: macros.filter((macro) => macro.group === 'people'),
    page: macros.filter((macro) => macro.group === 'page'),
    workspace: macros.filter((macro) => macro.group === 'workspace'),
    columns: macros.filter((macro) => macro.group === 'columns'),
  }
}

/** Default explícito e recomponível pelo host com `...scope.people`, etc. */
export function createFlowMacroSections(scope: FlowMacroScope): FlowMacroSection[] {
  return (Object.keys(SECTION_LABELS) as (keyof FlowMacroScope)[]).flatMap((id) => {
    const options = [...scope[id]]
    return options.length ? [{ id, label: SECTION_LABELS[id], options }] : []
  })
}

interface MacroMentionMaps {
  canonicalToMention: Map<string, string>
  mentionToCanonical: Map<string, string>
}

export function createMacroMentionMaps(macros: readonly FlowMacroOption[]): MacroMentionMaps {
  const canonicalToMention = new Map<string, string>()
  const mentionToCanonical = new Map<string, string>()
  const counts = new Map<string, number>()

  for (const macro of macros) {
    const base = encodeMacroMention(macro.label)
    const count = (counts.get(base) ?? 0) + 1
    counts.set(base, count)
    const mention = count === 1
      ? base
      : base.replace(/}$/, `_${count}}`)
    canonicalToMention.set(macro.token, mention)
    mentionToCanonical.set(mention, macro.token)
  }
  return { canonicalToMention, mentionToCanonical }
}

export function formatMacroMentions(value: string, macros: readonly FlowMacroOption[]): string {
  const { canonicalToMention } = createMacroMentionMaps(macros)
  return [...canonicalToMention.entries()]
    .sort(([left], [right]) => right.length - left.length)
    .reduce((text, [canonical, mention]) => text.split(canonical).join(mention), value)
}

export function parseMacroMentions(value: string, macros: readonly FlowMacroOption[]): string {
  const { mentionToCanonical } = createMacroMentionMaps(macros)
  return value.replace(MENTION, (mention) => mentionToCanonical.get(mention) ?? mention)
}
