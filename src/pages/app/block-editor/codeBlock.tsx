import { CodeBlockLowlight } from '@tiptap/extension-code-block-lowlight'
import { NodeViewContent, NodeViewWrapper, ReactNodeViewRenderer, type NodeViewProps } from '@tiptap/react'
import { all, createLowlight } from 'lowlight'

import { i18n } from '@/lib/i18n'

export const codeLowlight = createLowlight(all)
const LABELS: Record<string, string> = { c: 'C', csharp: 'C#', cpp: 'C++', javascript: 'JavaScript', typescript: 'TypeScript', html: 'HTML', xml: 'XML' }
export const CODE_LANGUAGES = [...new Set([...codeLowlight.listLanguages(), ...Object.keys(LABELS).filter((name) => codeLowlight.registered(name))])]
  .sort().map((value) => ({ value, label: LABELS[value] ?? value }))

function CodeBlockView({ node, updateAttributes }: NodeViewProps) {
  const language = typeof node.attrs.language === 'string' ? node.attrs.language : 'plaintext'
  return <NodeViewWrapper className="cubs-editor-code-block">
    <div contentEditable={false} className="flex justify-end border-b border-divider px-3 py-1.5">
      <select aria-label={i18n('pages.block-editor.code.language')} value={language}
        className="max-w-full rounded bg-background px-2 py-1 text-xs"
        onChange={(event) => updateAttributes({ language: event.target.value })}>
        {!CODE_LANGUAGES.some((option) => option.value === language) && <option value={language}>{language}</option>}
        {CODE_LANGUAGES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </div>
    <pre><NodeViewContent<'code'> as="code" className={`language-${language}`} style={{ whiteSpace: 'pre' }} /></pre>
  </NodeViewWrapper>
}

export const EditorCodeBlock = CodeBlockLowlight.extend({
  addNodeView() { return ReactNodeViewRenderer(CodeBlockView) },
}).configure({ lowlight: codeLowlight, defaultLanguage: 'plaintext', enableTabIndentation: true })
