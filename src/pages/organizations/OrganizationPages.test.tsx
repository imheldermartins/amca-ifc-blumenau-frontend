import {cleanup,fireEvent,render,screen,waitFor,within} from '@testing-library/react'
import {QueryClient,QueryClientProvider} from '@tanstack/react-query'
import {beforeEach,afterEach,describe,it,expect,vi} from 'vitest'
const mocks=vi.hoisted(()=>({navigate:vi.fn(),listOrganizations:vi.fn(),listMine:vi.fn(),create:vi.fn(),createOrganization:vi.fn(),get:vi.fn(),request:vi.fn()}))
vi.mock('@tanstack/react-router',()=>({useNavigate:()=>mocks.navigate,useParams:()=>({lang:'pt-br',organizationId:'org'})}))
vi.mock('@/contexts/AuthContext',()=>({useAuth:()=>({user:{id:'person',name:'Pessoa convidada',email:'person@example.test'}})}))
vi.mock('@/services/WorkspaceService',()=>({workspaceService:mocks}))
vi.mock('@/services/ApiService',()=>({apiService:{get:mocks.get}}))
vi.mock('@/services/AccessService',async original=>({...await original<typeof import('@/services/AccessService')>(),accessService:{request:mocks.request}}))
vi.mock('@iconify/react',()=>({Icon:({icon}:{icon:string})=><span data-testid="icon" data-icon={icon}/>}))
vi.mock('@/lib/i18n',()=>({DEFAULT_LANGUAGE:{slug:'pt-br'},i18n:(key:string)=>key}))
import {OrganizationsPage,OrganizationPage,NewOrganizationPage} from './OrganizationPages'
import { workspaceQueryKey, workspacesQueryKey } from '@/lib/workspaceQueryKeys'
import { currentWorkspaceSession } from '@/lib/currentWorkspaceSession'
import { workspacePreference } from '@/lib/workspacePreference'
function mount(element:React.ReactNode){
 const queryClient=new QueryClient({defaultOptions:{queries:{retry:false},mutations:{retry:false}}})
 return {...render(<QueryClientProvider client={queryClient}>{element}</QueryClientProvider>),queryClient}
}
beforeEach(()=>{
 vi.clearAllMocks()
 window.localStorage.clear()
 const org={id:'org',name:'Instituto Cub',permissions:{read:['view','workspaces'],write:[]}}
 mocks.listOrganizations.mockResolvedValue([org])
 mocks.listMine.mockResolvedValue([])
 mocks.get.mockImplementation(async(path:string)=>path.endsWith('/workspaces')?[{id:'wk',name:'Pesquisa',icon:'lucide:box',canEnter:false,isMember:false}]:org)
 mocks.request.mockResolvedValue({notificationPending:false})
 mocks.createOrganization.mockResolvedValue({id:'created'})
})
afterEach(cleanup)
describe('organizações',()=>{
 it('possui rota própria e não usa ícone na organização',async()=>{
  mount(<OrganizationsPage/>)
  const organizationName = await screen.findByText('Instituto Cub')
  expect(within(organizationName.closest('li')!).queryByTestId('icon')).toBeNull()
  fireEvent.click(screen.getByRole('button',{name:'organization.open'}))
  expect(mocks.navigate).toHaveBeenCalledWith({href:'/pt-br/organizations/org'})
 })
 it('leitura do catálogo permite solicitar, sem conceder entrada ou gestão',async()=>{
  mocks.listMine.mockResolvedValue([{
   id:'wk',name:'Pesquisa',icon:'lucide:box',owner:{id:'person',name:'Pessoa',email:'person@example.test'},
   permissions:{read:['view'],write:['update']},
  }])
  mount(<OrganizationPage organizationId="org"/>)
  expect(await screen.findByText('Pesquisa')).toBeTruthy()
  expect(within(document.querySelector('[data-workspace-card="wk"]') as HTMLElement).getByTestId('icon').getAttribute('data-icon')).toBe('lucide:box')
  expect(screen.queryByRole('button',{name:'organization.enter'})).toBeNull()
  expect(screen.queryByRole('button',{name:'organization.new-workspace'})).toBeNull()
  expect(screen.queryByRole('switch')).toBeNull()
  expect(screen.queryByRole('button',{name:'pages.workspaces.selector.settings'})).toBeNull()
  fireEvent.click(screen.getByRole('button',{name:'organization.request'}))
  await waitFor(()=>expect(mocks.request).toHaveBeenCalledWith('workspace','wk'))
  expect(await screen.findByRole('button',{name:'organization.requested'})).toBeTruthy()
 })
 it('cria pela conta validada e segue ao resultado da API',async()=>{
  mount(<NewOrganizationPage/>)
  expect(screen.getByText('person@example.test')).toBeTruthy()
  fireEvent.change(screen.getByLabelText('organization.name'),{target:{value:'Nova organização'}})
  fireEvent.click(screen.getByRole('button',{name:'organization.create'}))
  await waitFor(()=>expect(mocks.createOrganization).toHaveBeenCalledWith({name:'Nova organização'}))
  await waitFor(()=>expect(mocks.navigate).toHaveBeenCalledWith({href:'/pt-br/organizations/created'}))
 })

 it('cria na organização aberta sem sair dos detalhes e atualiza o grid e os caches',async()=>{
  const org={id:'org',name:'Instituto Cub',permissions:{read:['view','workspaces'],write:['create']}}
  mocks.get.mockImplementation(async(path:string)=>path.endsWith('/workspaces')?[]:org)
  const workspace={
   id:'created-workspace',name:'Equipe nova',icon:'lucide:box',data:{},organizationId:'org',organizationName:'Instituto Cub',
   isPersonal:false,isMember:true,owner:{id:'person',name:'Pessoa',email:'person@example.test'},
   permissions:{read:['view'],write:['update']},pageRootId:'created-workspace',
  }
  mocks.create.mockResolvedValue(workspace)
  const {queryClient}=mount(<OrganizationPage organizationId="org"/>)
  await screen.findByText('organization.empty-workspaces')
  fireEvent.click(screen.getByRole('button',{name:'organization.new-workspace'}))
  const dialog=screen.getByRole('dialog')
  const organization=within(dialog).getByRole('combobox')
  expect(organization.textContent).toContain('Instituto Cub')
  expect((organization as HTMLButtonElement).disabled).toBe(true)
  fireEvent.change(within(dialog).getByRole('textbox',{name:'pages.workspaces.access.name'}),{target:{value:'Equipe nova'}})
  fireEvent.click(within(dialog).getByRole('button',{name:'pages.workspaces.access.create'}))
  await screen.findByRole('heading',{name:'Equipe nova'})
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(mocks.create).toHaveBeenCalledWith({name:'Equipe nova',organizationId:'org'})
  expect(mocks.listOrganizations).not.toHaveBeenCalled()
  expect(mocks.navigate).not.toHaveBeenCalled()
  expect(queryClient.getQueryData(workspacesQueryKey('person'))).toEqual([workspace])
  expect(queryClient.getQueryData(workspaceQueryKey('person','created-workspace'))).toEqual(workspace)
  expect(queryClient.getQueryData(['organization-workspaces','person','org'])).toEqual([
   {id:'created-workspace',name:'Equipe nova',icon:'lucide:box',canEnter:true,isMember:true},
  ])
 })

 it('reutiliza preferências e configurações somente para workspaces com entrada e permissão',async()=>{
  const admin={
   id:'wk',name:'Pesquisa',icon:'lucide:box',owner:{id:'person',name:'Pessoa',email:'person@example.test'},
   permissions:{read:['view'],write:['update']},
  }
  mocks.listMine.mockResolvedValue([admin,{...admin,id:'reader',name:'Leitura',permissions:{read:['view'],write:[]}}])
  mocks.get.mockImplementation(async(path:string)=>path.endsWith('/workspaces')?[
   {id:'wk',name:'Pesquisa',icon:'lucide:box',canEnter:true,isMember:true},
   {id:'reader',name:'Leitura',icon:'lucide:box',canEnter:true,isMember:true},
  ]:{id:'org',name:'Instituto Cub',permissions:{read:['view','workspaces'],write:[]}})
  mount(<OrganizationPage organizationId="org"/>)
  await screen.findAllByRole('switch')
  const editable=within(document.querySelector('[data-workspace-card="wk"]') as HTMLElement)
  const reader=within(document.querySelector('[data-workspace-card="reader"]') as HTMLElement)
  expect(reader.queryByRole('button',{name:'pages.workspaces.selector.settings'})).toBeNull()
  fireEvent.click(reader.getByRole('switch'))
  expect(workspacePreference.get('person')).toBe('reader')
  fireEvent.click(editable.getByRole('switch'))
  expect(workspacePreference.get('person')).toBe('wk')
  expect(reader.getByRole('switch').getAttribute('aria-checked')).toBe('false')
  fireEvent.click(editable.getByRole('button',{name:'pages.workspaces.selector.settings'}))
  expect(mocks.navigate).toHaveBeenCalledWith({to:'/$lang/workspaces/$workspaceId/settings/general',params:{lang:'pt-br',workspaceId:'wk'}})
  expect(currentWorkspaceSession.get('person')).toBe('wk')
  fireEvent.click(reader.getByRole('button',{name:'pages.workspaces.selector.enter'}))
  expect(mocks.navigate).toHaveBeenCalledWith({to:'/$lang/workspace/$workspaceId',params:{lang:'pt-br',workspaceId:'reader'}})
 })

 it('mantém o catálogo privado quando a organização não concede sua leitura',async()=>{
  mocks.get.mockResolvedValue({id:'org',name:'Instituto Cub',permissions:{read:['view'],write:[]}})
  mount(<OrganizationPage organizationId="org"/>)
  await screen.findByRole('heading',{name:'Instituto Cub'})
  expect(mocks.get).toHaveBeenCalledTimes(1)
  expect(mocks.listMine).not.toHaveBeenCalled()
  expect(screen.queryByRole('region',{name:'organization.workspaces'})).toBeNull()
  expect(screen.queryByRole('button',{name:'organization.new-workspace'})).toBeNull()
 })
})
