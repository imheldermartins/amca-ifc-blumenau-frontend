import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { Icon } from '@iconify/react'
import { Button, Switch } from 'cubs-components'
import { i18n } from '@/lib/i18n'
import { pagePdfService } from '@/services/PagePdfService'
const PdfPreview = lazy(() => import('./PdfPreview'))

export function PdfExportContent({ pageId, selectedIds = [], beforeGenerate }: { pageId: string; selectedIds?: string[]; beforeGenerate?: () => Promise<void> }) {
  const batch = selectedIds.length > 1
  const [includePageTitle, setIncludePageTitle] = useState(true)
  const [loading, setLoading] = useState(true)
  const [downloading, setDownloading] = useState(false)
  const [error, setError] = useState('')
  const [file, setFile] = useState<{ blob: Blob; filename: string; key: string } | null>(null)
  const mounted = useRef(true), generation = useRef(0)
  const selection = selectedIds.join(',')
  const requestKey = JSON.stringify([pageId, selection, includePageTitle])
  const ready = file?.key === requestKey ? file : null
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; generation.current++ } }, [])
  const generate = useCallback(async () => {
    const request = ++generation.current
    setLoading(true); setError(''); setFile(null)
    if (selection.split(',').filter(Boolean).length > 50) { setLoading(false); setError(i18n('pdf.limit')); return }
    try {
      await beforeGenerate?.()
      if (!mounted.current || request !== generation.current) return
      const result = await pagePdfService.generate(pageId, selection ? selection.split(',') : undefined, { includePageTitle })
      if (mounted.current && request === generation.current) setFile({ ...result, key: requestKey })
    } catch { if (mounted.current && request === generation.current) setError(i18n('pdf.error')) }
    finally { if (mounted.current && request === generation.current) setLoading(false) }
  }, [pageId, selection, includePageTitle, beforeGenerate, requestKey])
  useEffect(() => { void generate() }, [generate])
  const download = async () => {
    if (!ready || loading || downloading) return
    setDownloading(true); setError('')
    try {
      const url = URL.createObjectURL(ready.blob)
      const link = document.createElement('a'); link.href = url; link.download = ready.filename; document.body.append(link); link.click(); link.remove()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch { if (mounted.current) setError(i18n('pdf.error')) }
    finally { if (mounted.current) setDownloading(false) }
  }
  const filename = ready?.filename ?? i18n('pdf.generating')
  return <section className={`flex ${batch ? 'h-[min(40dvh,320px)]' : 'h-[min(78dvh,900px)]'} min-h-0 flex-col`} aria-label={i18n(batch ? 'pdf.batch' : selectedIds.length ? 'pdf.selected-page' : 'pdf.title')} aria-busy={loading || downloading}>
    <header className="flex shrink-0 flex-wrap items-center gap-3 border-b border-divider px-4 pb-3">
      <div className="mr-auto min-w-0"><p className="truncate text-sm font-semibold" title={filename} data-pdf-filename>{filename}</p>{selectedIds.length > 0 && <p className="mt-0.5 text-xs opacity-55">{i18n('pdf.selected', { count: selectedIds.length })}</p>}</div>
      <Switch aria-label={i18n('pdf.include-page-title')} label={i18n('pdf.include-page-title')} checked={includePageTitle} disabled={downloading} onCheckedChange={setIncludePageTitle} />
      <Button className="gap-2" disabled={loading || downloading || selectedIds.length > 50 || !ready} onClick={() => { void download() }}><Icon icon={downloading ? 'lucide:loader-circle' : 'lucide:download'} aria-hidden="true" className={`size-4 ${downloading ? 'animate-spin' : ''}`} />{i18n(downloading ? 'pdf.generating' : batch ? 'pdf.download-zip' : 'pdf.download')}</Button>
    </header>
    <div className={`min-h-0 flex-1 bg-contrast/35 p-4 ${batch ? 'grid place-content-center text-center' : 'overflow-auto'}`} data-pdf-scroll>
      {loading && <div role="status" className="grid h-full min-h-32 place-content-center justify-items-center gap-3 text-sm opacity-60"><Icon icon="lucide:loader-circle" className="size-6 animate-spin" />{i18n('pdf.generating')}</div>}
      {error && <div className="grid h-full min-h-32 place-content-center justify-items-center gap-3"><p role="alert" className="text-sm text-p-red">{error}</p><Button variant="outlined" onClick={() => { void generate() }}>{i18n('pdf.retry')}</Button></div>}
      {ready && (batch ? <p role="status" className="text-sm" data-pdf-batch-success>{i18n('pdf.generated', { filename: ready.filename })}</p> : <Suspense fallback={<p role="status">{i18n('pdf.rendering')}</p>}><PdfPreview file={ready.blob} /></Suspense>)}
    </div>
  </section>
}
