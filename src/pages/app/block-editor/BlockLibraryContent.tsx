import type { Editor } from '@tiptap/core'
import { Icon } from '@iconify/react'
import { useRef, useState, type ChangeEvent } from 'react'

import { i18n } from '@/lib/i18n'
import { EDITOR_BLOCK_OPTIONS, EDITOR_BLOCK_SECTIONS, insertBlockFromCatalog, insertFormSubmitBlock, type EditorBlockOptionId } from './blockCatalog'
import type { FormBlockOption } from './editorEnvironmentContext'
import { EDITOR_IMAGE_ACCEPT, insertImageFile } from './imageBlock'

export function BlockLibraryContent({ editor, forms, initialSelectingForm = false, initialImageError = null, onClose, onCompressingChange }: {
  editor: Editor; forms: FormBlockOption[]; initialSelectingForm?: boolean; initialImageError?: string | null
  onClose: () => void; onCompressingChange?: (compressing: boolean) => void
}) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [compressing, setCompressing] = useState(false)
  const [imageError, setImageError] = useState<string | null>(initialImageError)
  const [selectingForm, setSelectingForm] = useState(initialSelectingForm)
  const selectOption = (id: EditorBlockOptionId) => {
    const option = EDITOR_BLOCK_OPTIONS[id]
    if (option.payload.action === 'select-image') { setImageError(null); fileInputRef.current?.click(); return }
    if (option.payload.action === 'select-form' && forms.length > 1) { setSelectingForm(true); return }
    if (option.payload.action === 'select-form' && forms[0]) insertFormSubmitBlock(editor, forms[0].viewId)
    else insertBlockFromCatalog(editor, id)
    onClose()
  }
  const upload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setCompressing(true); onCompressingChange?.(true); setImageError(null)
    void insertImageFile(editor, file).then(onClose)
      .catch(() => setImageError(i18n('pages.block-editor.block-library.image-error')))
      .finally(() => { setCompressing(false); onCompressingChange?.(false) })
  }
  return <div className="space-y-6">
    <input ref={fileInputRef} type="file" accept={EDITOR_IMAGE_ACCEPT} className="sr-only" tabIndex={-1} aria-hidden="true" onChange={upload} />
    <header className="flex items-center gap-3">
      <span className="flex size-11 items-center justify-center rounded-full bg-p-purple/10 text-p-purple"><Icon icon="lucide:blocks" fontSize={23} /></span>
      <div><h2 className="text-lg font-semibold">{i18n('pages.block-editor.block-library.title')}</h2>
        <p className="mt-0.5 text-sm opacity-60">{i18n('pages.block-editor.block-library.description')}</p></div>
    </header>
    {EDITOR_BLOCK_SECTIONS.map((section) => <section key={section.labelKey} aria-label={i18n(section.labelKey)}>
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider opacity-55">{i18n(section.labelKey)}</h3>
      <div className="grid grid-cols-3 gap-x-3 gap-y-4 sm:grid-cols-5">
        {section.options.filter((id) => id !== 'form-submit' || forms.length > 0).map((id) => {
          const option = EDITOR_BLOCK_OPTIONS[id]
          return <button key={id} type="button" disabled={compressing} onClick={() => selectOption(id)}
            className="group flex min-w-0 flex-col items-center gap-2 rounded-xl py-1 text-center focus-visible:outline-none disabled:opacity-40">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-p-purple/10 text-p-purple transition group-hover:scale-110 group-hover:bg-p-purple/20 group-focus-visible:ring-2 group-focus-visible:ring-p-purple/40 motion-reduce:transform-none"><Icon icon={option.icon} fontSize={23} /></span>
            <span className="text-xs font-medium leading-4">{i18n(option.labelKey)}</span>
          </button>
        })}
      </div>
    </section>)}
    {selectingForm && forms.length > 1 && <section aria-label={i18n('pages.block-editor.block-library.choose-form')}>
      <h3 className="mb-3 text-sm font-semibold">{i18n('pages.block-editor.block-library.choose-form')}</h3>
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">{forms.map((form) => <button key={form.viewId} type="button" className="group flex min-w-0 flex-col items-center gap-2 rounded-xl py-1 text-center focus-visible:outline-none"
        onClick={() => { insertFormSubmitBlock(editor, form.viewId); onClose() }}>
        <span className="flex size-12 items-center justify-center rounded-full bg-p-purple/10 text-p-purple transition group-hover:scale-110 group-focus-visible:ring-2 group-focus-visible:ring-p-purple/40"><Icon icon={form.icon ?? 'lucide:send'} fontSize={23} /></span><span className="text-xs font-medium leading-4">{form.label}</span>
      </button>)}</div>
    </section>}
    {imageError && <p role="alert" className="text-sm text-p-red">{imageError}</p>}
  </div>
}
