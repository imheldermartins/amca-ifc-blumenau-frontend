import { i18n } from '@/lib/i18n'
import type { AccessRole } from '@/services/AccessService'

export const normalizeEmail = (email: string) => email.trim().toLowerCase()
export const roleOptions = (roles: AccessRole[]) => roles.map((role) => ({ value: role.id, label: role.isDefault ? i18n('access.default-role') : role.name }))
export const expirationOptions = () => [{ value: '24h', label: i18n('access.expiration-day') }, { value: '7d', label: i18n('access.expiration-week') }, { value: 'never', label: i18n('access.no-expiration') }]
