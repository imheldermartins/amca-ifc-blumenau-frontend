import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MentionTextField, type MentionInputConfig } from './MentionTextField'

const id = 'workspace:01M00000000000000000000001:data.campaign'
const token = `@{${id}}`
const config: MentionInputConfig = {
  options: [{ id, label: 'Campanha', value: 'Outono', section: 'Workspace' }], token: (id) => `@{${id}}`,
  resolve: (value) => value.replace(token, 'Outono'), label: 'Variáveis', empty: 'Sem opções',
}
function Harness({ initial = '', mentions = config, commit = () => undefined }: { initial?: string; mentions?: MentionInputConfig; commit?: (value: string) => void }) {
  const [value, setValue] = useState(initial)
  return <MentionTextField aria-label="Título" value={value} onValueChange={setValue} mentions={mentions} onBlur={() => commit(value)} />
}
afterEach(cleanup)
describe('mention title input', () => {
  it('keeps ordinary masked input formatted when mentions are enabled', () => {
    const change = vi.fn()
    render(<MentionTextField value="" onValueChange={change} mentions={config} mask="cpf" />)
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '12345678901' } })
    expect(change).toHaveBeenCalledWith('123.456.789-01')
  })
  it('inserts and saves a reference on selection, preserving focus until the actual blur', async () => {
    const commit = vi.fn(); render(<Harness commit={commit} />)
    const input = screen.getByRole('combobox') as HTMLInputElement
    act(() => input.focus()); fireEvent.change(input, { target: { value: '@Camp' } })
    const option = screen.getByRole('option', { name: 'Campanha Outono' })
    fireEvent.mouseDown(option); fireEvent.click(option)
    expect(commit).not.toHaveBeenCalled(); expect(input.value).toBe(token)
    await act(() => new Promise((resolve) => requestAnimationFrame(resolve)))
    act(() => input.blur())
    expect(commit).toHaveBeenCalledWith(token); expect(input.value).toBe('Outono')
  })
  it('updates the visible value after a variable changes without rewriting the template', () => {
    const commit = vi.fn(); const view = render(<Harness initial={token} commit={commit} />)
    expect((screen.getByRole('combobox') as HTMLInputElement).value).toBe('Outono')
    view.rerender(<Harness initial={token} commit={commit} mentions={{ ...config, resolve: (value) => value.replace(token, 'Verão') }} />)
    const input = screen.getByRole('combobox') as HTMLInputElement
    expect(input.value).toBe('Verão'); expect(commit).not.toHaveBeenCalled()
    act(() => input.focus()); expect(input.value).toBe(token)
  })
  it('uses Enter to select and Escape to dismiss instead of blurring the field', () => {
    const commit = vi.fn(); render(<Harness commit={commit} />)
    const input = screen.getByRole('combobox') as HTMLInputElement
    act(() => input.focus()); fireEvent.change(input, { target: { value: '@' } }); fireEvent.keyDown(input, { key: 'Escape' })
    expect(screen.queryByRole('listbox')).toBeNull(); expect(commit).not.toHaveBeenCalled()
    fireEvent.change(input, { target: { value: '@Cam' } }); fireEvent.keyDown(input, { key: 'Enter' })
    expect(input.value).toBe(token); expect(commit).not.toHaveBeenCalled()
  })
})
