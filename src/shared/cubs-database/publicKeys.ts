import type { PublicKeyMetadata } from './types'

export type PublicKeyFallback = 'coluna' | 'opcao' | 'view'

const PUBLIC_KEY_PATTERN = /^[a-z0-9]+(?:_[a-z0-9]+)*$/

/** Normaliza um label para a key estável e legível usada na URL. */
export function normalizePublicKey(label: string, fallback: PublicKeyFallback): string {
  const normalized = label
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
  return normalized || fallback
}

export function isPublicKeyMetadata(value: unknown): value is PublicKeyMetadata {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const candidate = value as Record<string, unknown>
  return (
    typeof candidate.key === 'string' &&
    PUBLIC_KEY_PATTERN.test(candidate.key) &&
    Array.isArray(candidate.aliases) &&
    candidate.aliases.every(
      (alias) => typeof alias === 'string' && PUBLIC_KEY_PATTERN.test(alias),
    )
  )
}

export function parsePublicKeyMetadata(value: unknown): PublicKeyMetadata | null {
  if (!isPublicKeyMetadata(value)) return null
  return {
    key: value.key,
    aliases: [...new Set(value.aliases.filter((alias) => alias !== value.key))],
  }
}

export interface PublicKeyCandidate<T> {
  value: T
  label: string
  metadata?: PublicKeyMetadata | null
}

export interface ReconciledPublicKey<T> {
  value: T
  publicKey: PublicKeyMetadata
  repaired: boolean
}

/**
 * Repara um escopo inteiro de uma vez. Keys e aliases existentes são
 * reservados antes de gerar ausentes, portanto um link antigo nunca passa a
 * apontar para outra entidade.
 */
export function reconcilePublicKeys<T>(
  candidates: readonly PublicKeyCandidate<T>[],
  fallback: PublicKeyFallback,
): ReconciledPublicKey<T>[] {
  const reserved = new Set<string>()
  const accepted = new Map<number, PublicKeyMetadata>()

  candidates.forEach((candidate, index) => {
    const metadata = candidate.metadata
    if (!metadata || reserved.has(metadata.key)) return
    const aliases = metadata.aliases.filter(
      (alias, aliasIndex, all) =>
        alias !== metadata.key &&
        all.indexOf(alias) === aliasIndex &&
        !reserved.has(alias),
    )
    accepted.set(index, { key: metadata.key, aliases })
    reserved.add(metadata.key)
    aliases.forEach((alias) => reserved.add(alias))
  })

  return candidates.map((candidate, index) => {
    const current = accepted.get(index)
    if (current) {
      const original = candidate.metadata
      return {
        value: candidate.value,
        publicKey: current,
        repaired:
          !original ||
          original.key !== current.key ||
          original.aliases.length !== current.aliases.length ||
          original.aliases.some((alias, aliasIndex) => alias !== current.aliases[aliasIndex]),
      }
    }

    const base = normalizePublicKey(candidate.label, fallback)
    let key = base
    let suffix = 2
    while (reserved.has(key)) {
      key = `${base}_${suffix}`
      suffix += 1
    }
    reserved.add(key)
    return {
      value: candidate.value,
      publicKey: { key, aliases: [] },
      repaired: true,
    }
  })
}

export interface PublicKeyResolution<T> {
  status: 'current' | 'alias' | 'unknown' | 'ambiguous'
  value?: T
  currentKey?: string
}

/** Nunca escolhe silenciosamente quando duas entidades reivindicam a key. */
export function resolvePublicKey<T>(
  key: string,
  candidates: readonly { value: T; publicKey: PublicKeyMetadata }[],
): PublicKeyResolution<T> {
  const matches = candidates.filter(
    (candidate) =>
      candidate.publicKey.key === key || candidate.publicKey.aliases.includes(key),
  )
  if (matches.length === 0) return { status: 'unknown' }
  if (matches.length > 1) return { status: 'ambiguous' }
  const match = matches[0]!
  return {
    status: match.publicKey.key === key ? 'current' : 'alias',
    value: match.value,
    currentKey: match.publicKey.key,
  }
}
