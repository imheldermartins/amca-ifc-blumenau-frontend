import { useEffect } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useLanguage } from '@/contexts/LanguageContext'
/** Redireciona favoritos da antiga aba para a área própria de organizações. */
export function OrganizationManagement({onLeave}:{onLeave?:()=>void}) {
  const navigate=useNavigate();const {slug:lang}=useLanguage()
  useEffect(()=>{onLeave?.();void navigate({href:'/'+lang+'/organizations',replace:true})},[lang,navigate,onLeave])
  return null
}
