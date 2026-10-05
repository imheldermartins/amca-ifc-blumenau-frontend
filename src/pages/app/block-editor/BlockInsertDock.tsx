import type { Editor } from '@tiptap/core'
import { Icon } from '@iconify/react'
import { Button, Tooltip, cn } from 'cubs-components'
import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type PointerEvent,
} from 'react'

import { Modal } from '@components/Modal'
import { Typography } from '@components/Typography'
import { i18n } from '@/lib/i18n'

import {
  DEFAULT_EDITOR_BLOCK_OPTION_ID,
  EDITOR_BLOCK_OPTIONS,
  EDITOR_BLOCK_OPTION_IDS,
  insertBlockFromCatalog,
  insertFormSubmitBlock,
  type EditorBlockOptionId,
} from './blockCatalog'
import type { FormBlockOption } from './editorEnvironmentContext'
import {
  DEFAULT_IMAGE_COMPRESSION_PRESET,
  IMAGE_COMPRESSION_PRESETS,
} from './imageCompression'
import { EDITOR_IMAGE_ACCEPT, insertImageFile } from './imageBlock'

const DOCK_HOVER_DELAY_MS = 2_000

interface BlockInsertDockProps {
  editor: Editor
  forms?: FormBlockOption[]
}

function optionLabel(optionId: EditorBlockOptionId): string {
  return i18n(EDITOR_BLOCK_OPTIONS[optionId].labelKey)
}

export function BlockInsertDock({ editor, forms = [] }: BlockInsertDockProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const hoverTimerRef = useRef<number | null>(null)
  const [dockOpen, setDockOpen] = useState(false)
  const [libraryOpen, setLibraryOpen] = useState(false)
  const [compressing, setCompressing] = useState(false)
  const [imageError, setImageError] = useState<string | null>(null)
  const [selectingForm, setSelectingForm] = useState(false)
  const optionIds = EDITOR_BLOCK_OPTION_IDS.filter((id) => id !== 'form-submit' || forms.length > 0)

  const clearHoverTimer = () => {
    if (hoverTimerRef.current === null) return
    window.clearTimeout(hoverTimerRef.current)
    hoverTimerRef.current = null
  }

  useEffect(() => clearHoverTimer, [])

  const closeDock = () => {
    clearHoverTimer()
    setDockOpen(false)
  }

  const scheduleDock = () => {
    clearHoverTimer()
    if (dockOpen || libraryOpen) return
    hoverTimerRef.current = window.setTimeout(() => {
      hoverTimerRef.current = null
      setDockOpen(true)
    }, DOCK_HOVER_DELAY_MS)
  }

  const selectImage = () => {
    setImageError(null)
    fileInputRef.current?.click()
  }

  const selectOption = (optionId: EditorBlockOptionId) => {
    const option = EDITOR_BLOCK_OPTIONS[optionId]
    if (option.payload.action === 'select-image') {
      selectImage()
      return
    }
    if (option.payload.action === 'select-form') {
      if (forms.length === 1) {
        insertFormSubmitBlock(editor, forms[0]!.viewId)
        closeDock()
        setLibraryOpen(false)
      } else if (forms.length > 1) {
        closeDock()
        setSelectingForm(true)
        setLibraryOpen(true)
      }
      return
    }

    insertBlockFromCatalog(editor, optionId)
    closeDock()
    setLibraryOpen(false)
  }

  const handleDefaultInsert = () => {
    clearHoverTimer()
    insertBlockFromCatalog(editor, DEFAULT_EDITOR_BLOCK_OPTION_ID)
    setDockOpen(false)
  }

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    setCompressing(true)
    setImageError(null)
    void insertImageFile(editor, file)
      .then(() => {
        closeDock()
        setLibraryOpen(false)
      })
      .catch(() => {
        setImageError(i18n('pages.block-editor.block-library.image-error'))
        setLibraryOpen(true)
      })
      .finally(() => setCompressing(false))
  }

  const preventEditorBlur = (event: PointerEvent<HTMLElement>) => {
    event.preventDefault()
  }

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept={EDITOR_IMAGE_ACCEPT}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={handleFileChange}
      />

      <div className="pointer-events-none absolute bottom-6 right-6 z-30">
        <div
          className="pointer-events-auto relative"
          data-block-insert-control
          onPointerEnter={scheduleDock}
          onPointerLeave={closeDock}
        >
          {dockOpen && (
            <div
              role="toolbar"
              aria-label={i18n('pages.block-editor.block-library.dock')}
              data-block-insert-dock
              className={cn(
                'absolute right-[calc(100%-0.25rem)] top-1/2 flex -translate-y-1/2 items-center gap-1',
                'rounded-full border border-light-100/70 bg-glass p-1 pr-3 shadow-xl shadow-dark-900/15',
                'ring-1 ring-light-100/60 backdrop-blur-2xl backdrop-saturate-150',
                'dark:border-divider-contrast dark:shadow-dark-900/40 dark:ring-light-100/5',
              )}
            >
              {optionIds.map((optionId) => {
                const option = EDITOR_BLOCK_OPTIONS[optionId]
                return (
                  <Tooltip key={optionId} content={optionLabel(optionId)} delayDuration={150}>
                    <Button
                      variant="text"
                      color="from-theme"
                      className="size-9 shrink-0 rounded-full p-0"
                      aria-label={optionLabel(optionId)}
                      disabled={compressing}
                      onPointerDown={preventEditorBlur}
                      onClick={() => selectOption(optionId)}
                    >
                      <Icon icon={option.icon} fontSize={17} />
                    </Button>
                  </Tooltip>
                )
              })}

              <span className="mx-0.5 h-6 w-px shrink-0 bg-divider" aria-hidden="true" />
              <Tooltip
                content={i18n('pages.block-editor.block-library.more')}
                delayDuration={150}
              >
                <Button
                  variant="text"
                  color="from-theme"
                  className="size-9 shrink-0 rounded-full p-0"
                  aria-label={i18n('pages.block-editor.block-library.more')}
                  onPointerDown={preventEditorBlur}
                  onClick={() => {
                    closeDock()
                    setLibraryOpen(true)
                  }}
                >
                  <Icon icon="lucide:layout-grid" fontSize={17} />
                </Button>
              </Tooltip>
            </div>
          )}

          <Tooltip
            content={i18n('pages.block-editor.block-library.add-default-help')}
            delayDuration={500}
          >
            <Button
              className="size-11 rounded-full p-0 shadow-lg"
              aria-label={i18n('pages.block-editor.block-library.add')}
              aria-expanded={dockOpen}
              disabled={compressing}
              onPointerDown={preventEditorBlur}
              onClick={handleDefaultInsert}
            >
              <Icon
                icon={compressing ? 'lucide:loader-circle' : 'lucide:plus'}
                fontSize={22}
                className={compressing ? 'animate-spin' : undefined}
              />
            </Button>
          </Tooltip>
        </div>
      </div>

      <Modal
        open={libraryOpen}
        onOpenChange={setLibraryOpen}
        size="lg"
        accessibleTitle={i18n('pages.block-editor.block-library.title')}
        className="space-y-6"
      >
        <section>
          <Typography variant="h2">
            {i18n('pages.block-editor.block-library.title')}
          </Typography>
          <Typography variant="subtitle" className="mt-1">
            {i18n('pages.block-editor.block-library.description')}
          </Typography>

          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {optionIds.map((optionId) => {
              const option = EDITOR_BLOCK_OPTIONS[optionId]
              return (
                <button
                  key={optionId}
                  type="button"
                  disabled={compressing}
                  onClick={() => selectOption(optionId)}
                  className={cn(
                    'group rounded-xl border border-divider bg-contrast/45 p-3 text-left',
                    'transition-[border-color,background-color,box-shadow,transform]',
                    'hover:border-divider-contrast hover:bg-active hover:shadow-md',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-p-purple-500/25',
                    'disabled:pointer-events-none disabled:opacity-50',
                  )}
                >
                  <span className="flex items-center gap-2">
                    <span className="flex size-9 items-center justify-center rounded-lg bg-background text-p-purple">
                      <Icon icon={option.icon} fontSize={18} />
                    </span>
                    <Typography variant="body" as="span" className="font-semibold">
                      {optionLabel(optionId)}
                    </Typography>
                  </span>
                  <Typography variant="caption" as="p" className="mt-2 leading-relaxed">
                    {i18n(option.descriptionKey)}
                  </Typography>
                  <span className="mt-3 inline-flex rounded-full bg-background px-2 py-0.5 font-mono text-[0.68rem] opacity-65">
                    {option.payload.kind}
                  </span>
                </button>
              )
            })}
          </div>
          {selectingForm && forms.length > 1 && (
            <div className="mt-5 rounded-xl border border-divider bg-contrast/30 p-4">
              <Typography variant="h3">Escolha o formulário</Typography>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {forms.map((form) => <button
                  key={form.viewId}
                  type="button"
                  className="flex items-center gap-3 rounded-lg border border-divider bg-background p-3 text-left hover:bg-active"
                  onClick={() => {
                    insertFormSubmitBlock(editor, form.viewId)
                    setSelectingForm(false)
                    setLibraryOpen(false)
                  }}
                >
                  <Icon icon={form.icon ?? 'lucide:send'} className="size-5 text-p-purple" />
                  <span className="text-sm font-medium">{form.label}</span>
                </button>)}
              </div>
            </div>
          )}
        </section>

        <section className="rounded-xl border border-divider bg-contrast/30 p-4">
          <Typography variant="h3">
            {i18n('pages.block-editor.block-library.image-compression')}
          </Typography>
          <Typography variant="subtitle" className="mt-1">
            {i18n('pages.block-editor.block-library.image-compression-help')}
          </Typography>

          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <span className="rounded-full bg-active px-2 py-1">
              {i18n('pages.block-editor.block-library.compression-stage-dimensions')}
            </span>
            <span className="rounded-full bg-active px-2 py-1">
              {i18n('pages.block-editor.block-library.compression-stage-encoding')}
            </span>
            <span className="rounded-full bg-active px-2 py-1">
              {i18n('pages.block-editor.block-library.compression-storage')}
            </span>
          </div>

          <div className="mt-4 flex items-start gap-3 rounded-lg border border-p-purple/35 bg-p-purple-500/10 p-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-background text-p-purple">
              <Icon icon="lucide:gauge" fontSize={18} />
            </span>
            <div>
              <Typography variant="body" as="p" className="font-semibold">
                {i18n(
                  IMAGE_COMPRESSION_PRESETS[DEFAULT_IMAGE_COMPRESSION_PRESET].labelKey,
                )}
              </Typography>
              <Typography variant="caption" as="p" className="mt-1 leading-relaxed">
                {i18n('pages.block-editor.block-library.compression-fixed')}
              </Typography>
            </div>
          </div>

          {imageError && (
            <p role="alert" className="mt-3 text-sm text-p-red">
              {imageError}
            </p>
          )}
        </section>
      </Modal>
    </>
  )
}
