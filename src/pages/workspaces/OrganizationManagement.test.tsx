import { render } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({navigate: vi.fn()}))
vi.mock('@tanstack/react-router', () => ({useNavigate: () => mocks.navigate, useParams: () => ({lang: 'pt-br'})}))
import { OrganizationManagement } from './OrganizationManagement'
it('leva o favorito da antiga aba à rota própria da organização e marca a saída', () => {
  const onLeave = vi.fn()
  render(<OrganizationManagement onLeave={onLeave}/>)
  expect(onLeave).toHaveBeenCalledOnce()
  expect(mocks.navigate).toHaveBeenCalledWith({href: '/pt-br/organizations', replace: true})
  expect(onLeave.mock.invocationCallOrder[0]).toBeLessThan(mocks.navigate.mock.invocationCallOrder[0])
})
