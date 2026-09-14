import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams } from '@tanstack/react-router'
import { FormProvider, useForm } from 'react-hook-form'
import { useEffect, useState, type ReactNode } from 'react'
import { Button, Select, TextField } from 'cubs-components'
import { Typography } from '@/components/Typography'
import { ContextBackButton } from '@/components/ContextBackButton'
import { useAuth } from '@/contexts/AuthContext'
import { useWorkspace } from '@/contexts/WorkspaceContext'
import { useQueryParams } from '@/hooks/useQueryParams'
import { i18n } from '@/lib/i18n'
import { validators, combineRules } from '@/lib/validators'
import { accessService, can, canDelegate, rolePermission, type AccessScope, type AccessRole, type Permissions, type ScopeAccess } from '@/services/AccessService'
import { workspaceService } from '@/services/WorkspaceService'
import { PermissionFields, permissionDefaults, permissionsFromFields } from './PermissionFields'
const empty:Permissions={read:[],write:[]}
const roleLabel=(role:AccessRole)=>role.isDefault?i18n('access.default-role'):role.name
const withWorkspace=(href:string,workspaceId:string|null)=>workspaceId ? href+(href.includes('?')?'&':'?')+'workspace='+encodeURIComponent(workspaceId) : href
export function useAccessScope() {
  const params=useParams({strict:false})
  return {scope:params.scope as AccessScope,id:params.scopeId ?? '',lang:params.lang ?? 'pt-br',memberId:params.memberId,requestId:params.requestId}
}
export function useScopeData(scope:AccessScope,id:string) {
  const {user}=useAuth()
  const key=['access',user?.id,scope,id]
  const access=useQuery({queryKey:[...key,'current'],queryFn:()=>accessService.current(scope,id),retry:false})
  const catalog=useQuery({queryKey:['permission-catalog'],queryFn:accessService.catalog})
  const roles=useQuery({queryKey:[...key,'roles'],queryFn:()=>accessService.roles(scope,id),enabled:Boolean(access.data && (can(access.data,'read','roles') || [rolePermission[scope],'add_members','promote_members'].some(p=>can(access.data,'write',p))))})
  return {key,access,catalog,roles}
}
export function AccessFrame({scope,id,title,children}:{scope:AccessScope;id:string;title:string;children:ReactNode}) {
  const {lang}=useParams({strict:false});const navigate=useNavigate()
  const workspace=useWorkspace()
  const {access}=useScopeData(scope,id)
  const home=scope==='organization' ? '/'+lang+'/organizations/'+id : scope==='workspace' ? '/'+lang+'/workspaces/'+id+'/settings/members' : withWorkspace('/'+lang+'/page/'+id,workspace.workspaceId)
  const sections=[['', 'members',can(access.data,'read','members') || can(access.data,'write','add_members') || can(access.data,'write','promote_members')],
    ['/roles','roles',can(access.data,'read','roles') || can(access.data,'write',rolePermission[scope])],['/requests','requests',true]] as const
  return <main className="min-h-dvh bg-background px-5 py-8 text-foreground"><section className="mx-auto max-w-3xl">
    <ContextBackButton fallback={home} label={i18n('access.back')} />
    <Typography variant="caption" as="p" className="mt-6 text-foreground/60">{i18n('access.scope.'+scope)}</Typography>
    <Typography variant="h1">{title}</Typography>
    <nav aria-label={i18n('access.navigation')} className="my-6 flex gap-2 border-b border-divider pb-3">
      {sections.filter(([, , visible])=>visible).map(([path,label])=><Button key={path} variant="text" color="from-theme" onClick={()=>navigate({href:withWorkspace('/'+lang+'/access/'+scope+'/'+id+path,scope==='page'?workspace.workspaceId:null)})}>{i18n('access.'+label)}</Button>)}
    </nav>{children}</section></main>
}
export function Feedback({error=false,message}:{error?:boolean;message?:string}) {
  return <Typography variant="body" as="p" role={error?'alert':'status'} className={error?'my-4 text-p-red':'my-4 text-foreground/65'}>{message ?? i18n(error?'access.error':'common.carregando')}</Typography>
}
export function AccessMembersPage({scope:providedScope,id:providedId,embedded=false}:{scope?:AccessScope;id?:string;embedded?:boolean}={}) {
  const current=useAccessScope();const scope=providedScope??current.scope,id=providedId??current.id
  const {key,access,roles}=useScopeData(scope,id);const navigate=useNavigate();const workspace=useWorkspace()
  const members=useQuery({queryKey:[...key,'members'],queryFn:()=>accessService.members(scope,id)})
  const content=<>
    {embedded && <nav aria-label={i18n('access.navigation')} className="mb-5 flex gap-3">
      {(can(access.data,'read','roles') || can(access.data,'write',rolePermission[scope])) && <Button variant="text" color="purple" onClick={()=>navigate({href:'/'+current.lang+'/access/'+scope+'/'+id+'/roles'})}>{i18n('access.roles')}</Button>}
      <Button variant="text" color="from-theme" onClick={()=>navigate({href:'/'+current.lang+'/access/'+scope+'/'+id+'/requests'})}>{i18n('access.requests')}</Button>
    </nav>}
    {members.isPending?<Feedback/>:members.isError?<Feedback error/>:<ul className="divide-y divide-divider">
      {members.data.map(member=><li key={member.id} className="flex items-center justify-between gap-4 py-4">
        <div className="min-w-0"><Typography variant="subtitle" as="p" className="truncate">{member.name||member.email}</Typography>
          <Typography variant="caption" as="p" className="text-foreground/60">{member.email} · {member.id===access.data?.ownerId?i18n('access.owner'):member.roleName||i18n('access.no-role')}</Typography></div>
        <Button variant="text" color="purple" onClick={()=>navigate({href:withWorkspace('/'+current.lang+'/access/'+scope+'/'+id+'/member/'+member.id,scope==='page'?workspace.workspaceId:null)})}>{i18n('access.permissions')}</Button>
      </li>)}
      {!members.data.length&&<Feedback message={i18n('access.empty-members')}/>}
    </ul>}
    {can(access.data,'write','add_members')&&<InviteManager scope={scope} id={id} access={access.data} roles={roles.data??[]} queryKey={key}/>}
  </>
  return embedded?content:<AccessFrame scope={scope} id={id} title={i18n('access.members')}>{content}</AccessFrame>
}

function InviteManager({scope,id,access,roles,queryKey}:{scope:AccessScope;id:string;access?:ScopeAccess;roles:AccessRole[];queryKey:unknown[]}) {
  const queryClient=useQueryClient();const [link,setLink]=useState<string|null>(null)
  const form=useForm({defaultValues:{kind:'email',email:'',roleId:'',expiresIn:'24h',limitMode:'unlimited',customLimit:'2'}})
  const kind=form.watch('kind'),limitMode=form.watch('limitMode')
  const search=useMutation({mutationFn:(email:string)=>accessService.searchEmail(scope,id,email)})
  const create=useMutation({mutationFn:(value:{kind:string;email:string;roleId:string;expiresIn:string;limitMode:string;customLimit:string})=>accessService.createInvite(scope,id,{
    ...(value.kind==='email'?{recipientEmail:value.email.trim().toLowerCase()}:{recipientEmail:null}),
    ...(value.roleId?{roleId:value.roleId}:{}),
    expiresIn:value.expiresIn as '24h'|'7d'|'never',
    acceptanceLimit:value.kind==='email'||value.limitMode==='one'?1:value.limitMode==='custom'?Number(value.customLimit):null,
  }),onSuccess:async result=>{setLink(result.inviteUrl);search.reset();await queryClient.invalidateQueries({queryKey:[...queryKey,'invites']})}})
  const invites=useQuery({queryKey:[...queryKey,'invites'],queryFn:()=>accessService.invites(scope,id)})
  const expire=useMutation({mutationFn:(inviteId:string)=>accessService.removeInvite(scope,id,inviteId),onSuccess:()=>queryClient.invalidateQueries({queryKey:[...queryKey,'invites']})})
  const availableRoles=roles.filter(role=>canDelegate(access,role.roles))
  const roleOptions=availableRoles.map(role=>({value:role.id,label:roleLabel(role)}))
  const defaultRoleId=availableRoles.find(role=>role.isDefault)?.id
  useEffect(()=>{if(!form.getValues('roleId')&&defaultRoleId)form.setValue('roleId',defaultRoleId)},[defaultRoleId,form])
  return <section className="mt-8 rounded-xl border border-divider p-5">
    <Typography variant="h3">{i18n('access.invite-title')}</Typography>
    <FormProvider {...form}><form className="mt-4 flex flex-col gap-4" onSubmit={form.handleSubmit(value=>create.mutate(value))}>
      <Select name="kind" label={i18n('access.invite-type')} options={[{value:'email',label:i18n('access.invite-email')},{value:'link',label:i18n('access.invite-link')}]}/>
      {kind==='email'&&<div className="flex items-end gap-2"><TextField className="flex-1" name="email" label={i18n('access.email')} type="email" rules={combineRules(validators.required(),validators.email())} onChange={()=>search.reset()}/>
        <Button variant="outlined" color="purple" disabled={search.isPending} onClick={()=>void form.trigger('email').then(ok=>ok&&search.mutate(form.getValues('email')))}>{i18n('access.search-email')}</Button></div>}
      {kind==='email'&&search.data&&<Feedback message={search.data.isMember?i18n('access.already-member'):search.data.found?i18n('access.registered-email'):i18n('access.unregistered-email')}/>}
      <Select name="roleId" label={i18n('access.role')} options={roleOptions} rules={validators.required()}/>
      <div className="grid gap-4 sm:grid-cols-2"><Select name="expiresIn" label={i18n('access.expiration')} options={[{value:'24h',label:'24 horas'},{value:'7d',label:'7 dias'},{value:'never',label:i18n('access.no-expiration')}]}/>
        {kind==='link'&&<Select name="limitMode" label={i18n('access.acceptance-limit')} options={[{value:'unlimited',label:i18n('access.unlimited')},{value:'one',label:'1'},{value:'custom',label:i18n('access.custom')}]}/>}</div>
      {kind==='link'&&limitMode==='custom'&&<TextField name="customLimit" type="number" min={1} max={100000} label={i18n('access.custom-limit')} rules={validators.required()}/>}
      <Button type="submit" variant="filled" color="purple" disabled={create.isPending||!roleOptions.length||(kind==='email'&&!search.data)||Boolean(search.data?.isMember)}>{kind==='email'?i18n('access.send-invite'):i18n('access.create-link')}</Button>
      {create.data?.notificationPending&&<Feedback message={i18n('access.notification-pending')}/>} {create.isError&&<Feedback error/>}
    </form></FormProvider>
    {link&&<div className="mt-5 flex items-center gap-2 rounded-lg bg-active p-3"><code className="min-w-0 flex-1 truncate text-xs">{link}</code><Button variant="text" color="purple" onClick={()=>void navigator.clipboard.writeText(link)}>{i18n('access.copy-link')}</Button></div>}
    {!!invites.data?.length&&<div className="mt-7"><Typography variant="subtitle" as="h4">{i18n('access.active-invites')}</Typography><ul className="mt-2 divide-y divide-divider">{invites.data.map(invite=><li key={invite.id} className="flex items-center justify-between gap-3 py-3"><div className="min-w-0"><p className="truncate text-sm font-medium">{invite.recipientEmail??i18n('access.generic-link')} · {invite.roleName}</p><p className="text-xs text-foreground/60">{invite.acceptanceCount}/{invite.acceptanceLimit??'∞'} · {i18n('access.status.'+invite.status)}</p></div>{invite.status==='pending'&&<Button variant="text" color="red" disabled={expire.isPending} onClick={()=>expire.mutate(invite.id)}>{i18n('access.expire-link')}</Button>}</li>)}</ul></div>}
  </section>
}
export function MemberPermissionsPage() {
  const {scope,id,memberId,lang}=useAccessScope();const {key,access,roles,catalog}=useScopeData(scope,id);const queryClient=useQueryClient();const navigate=useNavigate()
  const workspace=useWorkspace()
  const member=useQuery({queryKey:[...key,'member',memberId],queryFn:()=>accessService.member(scope,id,memberId!)})
  const form=useForm({defaultValues:{roleId:''}})
  useEffect(()=>{if(member.data)form.reset({roleId:member.data.roleId??''})},[member.data,form])
  const linkedRole=roles.data?.find(role=>role.id===member.data?.roleId)
  const editLinkedRole=!member.data?.access?.isOwner && linkedRole && can(access.data,'write',rolePermission[scope]) && canDelegate(access.data,linkedRole.roles)
  const assign=useMutation({mutationFn:(value:{roleId:string})=>accessService.assign(scope,id,member.data!.id,value.roleId),
    onSuccess:()=>queryClient.invalidateQueries({queryKey:key})})
  return <AccessFrame scope={scope} id={id} title={member.data?.name||member.data?.email||i18n('access.permissions')}>
    {member.isPending?<Feedback/>:member.isError?<Feedback error/>:<>
      <Typography variant="body" as="p" className="text-foreground/60">{member.data.email}</Typography>
      {member.data.access?.isOwner?<Feedback message={i18n('access.owner-help')}/>:<FormProvider {...form}><form className="my-6 flex items-end gap-3" onSubmit={form.handleSubmit(value=>assign.mutate(value))}>
        <Select name="roleId" label={i18n('access.role')} className="flex-1" options={(roles.data??[]).filter(role=>canDelegate(access.data,role.roles)).map(role=>({value:role.id,label:roleLabel(role)}))} rules={validators.required()} disabled={!can(access.data,'write','promote_members')}/>
        {can(access.data,'write','promote_members')&&<Button type="submit" variant="filled" color="purple" disabled={assign.isPending}>{i18n('access.save')}</Button>}
      </form></FormProvider>}
      <Typography variant="h3" className="mt-6">{i18n(editLinkedRole?'access.template-permissions':'access.effective-permissions')}</Typography>
      {catalog.data && (editLinkedRole && access.data
        ? <RoleEditor key={linkedRole.id} scope={scope} id={id} role={linkedRole} access={access.data} catalog={catalog.data[scope]} queryKey={key}/>
        : <ReadPermissions key={JSON.stringify(member.data.access?.permissions)} scope={scope} catalog={catalog.data[scope]} permissions={member.data.access?.permissions??empty}/>)}
      {!member.data.access?.isOwner&&member.data.roleId&&can(access.data,'write',rolePermission[scope])&&<Button variant="text" color="purple" onClick={()=>navigate({href:withWorkspace('/'+lang+'/access/'+scope+'/'+id+'/roles?role='+member.data.roleId,scope==='page'?workspace.workspaceId:null)})}>{i18n('access.edit-template')}</Button>}
      {assign.isError&&<Feedback error/>}{assign.isSuccess&&<Feedback message={i18n('access.saved')}/>}
    </>}
  </AccessFrame>
}
function ReadPermissions({scope,catalog,permissions}:{scope:AccessScope;catalog:Permissions;permissions:Permissions}) {
  const form=useForm({defaultValues:permissionDefaults(permissions)})
  return <FormProvider {...form}><PermissionFields scope={scope} catalog={catalog} ceiling={catalog} disabled/></FormProvider>
}
export function RolesPage() {
  const {scope,id}=useAccessScope();const {key,access,roles,catalog}=useScopeData(scope,id)
  const [showOrganizationRoles,setShowOrganizationRoles]=useState(false);const queryClient=useQueryClient()
  const query=useQueryParams<'role'>();const selected=roles.data?.find(role=>role.id===query.get('role'))
  const workspace=useQuery({queryKey:['workspace',id,'scope-kind'],queryFn:()=>workspaceService.getWorkspace(id),enabled:scope==='workspace'})
  const canShowOrganizationRoles=scope==='workspace'&&workspace.data?.isPersonal===false
  useEffect(()=>{if(!canShowOrganizationRoles&&showOrganizationRoles)setShowOrganizationRoles(false)},[canShowOrganizationRoles,showOrganizationRoles])
  const organizationRoles=useQuery({queryKey:[...key,'organization-workspace-roles'],queryFn:()=>accessService.organizationWorkspaceRoles(id),enabled:canShowOrganizationRoles&&showOrganizationRoles})
  const copy=useMutation({mutationFn:(roleId:string)=>accessService.copyWorkspaceRole(id,roleId),onSuccess:async saved=>{await queryClient.invalidateQueries({queryKey:[...key,'roles']});query.set('role',saved.id)}})
  return <AccessFrame scope={scope} id={id} title={i18n('access.roles')}>
    {roles.isError?<Feedback error/>:!access.data||!catalog.data?<Feedback/>:<>
      <div className="flex items-end gap-2"><Select className="flex-1" label={i18n('access.template')} value={query.get('role')??'new'} options={[{value:'new',label:i18n('access.new-role')},...(roles.data??[]).map(role=>({value:role.id,label:roleLabel(role)}))]} onValueChange={value=>query.set('role',value)}/>
        {canShowOrganizationRoles&&<Button variant="outlined" color="from-theme" onClick={()=>setShowOrganizationRoles(value=>!value)}>{showOrganizationRoles?i18n('access.hide-org-roles'):i18n('access.show-org-roles')}</Button>}</div>
      {canShowOrganizationRoles&&showOrganizationRoles&&<div className="mt-4 rounded-xl border border-divider p-4"><Typography variant="subtitle" as="h3">{i18n('access.organization-workspace-roles')}</Typography><p className="mt-1 text-sm text-foreground/60">{i18n('access.organization-workspace-roles-help')}</p><ul className="mt-3 divide-y divide-divider">{organizationRoles.data?.filter(role=>role.workspaceId!==id).map(role=><li key={role.id} className="flex items-center justify-between gap-3 py-3"><span className="text-sm">{roleLabel(role)} · {role.workspaceName}</span><Button variant="text" color="purple" disabled={copy.isPending} onClick={()=>copy.mutate(role.id)}>{i18n('access.copy-to-workspace')}</Button></li>)}</ul></div>}
      <RoleEditor key={selected?.id??'new'} scope={scope} id={id} role={selected} access={access.data} catalog={catalog.data[scope]} queryKey={key}/>
    </>}
  </AccessFrame>
}
function RoleEditor({scope,id,role,access,catalog,queryKey}:{scope:AccessScope;id:string;role?:AccessRole;access:ScopeAccess;catalog:Permissions;queryKey:unknown[]}) {
  const form=useForm({defaultValues:{name:role?.name??'',...permissionDefaults(role?.roles??{read:['view'],write:[]})}})
  const queryClient=useQueryClient();const query=useQueryParams<'role'>()
  const editable=can(access,'write',rolePermission[scope]) && (!role || canDelegate(access,role.roles))
  const save=useMutation({mutationFn:(value:{name:string;read:Record<string,boolean>;write:Record<string,boolean>})=>accessService.saveRole(scope,id,{name:value.name,roles:permissionsFromFields(value),...(role&&{id:role.id,expectedUpdatedAt:role.updated_at})}),
    onSuccess:async saved=>{await queryClient.invalidateQueries({queryKey});query.set('role',saved.id)}})
  const remove=useMutation({mutationFn:()=>accessService.removeRole(scope,id,role!.id),onSuccess:async()=>{await queryClient.invalidateQueries({queryKey});query.set('role','new')}})
  return <FormProvider {...form}><form className="mt-6" onSubmit={form.handleSubmit(value=>save.mutate(value))}>
    <TextField name="name" label={i18n('access.role-name')} rules={{...validators.required(),maxLength:120}} disabled={!editable}/>
    {role&&<Feedback message={i18n('access.shared-template-help')}/>}
    <PermissionFields scope={scope} catalog={catalog} ceiling={access.permissions} disabled={!editable}/>
    {editable&&<div className="mt-6 flex gap-3"><Button type="submit" variant="filled" color="purple" disabled={save.isPending}>{i18n('access.save')}</Button>{role&&!role.isDefault&&!role.systemKey&&<Button variant="text" color="red" disabled={remove.isPending} onClick={()=>remove.mutate()}>{i18n('access.delete-role')}</Button>}</div>}
    {role?.isDefault&&<Feedback message={i18n('access.default-role-help')}/>} {(save.isError||remove.isError)&&<Feedback error/>}{save.isSuccess&&<Feedback message={i18n('access.saved')}/>}
  </form></FormProvider>
}
export function RequestsPage() {
  const {scope,id,requestId}=useAccessScope();const {key,access,roles}=useScopeData(scope,id);const queryClient=useQueryClient()
  const requests=useQuery({queryKey:[...key,'requests'],queryFn:()=>accessService.requests(scope,id)})
  const form=useForm({defaultValues:{roleId:''}})
  const availableRoles=(roles.data??[]).filter(role=>canDelegate(access.data,role.roles))
  const defaultRoleId=availableRoles.find(role=>role.isDefault)?.id
  useEffect(()=>{if(!form.getValues('roleId')&&defaultRoleId)form.setValue('roleId',defaultRoleId)},[defaultRoleId,form])
  const decision=useMutation({mutationFn:(input:{id:string;decision:string})=>accessService.decide(scope,id,input.id,input.decision,form.getValues('roleId')),
    onSuccess:()=>queryClient.invalidateQueries({queryKey:key})})
  return <AccessFrame scope={scope} id={id} title={i18n('access.requests')}>
    {requests.isPending?<Feedback/>:requests.isError?<Feedback error/>:<FormProvider {...form}>
      {can(access.data,'write','add_members')&&<Select name="roleId" label={i18n('access.role-on-accept')} options={availableRoles.map(role=>({value:role.id,label:roleLabel(role)}))}/>}
      <ul className="mt-5 divide-y divide-divider">{requests.data.filter(row=>!requestId||row.id===requestId).map(row=><li key={row.id} className="py-5">
        <Typography variant="subtitle" as="p">{row.requesterName||row.requesterEmail}</Typography>
        <Typography variant="body" as="p" className="text-foreground/60">{row.requesterEmail} · {i18n('access.status.'+row.status)}</Typography>
        {row.decidedAt&&<Typography variant="caption" as="p">{i18n('access.decided-at',{date:new Date(row.decidedAt).toLocaleString('pt-BR')})}</Typography>}
        {row.status==='pending'&&can(access.data,'write','add_members')&&<div className="mt-3 flex gap-3">
          <Button variant="filled" color="purple" disabled={decision.isPending||!form.watch('roleId')} onClick={()=>decision.mutate({id:row.id,decision:'accepted'})}>{i18n('access.accept')}</Button>
          <Button variant="text" color="from-theme" disabled={decision.isPending} onClick={()=>decision.mutate({id:row.id,decision:'rejected'})}>{i18n('access.reject')}</Button>
        </div>}
      </li>)}</ul>{!requests.data.length&&<Feedback message={i18n('access.empty-requests')}/>}
      {decision.isError&&<Feedback error/>}
    </FormProvider>}
  </AccessFrame>
}
