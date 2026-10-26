const tokens = () => /@\{([^{}]{1,1600})\}/g

/** Presentation only. Persisted references must never be replaced by their labels. */
export function displayMentionText(text: string, resolve?: (text: string) => string, unavailable = 'Indisponível'): string {
  let budget = 100
  const expand = (source: string, path: Set<string>): string => source.replace(tokens(), (token: string) => {
    if (!resolve || path.has(token) || path.size >= 8 || --budget < 0) return unavailable
    const value = resolve(token)
    if (value === token || value.length > 20_000) return unavailable
    return expand(value, new Set(path).add(token))
  })
  return expand(text, new Set())
}

interface MentionSpan { from: number; to: number; rawFrom: number; rawTo: number }
export interface MentionProjection { raw: string; text: string; spans: MentionSpan[] }

export function projectMentions(raw: string, resolve?: (text: string) => string, unavailable?: string): MentionProjection {
  const spans: MentionSpan[] = []
  let text = '', offset = 0
  for (const match of raw.matchAll(tokens())) {
    text += raw.slice(offset, match.index)
    const from = text.length
    // An empty reference still needs a visible, selectable editing target.
    text += displayMentionText(match[0], resolve, unavailable) || 'Sem valor'
    offset = match.index + match[0].length
    spans.push({ from, to: text.length, rawFrom: match.index, rawTo: offset })
  }
  return { raw, text: text + raw.slice(offset), spans }
}

export function rawMentionOffset(projection: MentionProjection, position: number, end = false): number {
  let delta = 0
  for (const span of projection.spans) {
    if (position <= span.from) break
    if (position < span.to) return end ? span.rawTo : span.rawFrom
    delta += (span.rawTo - span.rawFrom) - (span.to - span.from)
  }
  return position + delta
}

export function visibleMentionOffset(projection: MentionProjection, position: number): number {
  let delta = 0
  for (const span of projection.spans) {
    if (position <= span.rawFrom) break
    if (position < span.rawTo) return span.to
    delta += (span.rawTo - span.rawFrom) - (span.to - span.from)
  }
  return position - delta
}

/** Apply a native text edit to the original template, keeping untouched references intact. */
export function editMentionProjection(projection: MentionProjection, next: string, selection?: { start: number; end: number } | null) {
  const previous = projection.text
  let from = 0, to = previous.length, nextTo = next.length
  // The native selection disambiguates edits beside identical labels/text.
  if (selection && next.startsWith(previous.slice(0, selection.start)) && next.endsWith(previous.slice(selection.end))
    && next.length >= selection.start + previous.length - selection.end) {
    from = selection.start; to = selection.end; nextTo = next.length - (previous.length - to)
  } else {
    while (from < previous.length && from < next.length && previous[from] === next[from]) from++
    while (to > from && nextTo > from && previous[to - 1] === next[nextTo - 1]) { to--; nextTo-- }
  }
  const start = rawMentionOffset(projection, from)
  const end = rawMentionOffset(projection, to, true)
  const inserted = next.slice(from, nextTo)
  return { value: projection.raw.slice(0, start) + inserted + projection.raw.slice(end), cursor: start + inserted.length }
}
