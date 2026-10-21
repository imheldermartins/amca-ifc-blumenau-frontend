import {useEffect,useMemo,useRef,useState} from 'react'
import {Drawer,TextField} from 'cubs-components'
import {apiService} from '@/services/ApiService'
import type {ApiPageColumn} from '@/lib/databaseParser'
import type {HeaderCol} from 'cubs-database'
import {compileFormula,evaluateFormula,displaySource,completionContext,tokenize,typeKey,operations,type FormulaSymbol,type FormulaPage} from '@/shared/formula-engine'
import {FormulaResult} from '@/shared/cubs-database/components/FormulaResult'
import './formula-editor.css'

export type FormulaTarget={column?:HeaderCol}
interface Props {pageId:string;target:FormulaTarget|null;onClose:()=>void;onSaved:(column:ApiPageColumn)=>void}
const label=(symbol:FormulaSymbol,rooted=false)=>`@${rooted?'root.':''}${symbol.id==='title'?'page.title':`{${symbol.name}}`}`

export function FormulaDrawer({pageId,target,onClose,onSaved}:Props){
  const [catalog,setCatalog]=useState<FormulaSymbol[]>([])
  const [source,setSource]=useState('')
  const [caret,setCaret]=useState(0)
  const [search,setSearch]=useState('')
  const [status,setStatus]=useState('')
  const [saveFailed,setSaveFailed]=useState(false)
  const [ready,setReady]=useState(false)
  const [samples,setSamples]=useState<Record<string,string>>({})
  const editor=useRef<HTMLTextAreaElement>(null)
  const highlight=useRef<HTMLPreElement>(null)
  const session=useRef({id:'',revision:undefined as number|undefined,saved:'',generation:0})
  const latest=useRef({source:'',catalog:[] as FormulaSymbol[],ready:false})
  const saving=useRef<Promise<boolean>|null>(null)
  const draft=useRef(new Map<string,string>())
  const savedCallback=useRef(onSaved);savedCallback.current=onSaved
  const open=Boolean(target)
  const draftKey=`${pageId}:${target?.column?.id??'new'}`

  useEffect(()=>{
    if(!target)return
    let active=true
    const generation=++session.current.generation
    setReady(false);setSaveFailed(false);setStatus('Carregando referências…');setSearch('');setSamples({})
    session.current={id:target.column?.id??'',revision:target.column?.formula?.revision,saved:target.column?.formula?.source??'',generation}
    void apiService.get<FormulaSymbol[]>(`/pages/parent/${pageId}/formula/catalog`).then(items=>{
      if(!active)return
      setCatalog(items)
      setSource(draft.current.get(draftKey)??displaySource(target.column?.formula?.source??'',items))
      setReady(true);setStatus(target.column?.formula?'Salva':'Escreva uma fórmula')
    }).catch(error=>{if(active)setStatus(error instanceof Error?error.message:'Não foi possível carregar as referências')})
    return()=>{active=false;session.current.generation++}
  },[target,pageId,draftKey])
  latest.current={source,catalog,ready}
  const compiled=useMemo(()=>compileFormula(source,{catalog,databaseId:pageId,...(session.current.id&&{columnId:session.current.id})}),[source,catalog,pageId])
  const currentDb=completionContext(source,caret,{catalog,databaseId:pageId})
  const properties=[{id:'title',name:'Título da página',type:'text',databaseId:currentDb},...catalog.filter(c=>c.databaseId===currentDb&&c.id!==session.current.id&&!['date','flow'].includes(c.type))]
  const rootProperties=currentDb!==pageId?[{id:'title',name:'Título da página',type:'text',databaseId:pageId},...catalog.filter(c=>c.databaseId===pageId&&c.id!==session.current.id&&!['date','flow'].includes(c.type))]:[]

  const save=async():Promise<boolean>=>{
    if(saving.current){if(!await saving.current)return false;return save()}
    const current=latest.current, state=session.current
    if(!current.ready)return true
    const result=compileFormula(current.source,{catalog:current.catalog,databaseId:pageId,...(state.id&&{columnId:state.id})})
    if(!result.ok || result.canonicalSource===state.saved)return true
    const generation=state.generation
    setStatus('Salvando…');setSaveFailed(false)
    const work=(async()=>{
      try{
        const formula={version:1,source:result.canonicalSource,...(state.revision!==undefined&&{expectedRevision:state.revision})}
        const column=state.id
          ? await apiService.put<ApiPageColumn>(`/pages/parent/${pageId}/columns/${state.id}`,{type:'formula',formula})
          : await apiService.post<ApiPageColumn>(`/pages/parent/${pageId}/columns`,{type:'formula',name:'Fórmula',formula})
        if(session.current.generation!==generation)return false
        session.current={...state,id:column.id,revision:column.data?.formula?.revision,saved:column.data?.formula?.source??result.canonicalSource}
        savedCallback.current(column)
        if(latest.current.source===current.source)setStatus('Salva automaticamente')
        return true
      }catch(error){if(session.current.generation===generation){setSaveFailed(true);setStatus(error instanceof Error?error.message:'Não foi possível salvar a fórmula')}return false}
    })()
    saving.current=work
    const success=await work
    saving.current=null
    return success
  }
  const saveRef=useRef(save);saveRef.current=save
  useEffect(()=>{
    if(!open||!ready)return
    draft.current.set(draftKey,source)
    const timer=setTimeout(()=>{void saveRef.current()},650)
    return()=>clearTimeout(timer)
  },[source,open,ready,draftKey])
  const close=async()=>{if(!await saveRef.current())return;if(!target?.column)draft.current.delete(draftKey);onClose()}
  const reference=(symbol:FormulaSymbol,rooted=false)=>symbol.id==='title'?label(symbol,rooted):displaySource(`@${rooted?'root.':''}columns.${symbol.id}`,catalog)
  const insert=(text:string,inside=false)=>{
    const element=editor.current
    const start=element?.selectionStart??caret,end=element?.selectionEnd??caret
    const chain=inside&&start===end&&/[)\w}]$/.test(source.slice(0,start))&&!/\s$/.test(source.slice(0,start))?'.':''
    const addition=chain+text
    setSource(source.slice(0,start)+addition+source.slice(end))
    const position=start+addition.length-(inside?1:0)
    setCaret(position)
    requestAnimationFrame(()=>{element?.focus();element?.setSelectionRange(position,position)})
  }
  const fragments=useMemo(()=>{
    let end=0;const pieces=[]
    let tokens:ReturnType<typeof tokenize>=[]
    try{tokens=tokenize(source,true)}catch{ /* Source limit is displayed by compilation. */ }
    for(const token of tokens){
      if(token.kind==='eof')continue
      pieces.push(source.slice(end,token.start))
      pieces.push(<span key={token.start} className={`formula-token-${token.kind}`}>{source.slice(token.start,token.end)}</span>);end=token.end
    }
    pieces.push(source.slice(end)+'\n');return pieces
  },[source])
  const references=compiled.ok?[...new Map(compiled.references.map(ref=>[`${ref.symbol.databaseId}:${ref.symbol.id}`,ref])).values()]:[]
  const preview=useMemo(()=>{
    if(!compiled.ok)return null
    const pages:Record<string,FormulaPage>={}
    const databases=new Set([pageId,...catalog.map(c=>c.databaseId),...catalog.flatMap(c=>c.targetDatabaseId?[c.targetDatabaseId]:[])])
    for(const db of databases){
      const values:Record<string,unknown>={}
      for(const symbol of catalog.filter(c=>c.databaseId===db)){
        const raw=samples[symbol.id]??''
        values[symbol.id]=symbol.type==='relation'?[`preview:${symbol.targetDatabaseId}`]:['numeric','extract_as'].includes(symbol.type)?(raw===''?0:Number(raw)):symbol.type==='checkbox'?raw==='true':symbol.type==='select'?symbol.options?.find(o=>o.value===raw)?.id??null:raw
      }
      pages[`preview:${db}`]={id:`preview:${db}`,databaseId:db,title:samples[`title:${db}`]??'',values}
    }
    return evaluateFormula(compiled,{pageId:`preview:${pageId}`,pages})
  },[compiled,catalog,pageId,samples])
  const matches=(text:string)=>text.toLocaleLowerCase().includes(search.toLocaleLowerCase())

  return <Drawer open={open} onOpenChange={value=>{if(!value)void close()}} accessibleTitle="Editar fórmula" closeLabel="Fechar editor" panelClassName="w-full sm:w-[min(640px,90vw)]" className="flex flex-col gap-4 overflow-hidden">
    <div><h2 className="text-lg font-semibold">{target?.column?.title||'Fórmula'}</h2><p className="text-xs opacity-60">Use @ para mencionar propriedades.</p></div>
    <div className="formula-editor shrink-0">
      <pre ref={highlight} aria-hidden="true">{fragments}</pre>
      <textarea ref={editor} aria-label="Expressão da fórmula" value={source} spellCheck={false} autoComplete="off" disabled={!ready} onChange={event=>{latest.current={...latest.current,source:event.target.value};setSource(event.target.value);setCaret(event.target.selectionStart)}} onBlur={()=>{void saveRef.current()}} onSelect={event=>setCaret(event.currentTarget.selectionStart)} onScroll={event=>{if(highlight.current){highlight.current.scrollTop=event.currentTarget.scrollTop;highlight.current.scrollLeft=event.currentTarget.scrollLeft}}} />
    </div>
    <div className="flex shrink-0 flex-wrap items-center gap-2 text-xs" aria-label="Tipagem e referências">
      <span className="rounded-md bg-p-purple/10 px-2 py-1 text-p-purple">{compiled.ok?typeKey(compiled.valueType):'Expressão incompleta'}</span>
      {references.map(ref=><button type="button" key={`${ref.symbol.databaseId}:${ref.symbol.id}`} className="rounded-md border border-divider px-2 py-1" onClick={()=>{editor.current?.focus();editor.current?.setSelectionRange(ref.start,ref.end)}}>{source.slice(ref.start,ref.end)}</button>)}
    </div>
    <div className="shrink-0 text-xs" role="status">{ready&&!compiled.ok&&source.trim()?<span className="text-p-orange-600">{compiled.diagnostics[0]?.message} A última fórmula salva continua ativa.</span>:status}</div>
    {saveFailed?<button type="button" className="shrink-0 self-start text-xs underline" onClick={onClose}>Fechar e manter rascunho</button>:null}
    {compiled.ok?<div className="max-h-52 shrink-0 overflow-y-auto rounded-lg border border-divider p-3">
      <p className="mb-2 text-xs font-medium">Prévia <span className="font-normal opacity-50">• valores temporários</span></p>
      <div className="grid grid-cols-2 gap-2">{references.filter(ref=>!['formula','relation'].includes(ref.symbol.type)).map(ref=>{
        const key=ref.symbol.title?`title:${ref.symbol.databaseId}`:ref.symbol.id
        return <TextField key={key} size="sm" label={ref.symbol.name} value={samples[key]??''} placeholder={ref.symbol.type==='numeric'?'0':ref.symbol.type==='checkbox'?'true / false':'Texto'} onChange={event=>setSamples(current=>({...current,[key]:event.target.value}))}/>
      })}</div>
      <div className="mt-3 flex min-h-8 items-center rounded-md bg-contrast px-2" aria-label="Resultado da prévia"><FormulaResult value={preview?.ok?preview.value:preview?{kind:'formula-error',message:preview.error.message}:null}/></div>
    </div>:null}
    <TextField size="sm" aria-label="Buscar referências" placeholder="Buscar propriedades e funções…" value={search} onChange={event=>setSearch(event.target.value)}/>
    <div className="min-h-24 flex-1 overflow-y-scroll overscroll-contain" aria-label="Referências disponíveis">
      <p className="mb-2 text-xs font-semibold opacity-50">Propriedades</p>
      {properties.filter(item=>matches(item.name)).map(item=><button type="button" key={item.id} className="formula-reference" onMouseDown={event=>event.preventDefault()} onClick={()=>insert(reference(item))}><span>{label(item)}</span><small>{item.type}</small></button>)}
      {rootProperties.filter(item=>matches(item.name)).map(item=><button type="button" key={`root:${item.id}`} className="formula-reference" onMouseDown={event=>event.preventDefault()} onClick={()=>insert(reference(item,true))}><span>{label(item,true)}</span><small>{item.type}</small></button>)}
      <p className="mb-2 mt-4 text-xs font-semibold opacity-50">Funções</p>
      {operations.filter(item=>matches(item.name+' '+item.description)).map(item=><button type="button" key={item.name} className="formula-reference" onMouseDown={event=>event.preventDefault()} onClick={()=>insert(`${item.name}()`,true)}><span><b className="font-mono text-p-purple">{item.syntax}</b><small className="mt-1 block">{item.description}</small></span><span className="opacity-40">+</span></button>)}
    </div>
  </Drawer>
}
