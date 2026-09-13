import { useWatch } from 'react-hook-form'
import { SwitchAccordion } from 'cubs-components'
import { i18n } from '@/lib/i18n'
import { type AccessScope, type Permissions } from '@/services/AccessService'
export function PermissionFields({scope,catalog,ceiling,disabled=false}: {scope:AccessScope;catalog:Permissions;ceiling:Permissions;disabled?:boolean}) {
  const update = useWatch({name:'write.update'})
  const label = (kind: string, action: string) => i18n('access.permission.'+scope+'.'+kind+'.'+action)
  const field = (kind: keyof Permissions, action: string) => <SwitchAccordion key={kind+action} name={kind+'.'+action}
    label={label(kind,action)} disabled={disabled || !ceiling[kind].includes(action)} />
  return <SwitchAccordion name="read.view" label={label('read','view')} disabled={disabled || !ceiling.read.includes('view')}>
    {catalog.read.filter(action=>!['view','subpages'].includes(action)).map(action=>field('read',action))}
    {scope==='page' && <SwitchAccordion name="read.subpages" label={label('read','subpages')} disabled={disabled || !ceiling.read.includes('subpages')}>
      <SwitchAccordion name="write.edit_subpages" label={label('write','edit_subpages')} description={i18n('access.subpages-help')}
        disabled={disabled || !update || !ceiling.write.includes('edit_subpages')} />
    </SwitchAccordion>}
    {catalog.write.filter(action=>action!=='edit_subpages').map(action=>field('write',action))}
  </SwitchAccordion>
}
export function permissionDefaults(permissions:Permissions) {
  return {read:Object.fromEntries(permissions.read.map(action=>[action,true])),write:Object.fromEntries(permissions.write.map(action=>[action,true]))}
}
export function permissionsFromFields(value:{read:Record<string,boolean>;write:Record<string,boolean>}):Permissions {
  if(!value.read.view) return {read:[],write:[]}
  return {read:Object.keys(value.read).filter(key=>value.read[key]),write:Object.keys(value.write).filter(key=>value.write[key] && (key!=='edit_subpages' || (value.read.subpages && value.write.update)))}
}
