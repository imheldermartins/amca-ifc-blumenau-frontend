import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/contexts/AuthContext'
import { accessService } from '@/services/AccessService'
export function usePageAccess(pageId:string|undefined) {
  const {user}=useAuth()
  return useQuery({queryKey:['access',user?.id,'page',pageId,'current'],queryFn:()=>accessService.current('page',pageId!),enabled:Boolean(pageId&&user),retry:false})
}
