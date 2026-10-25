import type { Editor } from '@tiptap/core'
import { Icon } from '@iconify/react'
import { Button, Dock } from 'cubs-components'
import { useEffect, useRef, useState, type ChangeEvent } from 'react'

import { useModal, type ModalHandle } from '@/hooks/useModal'
import { i18n } from '@/lib/i18n'
import { EDITOR_BLOCK_OPTIONS, EDITOR_BLOCK_OPTION_IDS, insertBlockFromCatalog, insertFormSubmitBlock, type EditorBlockOptionId } from './blockCatalog'
import type { FormBlockOption } from './editorEnvironmentContext'
import { EDITOR_IMAGE_ACCEPT, insertImageFile } from './imageBlock'
import { BlockLibraryContent } from './BlockLibraryContent'

export function BlockInsertDock({ editor, forms = [] }: { editor: Editor; forms?: FormBlockOption[] }) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const libraryModalRef = useRef<ModalHandle | null>(null)
  const [dockOpen, setDockOpen] = useState(false)
  const [compressing, setCompressing] = useState(false)
  const { openModal } = useModal()
  const optionIds = EDITOR_BLOCK_OPTION_IDS.filter((id) => id !== 'form-submit' || forms.length > 0)
  const controlRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!dockOpen) return
    const dismiss = (event: PointerEvent) => {
      if (event.target instanceof Node && !controlRef.current?.contains(event.target)) setDockOpen(false)
    }
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setDockOpen(false) }
    document.addEventListener('pointerdown', dismiss)
    document.addEventListener('keydown', escape)
    return () => { document.removeEventListener('pointerdown', dismiss); document.removeEventListener('keydown', escape) }
  }, [dockOpen])

  const openLibrary = (initialSelectingForm = false, initialImageError: string | null = null) => {
    setDockOpen(false)
    libraryModalRef.current = openModal({
      size: 'md', className: 'space-y-5',
      onClose: () => {
        libraryModalRef.current = null
        // Dialog restores focus after closing; return it to the writing cursor
        // once that restoration has finished, so an empty line can show its hint.
        requestAnimationFrame(() => {
          if (!editor.isDestroyed && !(document.activeElement instanceof HTMLElement && document.activeElement.closest('[data-editor-math-popup]'))) {
            editor.commands.focus(undefined, { scrollIntoView: false })
          }
        })
      },
      content: ({ closeModal }) => <BlockLibraryContent editor={editor} forms={forms}
        initialSelectingForm={initialSelectingForm} initialImageError={initialImageError}
        onClose={closeModal} onCompressingChange={setCompressing} />,
    })
  }
  const selectOption = (optionId: EditorBlockOptionId) => {
    const option = EDITOR_BLOCK_OPTIONS[optionId]
    if (option.payload.action === 'select-image') { fileInputRef.current?.click(); return }
    if (option.payload.action === 'select-form') {
      if (forms.length === 1) insertFormSubmitBlock(editor, forms[0]!.viewId)
      else if (forms.length > 1) { openLibrary(true); return }
    } else insertBlockFromCatalog(editor, optionId)
    setDockOpen(false)
  }
  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setCompressing(true)
    void insertImageFile(editor, file)
      .then(() => { setDockOpen(false); libraryModalRef.current?.closeModal() })
      .catch(() => openLibrary(false, i18n('pages.block-editor.block-library.image-error')))
      .finally(() => setCompressing(false))
  }
  return <div ref={controlRef} className="sticky bottom-4 z-30 mt-6 w-full" data-block-insert-control>
    <input ref={fileInputRef} type="file" accept={EDITOR_IMAGE_ACCEPT} className="sr-only" tabIndex={-1} aria-hidden="true" onChange={handleFileChange} />
    {dockOpen && <div className="mb-3" data-block-insert-dock>
      <Dock label={i18n('pages.block-editor.block-library.dock')}
        items={optionIds.map((id) => ({ name: i18n(EDITOR_BLOCK_OPTIONS[id].labelKey), icon: EDITOR_BLOCK_OPTIONS[id].icon, action: () => selectOption(id), disabled: compressing }))}
        more={{ name: i18n('pages.block-editor.block-library.more'), icon: 'lucide:layout-grid', action: () => openLibrary() }} />
    </div>}
    <div className="flex justify-center">
      <Button className="size-12 rounded-2xl p-0 shadow-lg" aria-label={i18n('pages.block-editor.block-library.add')}
        aria-expanded={dockOpen} disabled={compressing} onPointerDown={(event) => event.preventDefault()} onClick={() => setDockOpen((open) => !open)}>
        <Icon icon={compressing ? 'lucide:loader-circle' : dockOpen ? 'lucide:x' : 'lucide:plus'} fontSize={24} className={compressing ? 'animate-spin' : undefined} />
      </Button>
    </div>
  </div>
}
