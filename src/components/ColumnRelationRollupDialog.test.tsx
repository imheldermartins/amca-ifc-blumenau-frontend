import {cleanup, fireEvent, render, screen, waitFor} from '@testing-library/react'
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import {ColumnRelationRollupDialog} from './ColumnRelationRollupDialog'
import {RelationCellEditor} from '@/shared/cubs-database/components/cells/RelationCellEditor'
import type {HeaderCol} from 'cubs-database'

const api=vi.hoisted(()=>({listRelationDatabases:vi.fn(),getColumns:vi.fn()}))
vi.mock('@/services/DatabaseService',()=>({databaseService:api}))
beforeEach(()=>{
  vi.clearAllMocks()
  api.listRelationDatabases.mockResolvedValue({items:[{id:'target',title:'Pedidos'}],nextCursor:null})
  api.getColumns.mockResolvedValue([])
})
afterEach(cleanup)
const column: HeaderCol={id:'relation',title:'Pedidos',type:'relation',relation:{version:1,targetDatabaseId:'target',cardinality:'one'}}

describe('Relation settings and cells',()=>{
  it('preserves the current destination and limit when reopening or searching other databases',async()=>{
    api.listRelationDatabases.mockResolvedValue({items:[{id:'another',title:'Outra base'}],nextCursor:null})
    const save=vi.fn().mockResolvedValue(undefined)
    render(<ColumnRelationRollupDialog target={{mode:'update',type:'relation',columnId:column.id}} workspaceId="workspace"
      columns={[column]} onSave={save} onClose={vi.fn()}/>)
    await waitFor(()=>expect(api.listRelationDatabases).toHaveBeenCalled())
    expect(screen.getByRole('combobox',{name:'Limite de páginas'}).textContent).toContain('Uma página')
    fireEvent.click(screen.getByRole('button',{name:'Salvar'}))
    await waitFor(()=>expect(save).toHaveBeenCalled())
    expect(save.mock.calls[0][1]).toEqual({relation:{version:1,targetDatabaseId:'target',cardinality:'one',bidirectional:false}})
  })
  it('creates an inverse only after the user enables it and names the destination property',async()=>{
    const save=vi.fn().mockResolvedValue(undefined)
    render(<ColumnRelationRollupDialog target={{mode:'create',type:'relation'}} workspaceId="workspace"
      columns={[]} onSave={save} onClose={vi.fn()}/>)
    await waitFor(()=>expect((screen.getByRole('button',{name:'Salvar'}) as HTMLButtonElement).disabled).toBe(false))
    expect(screen.queryByRole('textbox',{name:'Propriedade no destino'})).toBeNull()
    fireEvent.click(screen.getByRole('switch',{name:'Mostrar no destino'}))
    fireEvent.change(screen.getByRole('textbox',{name:'Propriedade no destino'}),{target:{value:'Clientes'}})
    fireEvent.click(screen.getByRole('button',{name:'Salvar'}))
    await waitFor(()=>expect(save).toHaveBeenCalled())
    expect(save.mock.calls[0][1]).toEqual({relation:{version:1,targetDatabaseId:'target',cardinality:'many',bidirectional:true,inverseName:'Clientes',inverseCardinality:'many'}})
  })
  it('keeps the editor open with the server error if existing values prevent a limit change',async()=>{
    const close=vi.fn(), save=vi.fn().mockRejectedValue(new Error('Existem células com várias páginas.'))
    render(<ColumnRelationRollupDialog target={{mode:'update',type:'relation',columnId:column.id}} workspaceId="workspace"
      columns={[column]} onSave={save} onClose={close}/>)
    await waitFor(()=>expect((screen.getByRole('button',{name:'Salvar'}) as HTMLButtonElement).disabled).toBe(false))
    fireEvent.click(screen.getByRole('button',{name:'Salvar'}))
    expect((await screen.findByRole('alert')).textContent).toContain('Existem células com várias páginas.')
    expect(close).not.toHaveBeenCalled()
  })
  it('replaces a selected page for a one-page relation and appends for a many-page relation',async()=>{
    const commit=vi.fn()
    const options={a:{id:'a',title:'Primeiro'},b:{id:'b',title:'Segundo'}}
    const loadRelationOptions=vi.fn().mockResolvedValue({items:Object.values(options),nextCursor:null})
    const props={rowId:'row',column:{...column,relationTargets:options,loadRelationOptions},value:['a'],onCommit:commit}
    const {rerender}=render(<RelationCellEditor {...props}/>)
    fireEvent.click(screen.getByRole('button',{name:'Pedidos'}))
    fireEvent.click(await screen.findByRole('button',{name:'Segundo'}))
    expect(commit).toHaveBeenLastCalledWith(['b'])
    rerender(<RelationCellEditor {...props} column={{...props.column,relation:{...column.relation!,cardinality:'many'}}}/>)
    fireEvent.click(screen.getByRole('button',{name:'Segundo'}))
    expect(commit).toHaveBeenLastCalledWith(['a','b'])
  })
})
