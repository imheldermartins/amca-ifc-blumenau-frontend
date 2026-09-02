import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { PageContentViewSwitcher } from './PageContentViewSwitcher'

const labels = {
  navigation: 'Visualização da página',
  files: 'Base',
  document: 'Documento',
  workflow: 'Workflow',
}

afterEach(() => cleanup())

describe('PageContentViewSwitcher', () => {
  it('expõe a view ativa e solicita a troca sem manter estado próprio', () => {
    const onValueChange = vi.fn()
    render(
      <PageContentViewSwitcher
        value="files"
        onValueChange={onValueChange}
        labels={labels}
      />,
    )

    expect(screen.getByRole('tab', { name: 'Base' }).getAttribute('aria-selected')).toBe('true')
    expect(screen.getByRole('tab', { name: 'Documento' }).getAttribute('aria-selected')).toBe(
      'false',
    )

    fireEvent.click(screen.getByRole('tab', { name: 'Workflow' }))
    expect(onValueChange).toHaveBeenCalledOnce()
    expect(onValueChange).toHaveBeenCalledWith('workflow')
  })
})
