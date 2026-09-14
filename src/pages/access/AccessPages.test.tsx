import {cleanup, fireEvent, render, screen, waitFor} from '@testing-library/react'
import {QueryClient, QueryClientProvider} from '@tanstack/react-query'
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
const mocks=vi.hoisted(()=>({current:vi.fn(),roles:vi.fn(),catalog:vi.fn(),member:vi.fn(),saveRole:vi.fn(),requests:vi.fn(),decide:vi.fn(),navigate:vi.fn(),querySet:vi.fn()}))
vi.mock('@tanstack/react-router',()=>({useNavigate:()=>mocks.navigate,useParams:()=>({lang:'pt-br',scope:'page',scopeId:'page',memberId:'owner',requestId:'request'}),useCanGoBack:()=>false,useRouter:()=>({history:{back:vi.fn()}})}))
vi.mock('@/contexts/AuthContext',()=>({useAuth:()=>({user:{id:'owner'}})}))
vi.mock('@/contexts/WorkspaceContext',()=>({useWorkspace:()=>({workspaceId:'workspace'})}))
vi.mock('@/hooks/useQueryParams',()=>({useQueryParams:()=>({get:()=>undefined,set:mocks.querySet})}))
vi.mock('@/lib/i18n',()=>({i18n:(key:string)=>key}))
vi.mock('@/services/AccessService',async original=>({...await original<typeof import('@/services/AccessService')>(),accessService:mocks}))
import {MemberPermissionsPage, RolesPage, RequestsPage} from './AccessPages'
const catalog={read:['view','subpages','members','roles'],write:['update','create','edit_subpages','delete','add_members','promote_members','create_page_roles']}
function mount(element:React.ReactNode){return render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false},mutations:{retry:false}}})}>{element}</QueryClientProvider>)}
beforeEach(()=>{
 vi.clearAllMocks()
 mocks.current.mockResolvedValue({scope:'page',scopeId:'page',isOwner:true,ownerId:'owner',permissions:catalog})
 mocks.catalog.mockResolvedValue({page:catalog})
 mocks.roles.mockResolvedValue([])
 mocks.saveRole.mockResolvedValue({id:'saved'})
 mocks.member.mockResolvedValue({id:'owner',name:'Pessoa owner',email:'owner@example.test',access:{isOwner:true,permissions:catalog}})
 mocks.requests.mockResolvedValue([{id:'request',requesterName:'Pessoa solicitante',requesterEmail:'reader@example.test',status:'pending'}])
})
afterEach(cleanup)
describe('telas de permissões',()=>{
 it('salva o template e limpa permissões dependentes quando a leitura é desligada',async()=>{
  mount(<RolesPage/>)
  fireEvent.change(await screen.findByLabelText('access.role-name'),{target:{value:'Leitura restrita'}})
  fireEvent.click(screen.getByRole('switch',{name:'access.permission.page.write.update'}))
  fireEvent.click(screen.getByRole('switch',{name:'access.permission.page.read.subpages'}))
  fireEvent.click(screen.getByRole('switch',{name:'access.permission.page.write.edit_subpages'}))
  fireEvent.click(screen.getByRole('switch',{name:'access.permission.page.read.view'}))
  expect(screen.queryByRole('switch',{name:'access.permission.page.write.update'})).toBeNull()
  fireEvent.click(screen.getByRole('button',{name:'access.save'}))
  await waitFor(()=>expect(mocks.saveRole).toHaveBeenCalledWith('page','page',{name:'Leitura restrita',roles:{read:[],write:[]}}))
 })
 it('desabilita a edição de subpáginas até autorizar edição da página',async()=>{
  mount(<RolesPage/>)
  fireEvent.click(await screen.findByRole('switch',{name:'access.permission.page.read.subpages'}))
  const child=screen.getByRole('switch',{name:'access.permission.page.write.edit_subpages'}) as HTMLInputElement
  expect(child.disabled).toBe(true)
  fireEvent.click(screen.getByRole('switch',{name:'access.permission.page.write.update'}))
  expect(child.disabled).toBe(false)
 })
 it('mostra a soberania do owner e não oferece troca de role',async()=>{
  mount(<MemberPermissionsPage/>)
  expect(await screen.findByText('access.owner-help')).toBeTruthy()
  expect(screen.queryByRole('button',{name:'access.save'})).toBeNull()
  expect(screen.queryByRole('combobox')).toBeNull()
  expect((screen.getByRole('switch',{name:'access.permission.page.read.view'}) as HTMLInputElement).disabled).toBe(true)
 })
 it('abrir o link de solicitação não aceita: a decisão precisa de um clique',async()=>{
  mount(<RequestsPage/>)
  expect(await screen.findByText('Pessoa solicitante')).toBeTruthy()
  expect(mocks.decide).not.toHaveBeenCalled()
  expect((screen.getByRole('button',{name:'access.accept'}) as HTMLButtonElement).disabled).toBe(true)
  fireEvent.click(screen.getByRole('button',{name:'access.reject'}))
  await waitFor(()=>expect(mocks.decide).toHaveBeenCalledWith('page','page','request','rejected',''))
 })
})
