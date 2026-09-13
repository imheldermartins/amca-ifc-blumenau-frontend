/** Apenas rotas privadas na mesma origem. */
export function readAuthReturnTo(value: unknown): string | undefined {
  if (typeof value !== 'string' || !/^\/[a-z]{2}-[a-z]{2}\/(?:organizations|access|workspaces|myworkspace|page|invite)(?:\/|\?|$)/i.test(value)) return undefined
  if (/[\\\r\n]/.test(value)) return undefined
  return value
}
