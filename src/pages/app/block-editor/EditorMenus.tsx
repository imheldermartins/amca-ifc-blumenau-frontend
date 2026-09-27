import type { Editor } from '@tiptap/core'
import { useEditorState } from '@tiptap/react'
import { BubbleMenu } from '@tiptap/react/menus'
import { Icon } from '@iconify/react'
import { Button, FilePicker, Popover, TextField, cn } from 'cubs-components'
import { useCallback, useRef, useState, type ReactNode } from 'react'

import { Typography } from '@components/Typography'
import { i18n } from '@/lib/i18n'

import { adjustCurrentBlockIndent } from './editorExtensions'
import { EDITOR_IMAGE_ACCEPT, insertImageFile } from './imageBlock'

interface EditorMenusProps {
  editor: Editor
}

interface MenuGroupProps {
  label: string
  icon: string
  children: ReactNode
}

interface ToolbarButtonProps {
  label: string
  icon?: string
  text?: string
  active?: boolean
  onSelect: () => void
}

function ToolbarButton({ label, icon, text, active, onSelect }: ToolbarButtonProps) {
  return (
    <Button
      variant="text"
      color="from-theme"
      className={cn('size-9 p-0', active && 'bg-active')}
      aria-label={label}
      aria-pressed={active}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onSelect}
    >
      {icon && <Icon icon={icon} fontSize={17} />}
      {text && (
        <Typography variant="caption" as="span" className="font-semibold text-foreground">
          {text}
        </Typography>
      )}
    </Button>
  )
}

function ImageUploadButton({ editor, onSelect }: EditorMenusProps & { onSelect?: () => void }) {
  return (
    <FilePicker
      accept={EDITOR_IMAGE_ACCEPT}
      label={i18n('pages.block-editor.toolbar.image-upload')}
      icon="lucide:image-up"
      variant="text"
      color="from-theme"
      className="size-9 p-0"
      onMouseDown={(event) => event.preventDefault()}
      onFileSelect={(file) => {
        onSelect?.()
        void insertImageFile(editor, file).catch(console.error)
      }}
    />
  )
}

function MenuGroup({ label, icon, children }: MenuGroupProps) {
  return (
    <Popover
      side="top"
      align="center"
      sideOffset={8}
      className="p-2"
      trigger={
        <Button
          variant="text"
          color="from-theme"
          className="size-9 p-0"
          aria-label={label}
          onMouseDown={(event) => event.preventDefault()}
        >
          <Icon icon={icon} fontSize={17} />
        </Button>
      }
    >
      {children}
    </Popover>
  )
}

function EmphasisGroup({ editor }: EditorMenusProps) {
  return (
    <MenuGroup label={i18n('pages.block-editor.toolbar.emphasis')} icon="lucide:bold">
      <div className="flex items-center gap-1">
        <ToolbarButton
          label={i18n('pages.block-editor.toolbar.bold')}
          icon="lucide:bold"
          active={editor.isActive('bold')}
          onSelect={() => editor.chain().focus().toggleBold().run()}
        />
        <ToolbarButton
          label={i18n('pages.block-editor.toolbar.italic')}
          icon="lucide:italic"
          active={editor.isActive('italic')}
          onSelect={() => editor.chain().focus().toggleItalic().run()}
        />
        <ToolbarButton
          label={i18n('pages.block-editor.toolbar.underline')}
          icon="lucide:underline"
          active={editor.isActive('underline')}
          onSelect={() => editor.chain().focus().toggleUnderline().run()}
        />
      </div>
    </MenuGroup>
  )
}

type InsertMode = 'actions' | 'link' | 'equation'

function InsertGroup({ editor }: EditorMenusProps) {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<InsertMode>('actions')
  const [value, setValue] = useState('')

  const close = () => {
    setOpen(false)
    setMode('actions')
    setValue('')
  }

  const startLink = () => {
    const href = editor.getAttributes('link').href
    setValue(typeof href === 'string' ? href : 'https://')
    setMode('link')
  }

  const applyLink = () => {
    const href = value.trim()
    if (!href) editor.chain().focus().extendMarkRange('link').unsetLink().run()
    else editor.chain().focus().extendMarkRange('link').setLink({ href }).run()
    close()
  }

  const applyEquation = () => {
    const latex = value.trim()
    if (latex) editor.chain().focus().insertInlineMath({ latex }).run()
    close()
  }

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen)
        if (!nextOpen) setMode('actions')
      }}
      side="top"
      align="center"
      sideOffset={8}
      className="p-2"
      trigger={
        <Button
          variant="text"
          color="from-theme"
          className="size-9 p-0"
          aria-label={i18n('pages.block-editor.toolbar.insert')}
          onMouseDown={(event) => event.preventDefault()}
        >
          <Icon icon="lucide:braces" fontSize={17} />
        </Button>
      }
    >
      {mode === 'actions' ? (
        <div className="flex items-center gap-1">
          <ToolbarButton
            label={i18n('pages.block-editor.toolbar.link')}
            icon="lucide:link"
            active={editor.isActive('link')}
            onSelect={startLink}
          />
          <ToolbarButton
            label={i18n('pages.block-editor.toolbar.code')}
            icon="lucide:code-2"
            active={editor.isActive('code')}
            onSelect={() => {
              editor.chain().focus().toggleCode().run()
              close()
            }}
          />
          <ToolbarButton
            label={i18n('pages.block-editor.toolbar.equation')}
            icon="lucide:sigma"
            onSelect={() => {
              setValue('x^2 + y^2 = z^2')
              setMode('equation')
            }}
          />
          <ImageUploadButton editor={editor} onSelect={close} />
        </div>
      ) : (
        <div className="flex w-72 items-end gap-2">
          <TextField
            size="sm"
            surface="background"
            className="min-w-0 flex-1"
            label={i18n(
              mode === 'link'
                ? 'pages.block-editor.toolbar.link-value'
                : 'pages.block-editor.toolbar.equation-value',
            )}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== 'Enter') return
              event.preventDefault()
              if (mode === 'link') applyLink()
              else applyEquation()
            }}
          />
          <Button className="h-9 px-3" onClick={mode === 'link' ? applyLink : applyEquation}>
            <Icon icon="lucide:check" fontSize={16} />
            <Typography variant="caption" as="span" className="sr-only">
              {i18n('pages.block-editor.toolbar.apply')}
            </Typography>
          </Button>
        </div>
      )}
    </Popover>
  )
}

const COLORS = [
  {
    id: 'purple',
    labelKey: 'pages.block-editor.colors.purple',
    value: 'var(--p-purple)',
    highlight: 'color-mix(in oklab, var(--p-purple) 28%, transparent)',
    className: 'bg-p-purple',
  },
  {
    id: 'blue',
    labelKey: 'pages.block-editor.colors.blue',
    value: 'var(--p-blue)',
    highlight: 'color-mix(in oklab, var(--p-blue) 28%, transparent)',
    className: 'bg-p-blue',
  },
  {
    id: 'green',
    labelKey: 'pages.block-editor.colors.green',
    value: 'var(--p-green)',
    highlight: 'color-mix(in oklab, var(--p-green) 28%, transparent)',
    className: 'bg-p-green',
  },
  {
    id: 'red',
    labelKey: 'pages.block-editor.colors.red',
    value: 'var(--p-red)',
    highlight: 'color-mix(in oklab, var(--p-red) 28%, transparent)',
    className: 'bg-p-red',
  },
] as const

interface ColorSwatchProps {
  label: string
  className: string
  active: boolean
  onSelect: () => void
}

function ColorSwatch({ label, className, active, onSelect }: ColorSwatchProps) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      className={cn(
        'size-6 rounded-full border-2 border-background shadow-sm transition-transform hover:scale-110',
        className,
        active && 'ring-2 ring-foreground ring-offset-1 ring-offset-background',
      )}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onSelect}
    />
  )
}

function ColorGroup({ editor }: EditorMenusProps) {
  return (
    <MenuGroup label={i18n('pages.block-editor.toolbar.colors')} icon="lucide:palette">
      <div className="flex w-56 flex-col gap-3 p-1">
        <div className="flex items-center justify-between gap-3">
          <Typography variant="caption" as="span">
            {i18n('pages.block-editor.toolbar.text-color')}
          </Typography>
          <div className="flex items-center gap-1.5">
            {COLORS.map((color) => (
              <ColorSwatch
                key={color.id}
                label={i18n(color.labelKey)}
                className={color.className}
                active={editor.isActive('textStyle', { color: color.value })}
                onSelect={() => editor.chain().focus().setColor(color.value).run()}
              />
            ))}
            <ToolbarButton
              label={i18n('pages.block-editor.toolbar.clear-color')}
              icon="lucide:rotate-ccw"
              onSelect={() => editor.chain().focus().unsetColor().run()}
            />
          </div>
        </div>
        <div className="flex items-center justify-between gap-3">
          <Typography variant="caption" as="span">
            {i18n('pages.block-editor.toolbar.markup-color')}
          </Typography>
          <div className="flex items-center gap-1.5">
            {COLORS.map((color) => (
              <ColorSwatch
                key={color.id}
                label={i18n(color.labelKey)}
                className={color.className}
                active={editor.isActive('highlight', { color: color.highlight })}
                onSelect={() =>
                  editor.chain().focus().setHighlight({ color: color.highlight }).run()
                }
              />
            ))}
            <ToolbarButton
              label={i18n('pages.block-editor.toolbar.clear-markup')}
              icon="lucide:rotate-ccw"
              onSelect={() => editor.chain().focus().unsetHighlight().run()}
            />
          </div>
        </div>
      </div>
    </MenuGroup>
  )
}

function HeadingGroup({ editor }: EditorMenusProps) {
  return (
    <MenuGroup label={i18n('pages.block-editor.toolbar.headings')} icon="lucide:heading">
      <div className="flex items-center gap-1">
        {([1, 2, 3] as const).map((level) => (
          <ToolbarButton
            key={level}
            label={i18n('pages.block-editor.toolbar.heading', { level })}
            text={`H${level}`}
            active={editor.isActive('heading', { level })}
            onSelect={() => editor.chain().focus().toggleHeading({ level }).run()}
          />
        ))}
      </div>
    </MenuGroup>
  )
}

function isListSelected(editor: Editor): boolean {
  return (
    !editor.state.selection.empty &&
    (editor.isActive('taskList') ||
      editor.isActive('bulletList') ||
      editor.isActive('orderedList'))
  )
}

function ListIndentControls({ editor }: EditorMenusProps) {
  return (
    <>
      <ToolbarButton
        label={i18n('pages.block-editor.toolbar.outdent')}
        icon="lucide:indent-decrease"
        onSelect={() => {
          editor.chain().focus().run()
          adjustCurrentBlockIndent(editor, -1)
        }}
      />
      <ToolbarButton
        label={i18n('pages.block-editor.toolbar.indent')}
        icon="lucide:indent-increase"
        onSelect={() => {
          editor.chain().focus().run()
          adjustCurrentBlockIndent(editor, 1)
        }}
      />
    </>
  )
}

export function EditorMenus({ editor }: EditorMenusProps) {
  const selectionRef = useRef(editor.state.selection)
  const menuState = useEditorState({
    editor,
    selector: ({ editor: currentEditor }) => {
      const currentSelection = currentEditor.state.selection
      selectionRef.current = currentSelection
      return {
        from: currentSelection.from,
        to: currentSelection.to,
        empty: currentSelection.empty,
        listSelected: isListSelected(currentEditor),
        activeFormatting: [
          currentEditor.isActive('bold'),
          currentEditor.isActive('italic'),
          currentEditor.isActive('underline'),
          currentEditor.isActive('link'),
          currentEditor.isActive('code'),
          currentEditor.getAttributes('textStyle').color ?? '',
          currentEditor.getAttributes('highlight').color ?? '',
          currentEditor.getAttributes('heading').level ?? '',
        ].join('|'),
      }
    },
  })
  const shouldShowBubbleMenu = useCallback(({
    state,
    from,
    to,
  }: {
    state: typeof editor.state
    from: number
    to: number
  }) => {
    selectionRef.current = state.selection
    return !selectionRef.current.empty && from !== to
  }, [])

  return (
    <>
      <BubbleMenu
        editor={editor}
        pluginKey="cubs-rich-text-bubble-menu"
        updateDelay={0}
        resizeDelay={0}
        shouldShow={shouldShowBubbleMenu}
        options={{ placement: 'top', offset: 10 }}
        className="flex items-center gap-1 rounded-lg border border-divider-contrast bg-glass p-1 shadow-xl backdrop-blur-md"
      >
        <EmphasisGroup editor={editor} />
        <span className="mx-0.5 h-6 w-px bg-divider" aria-hidden="true" />
        <InsertGroup editor={editor} />
        <span className="mx-0.5 h-6 w-px bg-divider" aria-hidden="true" />
        <ColorGroup editor={editor} />
        <span className="mx-0.5 h-6 w-px bg-divider" aria-hidden="true" />
        <HeadingGroup editor={editor} />
        {menuState.listSelected && (
          <>
            <span className="mx-0.5 h-6 w-px bg-divider" aria-hidden="true" />
            <ListIndentControls editor={editor} />
          </>
        )}
      </BubbleMenu>

    </>
  )
}
