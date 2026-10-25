import { apiService } from './ApiService'
import type { MentionCatalog, MentionScope } from '@/shared/mentions'

export const mentionService = {
  catalog(scope: MentionScope): Promise<MentionCatalog> {
    const query = new URLSearchParams(Object.entries(scope).filter((entry): entry is [string, string] => Boolean(entry[1])))
    return apiService.get<MentionCatalog>(`/mentions?${query}`)
  },
  resolve(scope: MentionScope, ids: string[]): Promise<Record<string, string | null>> {
    return apiService.post('/mentions/resolve', { scope, ids })
  },
}
