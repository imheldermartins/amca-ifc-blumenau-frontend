import { i18n } from '@/lib/i18n'

export function AccessFeedback({ error = false, message }: { error?: boolean; message?: string }) {
  return <p role={error ? 'alert' : 'status'} className={`my-3 text-sm ${error ? 'text-p-red' : 'text-foreground/60'}`}>{message ?? i18n(error ? 'access.error' : 'common.carregando')}</p>
}
