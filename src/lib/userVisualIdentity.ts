import {
  USER_COLORS,
  type UserIdentity,
  type UserVisualIdentity,
} from '@/types/user'

const NAME_CONNECTORS = new Set(['DA', 'DAS', 'DE', 'DO', 'DOS', 'E'])
const SLUG_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'

interface IndexedUser {
  index: number
  user: UserIdentity
  key: string
  words: string[]
  baseSlug: string
}

function asciiWords(value: string): string[] {
  return (
    value
      .normalize('NFKD')
      .replace(/\p{M}/gu, '')
      .toUpperCase()
      .match(/[A-Z0-9]+/g) ?? []
  )
}

function meaningfulWords(user: Pick<UserIdentity, 'name' | 'email'>): string[] {
  const nameWords = asciiWords(user.name?.trim() || '')
  const sourceWords = nameWords.length > 0
    ? nameWords
    : asciiWords(user.email.split('@')[0] ?? '')
  const withoutConnectors = sourceWords.filter((word) => !NAME_CONNECTORS.has(word))
  return withoutConnectors.length > 0 ? withoutConnectors : (sourceWords.length > 0 ? sourceWords : ['U'])
}

/**
 * Forma as iniciais convencionais antes de considerar colisões na página:
 * uma letra para nome simples e primeira + última para nome composto.
 */
export function getBaseUserSlug(user: Pick<UserIdentity, 'name' | 'email'>): string {
  const words = meaningfulWords(user)
  if (words.length === 1) return words[0]?.[0] ?? 'U'
  return `${words[0]?.[0] ?? 'U'}${words.at(-1)?.[0] ?? 'U'}`
}

function stableUserKey(user: UserIdentity): string {
  return `${user.id}\u0000${user.email.toLowerCase()}\u0000${user.name ?? ''}`
}

function hash(value: string): number {
  let result = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index)
    result = Math.imul(result, 16777619)
  }
  return result >>> 0
}

function uniqueCharacters(value: string): string[] {
  return [...new Set(value.match(/[A-Z0-9]/g) ?? [])]
}

function duplicateSlugCandidates(entry: IndexedUser): string[] {
  const { baseSlug, key, words } = entry
  const compactName = words.join('')
  const first = words[0] ?? 'U'
  const last = words.at(-1) ?? first
  const middle = words.slice(1, -1).map((word) => word[0] ?? '').join('')
  const prefix = baseSlug.length === 1
    ? `${compactName}${baseSlug}`.slice(0, 2).padEnd(2, baseSlug)
    : baseSlug
  const semanticCharacters = baseSlug.length === 1
    ? compactName.slice(2)
    : `${last.slice(1)}${middle}${first.slice(1)}${compactName}`
  const start = hash(key) % SLUG_ALPHABET.length
  const fallbackCharacters = `${SLUG_ALPHABET.slice(start)}${SLUG_ALPHABET.slice(0, start)}`

  return uniqueCharacters(`${semanticCharacters}${fallbackCharacters}`).map(
    (character) => `${prefix}${character}`,
  )
}

function assignSlugs(entries: readonly IndexedUser[]): string[] {
  const baseCounts = new Map<string, number>()
  for (const entry of entries) {
    baseCounts.set(entry.baseSlug, (baseCounts.get(entry.baseSlug) ?? 0) + 1)
  }

  const assigned = entries.map((entry) => entry.baseSlug)
  const used = new Set(
    entries
      .filter((entry) => baseCounts.get(entry.baseSlug) === 1)
      .map((entry) => entry.baseSlug),
  )
  const duplicateGroups = new Map<string, IndexedUser[]>()

  for (const entry of entries) {
    if ((baseCounts.get(entry.baseSlug) ?? 0) < 2) continue
    const group = duplicateGroups.get(entry.baseSlug) ?? []
    group.push(entry)
    duplicateGroups.set(entry.baseSlug, group)
  }

  for (const [, group] of [...duplicateGroups].sort(([left], [right]) => left.localeCompare(right))) {
    group.sort((left, right) => left.key.localeCompare(right.key) || left.index - right.index)
    for (const entry of group) {
      const candidate = duplicateSlugCandidates(entry).find((slug) => !used.has(slug))
      // Com até 36 colisões do mesmo prefixo sempre há candidato; o fallback
      // apenas mantém o componente renderizável em conjuntos artificiais maiores.
      const slug = candidate ?? duplicateSlugCandidates(entry)[0] ?? `${entry.baseSlug}U`.slice(0, 3)
      assigned[entry.index] = slug
      used.add(slug)
    }
  }

  return assigned
}

function assignColors(entries: readonly IndexedUser[]): UserVisualIdentity['color'][] {
  const assigned: UserVisualIdentity['color'][] = Array.from(
    { length: entries.length },
    () => USER_COLORS[0],
  )
  const ordered = [...entries].sort(
    (left, right) => left.key.localeCompare(right.key) || left.index - right.index,
  )
  let available = new Set(USER_COLORS)

  for (const entry of ordered) {
    if (available.size === 0) available = new Set(USER_COLORS)
    const preferredIndex = hash(entry.key) % USER_COLORS.length
    let color = USER_COLORS[preferredIndex]
    for (let offset = 0; offset < USER_COLORS.length; offset += 1) {
      const candidate = USER_COLORS[(preferredIndex + offset) % USER_COLORS.length]
      if (candidate && available.has(candidate)) {
        color = candidate
        break
      }
    }
    assigned[entry.index] = color
    available.delete(color)
  }

  return assigned
}

/**
 * Projeta avatares para a audiência completa de uma página.
 *
 * A ordem de entrada é preservada, mas a alocação usa a identidade estável do
 * usuário: reordenar a lista não muda sua cor ou suas iniciais. Cores não se
 * repetem enquanto ainda houver uma opção livre na paleta; só então começa um
 * novo ciclo. Slugs crescem para três caracteres apenas quando a forma base
 * colide com a de outro participante.
 */
export function assignUserVisualIdentities(
  users: readonly UserIdentity[],
): UserVisualIdentity[] {
  const entries: IndexedUser[] = users.map((user, index) => ({
    index,
    user,
    key: stableUserKey(user),
    words: meaningfulWords(user),
    baseSlug: getBaseUserSlug(user),
  }))
  const slugs = assignSlugs(entries)
  const colors = assignColors(entries)

  return entries.map((entry) => ({
    ...entry.user,
    slug: slugs[entry.index] ?? entry.baseSlug,
    color: colors[entry.index] ?? USER_COLORS[0],
  }))
}
