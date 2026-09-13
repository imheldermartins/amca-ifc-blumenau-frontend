import { useEffect } from 'react'
import { useNavigate, useParams } from '@tanstack/react-router'
/** Redireciona favoritos da antiga aba para a área própria de organizações. */
export function OrganizationManagement({onLeave}:{onLeave?:()=>void}) {
  const navigate=useNavigate();const {lang}=useParams({strict:false})
  useEffect(()=>{onLeave?.();void navigate({href:'/'+(lang??'pt-br')+'/organizations',replace:true})},[lang,navigate,onLeave])
  return null
}
