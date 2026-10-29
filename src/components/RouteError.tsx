import { AlertTriangle } from 'lucide-react'
import type { ErrorComponentProps } from '@tanstack/react-router'

import { i18n } from '@/lib/i18n'
import { Button } from '@/shared/cubs-components/Button'

export function RouteError({ error, reset }: ErrorComponentProps) {
  const log = error.stack || `${error.name}: ${error.message}`

  return (
    <div className="flex min-h-dvh w-full items-center justify-center bg-background p-4 text-foreground sm:p-8">
      <section role="alert" aria-labelledby="route-error-title" className="flex w-full min-w-0 max-w-2xl flex-col items-center gap-5 rounded-xl border border-divider bg-background p-6 text-center shadow-lg sm:p-8">
        <div className="flex size-14 items-center justify-center rounded-full bg-red-500/10 text-red-500">
          <AlertTriangle size={28} aria-hidden="true" />
        </div>
        <div className="space-y-2">
          <h1 id="route-error-title" className="text-xl font-semibold">{i18n('route-error.title')}</h1>
          <p className="text-sm text-foreground/70">{i18n('route-error.description')}</p>
        </div>
        <div className="w-full min-w-0 space-y-2 text-left">
          <h2 className="text-sm font-semibold">{i18n('route-error.log')}</h2>
          <pre tabIndex={0} aria-label={i18n('route-error.log')} className="max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-lg border border-divider bg-red-500/5 p-4 text-xs text-foreground [overflow-wrap:anywhere]">{log}</pre>
        </div>
        <div className="flex flex-wrap justify-center gap-3">
          <Button onClick={reset}>{i18n('route-error.retry')}</Button>
          <Button variant="outlined" color="from-theme" onClick={() => window.location.reload()}>{i18n('route-error.reload')}</Button>
        </div>
      </section>
    </div>
  )
}
