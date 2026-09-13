import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react'
import {QueryClient,QueryClientProvider} from '@tanstack/react-query'
import {beforeEach,afterEach,describe,it,expect,vi} from 'vitest'
const mocks=vi.hoisted(()=>({navigate:vi.fn(),listOrganizations:vi.fn(),createOrganization:vi.fn(),get:vi.fn(),request:vi.fn()}))
vi.mock('@tanstack/react-router',()=>({useNavigate:()=>mocks.navigate,useParams:()=>({lang:'pt-br',organizationId:'org'})}))
vi.mock('@/contexts/AuthContext',()=>({useAuth:()=>({user:{id:'person',name:'Pessoa convidada',email:'person@example.test'}})}))
vi.mock('@/services/WorkspaceService',()=>({workspaceService:mocks}))
vi.mock('@/services/ApiService',()=>({apiService:{get:mocks.get}}))
vi.mock('@/services/AccessService',async original=>({...await original<typeof import('@/services/AccessService')>(),accessService:{request:mocks.request}}))
vi.mock('@iconify/react',()=>({Icon:({icon}:{icon:string})=><span data-testid="icon" data-icon={icon}/>}))
vi.mock('@/lib/i18n',()=>({i18n:(key:string)=>key}))
import {OrganizationsPage,OrganizationPage,NewOrganizationPage} from './OrganizationPages'
function mount(element:React.ReactNode){return render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false},mutations:{retry:false}}})}>{element}</QueryClientProvider>)}
beforeEach(()=>{
 vi.clearAllMocks()
 const org={id:'org',name:'Instituto Cub',permissions:{read:['view','workspaces'],write:[]}}
 mocks.listOrganizations.mockResolvedValue([org])
 mocks.get.mockImplementation(async(path:string)=>path.endsWith('/workspaces')?[{id:'wk',name:'Pesquisa',icon:'lucide:box',canEnter:false,isMember:false}]:org)
 mocks.request.mockResolvedValue({notificationPending:false})
 mocks.createOrganization.mockResolvedValue({id:'created'})
})
afterEach(cleanup)
describe('organizações',()=>{
 it('possui rota própria e não usa ícone na organização',async()=>{
  mount(<OrganizationsPage/>)
  expect(await screen.findByText('Instituto Cub')).toBeTruthy()
  expect(screen.queryByTestId('icon')).toBeNull()
  fireEvent.click(screen.getByRole('button',{name:'organization.open'}))
  expect(mocks.navigate).toHaveBeenCalledWith({href:'/pt-br/organizations/org'})
 })
 it('leitura do catálogo permite solicitar, sem conceder entrada ou gestão',async()=>{
  mount(<OrganizationPage/>)
  expect(await screen.findByText('Pesquisa')).toBeTruthy()
  expect(screen.getByTestId('icon').getAttribute('data-icon')).toBe('lucide:box')
  expect(screen.queryByRole('button',{name:'organization.enter'})).toBeNull()
  expect(screen.queryByRole('button',{name:'organization.new-workspace'})).toBeNull()
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
})
