import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react'
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest'
import {FormulaDrawer} from './FormulaDrawer'
import {FormulaResult} from '@/shared/cubs-database/components/FormulaResult'
const api=vi.hoisted(()=>({get:vi.fn(),post:vi.fn(),put:vi.fn()}))
vi.mock('@/services/ApiService',()=>({apiService:api}))
const columnId='01M00000000000000000000001', propertyId='01M00000000000000000000002'
const catalog=[{id:propertyId,name:'Total',type:'numeric',databaseId:'base'}]
beforeEach(()=>{vi.clearAllMocks();api.get.mockResolvedValue(catalog);api.post.mockImplementation(async (_url,body)=>({id:columnId,name:'Fórmula',type:'formula',data:{formula:{...body.formula,revision:1}}}));api.put.mockImplementation(async (_url,body)=>({id:columnId,name:'Fórmula',type:'formula',data:{formula:{...body.formula,revision:2}}}))})
afterEach(cleanup)
const editor=()=>screen.getByRole('textbox',{name:'Expressão da fórmula'}) as HTMLTextAreaElement
describe('Formula drawer',()=>{
  it('flushes valid code on blur immediately without waiting for the debounce',async()=>{
    render(<FormulaDrawer pageId="base" target={{}} onClose={vi.fn()} onSaved={vi.fn()}/>)
    await waitFor(()=>expect(editor().disabled).toBe(false))
    fireEvent.change(editor(),{target:{value:'@Total + 2'}})
    fireEvent.blur(editor())
    expect(api.post).toHaveBeenCalledTimes(1)
    expect(api.post.mock.calls[0][1].formula.source).toBe(`@columns.${propertyId} + 2`)
    await waitFor(()=>expect(screen.getByRole('status').textContent).toBe('Salva automaticamente'))
  })
  it('inserts a function immediately with focus inside parentheses',async()=>{
    render(<FormulaDrawer pageId="base" target={{}} onClose={vi.fn()} onSaved={vi.fn()}/>)
    await waitFor(()=>expect(editor().disabled).toBe(false))
    fireEvent.click(screen.getByRole('button',{name:/^if\(condição/}))
    await waitFor(()=>expect(editor().selectionStart).toBe(3))
    expect(editor().value).toBe('if()');expect(document.activeElement).toBe(editor());expect(api.post).not.toHaveBeenCalled()
  })
  it('canonicalizes references and saves valid code automatically',async()=>{
    const saved=vi.fn();render(<FormulaDrawer pageId="base" target={{}} onClose={vi.fn()} onSaved={saved}/>)
    await waitFor(()=>expect(editor().disabled).toBe(false))
    fireEvent.change(editor(),{target:{value:'@Total + 1'}})
    await waitFor(()=>expect(api.post).toHaveBeenCalledTimes(1),{timeout:2000})
    expect(api.post.mock.calls[0][1].formula.source).toBe(`@columns.${propertyId} + 1`)
    expect(saved).toHaveBeenCalledTimes(1)
    expect(screen.getByLabelText('Tipagem e referências').textContent).toContain('number')
  })
  it('keeps invalid drafts from replacing the saved definition and allows closing',async()=>{
    const close=vi.fn();render(<FormulaDrawer pageId="base" target={{column:{id:columnId,title:'Fórmula',type:'formula',formula:{version:1,source:'1',revision:1}}}} onClose={close} onSaved={vi.fn()}/>)
    await waitFor(()=>expect(editor().value).toBe('1'))
    fireEvent.change(editor(),{target:{value:'1 / 0'}})
    fireEvent.click(screen.getByRole('button',{name:'Fechar editor'}))
    await waitFor(()=>expect(close).toHaveBeenCalled())
    expect(api.put).not.toHaveBeenCalled();expect(screen.getByRole('status').textContent).toContain('última fórmula salva')
  })
  it('flushes valid edits before closing and supplies the expected revision',async()=>{
    const close=vi.fn();render(<FormulaDrawer pageId="base" target={{column:{id:columnId,title:'Fórmula',type:'formula',formula:{version:1,source:'1',revision:5}}}} onClose={close} onSaved={vi.fn()}/>)
    await waitFor(()=>expect(editor().value).toBe('1'))
    fireEvent.change(editor(),{target:{value:'2'}});fireEvent.click(screen.getByRole('button',{name:'Fechar editor'}))
    await waitFor(()=>expect(close).toHaveBeenCalled())
    expect(api.put.mock.calls[0][1].formula).toEqual({version:1,source:'2',expectedRevision:5})
  })
  it('preview input edits affect only the preview',async()=>{
    render(<FormulaDrawer pageId="base" target={{column:{id:columnId,title:'Fórmula',type:'formula',formula:{version:1,source:`@columns.${propertyId} + 1`,revision:1}}}} onClose={vi.fn()} onSaved={vi.fn()}/>)
    const sample=await screen.findByRole('textbox',{name:'Total'})
    fireEvent.change(sample,{target:{value:'40'}})
    expect(screen.getByLabelText('Resultado da prévia').textContent).toBe('41');expect(api.put).not.toHaveBeenCalled()
  })
  it('keeps valid unsaved code open if the server rejects the save',async()=>{
    api.post.mockRejectedValue(new Error('Falha de rede'))
    const close=vi.fn();render(<FormulaDrawer pageId="base" target={{}} onClose={close} onSaved={vi.fn()}/>)
    await waitFor(()=>expect(editor().disabled).toBe(false))
    fireEvent.change(editor(),{target:{value:'2'}});fireEvent.click(screen.getByRole('button',{name:'Fechar editor'}))
    await waitFor(()=>expect(screen.getByRole('status').textContent).toBe('Falha de rede'))
    expect(close).not.toHaveBeenCalled();expect(editor().value).toBe('2')
    fireEvent.click(screen.getByRole('button',{name:'Fechar e manter rascunho'}));expect(close).toHaveBeenCalledOnce()
  })
  it('renders markup as escaped text, never HTML',()=>{
    const {container}=render(<FormulaResult value={{kind:'markup',value:'<img src=x onerror=alert(1)>',color:'purple'}} />)
    expect(container.querySelector('img')).toBeNull();expect(container.textContent).toContain('<img')
  })
})
