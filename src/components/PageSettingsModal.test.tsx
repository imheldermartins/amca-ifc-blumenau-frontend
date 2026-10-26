import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
vi.mock('@/pages/access/AccessMembersPanel', () => ({ AccessMembersPanel: ({scope,id,onMembersChanged}:{scope:string;id:string;onMembersChanged?:()=>void}) => <div data-testid="members-panel" data-scope={scope} data-id={id}><button onClick={onMembersChanged}>Atualizar colaboradores</button></div> }))
import { PageSettingsContent, type PageSettingsFragment, type PageSettingsContentProps } from './PageSettingsModal'
afterEach(() => cleanup())
function props(overrides: Partial<PageSettingsContentProps> = {}): PageSettingsContentProps {
  return { initialFragment: '#collaborators', onFragmentChange: vi.fn(), pageId: 'page-1', pageTitle: 'Planejamento', ...overrides }
}
describe('PageSettingsContent', () => {
  it('offers PDF generation from the page menu, including when member management is unavailable', () => {
    const onSelect = vi.fn()
    render(<PageSettingsContent {...props({ showCollaborators: false, pdfAction: { label: 'Gerar PDF', onSelect } })} />)
    expect(screen.queryByRole('tab', { name: 'Colaboradores' })).toBeNull()
    expect(screen.queryByTestId('members-panel')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Gerar PDF em Lote' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Gerar PDF da página selecionada' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Gerar PDF' }))
    expect(onSelect).toHaveBeenCalledOnce()
  })
  it('abre o mesmo painel da listagem no escopo da página e repassa atualizações', () => {
    const onFragmentChange = vi.fn<(fragment: PageSettingsFragment) => void>(), onMembersChanged = vi.fn()
    render(<PageSettingsContent {...props({ onFragmentChange, onMembersChanged })} />)
    const panel = screen.getByRole('tabpanel')
    expect(within(panel).getByRole('heading', { name: 'Colaboradores' })).toBeTruthy()
    expect(screen.getByTestId('members-panel').dataset).toMatchObject({ scope: 'page', id: 'page-1' })
    fireEvent.click(screen.getByRole('button', { name: 'Atualizar colaboradores' }))
    expect(onMembersChanged).toHaveBeenCalledOnce()
    fireEvent.click(screen.getByRole('tab', { name: 'Geral' }))
    expect(onFragmentChange).toHaveBeenCalledWith('#general')
  })
  it('preserva a seção geral e não carrega o painel de colaboradores nela', () => {
    render(<PageSettingsContent {...props({ initialFragment: '#general' })} />)
    expect(within(screen.getByRole('tabpanel')).getByText('Planejamento')).toBeTruthy()
    expect(screen.getByText('page-1')).toBeTruthy()
    expect(screen.queryByTestId('members-panel')).toBeNull()
  })
  it('troca o escopo do painel quando a página muda', () => {
    const { rerender } = render(<PageSettingsContent {...props()} />)
    rerender(<PageSettingsContent {...props({ pageId: 'page-2' })} />)
    expect(screen.getByTestId('members-panel').dataset.id).toBe('page-2')
  })
})
